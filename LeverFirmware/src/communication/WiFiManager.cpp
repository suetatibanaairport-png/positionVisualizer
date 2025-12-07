/**
 * WiFiManager.cpp - WiFi接続管理クラスの実装
 */

#include "WiFiManager.h"

//==========================================================================
// RealWiFiManager 実装
//==========================================================================

// コンストラクタ
RealWiFiManager::RealWiFiManager(uint16_t httpPort)
  : _webServer(httpPort),
    _networkStatus(DISCONNECTED),
    _lastStatusCheck(0),
    _discoveryEnabled(false),
    _rawValue(0),
    _calibratedValue(0),
    _isCalibrated(false),
    _minValue(0),
    _maxValue(1023),
    _errorCode(0),
    _reconnectAttemptCount(0), // 追加: 再接続カウンター初期化
    _lastReconnectAttempt(0) // 追加: 最終再接続時間の初期化
{
  _deviceId = "lever" + String(ESP.getChipId() & 0xFFFF, HEX); // チップIDからデフォルトのデバイスIDを生成
}

// デストラクタ
RealWiFiManager::~RealWiFiManager()
{
  _webServer.stop();
  _udp.stop();
}

// 初期化
void RealWiFiManager::begin()
{
  DEBUG_INFO("WiFiManager初期化開始");

  // WiFi設定の最適化
  WiFi.mode(WIFI_STA);
  WiFi.setSleepMode(WIFI_NONE_SLEEP);
  WiFi.setAutoReconnect(true);
  WiFi.persistent(true);  // 接続情報を永続化（フラッシュメモリに保存）

  // WiFi接続設定
  _wifiManager.setConfigPortalTimeout(180); // ポータルのタイムアウト時間（秒）
  _wifiManager.setDebugOutput(true);

  // デバイス名の設定（アクセスポイントモード時のSSID）
  String apName = "LeverSetup-" + _deviceId;

  // 設定済みの場合は自動接続を試み、未設定の場合はポータル起動
  DEBUG_INFO("WiFiManager autoConnectを開始...");
  if (_wifiManager.autoConnect(apName.c_str())) {
    // この時点でWiFiManagerが接続試行を行ったが、実際に接続されているかは別途確認

    bool connected = false;
    int attempts = 0;
    const int MAX_INIT_ATTEMPTS = 5; // 初期接続の最大試行回数

    DEBUG_INFO("WiFi接続確認開始...");

    while (!connected && attempts < MAX_INIT_ATTEMPTS) {
      attempts++;
      DEBUG_INFO("接続試行 " + String(attempts) + "/" + String(MAX_INIT_ATTEMPTS));

      // 1秒間のタイムアウトで接続を確認
      unsigned long startTime = millis();
      while (WiFi.status() != WL_CONNECTED && millis() - startTime < 1000) {
        yield(); // WiFiプロセスとWDTに時間を与える
        delay(10); // 最小限の遅延
      }

      if (WiFi.status() == WL_CONNECTED) {
        connected = true;
        _networkStatus = CONNECTED;
        _reconnectAttemptCount = 0;
        _lastReconnectAttempt = 0;

        // 詳細な接続情報をログ出力
        DEBUG_INFO("WiFi接続成功: " + WiFi.localIP().toString());
        DEBUG_INFO("ゲートウェイ: " + WiFi.gatewayIP().toString());
        DEBUG_INFO("サブネット: " + WiFi.subnetMask().toString());
        DEBUG_INFO("DNS: " + WiFi.dnsIP().toString());
        DEBUG_INFO("信号強度: " + String(WiFi.RSSI()) + " dBm");
        DEBUG_INFO("チャンネル: " + String(WiFi.channel()));
      } else {
        DEBUG_WARNING("WiFi接続試行 " + String(attempts) + " 失敗、再試行...");

        // Qiitaの方法による再接続
        WiFi.disconnect(false); // WiFi設定を保持しつつ切断
        yield();
        WiFi.begin(); // 保存済みの認証情報で再接続
      }
    }

    if (!connected) {
      _networkStatus = DISCONNECTED;
      DEBUG_WARNING("WiFi初期接続に失敗しました。通常動作を継続します。");
    }
  } else {
    // WiFiManagerのポータルがタイムアウト
    _networkStatus = DISCONNECTED;
    DEBUG_WARNING("WiFi設定ポータルがタイムアウトしました");
  }

  // HTTPサーバーのセットアップ
  setupHttpHandlers();
  _webServer.begin();
  DEBUG_INFO("HTTPサーバー開始: ポート " + String(_httpPort));

  // UDPサーバーの開始
  if (_udp.begin(UDP_DISCOVERY_PORT)) {
    DEBUG_INFO("UDPリスナー開始: ポート " + String(UDP_DISCOVERY_PORT));
  } else {
    DEBUG_ERROR("UDPリスナーの開始に失敗");
  }
}

// 定期的に呼び出して接続状態を更新する
void RealWiFiManager::update()
{
  // WiFi状態の更新（間隔を200msから2000msに延長）
  unsigned long currentMillis = millis();
  if (currentMillis - _lastStatusCheck > 2000) {  // 2秒間隔に変更
    _lastStatusCheck = currentMillis;

    // WiFiの状態チェック
    wl_status_t wifiStatus = WiFi.status();

    // 追加: WiFi状態の詳細ログ
    String statusText;
    switch (wifiStatus) {
      case WL_CONNECTED: statusText = "接続済み"; break;
      case WL_IDLE_STATUS: statusText = "アイドル"; break;
      case WL_NO_SSID_AVAIL: statusText = "SSID未発見"; break;
      case WL_CONNECT_FAILED: statusText = "接続失敗"; break;
      case WL_CONNECTION_LOST: statusText = "接続喪失"; break;
      case WL_DISCONNECTED: statusText = "未接続"; break;
      default: statusText = "不明(" + String(wifiStatus) + ")"; break;
    }

    // 状態変化時のみ出力
    static wl_status_t lastWifiStatus = (wl_status_t)-1;
    if (lastWifiStatus != wifiStatus) {
      DEBUG_INFO("WiFi状態変化: " + statusText + " (コード:" + String(wifiStatus) + ")");
      lastWifiStatus = wifiStatus;
    }

    if (wifiStatus == WL_CONNECTED) {
      // 接続状態
      if (_networkStatus != CONNECTED) {
        _networkStatus = CONNECTED;
        DEBUG_INFO("WiFi接続状態: 接続済み (" + WiFi.localIP().toString() + ")");
        DEBUG_INFO("信号強度: " + String(WiFi.RSSI()) + " dBm");
        // 両方のカウンターをリセット
        _reconnectAttemptCount = 0;
        _lastReconnectAttempt = 0;  // 追加: 最終再接続時間もリセット
      }

      // 定期的なRSSIモニタリング（30秒ごと）
      static unsigned long lastRssiCheck = 0;
      if (currentMillis - lastRssiCheck > 30000) {
        lastRssiCheck = currentMillis;
        int rssi = WiFi.RSSI();
        String quality = (rssi > -50) ? "優秀" : (rssi > -60) ? "良好" : (rssi > -70) ? "普通" : "弱い";
        DEBUG_INFO("WiFi信号強度: " + String(rssi) + " dBm (" + quality + ")");
      }
    } else {
      // 未接続状態
      if (_networkStatus != DISCONNECTED) {
        _networkStatus = DISCONNECTED;
        DEBUG_WARNING("WiFi接続状態: 未接続 (Status: " + String(wifiStatus) + ")");
      }

      // 再接続処理の改良（1秒間隔、10回試行後リセット）
      bool shouldAttemptReconnect = false;

      // 10回までは1秒間隔で試行
      if (_reconnectAttemptCount < 10) {
        // 1秒間隔で再接続を試行
        if (currentMillis - _lastReconnectAttempt > 1000) {  // 1秒間隔
          shouldAttemptReconnect = true;
        }
      } else {
        // 10回失敗した場合はシステムをリセット
        DEBUG_WARNING("10回の再接続試行に失敗しました。システムをリセットします");

        // 最終ステータスをログに残す
        DEBUG_WARNING("========= リセット前の状態 =========");
        DEBUG_WARNING("稼働時間: " + String(millis() / 1000) + "秒");
        DEBUG_WARNING("WiFi状態: " + String(WiFi.status()));
        DEBUG_WARNING("最終SSID: " + WiFi.SSID());
        DEBUG_WARNING("空きヒープ: " + String(ESP.getFreeHeap()) + "バイト");
        DEBUG_WARNING("=================================");

        // 少し待ってからリセット（ログが送信される時間を確保）
        delay(500);
        ESP.restart();  // ESP8266をソフトウェアリセット
      }

      if (shouldAttemptReconnect) {
        _lastReconnectAttempt = currentMillis;
        _reconnectAttemptCount++;

        DEBUG_INFO("WiFi再接続を試行 (" + String(_reconnectAttemptCount) + "/10)");

        // Qiitaの方法による確実な再接続
        WiFi.disconnect(false); // WiFi設定を保持しつつ切断
        yield(); // delay(100)をyieldに置き換え - ブロッキングを回避

        if (WiFi.reconnect()) {
          DEBUG_INFO("WiFi再接続要求が受理されました");

          // 再接続の即時確認（Qiitaの方法）- 非ブロッキング
          unsigned long reconnectStart = millis();
          bool quickCheck = false;

          // 最大500msの短い時間で接続成功するか確認
          while (millis() - reconnectStart < 500) {
            if (WiFi.status() == WL_CONNECTED) {
              quickCheck = true;
              DEBUG_INFO("WiFi再接続に成功しました（即時確認）");
              _networkStatus = CONNECTED;
              break;
            }
            yield(); // CPU時間を他の処理に譲る
          }

          if (!quickCheck) {
            DEBUG_INFO("WiFi再接続進行中...");
          }
        } else {
          DEBUG_WARNING("WiFi再接続要求が失敗しました");
        }
      }
    }
  }

  // HTTPリクエスト処理
  _webServer.handleClient();

  // UDPディスカバリーリクエスト処理
  if (_discoveryEnabled) {
    processUdpDiscovery();
  }
}

// WiFi接続状態を取得
NetworkStatus RealWiFiManager::getStatus()
{
  return _networkStatus;
}

// ローカルIPアドレスを取得
String RealWiFiManager::getLocalIP()
{
  if (_networkStatus == CONNECTED) {
    return WiFi.localIP().toString();
  }
  return "";
}

// デバイスIDを設定
void RealWiFiManager::setDeviceId(const String& deviceId)
{
  _deviceId = deviceId;
  DEBUG_INFO("デバイスIDを設定: " + _deviceId);
}

// デバイスIDを取得
String RealWiFiManager::getDeviceId()
{
  return _deviceId;
}

// API要求に対する応答を処理するコールバックを設定
void RealWiFiManager::setApiHandler(HttpRequestCallback handler)
{
  _apiHandler = handler;
}

// UDPディスカバリーを有効/無効にする
void RealWiFiManager::enableDiscovery(bool enable)
{
  _discoveryEnabled = enable;
  DEBUG_INFO("UDPディスカバリー: " + String(enable ? "有効" : "無効"));
}

// レバー値の更新を通知
void RealWiFiManager::updateLeverValue(int rawValue, int calibratedValue, bool isCalibrated,
                                      int minValue, int maxValue)
{
  _rawValue = rawValue;
  _calibratedValue = calibratedValue;
  _isCalibrated = isCalibrated;
  _minValue = minValue;
  _maxValue = maxValue;
}

// エラーコードを設定
void RealWiFiManager::setErrorCode(uint8_t errorCode)
{
  _errorCode = errorCode;
}

// WiFi設定をリセット
void RealWiFiManager::resetSettings()
{
  DEBUG_WARNING("WiFi設定をリセット");
  _wifiManager.resetSettings();
}

// 接続待ち
bool RealWiFiManager::waitForConnection(unsigned long timeout)
{
  DEBUG_INFO("WiFi接続待機開始（タイムアウト: " + String(timeout) + "ms）");

  unsigned long startTime = millis();
  bool connected = false;
  int attempts = 0;
  const int MAX_ATTEMPTS = 10; // 最大試行回数

  // 接続を試みる
  while (!connected && millis() - startTime < timeout && attempts < MAX_ATTEMPTS) {
    attempts++;
    DEBUG_INFO("接続確認 " + String(attempts) + "/" + String(MAX_ATTEMPTS));

    // 1秒間の短いタイムアウトで接続を確認
    unsigned long checkStart = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - checkStart < 1000) {
      yield(); // WiFiプロセスとWDTに時間を与える
      delay(10); // 最小限の遅延
    }

    if (WiFi.status() == WL_CONNECTED) {
      connected = true;
      _networkStatus = CONNECTED;
      _reconnectAttemptCount = 0;
      _lastReconnectAttempt = 0;

      // 詳細な接続情報をログ出力
      DEBUG_INFO("WiFi接続完了: " + WiFi.localIP().toString());
      DEBUG_INFO("信号強度: " + String(WiFi.RSSI()) + " dBm");

      return true;
    } else {
      DEBUG_WARNING("WiFi接続試行 " + String(attempts) + " 失敗、再試行...");

      // Qiitaの方法で即座に再接続
      WiFi.disconnect(false); // WiFi設定を保持しつつ切断
      yield();
      WiFi.begin(); // 保存済みの認証情報で再接続
    }
  }

  // タイムアウトまたは最大試行回数に達した
  if (!connected) {
    _networkStatus = CONNECTION_ERROR;

    if (millis() - startTime >= timeout) {
      DEBUG_WARNING("WiFi接続がタイムアウトしました（" + String(timeout) + "ms）");
    } else {
      DEBUG_WARNING("WiFi接続が最大試行回数（" + String(MAX_ATTEMPTS) + "回）に達しました");
    }
  }

  return connected;
}

// HTTPハンドラーのセットアップ
void RealWiFiManager::setupHttpHandlers()
{
  // APIエンドポイント
  _webServer.on("/api", HTTP_GET, [this]() {
    this->handleApiRequest();
  });

  // ルートパス（存在確認用）
  _webServer.on("/", HTTP_GET, [this]() {
    _webServer.send(200, "text/plain", "Pedantic Lever Controller");
  });

  // 404エラー
  _webServer.onNotFound([this]() {
    _webServer.send(404, "text/plain", "Not Found");
  });
}

// APIリクエストのハンドリング
void RealWiFiManager::handleApiRequest()
{
  if (_apiHandler) {
    // APIコールバックを呼び出し、結果をクライアントに送信
    String response = _apiHandler("/api");
    _webServer.send(200, "application/json", response);
  } else {
    // コールバックが設定されていない場合はデフォルトのレスポンスを返す
    StaticJsonDocument<256> jsonDoc;
    jsonDoc["device_id"] = _deviceId;

    JsonObject data = jsonDoc.createNestedObject("data");
    data["raw"] = _rawValue;
    data["value"] = _calibratedValue;
    data["calibrated"] = _isCalibrated;
    data["calib_min"] = _minValue;
    data["calib_max"] = _maxValue;

    JsonObject status = jsonDoc.createNestedObject("status");
    status["error_code"] = _errorCode;
    status["wifi_rssi"] = WiFi.RSSI();

    String response;
    serializeJson(jsonDoc, response);
    _webServer.send(200, "application/json", response);
  }
}

// UDPディスカバリー要求の処理
void RealWiFiManager::processUdpDiscovery()
{
  // UDPパケットの受信
  int packetSize = _udp.parsePacket();
  if (packetSize > 0) {
    // パケットの内容を取得
    int len = _udp.read(_udpBuffer, UDP_BUFFER_SIZE - 1);
    if (len > 0) {
      _udpBuffer[len] = '\0';  // NULL終端

      // ディスカバリートークンの確認
      if (String(_udpBuffer) == DISCOVERY_TOKEN) {
        DEBUG_INFO("UDPディスカバリー要求を受信");

        // 応答の準備
        String response = createDiscoveryResponse();

        // 送信者に応答を返す
        _udp.beginPacket(_udp.remoteIP(), _udp.remotePort());
        _udp.write(response.c_str());
        _udp.endPacket();

        DEBUG_INFO("UDPディスカバリー応答を送信: " + _udp.remoteIP().toString() + ":" + String(_udp.remotePort()));
      }
    }
  }
}

// ディスカバリー応答のJSON生成
String RealWiFiManager::createDiscoveryResponse()
{
  StaticJsonDocument<128> jsonDoc;

  jsonDoc["type"] = "lever";
  jsonDoc["id"] = _deviceId;
  jsonDoc["ip"] = WiFi.localIP().toString();

  String response;
  serializeJson(jsonDoc, response);
  return response;
}


//==========================================================================
// MockWiFiManager 実装
//==========================================================================

// コンストラクタ
MockWiFiManager::MockWiFiManager()
  : _networkStatus(CONNECTED), // デフォルトは接続済み状態
    _discoveryEnabled(false),
    _rawValue(0),
    _calibratedValue(0),
    _isCalibrated(false),
    _minValue(0),
    _maxValue(1023),
    _errorCode(0)
{
  _deviceId = "mock-lever";
  _localIp = "192.168.1.100"; // シミュレートされたIPアドレス
}

// 初期化
void MockWiFiManager::begin()
{
  DEBUG_INFO("[Mock] WiFiManager初期化");
  // モックは常に成功
  _networkStatus = CONNECTED;
  DEBUG_INFO("[Mock] WiFi接続成功: " + _localIp);
}

// 定期的に呼び出して接続状態を更新する（モックでは何もしない）
void MockWiFiManager::update()
{
  // モックでは基本的に何もしない
}

// WiFi接続状態を取得
NetworkStatus MockWiFiManager::getStatus()
{
  return _networkStatus;
}

// ローカルIPアドレスを取得
String MockWiFiManager::getLocalIP()
{
  if (_networkStatus == CONNECTED) {
    return _localIp;
  }
  return "";
}

// デバイスIDを設定
void MockWiFiManager::setDeviceId(const String& deviceId)
{
  _deviceId = deviceId;
  DEBUG_INFO("[Mock] デバイスIDを設定: " + _deviceId);
}

// デバイスIDを取得
String MockWiFiManager::getDeviceId()
{
  return _deviceId;
}

// API要求に対する応答を処理するコールバックを設定
void MockWiFiManager::setApiHandler(HttpRequestCallback handler)
{
  _apiHandler = handler;
}

// UDPディスカバリーを有効/無効にする
void MockWiFiManager::enableDiscovery(bool enable)
{
  _discoveryEnabled = enable;
  DEBUG_INFO("[Mock] UDPディスカバリー: " + String(enable ? "有効" : "無効"));
}

// レバー値の更新を通知
void MockWiFiManager::updateLeverValue(int rawValue, int calibratedValue, bool isCalibrated,
                                      int minValue, int maxValue)
{
  _rawValue = rawValue;
  _calibratedValue = calibratedValue;
  _isCalibrated = isCalibrated;
  _minValue = minValue;
  _maxValue = maxValue;
}

// エラーコードを設定
void MockWiFiManager::setErrorCode(uint8_t errorCode)
{
  _errorCode = errorCode;
}

// WiFi設定をリセット
void MockWiFiManager::resetSettings()
{
  DEBUG_WARNING("[Mock] WiFi設定をリセット");
  // モックでは何もしない
}

// 接続待ち（モックでは即時成功）
bool MockWiFiManager::waitForConnection(unsigned long timeout)
{
  // モックでは即時接続成功
  _networkStatus = CONNECTED;
  DEBUG_INFO("[Mock] WiFi接続完了: " + _localIp);
  return true;
}

// 手動で接続状態を変更する（テスト用）
void MockWiFiManager::setNetworkStatus(NetworkStatus status)
{
  _networkStatus = status;
  if (status == CONNECTED) {
    DEBUG_INFO("[Mock] WiFi接続状態: 接続済み (" + _localIp + ")");
  } else {
    DEBUG_WARNING("[Mock] WiFi接続状態: " + String(status));
  }
}

// シミュレートされたAPIリクエストを処理する
String MockWiFiManager::processApiRequest(const String& request)
{
  if (_apiHandler) {
    // APIコールバックを呼び出し、結果を返す
    return _apiHandler(request);
  } else {
    // コールバックが設定されていない場合はデフォルトのレスポンスを返す
    StaticJsonDocument<256> jsonDoc;
    jsonDoc["device_id"] = _deviceId;

    JsonObject data = jsonDoc.createNestedObject("data");
    data["raw"] = _rawValue;
    data["value"] = _calibratedValue;
    data["calibrated"] = _isCalibrated;
    data["calib_min"] = _minValue;
    data["calib_max"] = _maxValue;

    JsonObject status = jsonDoc.createNestedObject("status");
    status["error_code"] = _errorCode;
    status["wifi_rssi"] = -65; // シミュレートされたRSSI値

    String response;
    serializeJson(jsonDoc, response);
    return response;
  }
}