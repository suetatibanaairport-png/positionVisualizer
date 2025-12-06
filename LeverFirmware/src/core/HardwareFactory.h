/**
 * HardwareFactory.h - ハードウェアインスタンス生成ファクトリー
 *
 * 実機とシミュレーションの切り替えを容易にするためのファクトリークラス。
 * コンパイル時またはランタイムで動作モードを切り替え可能にする。
 */

#ifndef HARDWARE_FACTORY_H
#define HARDWARE_FACTORY_H

#include "Hardware.h"
#include "RealHardware.h"
#include "MockHardware.h"
#include "../communication/NetworkInterface.h"
#include "../communication/WiFiManager.h"

// ハードウェアアクセス生成用ファクトリークラス
class HardwareFactory {
public:
  // シミュレーションモードの設定
  static void setSimulationMode(bool enabled) {
    _simulationMode = enabled;
    DEBUG_INFO(String("HardwareFactory: Mode set to ") + (_simulationMode ? "SIMULATION" : "REAL"));
  }

  // 現在のモード取得
  static bool isSimulationMode() {
    return _simulationMode;
  }

  // ポテンショメータリーダーのインスタンス生成
  static IPotentiometerReader* createPotentiometerReader() {
    if (_simulationMode) {
      DEBUG_INFO("Creating MockPotentiometerReader");
      return new MockPotentiometerReader();
    } else {
      DEBUG_INFO("Creating RealPotentiometerReader");
      return new RealPotentiometerReader(A0);
    }
  }

  // LEDコントローラーのインスタンス生成
  static ILedController* createLedController(uint8_t pin) {
    if (_simulationMode) {
      DEBUG_INFO(String("Creating MockLedController for pin ") + pin);
      return new MockLedController(("LED_" + String(pin)).c_str());
    } else {
      DEBUG_INFO(String("Creating RealLedController for pin ") + pin);
      return new RealLedController(pin);
    }
  }

  // ボタンハンドラーのインスタンス生成
  static IButtonHandler* createButtonHandler(uint8_t pin, bool pullUp = true) {
    if (_simulationMode) {
      DEBUG_INFO(String("Creating MockButtonHandler for pin ") + pin);
      return new MockButtonHandler(("Button_" + String(pin)).c_str());
    } else {
      DEBUG_INFO(String("Creating RealButtonHandler for pin ") + pin);
      return new RealButtonHandler(pin, pullUp);
    }
  }

  // ストレージマネージャーのインスタンス生成
  static IStorageManager* createStorageManager(size_t size = 512) {
    if (_simulationMode) {
      DEBUG_INFO(String("Creating MockStorageManager with size ") + size);
      return new MockStorageManager(size);
    } else {
      DEBUG_INFO(String("Creating RealStorageManager with size ") + size);
      return new RealStorageManager(size);
    }
  }

  // ネットワークマネージャーのインスタンス生成
  static INetworkManager* createNetworkManager(uint16_t httpPort = 80) {
    if (_simulationMode) {
      DEBUG_INFO("Creating MockWiFiManager");
      return new MockWiFiManager();
    } else {
      DEBUG_INFO("Creating RealWiFiManager");
      return new RealWiFiManager(httpPort);
    }
  }

private:
  static bool _simulationMode;
};

#endif // HARDWARE_FACTORY_H