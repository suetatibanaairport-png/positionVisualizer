/**
 * Calibration.cpp - レバーセンサーのキャリブレーション機能実装
 */

#include "Calibration.h"
#include "HardwareFactory.h"

// キャリブレーション設定
const int VALID_RANGE_DIFF = 100; // 有効なキャリブレーション範囲の最小差
const int DEFAULT_MIN = 0;        // デフォルト最小値
const int DEFAULT_MID = 511;      // デフォルト中間値
const int DEFAULT_MAX = 1023;     // デフォルト最大値
const int MIN_VALUE = 0;          // マッピング後の最小値
const int MID_VALUE = 500;         // マッピング後の中間値
const int MAX_VALUE = 1000;        // マッピング後の最大値

// コンストラクタ
Calibration::Calibration()
  : _dataLoaded(false) {
  // デフォルト値の設定
  _calibData.minValue = DEFAULT_MIN;
  _calibData.midValue = DEFAULT_MID;
  _calibData.maxValue = DEFAULT_MAX;
  _calibData.isCalibrated = false;
  _calibData.checksum = 0;

  // ストレージマネージャの作成
  _storage = HardwareFactory::createStorageManager();
}

// デストラクタ
Calibration::~Calibration() {
  // ストレージマネージャの解放
  if (_storage) {
    delete _storage;
    _storage = nullptr;
  }
}

// 初期化
void Calibration::begin()
{
  // ストレージの初期化
  _storage->begin();

  // 保存されたキャリブレーション値を読み込み
  int min, mid, max;
  bool calibrated;
  if (loadCalibration(min, mid, max, calibrated))
  {
    DEBUG_INFO("保存されたキャリブレーション値を読み込みました");
    DEBUG_INFO(String("Min: ") + min +
              ", Max: " + max +
              ", Calibrated: " + (calibrated ? "Yes" : "No"));
  }
  else
  {
    DEBUG_INFO("保存されたキャリブレーション値がないか、無効です");
    DEBUG_INFO("デフォルト値を使用します");
    // デフォルト値を設定（保存はしない）
    _calibData.minValue = DEFAULT_MIN;
    _calibData.midValue = DEFAULT_MID;
    _calibData.maxValue = DEFAULT_MAX;
    _calibData.isCalibrated = false;
  }
}

// キャリブレーション最小値のセット
void Calibration::setCalibMinValue(int minValue)
{
  _calibData.minValue = minValue;
}

// キャリブレーション中間値のセット
void Calibration::setCalibMidValue(int midValue)
{
  _calibData.midValue = midValue;
}

// キャリブレーション最大値のセット
void Calibration::setCalibMaxValue(int maxValue)
{
  _calibData.maxValue = maxValue;
}

// キャリブレーション最小値の取得
int Calibration::getCalibMinValue()
{
  return _calibData.minValue;
}

// キャリブレーション中間値の取得
int Calibration::getCalibMidValue()
{
  return _calibData.midValue;
}

// キャリブレーション最大値の取得
int Calibration::getCalibMaxValue()
{
  return _calibData.maxValue;
}

// キャリブレーション値の保存
bool Calibration::saveCalibration()
{
  // データの範囲チェック
  if (!isValidRange(_calibData.minValue, _calibData.maxValue) && _calibData.isCalibrated) {
    DEBUG_WARNING("無効なキャリブレーション範囲です");
    return false;
  }

  // 構造体の更新
  _calibData.checksum = calculateChecksum(_calibData);

  // ストレージに保存
  if (_storage->writeData(&_calibData, sizeof(CalibrationData), 0)) {
    if (_storage->commit()) {
      DEBUG_INFO(String("キャリブレーション保存: ") +
                "Min=" + _calibData.minValue +
                ", Mid=" + _calibData.midValue +
                ", Max=" + _calibData.maxValue +
                ", IsCalibrated=" + (_calibData.isCalibrated ? "Yes" : "No"));
      _dataLoaded = true;
      return true;
    }
  }

  DEBUG_ERROR("キャリブレーションデータの保存に失敗しました");
  return false;
}

// 保存されたキャリブレーション値の読み込み
bool Calibration::loadCalibration(int &minValue, int &midValue, int &maxValue, bool &isCalibrated)
{
  CalibrationData loadedData;

  // ストレージからデータを読み込む
  if (!_storage->readData(&loadedData, sizeof(CalibrationData), 0)) {
    DEBUG_WARNING("キャリブレーションデータの読み込みに失敗しました");

    // デフォルト値を返す
    minValue = DEFAULT_MIN;
    midValue = DEFAULT_MID;
    maxValue = DEFAULT_MAX;
    isCalibrated = false;
    return false;
  }

  // チェックサム検証
  uint16_t calculatedChecksum = calculateChecksum(loadedData);
  if (calculatedChecksum != loadedData.checksum) {
    DEBUG_WARNING("キャリブレーションデータのチェックサムエラー");

    // デフォルト値を返す
    minValue = DEFAULT_MIN;
    midValue = DEFAULT_MID;
    maxValue = DEFAULT_MAX;
    isCalibrated = false;
    return false;
  }

  // キャリブレーション範囲の検証
  if (loadedData.isCalibrated && !isValidRange(loadedData.minValue, loadedData.maxValue)) {
    DEBUG_WARNING("保存されているキャリブレーション範囲が無効です");

    // デフォルト値を返す
    minValue = DEFAULT_MIN;
    midValue = DEFAULT_MID;
    maxValue = DEFAULT_MAX;
    isCalibrated = false;
    return false;
  }

  // 検証に通った値を保存して返す
  _calibData = loadedData;
  _dataLoaded = true;

  minValue = _calibData.minValue;
  midValue = _calibData.midValue;
  maxValue = _calibData.maxValue;
  isCalibrated = _calibData.isCalibrated;

  DEBUG_INFO(String("キャリブレーション読み込み: ") +
             "Min=" + minValue +
             ", Mid=" + midValue +
             ", Max=" + maxValue +
             ", IsCalibrated=" + (isCalibrated ? "Yes" : "No"));
  return true;
}

// 値の正規化（0-100）
int Calibration::mapTo0_100(int rawValue)
{
  int result;

  if (_calibData.isCalibrated)
  {
    long num = 0;
    long den = 500;
    long mid = 500;
    // キャリブレーション済みの場合、calibMin-calibMaxの範囲を0-100に変換
    if (rawValue < _calibData.midValue) {
      num = (long)(rawValue - _calibData.minValue) * (MID_VALUE - MIN_VALUE);
      den = (long)(_calibData.midValue - _calibData.minValue);
      mid = MIN_VALUE;
    } else {
      num = (long)(rawValue - _calibData.midValue) * (MAX_VALUE - MID_VALUE);
      den = (long)(_calibData.maxValue - _calibData.midValue);
      mid = MID_VALUE;
    }
    // ゼロ除算防止
    if (den == 0)
    {
      return MIN_VALUE;
    }

    result = (int)( num / den + mid );
  }
  else
  {
    // 未キャリブレーションの場合、0-1023を0-100に変換
    result = map(rawValue, DEFAULT_MIN, DEFAULT_MAX, MIN_VALUE, MAX_VALUE);
  }

  // 値を0-100の範囲に制限
  if (result < MIN_VALUE)
    result = MIN_VALUE;
  if (result > MAX_VALUE)
    result = MAX_VALUE;

  return result;
}

// キャリブレーション範囲の検証（十分な差があるか）
bool Calibration::isValidRange(int minValue, int maxValue)
{
  return (maxValue - minValue) >= VALID_RANGE_DIFF;
}

// キャリブレーション状態のリセット
void Calibration::resetCalibration()
{
  _calibData.minValue = DEFAULT_MIN;
  _calibData.maxValue = DEFAULT_MAX;
  _calibData.isCalibrated = false;
  _calibData.checksum = calculateChecksum(_calibData);

  // ストレージに保存
  if (_storage->writeData(&_calibData, sizeof(CalibrationData), 0)) {
    _storage->commit();
    DEBUG_INFO("キャリブレーションをデフォルトにリセットしました");
  } else {
    DEBUG_ERROR("キャリブレーションリセットの保存に失敗しました");
  }

  _dataLoaded = false;
}

// チェックサムの計算
uint16_t Calibration::calculateChecksum(const CalibrationData &data)
{
  // チェックサムフィールドを除く構造体のバイト配列を作成
  const uint8_t *byteData = (const uint8_t *)&data;
  uint16_t checksum = 0;

  // チェックサムフィールドを除くすべてのバイトの合計を計算
  for (size_t i = 0; i < sizeof(CalibrationData) - sizeof(uint16_t); i++) {
    checksum += byteData[i];
  }

  return checksum;
}