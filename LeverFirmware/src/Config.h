/**
 * Config.h - レバーコントローラの設定ファイル
 *
 * コンパイル時の設定や、ハードウェア構成に関する定数を定義する。
 * このファイルを編集することで、挙動を調整可能。
 */

#ifndef CONFIG_H
#define CONFIG_H

// シミュレーションモード設定
// true: ハードウェアなしでのシミュレーション（テスト用）
// false: 実機動作モード
#ifndef SIMULATION_MODE
#define SIMULATION_MODE false
#endif

// デバッグレベル
// 0: デバッグ出力なし
// 1: エラーのみ
// 2: 警告とエラー
// 3: 情報、警告、エラー
// 4: 詳細情報（開発時のみ使用）
#define DEBUG_LEVEL 4

// ピン設定（ESP8266）
#define POT_PIN A0       // ポテンショメータ入力ピン
#define LED_PIN D2       // ステータスLED出力ピン
#define CALIB_BUTTON_PIN D1 // キャリブレーションボタンピン（内部プルアップ、押下=LOW）

// ネットワーク設定
#define HTTP_PORT 80            // Webサーバーのポート番号
#define UDP_DISCOVERY_PORT 4210 // UDPディスカバリー用のポート番号

// センサー読み取り設定
#define SMOOTHING_FACTOR 1      // センサー値の平滑化係数（大きいほど滑らか）
#define CALIB_TIMEOUT 10000     // キャリブレーションタイムアウト（ミリ秒）
#define UPDATE_INTERVAL 50      // データ更新間隔（ミリ秒）- 20Hz

#endif // CONFIG_H