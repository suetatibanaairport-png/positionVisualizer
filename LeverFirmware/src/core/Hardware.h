/**
 * Hardware.h - ハードウェアアクセスの抽象化インターフェース
 *
 * ハードウェア依存部分を抽象化し、実機とシミュレーションの切り替えを可能にする。
 * このインターフェースにより、実機なしでもコードのテストが可能になる。
 */

#ifndef HARDWARE_H
#define HARDWARE_H

#include <Arduino.h>

// キャリブレーションボタンコントローラーが使用するコールバック関数の型定義
using PressCaliButtonCallback = std::function<void()>;
using ReleasedCaliButtonCallback = std::function<void()>;

// ポテンショメータ読取りインターフェース
class IPotentiometerReader {
public:
  virtual ~IPotentiometerReader() {}

  // ポテンショメーターの初期化
  virtual void begin() = 0;

  // 生の値を読み取る（0-1023の範囲）
  virtual int readRawValue() = 0;

  // 平滑化された値を読み取る
  virtual int readSmoothedValue() = 0;

  // 状態更新（ループ内で呼び出し）
  virtual void update() = 0;
};

// LED制御インターフェース
class ILedController {
public:
  virtual ~ILedController() {}

  // LEDの初期化
  virtual void begin() = 0;

  // LEDをON/OFF（単一LED用）
  virtual void setLed(bool state) = 0;

  // LED明るさ設定（PWM対応LEDの場合）
  virtual void setBrightness(int brightness) = 0; // 0-255

  // 点滅パターンの設定
  virtual void setBlinkPattern(int onTimeMs, int offTimeMs) = 0;

  // 状態更新（ループ内で呼び出し）
  virtual void update() = 0;
};

// ボタン制御インターフェース
class IButtonHandler {
public:
  virtual ~IButtonHandler() {}

  // ボタンの初期化
  virtual void begin() = 0;

  // ボタンの状態を読み取る（押されていればtrue）
  virtual bool isPressed() = 0;

  // 前回の更新からボタンが押されたかどうか
  virtual bool wasPressed() = 0;

  // 前回の更新からボタンが離されたかどうか
  virtual bool wasReleased() = 0;

  // 長押し検出
  virtual bool isLongPressed(unsigned long durationMs) = 0;

  // 状態更新（ループ内で呼び出し）
  virtual void update() = 0;

    // ボタンを押した時のコールバックを設定
  virtual void setPressCaliButtonCallback(PressCaliButtonCallback callback) = 0;

  // ボタンを離した時のコールバックを設定
  virtual void setReleaseCaliButtonCallback(ReleasedCaliButtonCallback callback) = 0;
};

// ストレージアクセスインターフェース
class IStorageManager {
public:
  virtual ~IStorageManager() {}

  // ストレージの初期化
  virtual void begin() = 0;

  // データの読み込み
  virtual bool readData(void* data, size_t size, size_t address = 0) = 0;

  // データの書き込み
  virtual bool writeData(const void* data, size_t size, size_t address = 0) = 0;

  // データの消去
  virtual bool eraseData(size_t size, size_t address = 0) = 0;

  // コミット（EEPROM等で必要な場合）
  virtual bool commit() = 0;
};

// シミュレーションモードのフラグ
#ifndef SIMULATION_MODE
  #define SIMULATION_MODE false // デフォルトは実機モード
#endif

// デバッグレベル
#ifndef DEBUG_LEVEL
  #define DEBUG_LEVEL 4 // 0:なし, 1:エラーのみ, 2:警告, 3:情報, 4:詳細
#endif

// デバッグ出力マクロ
#if DEBUG_LEVEL > 0
  #define DEBUG_ERROR(msg) Serial.print("[ERROR] "); Serial.println(msg)
  #if DEBUG_LEVEL > 1
    #define DEBUG_WARNING(msg) Serial.print("[WARN] "); Serial.println(msg)
    #if DEBUG_LEVEL > 2
      #define DEBUG_INFO(msg) Serial.print("[INFO] "); Serial.println(msg)
      #if DEBUG_LEVEL > 3
        #define DEBUG_VERBOSE(msg) Serial.print("[VERB] "); Serial.println(msg)
      #else
        #define DEBUG_VERBOSE(msg)
      #endif
    #else
      #define DEBUG_INFO(msg)
      #define DEBUG_VERBOSE(msg)
    #endif
  #else
    #define DEBUG_WARNING(msg)
    #define DEBUG_INFO(msg)
    #define DEBUG_VERBOSE(msg)
  #endif
#else
  #define DEBUG_ERROR(msg)
  #define DEBUG_WARNING(msg)
  #define DEBUG_INFO(msg)
  #define DEBUG_VERBOSE(msg)
#endif

#endif // HARDWARE_H