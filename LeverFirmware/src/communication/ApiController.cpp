/**
 * ApiController.cpp - APIリクエスト処理コントローラーの実装
 */

#include "ApiController.h"

// コンストラクタ
ApiController::ApiController()
  : _deviceId("unknown"),
    _errorCode(0)
{
  // コールバック関数はnullptrで初期化
  _getLeverValueCallback = nullptr;
  _getRawValueCallback = nullptr;
  _getCalibrationInfoCallback = nullptr;
  _resetCalibrationCallback = nullptr;
  _setLedModeCallback = nullptr;
}

// デバイスIDを設定
void ApiController::setDeviceId(const String& deviceId)
{
  _deviceId = deviceId;
}

// センサー値取得コールバックを設定
void ApiController::setGetLeverValueCallback(GetLeverValueCallback callback)
{
  _getLeverValueCallback = callback;
}

void ApiController::setGetRawValueCallback(GetRawValueCallback callback)
{
  _getRawValueCallback = callback;
}

void ApiController::setGetCalibrationInfoCallback(GetCalibrationInfoCallback callback)
{
  _getCalibrationInfoCallback = callback;
}

// アクション用コールバックを設定
void ApiController::setResetCalibrationCallback(ResetCalibrationCallback callback)
{
  _resetCalibrationCallback = callback;
}

void ApiController::setSetLedModeCallback(SetLedModeCallback callback)
{
  _setLedModeCallback = callback;
}

// エラーコードを設定
void ApiController::setErrorCode(uint8_t errorCode)
{
  _errorCode = errorCode;
}

// APIリクエストを処理してJSONレスポンスを返す
String ApiController::handleRequest(const String& request)
{
  // リクエストに基づいて適切なハンドラーを呼び出す
  if (request == "/api" || request == "/api/") {
    return handleApiRoot();
  }
  else if (request == "/api/resetCalib" || request == "/api/reset") {
    return handleApiResetCalib();
  }
  else if (request.startsWith("/api/setLedMode")) {
    // 「/api/setLedMode?mode=X」形式のリクエストからモード値を抽出
    int modeStartPos = request.indexOf("mode=");
    if (modeStartPos > 0) {
      String modeStr = request.substring(modeStartPos + 5); // "mode="の後の文字列
      int modeEndPos = modeStr.indexOf("&");
      if (modeEndPos > 0) {
        modeStr = modeStr.substring(0, modeEndPos); // 次のパラメータがある場合は切り出す
      }

      // 数値に変換
      int mode = modeStr.toInt();
      return handleApiSetLedMode(mode);
    }
  }

  // 不明なエンドポイントの場合はエラーを返す
  JsonDocument errorDoc;
  errorDoc["status"] = "error";
  errorDoc["message"] = "Unknown API endpoint";

  String response;
  serializeJson(errorDoc, response);
  return response;
}

// APIルートエンドポイントの処理（センサーデータ取得）
String ApiController::handleApiRoot()
{
  JsonDocument jsonDoc;

  // デバイス情報
  jsonDoc["device_id"] = _deviceId;
  jsonDoc["timestamp"] = millis() / 1000; // 簡易的なタイムスタンプ

  // センサーデータ
  JsonObject data = jsonDoc["data"].to<JsonObject>();

  // コールバックが設定されていれば値を取得
  if (_getRawValueCallback) {
    data["raw"] = _getRawValueCallback();
  } else {
    data["raw"] = 0;
  }

  if (_getLeverValueCallback) {
    data["value"] = _getLeverValueCallback();
  } else {
    data["value"] = 0;
  }

  // キャリブレーション情報の取得
  int minValue = 0;
  int midValue = 512;
  int maxValue = 1023;
  bool isCalibrated = false;

  if (_getCalibrationInfoCallback) {
    _getCalibrationInfoCallback(minValue, midValue, maxValue, isCalibrated);
  }

  data["calibrated"] = isCalibrated;
  data["calib_min"] = minValue;
  data["calib_mid"] = midValue;
  data["calib_max"] = maxValue;

  // ステータス情報
  JsonObject status = jsonDoc["status"].to<JsonObject>();
  status["error_code"] = _errorCode;

  // レスポンスのシリアライズ
  String response;
  serializeJson(jsonDoc, response);
  return response;
}

// キャリブレーションリセットエンドポイントの処理
String ApiController::handleApiResetCalib()
{
  JsonDocument jsonDoc;

  // コールバックが設定されていればリセット実行
  if (_resetCalibrationCallback) {
    _resetCalibrationCallback();
    jsonDoc["status"] = "success";
    jsonDoc["message"] = "Calibration reset";
  } else {
    jsonDoc["status"] = "error";
    jsonDoc["message"] = "Reset callback not set";
  }

  // レスポンスのシリアライズ
  String response;
  serializeJson(jsonDoc, response);
  return response;
}

// LED表示モード設定エンドポイントの処理
String ApiController::handleApiSetLedMode(int mode)
{
  JsonDocument jsonDoc;

  // コールバックが設定されていれば表示モード変更
  if (_setLedModeCallback) {
    _setLedModeCallback(mode);
    jsonDoc["status"] = "success";
    jsonDoc["message"] = "LED mode set to " + String(mode);
  } else {
    jsonDoc["status"] = "error";
    jsonDoc["message"] = "Set LED mode callback not set";
  }

  // レスポンスのシリアライズ
  String response;
  serializeJson(jsonDoc, response);
  return response;
}