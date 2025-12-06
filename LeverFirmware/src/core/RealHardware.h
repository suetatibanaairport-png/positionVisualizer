/**
 * RealHardware.h - 実機用ハードウェアインターフェース実装
 *
 * 実際のハードウェアに対するインターフェース実装を提供する。
 * ESP8266の実機で動作させるときに使用するクラス群。
 */

#ifndef REAL_HARDWARE_H
#define REAL_HARDWARE_H

#include "Hardware.h"
#include <Arduino.h>
#include <EEPROM.h>

// 実機用ポテンショメータ読取り実装
class RealPotentiometerReader : public IPotentiometerReader {
public:
  RealPotentiometerReader(uint8_t pin = A0, uint8_t smoothingFactor = 10)
    : _pin(pin), _smoothingFactor(smoothingFactor), _lastValue(0) {    
  }

  void begin() {
    // アナログピンの初期化（必要に応じて）
    pinMode(_pin, INPUT);

    // 初期値を読み取り
    _lastValue = analogRead(_pin);

    // サンプリングバッファの初期化
    for (int i = 0; i < BUFFER_SIZE; i++) {
      _samples[i] = _lastValue;
    }
    _sampleIndex = 0;
    _samplesValid = 0;
    _sum = _lastValue * BUFFER_SIZE;
  }

  // 生の値を読み取る（0-1023の範囲）
  int readRawValue() override {
    _lastValue = analogRead(_pin);
    return _lastValue;
  }

  // 平滑化された値を読み取る
  int readSmoothedValue() override {
    // 新しい値を取得
    int newValue = readRawValue();

    // サンプルバッファを更新
    _sum -= _samples[_sampleIndex];
    _samples[_sampleIndex] = newValue;
    _sum += newValue;

    _sampleIndex = (_sampleIndex + 1) % BUFFER_SIZE;
    if (_samplesValid < BUFFER_SIZE) {
      _samplesValid++;
    }

    // 平均値を計算して返す
    if (_samplesValid > 0) {
      return _sum / _samplesValid;
    }
    return newValue; // フォールバック
  }

  void update() override {
    return;
  }

private:
  static const int BUFFER_SIZE = 10; // 平滑化用バッファサイズ
  uint8_t _pin;                     // アナログ入力ピン
  uint8_t _smoothingFactor;         // 平滑化係数
  int _lastValue;                   // 最後に読み取った値

  // 平滑化用変数
  int _samples[BUFFER_SIZE];        // サンプル値バッファ
  int _sampleIndex;                 // 現在のサンプルインデックス
  int _samplesValid;                // 有効なサンプル数
  long _sum;                        // サンプルの合計
};

// 実機用LED制御実装
class RealLedController : public ILedController {
public:
  RealLedController(uint8_t pin) : _pin(pin), _state(false), _blinkEnabled(false),
                                   _onTimeMs(500), _offTimeMs(500), _lastToggleTime(0) {
  }

  void begin() override {
    pinMode(_pin, OUTPUT);
    digitalWrite(_pin, LOW);
  }

  void setLed(bool state) override {
    _state = state;
    _blinkEnabled = false;
    digitalWrite(_pin, _state ? HIGH : LOW);
  }

  void setBrightness(int brightness) override {
    // 明るさ制御 (PWM)
    _brightness = constrain(brightness, 0, 255);
    analogWrite(_pin, _brightness);
  }

  void setBlinkPattern(int onTimeMs, int offTimeMs) override {
    _onTimeMs = onTimeMs;
    _offTimeMs = offTimeMs;
    _blinkEnabled = true;
    _lastToggleTime = millis();
  }

  void update() override {
    if (_blinkEnabled) {
      unsigned long currentTime = millis();
      unsigned long elapsed = currentTime - _lastToggleTime;

      if ((_state && elapsed >= (unsigned long ) _onTimeMs) || (!_state && elapsed >= (unsigned long ) _offTimeMs)) {
        _state = !_state;
        digitalWrite(_pin, _state ? HIGH : LOW);
        _lastToggleTime = currentTime;
      }
    }
  }

private:
  uint8_t _pin;                 // LED接続ピン
  bool _state;                  // 現在の状態
  int _brightness;              // 明るさ (0-255)
  bool _blinkEnabled;           // 点滅モード有効フラグ
  int _onTimeMs, _offTimeMs;    // 点滅のON/OFF時間
  unsigned long _lastToggleTime; // 最後に状態を切り替えた時間
};

// 実機用ボタン制御実装
class RealButtonHandler : public IButtonHandler {
public:
  RealButtonHandler(uint8_t pin, bool pullUp = true)
    : _pin(pin), _pullUp(pullUp), _state(false), _lastState(false),
      _lastDebounceTime(0), _lastChangeTime(0) 
  {
    _pressCaliButtonCallback = nullptr;
    _releasedCaliButtonCallback = nullptr;
  }

  void begin() override {
    pinMode(_pin, _pullUp ? INPUT_PULLUP : INPUT);
    _lastState = _state = readRawState();
  }

  bool isPressed() override {
    return _state;
  }

  bool wasPressed() override {
    return _state && !_lastState;
  }

  bool wasReleased() override {
    return !_state && _lastState;
  }

  bool isLongPressed(unsigned long durationMs) override {
    return _state && (millis() - _lastChangeTime >= durationMs);
  }

  void update() override {
    bool rawState = readRawState();

    // デバウンス処理
    if (rawState != _lastRawState) {
      _lastDebounceTime = millis();
    }

    if ((millis() - _lastDebounceTime) > DEBOUNCE_DELAY) {
      // 状態変化を検出
      if (rawState != _state) {
        _state = rawState;
        _lastChangeTime = millis();
      }
    }

    _lastRawState = rawState;
    _lastState = _state;
  }

  // ボタンを押した時のコールバックを設定
  void setPressCaliButtonCallback(PressCaliButtonCallback callback) override
  {
    _pressCaliButtonCallback = callback;
  }

  // ボタンを離した時のコールバックを設定
  void setReleaseCaliButtonCallback(ReleasedCaliButtonCallback callback) override
  {
    _releasedCaliButtonCallback = callback;
  }

private:
  static const int DEBOUNCE_DELAY = 50; // デバウンス時間（ms）

  uint8_t _pin;            // ボタン接続ピン
  bool _pullUp;            // プルアップ抵抗の有無
  bool _state;             // 現在のデバウンス後状態
  bool _lastState;         // 前回のデバウンス後状態
  bool _lastRawState;      // 前回の生の状態
  unsigned long _lastDebounceTime;  // 最後に状態が変化した時間
  unsigned long _lastChangeTime;    // デバウンス後に状態が変化した時間

  PressCaliButtonCallback _pressCaliButtonCallback;
  ReleasedCaliButtonCallback _releasedCaliButtonCallback;

  // ボタンの生の状態を読み取る（プルアップの場合は反転）
  bool readRawState() {
    bool rawState = digitalRead(_pin);
    return _pullUp ? !rawState : rawState; // プルアップの場合は反転（押したときLOWになるため）
  }
};

// 実機用ストレージ管理実装（EEPROM使用）
class RealStorageManager : public IStorageManager {
public:
  RealStorageManager(size_t size = 512) : _size(size) {
  }

  void begin() override {
    EEPROM.begin(_size);
  }

  bool readData(void* data, size_t size, size_t address = 0) override {
    if (address + size > _size) {
      return false; // 範囲外
    }

    uint8_t* byteData = (uint8_t*)data;
    for (size_t i = 0; i < size; i++) {
      byteData[i] = EEPROM.read(address + i);
    }

    return true;
  }

  bool writeData(const void* data, size_t size, size_t address = 0) override {
    if (address + size > _size) {
      return false; // 範囲外
    }

    const uint8_t* byteData = (const uint8_t*)data;
    for (size_t i = 0; i < size; i++) {
      EEPROM.write(address + i, byteData[i]);
    }

    return true;
  }

  bool eraseData(size_t size, size_t address = 0) override {
    if (address + size > _size) {
      return false; // 範囲外
    }

    for (size_t i = 0; i < size; i++) {
      EEPROM.write(address + i, 0xFF); // 消去はFFで埋める
    }

    return true;
  }

  bool commit() override {
    return EEPROM.commit();
  }

private:
  size_t _size; // EEPROMサイズ
};

#endif // REAL_HARDWARE_H