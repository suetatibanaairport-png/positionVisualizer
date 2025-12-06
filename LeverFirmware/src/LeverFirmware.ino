/**
 * LeverFirmware.ino - Pedantic Lever Controllerのメインスケッチ
 *
 * ESP8266を使用したレバーコントローラーのファームウェア。
 * ポテンショメータ、WiFi接続、LEDステータス表示、キャリブレーション機能を実装。
 *
 * ハードウェア：
 * - ESP8266（NodeMCU等）
 * - ポテンショメータ（A0ピンに接続）
 * - ステータスLED（D2ピンに接続）
 * - キャリブレーションボタン（D0ピンに接続、プルアップ）
 *
 * 機能：
 * - WiFiマネージャによる接続設定（初回起動時にAPモードでセットアップ）
 * - HTTP APIによるレバー値の取得
 * - UDPディスカバリによる自動検出
 * - キャリブレーションボタンによるレバー値範囲調整
 * - LEDによる動作状態表示
 *
 * シミュレーションモード：
 * - コンパイル時に SIMULATION_MODE を定義するとシミュレーションモードで動作
 * - ハードウェアなしでのテストが可能
 */

#include <Arduino.h>
#include "../src/LeverController.h"

// シミュレーションモード設定
// SIMULATION_MODE はコンパイル時に定義される想定
#ifndef SIMULATION_MODE
#define SIMULATION_MODE false
#endif

// レバーコントローラインスタンス
LeverController leverController(SIMULATION_MODE);

void setup() {
  // シリアル初期化
  Serial.begin(115200);
  Serial.println("\n\n=== Pedantic Lever Controller ===");
  Serial.println("Firmware version 1.0.0");
  Serial.println("Mode: " + String(SIMULATION_MODE ? "SIMULATION" : "HARDWARE"));

  // レバーコントローラの初期化
  //leverController.resetWiFiSettings();
  leverController.begin();
}

void loop() {
  // レバーコントローラの定期更新
  leverController.update();

  // メインループに余裕を持たせる
  yield();
}