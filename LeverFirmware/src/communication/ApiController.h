/**
 * ApiController.h - APIリクエスト処理コントローラー
 *
 * HTTP APIリクエストを処理し、JSON形式でレスポンスを返すコントローラークラスを提供します。
 * キャリブレーションコールバック、LED表示モード変更などのハンドラーも管理します。
 */

#ifndef API_CONTROLLER_H
#define API_CONTROLLER_H

#include <Arduino.h>
#include <ArduinoJson.h>
#include <functional>

// APIコントローラーが使用するコールバック関数の型定義
using ResetCalibrationCallback = std::function<void()>;
using SetLedModeCallback = std::function<void(int)>;
using GetLeverValueCallback = std::function<int()>;
using GetRawValueCallback = std::function<int()>;
using GetCalibrationInfoCallback = std::function<void(int&, int&, int&, bool&)>;

class ApiController {
public:
  ApiController();
  ~ApiController() {}

  // デバイスIDを設定
  void setDeviceId(const String& deviceId);

  // センサー値取得コールバックを設定
  void setGetLeverValueCallback(GetLeverValueCallback callback);
  void setGetRawValueCallback(GetRawValueCallback callback);
  void setGetCalibrationInfoCallback(GetCalibrationInfoCallback callback);

  // アクション用コールバックを設定
  void setResetCalibrationCallback(ResetCalibrationCallback callback);
  void setSetLedModeCallback(SetLedModeCallback callback);

  // エラーコードを設定
  void setErrorCode(uint8_t errorCode);

  // APIリクエストを処理してJSONレスポンスを返す
  String handleRequest(const String& request);

private:
  // デバイス情報
  String _deviceId;
  uint8_t _errorCode;

  // 各種コールバック関数
  GetLeverValueCallback _getLeverValueCallback;
  GetRawValueCallback _getRawValueCallback;
  GetCalibrationInfoCallback _getCalibrationInfoCallback;
  ResetCalibrationCallback _resetCalibrationCallback;
  SetLedModeCallback _setLedModeCallback;

  // 各種APIエンドポイント処理
  String handleApiRoot();
  String handleApiResetCalib();
  String handleApiSetLedMode(int mode);
};

#endif // API_CONTROLLER_H