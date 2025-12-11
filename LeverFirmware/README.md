# レバー制御ファームウェア

「白黒つけない会議」のための物理レバーデバイス制御ファームウェアです。レバーの物理的な動きを0-100の数値に変換し、リアルタイムに表示およびシリアル通信で送信します。

## 概要

このファームウェアは、ポテンショメータを使用したレバー装置の制御、値の読み取り、キャリブレーション、および通信機能を提供します。マイコン非依存の設計を目指しており、将来的に様々なマイコンに対応できるよう設計されています。

## 機能

- ポテンショメータ入力の読み取りと平滑化処理
- 値の正規化（0-100）とキャリブレーション
- キャリブレーションデータの永続化
- シリアル通信によるJSON形式でのデータ送信
- LED表示による視覚的フィードバック
- エラー検出と復帰処理
- Non-blocking設計（リアルタイム応答性）

## プロジェクト構造

```
LeverFirmware/
├── src/                    # メインソースコード
│   ├── core/               # コア機能
│   ├── display/            # 表示機能
│   ├── communication/      # 通信関連
│   └── error/              # エラー処理
├── include/                # グローバルヘッダー
├── test/                   # テストコード
├── tools/                  # 開発・テスト用ツール
├── docs/                   # ドキュメント
└── LeverFirmware.ino       # メインスケッチ
```

詳細な構造については [docs/project_structure.md](docs/project_structure.md) を参照してください。

## ハードウェア要件

- **マイコン**: ESP8266/ESP32/Arduino（プリプロセッサマクロで切り替え）
- **センサー**: ポテンショメータ（アナログ入力ピン）
- **入力**: キャリブレーションボタン（デジタル入力ピン、内部プルアップ）
- **表示**: LED表示装置
- **通信**: シリアル通信（USB接続）

## ピン配置（ESP8266ベース）

| 機能 | ピン | 備考 |
|-----|------|------|
| ポテンショメータ | A0 | アナログ入力 |
| キャリブレーションボタン | D1 | 内部プルアップ、押下=LOW |
| LED表示装置 | D2 | HIGH=点灯, LOW=消灯 |

## セットアップ方法

### Arduino IDEでの使用方法

1. このリポジトリをクローン
2. Arduino IDEでLeverFirmware.inoを開く
3. 必要なライブラリをインストール
   - ArduinoJson
4. マイコンボードを選択
5. コンパイルとアップロード

### PlatformIOでの使用方法

```bash
# インストール
platformio run --target upload

# モニター
platformio device monitor
```

## テスト

テスト実行方法については [docs/testing_guide.md](docs/testing_guide.md) を参照してください。

### ユニットテスト

```bash
# すべてのテストを実行
platformio test -e native
```

### シリアル通信テストハーネス

```bash
# 対話モード
python tools/serial_test_harness/serial_test_harness.py --port [ポート名]

# 自動テスト
python tools/serial_test_harness/serial_test_harness.py --port [ポート名] --auto
```

## 通信プロトコル

### 受信コマンド

- `GET_DATA` - センサーデータの送信要求
- `RESET_CALIB` - キャリブレーションのリセット
- `SET_ID:xxxx` - デバイスIDの設定

### 送信データフォーマット

```json
{
  "device_id": "lever1",
  "timestamp": 1646916712,
  "data": {
    "raw": 512,
    "smoothed": 500,
    "value": 50,
    "calibrated": true,
    "calib_min": 0,
    "calib_max": 1023
  },
  "status": {
    "error_code": 0
  }
}
```

## 開発状況

| 機能 | 状態 |
|-----|------|
| 基本設定と初期化コード | ✅ |
| センサー入力と平滑化処理 | ✅ |
| 値の正規化とキャリブレーション | ✅ |
| シリアル通信（JSON） | ✅ |
| LED表示パターン | ✅ |
| エラー検出と復帰処理 | ✅ |
| テスト環境の構築 | ✅ |
| 複数レバーの識別と管理 | ⏳ |
