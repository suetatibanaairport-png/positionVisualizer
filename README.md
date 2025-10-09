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
### ※ピンはスケッチ先頭の #define で変更可。
