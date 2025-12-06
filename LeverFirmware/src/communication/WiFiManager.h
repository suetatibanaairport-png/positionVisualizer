/**
 * WiFiManager.h - WiFi接続管理クラス
 *
 * ESP8266用のWiFi接続、HTTP/UDPサーバー機能を実装するクラス。
 * WiFiManager(自動設定ポータル)、ESP8266WebServer、UDP機能を利用。
 */

#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <WiFiManager.h>  // https://github.com/tzapu/WiFiManager
#include <WiFiUdp.h>
#include <ArduinoJson.h>
#include "NetworkInterface.h"
#include "core/Hardware.h"

// UDPディスカバリー用定数
#define UDP_DISCOVERY_PORT 4210
#define DISCOVERY_TOKEN "DISCOVER_LEVER"
#define UDP_BUFFER_SIZE 255

/**
 * ESP8266 WiFi接続管理クラス
 */
class RealWiFiManager : public INetworkManager {
public:
  RealWiFiManager(uint16_t httpPort = 80);
  virtual ~RealWiFiManager();

  // INetworkManager インターフェースの実装
  virtual void begin() override;
  virtual void update() override;
  virtual NetworkStatus getStatus() override;
  virtual String getLocalIP() override;
  virtual void setDeviceId(const String& deviceId) override;
  virtual String getDeviceId() override;
  virtual void setApiHandler(HttpRequestCallback handler) override;
  virtual void enableDiscovery(bool enable) override;
  virtual void updateLeverValue(int rawValue, int calibratedValue, bool isCalibrated,
                              int minValue, int maxValue) override;
  virtual void setErrorCode(uint8_t errorCode) override;
  virtual void resetSettings() override;
  virtual bool waitForConnection(unsigned long timeout = 10000) override;

private:
  // WiFi関連
  ::WiFiManager _wifiManager;     // WiFi設定マネージャー
  NetworkStatus _networkStatus;   // 現在のネットワーク状態
  String _deviceId;               // デバイスID
  unsigned long _lastStatusCheck; // 最終WiFi状態チェック時間

  // HTTPサーバー関連
  ESP8266WebServer _webServer;    // HTTPサーバー
  HttpRequestCallback _apiHandler; // API処理用コールバック

  // UDPディスカバリー関連
  WiFiUDP _udp;                  // UDP通信用
  bool _discoveryEnabled;         // ディスカバリー機能有効フラグ
  char _udpBuffer[UDP_BUFFER_SIZE]; // UDP受信バッファ

  // センサーデータのキャッシュ
  int _rawValue;
  int _calibratedValue;
  bool _isCalibrated;
  int _minValue;
  int _maxValue;
  uint8_t _errorCode;
  uint16_t _httpPort;

  // HTTPハンドラーのセットアップ
  void setupHttpHandlers();

  // APIリクエストのハンドリング
  void handleApiRequest();

  // UDPディスカバリー要求の処理
  void processUdpDiscovery();

  // ディスカバリー応答のJSON生成
  String createDiscoveryResponse();
};

/**
 * モック用WiFiマネージャークラス
 * シミュレーション用の実装
 */
class MockWiFiManager : public INetworkManager {
public:
  MockWiFiManager();
  virtual ~MockWiFiManager() {}

  // INetworkManager インターフェースの実装
  virtual void begin() override;
  virtual void update() override;
  virtual NetworkStatus getStatus() override;
  virtual String getLocalIP() override;
  virtual void setDeviceId(const String& deviceId) override;
  virtual String getDeviceId() override;
  virtual void setApiHandler(HttpRequestCallback handler) override;
  virtual void enableDiscovery(bool enable) override;
  virtual void updateLeverValue(int rawValue, int calibratedValue, bool isCalibrated,
                              int minValue, int maxValue) override;
  virtual void setErrorCode(uint8_t errorCode) override;
  virtual void resetSettings() override;
  virtual bool waitForConnection(unsigned long timeout = 10000) override;

  // モック用の機能
  // 手動で接続状態を変更する（テスト用）
  void setNetworkStatus(NetworkStatus status);

  // シミュレートされたAPIリクエストを処理する
  String processApiRequest(const String& request);

private:
  NetworkStatus _networkStatus;   // シミュレートされたネットワーク状態
  String _deviceId;               // デバイスID
  bool _discoveryEnabled;         // ディスカバリー機能有効フラグ
  String _localIp;                // シミュレートされたIPアドレス
  HttpRequestCallback _apiHandler; // API処理用コールバック

  // センサーデータのキャッシュ
  int _rawValue;
  int _calibratedValue;
  bool _isCalibrated;
  int _minValue;
  int _maxValue;
  uint8_t _errorCode;
  uint16_t _httpPort;
};

#endif // WIFI_MANAGER_H