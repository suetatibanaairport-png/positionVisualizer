/**
 * MockHardware.h - シミュレーション用ハードウェアインターフェース実装
 *
 * 実際のハードウェアなしでテストするためのモック実装を提供する。
 * シミュレーションモードで動作させるときに使用するクラス群。
 */

#ifndef MOCK_HARDWARE_H
#define MOCK_HARDWARE_H

#include "Hardware.h"
#include <Arduino.h>

// シミュレーション用ポテンショメータ読取り実装
class MockPotentiometerReader : public IPotentiometerReader {
public:
  MockPotentiometerReader(int initialValue = 512)
    : _simulatedValue(initialValue), _smoothedValue(initialValue),
      _noiseEnabled(false), _noiseAmount(10) {
  }

  void begin() {
    // 初期化処理（必要に応じて）
  }

  // シミュレートされた値をセット
  void setSimulatedValue(int value) {
    _simulatedValue = constrain(value, 0, 1023);
    // 値を変更したときにノイズが無効なら平滑化値も更新
    if (!_noiseEnabled) {
      _smoothedValue = _simulatedValue;
    }
  }

  // ノイズの有効・無効を設定
  void enableNoise(bool enable) {
    _noiseEnabled = enable;
  }

  // ノイズ量を設定
  void setNoiseAmount(int amount) {
    _noiseAmount = constrain(amount, 0, 100);
  }

  // 変化速度を設定（シミュレーション時に徐々に変化させる場合）
  void setChangeRate(int ratePerSecond) {
    _changeRate = ratePerSecond;
  }

  // 自動変化パターンを設定（sin波など）
  void setAutoChangePattern(int patternType) {
    _autoChangePattern = patternType;
    _autoChangeEnabled = true;
  }

  // 自動変化を停止
  void stopAutoChange() {
    _autoChangeEnabled = false;
  }

  // 生の値を読み取る（0-1023の範囲）
  int readRawValue() override {
    updateSimulatedValue();

    if (_noiseEnabled) {
      // ノイズを追加
      return _simulatedValue + random(-_noiseAmount, _noiseAmount);
    }
    return _simulatedValue;
  }

  // 平滑化された値を読み取る
  int readSmoothedValue() override {
    updateSimulatedValue();

    // シンプルなローパスフィルタでスムーズ化
    _smoothedValue = (_smoothedValue * 3 + readRawValue()) / 4;
    return _smoothedValue;
  }

  void update() override {
    return;
  }

private:
  int _simulatedValue;     // シミュレートされた現在値
  int _smoothedValue;      // 平滑化された値
  bool _noiseEnabled;      // ノイズ有効フラグ
  int _noiseAmount;        // ノイズ量（0-100）

  // 自動変化用パラメータ
  bool _autoChangeEnabled = false;  // 自動変化有効フラグ
  int _autoChangePattern = 0;       // 変化パターン（0=なし、1=sin波、2=三角波、3=ランダム）
  int _changeRate = 10;             // 変化速度（1秒あたりの変化量）
  unsigned long _lastUpdateTime = 0; // 最後の更新時間

  // シミュレート値を更新（自動変化がある場合）
  void updateSimulatedValue() {
    if (!_autoChangeEnabled) return;

    unsigned long currentTime = millis();
    if (currentTime - _lastUpdateTime < 50) return; // 更新間隔制限

    _lastUpdateTime = currentTime;
    float timeSeconds = currentTime / 1000.0f;

    switch (_autoChangePattern) {
      case 1: // Sin波
        _simulatedValue = 512 + (int)(511 * sin(timeSeconds * _changeRate / 10.0f));
        break;
      case 2: // 三角波
        {
          float phase = fmod(timeSeconds * _changeRate / 10.0f, 2.0f);
          if (phase < 1.0f) {
            _simulatedValue = 0 + (int)(phase * 1023);
          } else {
            _simulatedValue = 1023 - (int)((phase - 1.0f) * 1023);
          }
        }
        break;
      case 3: // ランダム（緩やかに変化）
        _simulatedValue += random(-_changeRate, _changeRate);
        _simulatedValue = constrain(_simulatedValue, 0, 1023);
        break;
    }
  }
};

// シミュレーション用LED制御実装
class MockLedController : public ILedController {
public:
  MockLedController(const char* name = "LED")
    : _name(name), _state(false), _brightness(0), _blinkEnabled(false),
      _onTimeMs(500), _offTimeMs(500), _lastToggleTime(0) {
  }

  void begin() override {
    DEBUG_INFO(String("MockLed [") + _name + "] initialized");
  }

  void setLed(bool state) override {
    _state = state;
    _blinkEnabled = false;
    DEBUG_VERBOSE(String("MockLed [") + _name + "] set to " + (_state ? "ON" : "OFF"));
  }

  void setBrightness(int brightness) override {
    _brightness = constrain(brightness, 0, 255);
    DEBUG_VERBOSE(String("MockLed [") + _name + "] brightness set to " + _brightness);
  }

  void setBlinkPattern(int onTimeMs, int offTimeMs) override {
    _onTimeMs = onTimeMs;
    _offTimeMs = offTimeMs;
    _blinkEnabled = true;
    _lastToggleTime = millis();
    DEBUG_VERBOSE(String("MockLed [") + _name + "] blink pattern set to " +
                 _onTimeMs + "ms ON, " + _offTimeMs + "ms OFF");
  }

  void update() override {
    if (_blinkEnabled) {
      unsigned long currentTime = millis();
      unsigned long elapsed = currentTime - _lastToggleTime;

      if ((_state && elapsed >= (unsigned long ) _onTimeMs) || (!_state && elapsed >= (unsigned long ) _offTimeMs)) {
        _state = !_state;
        _lastToggleTime = currentTime;
        DEBUG_VERBOSE(String("MockLed [") + _name + "] blink state changed to " +
                     (_state ? "ON" : "OFF"));
      }
    }
  }

  // シミュレーション用の追加メソッド
  bool getState() const {
    return _state;
  }

  int getBrightness() const {
    return _brightness;
  }

  bool isBlinkEnabled() const {
    return _blinkEnabled;
  }

  // LED状態のシリアル出力
  void printStatus() const {
    String status = String("MockLed [") + _name + "] Status: ";
    status += _state ? "ON" : "OFF";
    if (_blinkEnabled) {
      status += " (Blinking: " + String(_onTimeMs) + "ms ON, " + String(_offTimeMs) + "ms OFF)";
    }
    status += ", Brightness: " + String(_brightness);
    Serial.println(status);
  }

private:
  const char* _name;            // LED名（識別用）
  bool _state;                  // 現在の状態
  int _brightness;              // 明るさ (0-255)
  bool _blinkEnabled;           // 点滅モード有効フラグ
  int _onTimeMs, _offTimeMs;    // 点滅のON/OFF時間
  unsigned long _lastToggleTime; // 最後に状態を切り替えた時間
};

// シミュレーション用ボタン制御実装
class MockButtonHandler : public IButtonHandler {
public:
  MockButtonHandler(const char* name = "Button")
    : _name(name), _state(false), _lastState(false), _lastChangeTime(0) 
  {
    _pressCaliButtonCallback = nullptr;
    _releasedCaliButtonCallback = nullptr;
  }

  void begin() override {
    DEBUG_INFO(String("MockButton [") + _name + "] initialized");
  }

  // シミュレートされたボタン状態を設定
  void setSimulatedState(bool pressed) {
    if (_state != pressed) {
      _lastState = _state;
      _state = pressed;
      _lastChangeTime = millis();
      DEBUG_VERBOSE(String("MockButton [") + _name + "] state changed to " +
                   (pressed ? "PRESSED" : "RELEASED"));
    }
  }

  // シミュレートされたボタン押下
  void simulatePress() {
    setSimulatedState(true);
  }

  // シミュレートされたボタン解放
  void simulateRelease() {
    setSimulatedState(false);
  }

  // シミュレートされたボタンクリック（押して離す）
  void simulateClick(unsigned long pressDurationMs = 100) {
    simulatePress();
    delay(pressDurationMs); // 注意: ブロッキング処理
    simulateRelease();
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
    _lastState = _state;
    // シミュレーションでは何もしない（外部から状態が設定される）
  }

  // ボタン状態のシリアル出力
  void printStatus() const {
    String status = String("MockButton [") + _name + "] Status: ";
    status += _state ? "PRESSED" : "RELEASED";
    status += ", Last change: " + String((millis() - _lastChangeTime)) + "ms ago";
    Serial.println(status);
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
  const char* _name;            // ボタン名（識別用）
  bool _state;                  // 現在の状態
  bool _lastState;              // 前回の状態
  unsigned long _lastChangeTime; // 最後に状態が変化した時間

  PressCaliButtonCallback _pressCaliButtonCallback;
  ReleasedCaliButtonCallback _releasedCaliButtonCallback;
};

// シミュレーション用ストレージ管理実装
class MockStorageManager : public IStorageManager {
public:
  MockStorageManager(size_t size = 512) : _size(size) {
    _memory = new uint8_t[_size];
    memset(_memory, 0xFF, _size); // 初期化（未使用状態）
  }

  ~MockStorageManager() {
    delete[] _memory;
  }

  void begin() override {
    DEBUG_INFO(String("MockStorage initialized with size: ") + _size + " bytes");
  }

  bool readData(void* data, size_t size, size_t address = 0) override {
    if (address + size > _size) {
      DEBUG_ERROR(String("MockStorage: Read out of bounds - Address: ") +
                  address + ", Size: " + size + ", MaxSize: " + _size);
      return false; // 範囲外
    }

    memcpy(data, _memory + address, size);
    DEBUG_VERBOSE(String("MockStorage: Read ") + size + " bytes from address " + address);
    return true;
  }

  bool writeData(const void* data, size_t size, size_t address = 0) override {
    if (address + size > _size) {
      DEBUG_ERROR(String("MockStorage: Write out of bounds - Address: ") +
                  address + ", Size: " + size + ", MaxSize: " + _size);
      return false; // 範囲外
    }

    memcpy(_memory + address, data, size);
    DEBUG_VERBOSE(String("MockStorage: Wrote ") + size + " bytes to address " + address);
    return true;
  }

  bool eraseData(size_t size, size_t address = 0) override {
    if (address + size > _size) {
      DEBUG_ERROR(String("MockStorage: Erase out of bounds - Address: ") +
                  address + ", Size: " + size + ", MaxSize: " + _size);
      return false; // 範囲外
    }

    memset(_memory + address, 0xFF, size); // 消去はFFで埋める
    DEBUG_VERBOSE(String("MockStorage: Erased ") + size + " bytes at address " + address);
    return true;
  }

  bool commit() override {
    DEBUG_VERBOSE("MockStorage: Commit called (no effect in simulation)");
    return true; // シミュレーションでは常に成功
  }

  // シミュレーション用の追加メソッド：メモリ内容をダンプ
  void dumpMemory(size_t address, size_t size) {
    if (address + size > _size) {
      size = _size - address;
    }

    String hexDump;
    String asciiDump;

    Serial.print("\nMemory Dump from 0x");
    Serial.print(address, HEX);
    Serial.print(" to 0x");
    Serial.print(address + size - 1, HEX);
    Serial.println(":");

    for (size_t i = 0; i < size; i++) {
      if (i % 16 == 0) {
        if (i > 0) {
          Serial.print("  ");
          Serial.println(asciiDump);
        }
        Serial.print("0x");
        Serial.print(address + i, HEX);
        Serial.print(": ");
        hexDump = "";
        asciiDump = "";
      }

      uint8_t value = _memory[address + i];

      // HEX部分
      if (value < 16) {
        Serial.print("0");
      }
      Serial.print(value, HEX);
      Serial.print(" ");

      // ASCII部分
      if (value >= 32 && value <= 126) {
        asciiDump += (char)value;
      } else {
        asciiDump += ".";
      }

      if ((i + 1) % 16 == 0 || i == size - 1) {
        int remaining = 16 - (i % 16) - 1;
        for (int j = 0; j < remaining; j++) {
          Serial.print("   ");
        }
        Serial.print("  ");
        Serial.println(asciiDump);
      }
    }
  }

private:
  size_t _size;     // ストレージサイズ
  uint8_t* _memory; // シミュレーション用メモリ領域
};

#endif // MOCK_HARDWARE_H