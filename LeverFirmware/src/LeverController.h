/**
 * LeverController.h - レバーコントローラのメインクラス
 *
 * ポテンショメータ読み取り、LED表示、ボタン処理、ネットワーク通信を含む
 * レバーコントローラの全体制御を行うクラス。
 */

#ifndef LEVER_CONTROLLER_H
#define LEVER_CONTROLLER_H

#include <Arduino.h>
#include "core/Hardware.h"
#include "core/Calibration.h"
#include "display/SingleLedDisplay.h"
#include "communication/NetworkInterface.h"
#include "communication/ApiController.h"

class LeverController {
public:
  // コンストラクタ（実機モードまたはシミュレーションモードを指定可能）
  LeverController(bool simulationMode = false);
  ~LeverController();

  // 初期化（セットアップ時に呼び出す）
  void begin();

  // 定期更新（ループ内で呼び出す）
  void update();

  // キャリブレーションの開始と終了
  void startCalibration();
  void endCalibration();

  // WiFi設定をリセット
  void resetWiFiSettings();

private:
  // ハードウェアコンポーネント
  IPotentiometerReader* _potReader;
  ILedController* _led;
  IButtonHandler* _calibButton;
  INetworkManager* _network;

  // 機能モジュール
  Calibration _calibration;
  SingleLedDisplay _ledDisplay;
  ApiController _apiController;

  // 状態変数
  bool _isCalibrating;
  int _minValue;
  int _midValue;
  int _maxValue;
  unsigned long _calibStartTime;
  int _lastRawValue;
  int _smoothedValue;
  int _calibratedValue;
  int _lastCalibValue;
  unsigned long _lastSerialPrintTime;

  // コールバック関数
  void onCalibButtonPressed();
  void onCalibButtonReleased();
  void resetCalibration();
  void setLedMode(int mode);

  // APIコールバック関数
  String handleApiRequest(const String& request);

  // センサー値を取得
  int getLeverValue();
  int getRawValue();
  void getCalibrationInfo(int& minVal, int& midVal, int& maxVal, bool& isCalibrated);
};

#endif // LEVER_CONTROLLER_H