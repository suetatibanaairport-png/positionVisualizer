# Encoder Monitor (ESP8266 + Qt Visualizer)
ESP8266（NodeMCU）でロータリーエンコーダの値を0–100に正規化して表示・配信し、Windows 等のPCで Python を使ってリアルタイム可視化（円/棒グラフ）する最小構成。

## ハードウェア（最低限）
- ESP8266 (NodeMCU)
- ポテンショメータ（3端子：VCC, AOut, GND）
- TM1637 4桁7セグLED（CLK, DIO, VCC, GND）
- キャリブ用タクトスイッチ（GNDに落とす）
- 5V/3.3V 電源（NodeMCUの3V3使用）
## 配線（NodeMCU 例）
- Pot：VCC→3V3, Analog→A0, GND→GND
- キャリブボタン：D3（内部プルアップ、押下＝LOW）
- TM1637：CLK=D1, DIO=D2, VCC→3V3, GND→GND

※ピンはスケッチ先頭の #define で変更可。

## WiFiManager による接続設定（初回・再設定）
本デバイスは WiFiManager を用いて Wi-Fi 設定（SSID/パスワード/ホスト名など）を内蔵フラッシュに保存します。
初回起動、または保存済み設定で接続に失敗した場合は、自動的に設定用AP（アクセスポイント）を立ち上げます。
### 初回セットアップ手順
1. デバイスの電源を入れる。
2. 数秒後、スマホ/PC の Wi-Fi から PotConfigAP というAPに接続。
3. ブラウザで自動的に設定ポータル（キャプティブポータル）が開く
4. 画面の指示に従い、接続先 SSID と パスワード を入力（必要に応じて ホスト名/ラベル も入力）。
5. 保存（Save） を押す → デバイスが再起動し、指定Wi-Fiに接続。以後は自動的に同じ設定で接続します。
### 再設定（ネットワーク変更時）
- 方法A：設定ポータルを再起動
  - キャリブボタンを押しながら起動（数秒保持）
- 方法B：接続失敗時の自動フォールバック
  - 保存済みSSIDに接続できない状態が一定時間続くと、自動的にAPモードへフォールバックします。APへ接続して再設定してください。

参考：
https://github.com/tzapu/WiFiManager


## 可視化アプリ（Python / Qt）
### 依存のインストール
```
# どちらか一方（PySide6推奨）
pip install PySide6
# or
pip install PyQt5

# 共通
pip install matplotlib requests
```
### 使い方
1. 「検出(UDP)」→ 同一LANのESP一覧取得
2. ✔を付けたデバイスが右側にキャンバスとして生成
3. /api を既定 200ms 周期でポーリング → 円／棒をリアルタイム更新
4. 「円グラフで表示」チェックで方式切替、周期はUIで変更可能
