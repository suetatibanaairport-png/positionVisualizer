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
    _errorCode(0)
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

  // WiFi接続設定
  _wifiManager.setConfigPortalTimeout(180); // ポータルのタイムアウト時間（秒）
  _wifiManager.setDebugOutput(true);

  // デバイス名の設定（アクセスポイントモード時のSSID）
  DEBUG_WARNING("WiFiManager autoConnect");
  String apName = "LeverSetup-" + _deviceId;
  _wifiManager.autoConnect(apName.c_str());

  // WiFi接続状態の初期確認
  if (WiFi.status() == WL_CONNECTED) {
    _networkStatus = CONNECTED;
    DEBUG_INFO("WiFi接続成功: " + WiFi.localIP().toString());
  } else {
    _networkStatus = DISCONNECTED;
    DEBUG_WARNING("WiFi未接続");
  }
  /*
  bool done = true;
  Serial.print("WiFi connecting");
  auto last = millis();
  while (WiFi.status() != WL_CONNECTED && last + 1000 > millis()) {
      delay(500);
      Serial.print(".");
  }
  if (WiFi.status() == WL_CONNECTED) {
      Serial.print("WIFI_CONNECTED");
      done = false;
  } else {
      Serial.println("retry");
      WiFi.disconnect();
      WiFi.reconnect();
  }
  */

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
  // WiFi状態の更新（5秒ごと）
  unsigned long currentMillis = millis();
  if (currentMillis - _lastStatusCheck > 200) {
    _lastStatusCheck = currentMillis;

    Serial.println(WiFi.status());
    if (WiFi.status() == WL_CONNECTED) {
      if (_networkStatus != CONNECTED) {
        _networkStatus = CONNECTED;
        DEBUG_INFO("WiFi接続状態: 接続済み (" + WiFi.localIP().toString() + ")");
      }
    } else {
      if (_networkStatus != DISCONNECTED) {
        _networkStatus = DISCONNECTED;
        DEBUG_WARNING("WiFi接続状態: 未接続");

      }
      Serial.println("reconnect");
      //WiFi.disconnect();
      Serial.println(WiFi.reconnect());
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
  unsigned long startTime = millis();

  while (millis() - startTime < timeout) {
    if (WiFi.status() == WL_CONNECTED) {
      _networkStatus = CONNECTED;
      DEBUG_INFO("WiFi接続完了: " + WiFi.localIP().toString());
      return true;
    }
    delay(100);
  }

  if (WiFi.status() != WL_CONNECTED) {
    DEBUG_WARNING("WiFi接続タイムアウト");
    _networkStatus = CONNECTION_ERROR;
    return false;
  }

  return true;
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