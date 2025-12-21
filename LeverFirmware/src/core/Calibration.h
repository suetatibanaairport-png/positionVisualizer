/**
 * Calibration.h - レバーセンサーのキャリブレーション機能
 *
 * マイコン非依存のキャリブレーション機能を提供するヘッダファイル。
 * キャリブレーション値の永続化と読み込み、検証機能を含む。
 */

#ifndef CALIBRATION_H
#define CALIBRATION_H

#include <Arduino.h>
#include "Hardware.h" // ハードウェア抽象化インターフェース

// キャリブレーション構造体
struct CalibrationData
{
  int minValue;      // キャリブレーション最小値
  int midValue;      // キャリブレーション中間値
  int maxValue;      // キャリブレーション最大値
  bool isCalibrated; // キャリブレーション完了フラグ
  uint16_t checksum; // データ検証用チェックサム
};

class Calibration
{
public:
  Calibration();
  ~Calibration();

  // 初期化（起動時に呼び出す）
  void begin();

  // キャリブレーション値の保存
  bool saveCalibration();

  // 保存されたキャリブレーション値の読み込み
  bool loadCalibration(int &minValue, int &midValue, int &maxValue, bool &isCalibrated);

  // 値の正規化（0-100）
  int mapTo0_100(int rawValue);

  // キャリブレーション範囲の検証（十分な差があるか）
  bool isValidRange(int minValue, int maxValue);

  // キャリブレーション状態のリセット
  void resetCalibration();

  // キャリブレーション最小値のセット
  void setCalibMinValue(int minValue);

  // キャリブレーション中間値のセット
  void setCalibMidValue(int midValue);

  // キャリブレーション最大値のセット
  void setCalibMaxValue(int maxValue);

  // キャリブレーション最小値の取得
  int getCalibMinValue();

  // キャリブレーション中間値の取得
  int getCalibMidValue();

  // キャリブレーション最大値の取得
  int getCalibMaxValue();

private:
  CalibrationData _calibData;
  bool _dataLoaded;

  // ストレージマネージャ
  IStorageManager* _storage;

  // チェックサムの計算
  uint16_t calculateChecksum(const CalibrationData &data);
};

#endif // CALIBRATION_H