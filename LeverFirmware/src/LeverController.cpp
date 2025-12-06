/**
 * LeverController.cpp - レバーコントローラのメインクラス実装
 */

#include "LeverController.h"
#include "core/HardwareFactory.h"
#include "Config.h"

// コンストラクタ
LeverController::LeverController(bool simulationMode)
  : _isCalibrating(false),
    _minValue(0),
    _maxValue(1023),
    _calibStartTime(0),
    _lastRawValue(0),
    _smoothedValue(0),
    _calibratedValue(0)
{
  // シミュレーションモード設定
  HardwareFactory::setSimulationMode(simulationMode);

  DEBUG_INFO("LeverController初期化中");

  // ハードウェアコンポーネントの作成
  _potReader = HardwareFactory::createPotentiometerReader();
  _led = HardwareFactory::createLedController(LED_PIN);
  _calibButton = HardwareFactory::createButtonHandler(CALIB_BUTTON_PIN, true);
  _network = HardwareFactory::createNetworkManager(HTTP_PORT);

  // コンポーネントの初期設定
  _ledDisplay =  SingleLedDisplay();
}

// デストラクタ
LeverController::~LeverController()
{
  // ハードウェアコンポーネントの解放
  if (_potReader) {
    delete _potReader;
    _potReader = nullptr;
  }
  if (_led) {
    delete _led;
    _led = nullptr;
  }
  if (_calibButton) {
    delete _calibButton;
    _calibButton = nullptr;
  }
  if (_network) {
    delete _network;
    _network = nullptr;
  }
}

// 初期化
void LeverController::begin()
{
  DEBUG_INFO("LeverController開始");

  // ハードウェアコンポーネントの初期化
  _potReader->begin();
  _calibButton->begin();

  // LEDディスプレイの初期化
  _ledDisplay.begin(_led);
  _ledDisplay.setMode(SingleLedDisplay::POWER_ON); // 電源ON表示モード

  // キャリブレーションの初期化
  _calibration.begin();

  // ボタンのコールバック設定
  _calibButton->setPressCaliButtonCallback([this]() { this->onCalibButtonPressed(); });
  _calibButton->setReleaseCaliButtonCallback([this]() { this->onCalibButtonReleased(); });

  // APIコントローラーのコールバック設定
  _apiController.setGetLeverValueCallback([this]() { return this->getLeverValue(); });
  _apiController.setGetRawValueCallback([this]() { return this->getRawValue(); });
  _apiController.setGetCalibrationInfoCallback([this](int& min, int& max, bool& cal) {
    this->getCalibrationInfo(min, max, cal);
  });
  _apiController.setResetCalibrationCallback([this]() { this->resetCalibration(); });
  _apiController.setSetLedModeCallback([this](int mode) { this->setLedMode(mode); });


  
  // ネットワークの初期化
  String deviceId = "lever" + String(ESP.getChipId() & 0xFFFF, HEX);
  _network->setDeviceId(deviceId);
  _apiController.setDeviceId(deviceId);

  // APIハンドラの設定
  _network->setApiHandler([this](String request) {
    return this->handleApiRequest(request);
  });

  // ネットワーク開始
  _network->begin();
  _network->enableDiscovery(true);

  // ネットワーク接続待ち
  if (_network->waitForConnection(10000)) {
    _ledDisplay.setMode(SingleLedDisplay::WIFI_CONNECTED);
    DEBUG_INFO("WiFi接続完了: " + _network->getLocalIP());
  } else {
    DEBUG_WARNING("WiFi接続失敗またはタイムアウト");
  }
}

// 定期更新（ループ内で呼び出す）
void LeverController::update()
{
  // ハードウェアコンポーネントの更新
  _potReader->update();
  _calibButton->update();
  _ledDisplay.update();
  _network->update();

  // センサー値の読み取りと平滑化
  int rawValue = _potReader->readRawValue();

  // 単純な指数平滑化
  _smoothedValue = ((_smoothedValue * (SMOOTHING_FACTOR - 1)) + rawValue) / SMOOTHING_FACTOR;

  // キャリブレーションと正規化
  _calibratedValue = _calibration.mapTo0_100(_smoothedValue);

  // キャリブレーション中の処理
  if (_isCalibrating) {
    // キャリブレーション中はmin/maxを更新
    if (rawValue < _minValue) _minValue = rawValue;
    if (rawValue > _maxValue) _maxValue = rawValue;

    // タイムアウト確認
    if (millis() - _calibStartTime > CALIB_TIMEOUT) {
      // タイムアウトしたら自動的にキャリブレーション終了
      endCalibration();
    }
  }

  // ネットワークにデータを送信
  _network->updateLeverValue(rawValue, _calibratedValue, (!_isCalibrating),
                            _minValue, _maxValue);

  // WiFi接続完了後、正常稼働モードに移行（初回のみ）
  static bool normalOperationSet = false;
  if (_network->getStatus() == CONNECTED && !normalOperationSet && (!_isCalibrating)) {
    _ledDisplay.setMode(SingleLedDisplay::NORMAL_OPERATION);
    normalOperationSet = true;
  }
}

// キャリブレーション開始
void LeverController::startCalibration()
{
  if (!_isCalibrating) {
    DEBUG_INFO("キャリブレーション開始");
    _isCalibrating = true;
    _calibStartTime = millis();
    _minValue = 1023; // 最大値から始める
    _maxValue = 0;    // 最小値から始める
    _ledDisplay.setMode(SingleLedDisplay::CALIBRATING);
  }
}

// キャリブレーション終了
void LeverController::endCalibration()
{
  if (_isCalibrating) {
    DEBUG_INFO("キャリブレーション終了");
    _isCalibrating = false;

    // 有効なキャリブレーション範囲かチェック
    if (_calibration.isValidRange(_minValue, _maxValue)) {
      // 有効なら保存
      _calibration.saveCalibration(_minValue, _maxValue, true);
      DEBUG_INFO("キャリブレーション保存: min=" + String(_minValue) + ", max=" + String(_maxValue));
      _ledDisplay.setMode(SingleLedDisplay::CALIBRATED);
    } else {
      DEBUG_WARNING("キャリブレーション範囲が不十分です");
      _ledDisplay.setMode(SingleLedDisplay::ERROR);
      _ledDisplay.setErrorCode(1); // エラーコード1: キャリブレーション範囲不足
    }
  }
}

// WiFi設定をリセット
void LeverController::resetWiFiSettings()
{
  DEBUG_WARNING("WiFi設定をリセット");
  _network->resetSettings();
}

// キャリブレーションボタン押下時のコールバック
void LeverController::onCalibButtonPressed()
{
  DEBUG_INFO("キャリブレーションボタン押下");
  startCalibration();
}

// キャリブレーションボタン開放時のコールバック
void LeverController::onCalibButtonReleased()
{
  DEBUG_INFO("キャリブレーションボタン開放");
  endCalibration();
}

// キャリブレーションリセット
void LeverController::resetCalibration()
{
  DEBUG_WARNING("キャリブレーションリセット");
  _calibration.resetCalibration();
  _ledDisplay.setMode(SingleLedDisplay::POWER_ON);
}

// LEDモード設定
void LeverController::setLedMode(int mode)
{
  if (mode >= 0 && mode <= 6) {
    DEBUG_INFO("LEDモードを設定: " + String(mode));
    _ledDisplay.setMode(static_cast<SingleLedDisplay::DisplayMode>(mode));
  } else {
    DEBUG_WARNING("無効なLEDモード: " + String(mode));
  }
}

// APIリクエストハンドラ
String LeverController::handleApiRequest(const String& request)
{
  DEBUG_INFO("APIリクエスト: " + request);
  return _apiController.handleRequest(request);
}

// 正規化されたレバー値を取得
int LeverController::getLeverValue()
{
  return _calibratedValue;
}

// 生のセンサー値を取得
int LeverController::getRawValue()
{
  return _smoothedValue;
}

// キャリブレーション情報を取得
void LeverController::getCalibrationInfo(int& minVal, int& maxVal, bool& isCalibrated)
{
  int min, max;
  bool calibrated;
  _calibration.loadCalibration(min, max, calibrated);

  minVal = min;
  maxVal = max;
  isCalibrated = calibrated;
}

// 静的メンバの初期化
bool HardwareFactory::_simulationMode = SIMULATION_MODE;