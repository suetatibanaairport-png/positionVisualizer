/**
 * SingleLedDisplay.cpp - 単一LEDによる表示機能の実装
 */

#include "SingleLedDisplay.h"
#include "../core/HardwareFactory.h"

// コンストラクタ
SingleLedDisplay::SingleLedDisplay()
    : _currentMode(OFF), _errorCode(0),
      _lastUpdateTime(0), _patternStep(0), _ledState(false)
{
}

// デストラクタ
SingleLedDisplay::~SingleLedDisplay()
{
  if (_led) {
    _led = nullptr;
  }
}

// 初期化
void SingleLedDisplay::begin(ILedController* controller)
{
  _led = controller;
  _led->begin();
  DEBUG_INFO("SingleLedDisplay initialized");
}

// 表示モードを設定
void SingleLedDisplay::setMode(DisplayMode mode)
{
  if (_currentMode != mode) {
    _currentMode = mode;
    _patternStep = 0;
    _lastUpdateTime = millis();

    // モード名を出力（デバッグ用）
    String modeName;
    switch (mode) {
      case POWER_ON: modeName = "POWER_ON"; break;
      case CALIBRATED: modeName = "CALIBRATED"; break;
      case WIFI_CONNECTED: modeName = "WIFI_CONNECTED"; break;
      case NORMAL_OPERATION: modeName = "NORMAL_OPERATION"; break;
      case CALIBRATING: modeName = "CALIBRATING"; break;
      case ERROR: modeName = "ERROR"; break;
      case OFF: modeName = "OFF"; break;
      default: modeName = "UNKNOWN"; break;
    }

    DEBUG_INFO("LED Mode set to: " + modeName);
  }
}

// 現在のモードを取得
SingleLedDisplay::DisplayMode SingleLedDisplay::getMode() const
{
  return _currentMode;
}

// 表示を更新（定期的に呼び出す）
void SingleLedDisplay::update()
{
  if (!_led) return;

  // 現在のモードに応じたパターンを表示
  switch (_currentMode) {
    case POWER_ON:
      displayPowerOn();
      break;
    case CALIBRATED:
      displayCalibrated();
      break;
    case WIFI_CONNECTED:
      displayWifiConnected();
      break;
    case NORMAL_OPERATION:
      displayNormalOperation();
      break;
    case CALIBRATING:
      displayCalibrating();
      break;
    case ERROR:
      displayError();
      break;
    case OFF:
      _led->setLed(false);
      break;
  }

  // LEDの状態を更新
  _led->update();
}

// エラーコードを設定
void SingleLedDisplay::setErrorCode(uint8_t code)
{
  _errorCode = code;
  DEBUG_INFO("Error code set to: " + String(_errorCode));
}

// 通電状態表示（長いON, 短いOFF）
void SingleLedDisplay::displayPowerOn()
{
  const unsigned long ON_TIME = 1500;   // 1.5秒オン
  const unsigned long OFF_TIME = 500;   // 0.5秒オフ

  unsigned long currentTime = millis();
  unsigned long elapsed = currentTime - _lastUpdateTime;

  if ((_ledState && elapsed >= ON_TIME) || (!_ledState && elapsed >= OFF_TIME)) {
    _ledState = !_ledState;
    _led->setLed(_ledState);
    _lastUpdateTime = currentTime;

    DEBUG_VERBOSE("Power-on pattern: LED " + String(_ledState ? "ON" : "OFF"));
  }
}

// キャリブレーション完了表示（2回短い点滅）
void SingleLedDisplay::displayCalibrated()
{
  const unsigned long BLINK_ON_TIME = 200;    // 0.2秒オン
  const unsigned long BLINK_OFF_TIME = 200;   // 0.2秒オフ
  const unsigned long PAUSE_TIME = 1000;      // 1秒間隔
  const int PATTERN_LENGTH = 5;               // オン→オフ→オン→オフ→ポーズ

  unsigned long currentTime = millis();
  unsigned long elapsed = currentTime - _lastUpdateTime;
  unsigned long stepTime;

  // ステップによって時間を変える
  if (_patternStep % 2 == 0 && _patternStep < 4) {
    stepTime = BLINK_ON_TIME;  // オン時間
    if (!_ledState) {
      _ledState = true;
      _led->setLed(true);
      DEBUG_VERBOSE("Calibrated pattern: LED ON (step " + String(_patternStep) + ")");
    }
  } else if (_patternStep < 4) {
    stepTime = BLINK_OFF_TIME; // オフ時間
    if (_ledState) {
      _ledState = false;
      _led->setLed(false);
      DEBUG_VERBOSE("Calibrated pattern: LED OFF (step " + String(_patternStep) + ")");
    }
  } else {
    stepTime = PAUSE_TIME;     // ポーズ時間
    if (_ledState) {
      _ledState = false;
      _led->setLed(false);
      DEBUG_VERBOSE("Calibrated pattern: PAUSE");
    }
  }

  if (elapsed >= stepTime) {
    _patternStep = (_patternStep + 1) % PATTERN_LENGTH;
    _lastUpdateTime = currentTime;
  }
}

// WiFi接続完了表示（3回短い点滅）
void SingleLedDisplay::displayWifiConnected()
{
  const unsigned long BLINK_ON_TIME = 200;    // 0.2秒オン
  const unsigned long BLINK_OFF_TIME = 200;   // 0.2秒オフ
  const unsigned long PAUSE_TIME = 1000;      // 1秒間隔
  const int PATTERN_LENGTH = 7;               // オン→オフ→オン→オフ→オン→オフ→ポーズ

  unsigned long currentTime = millis();
  unsigned long elapsed = currentTime - _lastUpdateTime;
  unsigned long stepTime;

  // ステップによって時間を変える
  if (_patternStep % 2 == 0 && _patternStep < 6) {
    stepTime = BLINK_ON_TIME;  // オン時間
    if (!_ledState) {
      _ledState = true;
      _led->setLed(true);
      DEBUG_VERBOSE("WiFi pattern: LED ON (step " + String(_patternStep) + ")");
    }
  } else if (_patternStep < 6) {
    stepTime = BLINK_OFF_TIME; // オフ時間
    if (_ledState) {
      _ledState = false;
      _led->setLed(false);
      DEBUG_VERBOSE("WiFi pattern: LED OFF (step " + String(_patternStep) + ")");
    }
  } else {
    stepTime = PAUSE_TIME;     // ポーズ時間
    if (_ledState) {
      _ledState = false;
      _led->setLed(false);
      DEBUG_VERBOSE("WiFi pattern: PAUSE");
    }
  }

  if (elapsed >= stepTime) {
    _patternStep = (_patternStep + 1) % PATTERN_LENGTH;
    _lastUpdateTime = currentTime;
  }
}

// 正常稼働状態表示（常時点灯）
void SingleLedDisplay::displayNormalOperation()
{
  if (!_ledState) {
    _ledState = true;
    _led->setLed(true);
    DEBUG_VERBOSE("Normal operation: LED ON");
  }
}

// キャリブレーション中表示（速い点滅）
void SingleLedDisplay::displayCalibrating()
{
  const unsigned long BLINK_TIME = 100;  // 0.1秒間隔で点滅

  unsigned long currentTime = millis();
  unsigned long elapsed = currentTime - _lastUpdateTime;

  if (elapsed >= BLINK_TIME) {
    _ledState = !_ledState;
    _led->setLed(_ledState);
    _lastUpdateTime = currentTime;

    DEBUG_VERBOSE("Calibrating pattern: LED " + String(_ledState ? "ON" : "OFF"));
  }
}

// エラー状態表示（SOS: 短短短-長長長-短短短）
void SingleLedDisplay::displayError()
{
  const unsigned long SHORT_ON_TIME = 200;   // 短点灯: 0.2秒
  const unsigned long SHORT_OFF_TIME = 200;  // 短消灯: 0.2秒
  const unsigned long LONG_ON_TIME = 600;    // 長点灯: 0.6秒
  const unsigned long LONG_OFF_TIME = 600;   // 長消灯: 0.6秒
  const unsigned long PAUSE_TIME = 1000;     // ポーズ: 1.0秒

  // SOSパターン: ... --- ...
  // 0: 短ON 1: 短OFF 2: 短ON 3: 短OFF 4: 短ON 5: 短OFF
  // 6: 長ON 7: 長OFF 8: 長ON 9: 長OFF 10: 長ON 11: 短OFF
  // 12: 短ON 13: 短OFF 14: 短ON 15: 短OFF 16: 短ON 17: PAUSE
  const int PATTERN_LENGTH = 18;

  unsigned long currentTime = millis();
  unsigned long elapsed = currentTime - _lastUpdateTime;
  unsigned long stepTime;
  bool shouldBeOn;

  // ステップに応じたON/OFF時間を計算
  if (_patternStep < 6) { // 短符号部分 (...)
    stepTime = (_patternStep % 2 == 0) ? SHORT_ON_TIME : SHORT_OFF_TIME;
    shouldBeOn = (_patternStep % 2 == 0);
  } else if (_patternStep < 12) { // 長符号部分 (---)
    stepTime = (_patternStep % 2 == 0) ? LONG_ON_TIME : LONG_OFF_TIME;
    shouldBeOn = (_patternStep % 2 == 0);
  } else if (_patternStep < 17) { // 短符号部分 (...)
    stepTime = (_patternStep % 2 == 0) ? SHORT_ON_TIME : SHORT_OFF_TIME;
    shouldBeOn = (_patternStep % 2 == 0);
  } else { // ポーズ
    stepTime = PAUSE_TIME;
    shouldBeOn = false;
  }

  // LEDの状態を更新
  if (_ledState != shouldBeOn) {
    _ledState = shouldBeOn;
    _led->setLed(_ledState);
    DEBUG_VERBOSE("Error pattern: LED " + String(_ledState ? "ON" : "OFF") +
                 " (step " + String(_patternStep) + ")");
  }

  if (elapsed >= stepTime) {
    _patternStep = (_patternStep + 1) % PATTERN_LENGTH;
    _lastUpdateTime = currentTime;
  }
}