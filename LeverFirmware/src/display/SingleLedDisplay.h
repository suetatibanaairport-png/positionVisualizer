/**
 * SingleLedDisplay.h - 単一LEDによる表示機能
 *
 * 単一LEDを使用して4つの状態（通電、キャリブレーション完了、wifi接続、正常稼働）を
 * 異なる点滅パターンで表現する機能を提供するクラス。
 * ハードウェア抽象化インターフェースを利用しテスタビリティを向上。
 */

#ifndef SINGLE_LED_DISPLAY_H
#define SINGLE_LED_DISPLAY_H

#include <Arduino.h>
#include "../core/Hardware.h"

class SingleLedDisplay
{
public:
  // 表示モード
  enum DisplayMode
  {
    POWER_ON,           // 通電状態（長いON, 短いOFF）
    CALIBRATED,         // キャリブレーション完了（2回短い点滅）
    WIFI_CONNECTED,     // WiFi接続完了（3回短い点滅）
    NORMAL_OPERATION,   // 正常稼働状態（常時点灯）
    CALIBRATING,        // キャリブレーション中（速い点滅）
    ERROR,              // エラー状態（SOS: 短短短-長長長-短短短）
    OFF                 // 消灯
  };

  // コンストラクタ
  SingleLedDisplay();
  ~SingleLedDisplay();
  
  // 初期化
  void begin(ILedController*);
  
  // 表示モードを設定
  void setMode(DisplayMode mode);

  // 現在のモードを取得
  DisplayMode getMode() const;

  // 表示を更新（定期的に呼び出す）
  void update();

  // エラーコードを設定（エラーモード用）
  void setErrorCode(uint8_t code);

private:
  DisplayMode _currentMode;    // 現在の表示モード
  uint8_t _ledPin;             // LED接続ピン
  uint8_t _errorCode;          // エラーコード
  unsigned long _lastUpdateTime; // 最後の更新時間
  int _patternStep;            // パターン内の現在のステップ
  bool _ledState;              // LEDの現在の状態

  // LED制御用オブジェクト
  ILedController* _led;

  // 各モードの表示パターン
  void displayPowerOn();
  void displayCalibrated();
  void displayWifiConnected();
  void displayNormalOperation();
  void displayCalibrating();
  void displayError();
};

#endif // SINGLE_LED_DISPLAY_H