# LeverSystem

レバーデバイスのリアルタイム可視化システム

## 概要

LeverSystemは、ESP8266ベースのレバーデバイスから送信される値をリアルタイムで可視化するシステムです。ポータブル版のNode.jsとPythonを含むため、システムにインストール不要で動作します。

## 主な機能

- **リアルタイム可視化**: レバーの位置をリアルタイム表示
- **クロマキー**: 録画用ウィンドウ
- **ログ記録・再生**: データの記録と再生機能
- **自動デバイス検出**: UDP検出による自動デバイス検出
- **ポータブル版対応**: Node.jsとPythonのポータブル版を含むため、システムインストール不要

## プロジェクト構成

```
leverSystem/
├── positionVisualizer/    # フロントエンド（HTML/JavaScript）
│   ├── index.html         # メインウィンドウ
│   ├── overlay.html       # オーバーレイウィンドウ
│   ├── js/                # JavaScriptソースコード
│   └── tools/             # サーバーツール
├── LeverAPI/              # Python APIサーバー
│   ├── app.py             # メインAPIサーバー
│   └── requirements.txt   # Python依存パッケージ
├── LeverFirmware/         # Arduinoファームウェア
│   └── LeverFirmware.ino  # ESP8266ファームウェア
├── node-portable/         # Node.jsポータブル版
├── python-portable/       # Pythonポータブル版
├── start-visualizer.bat   # メイン起動スクリプト
├── setup-node-portable.bat    # Node.jsポータブル版セットアップ
└── setup-python-portable.bat  # Pythonポータブル版セットアップ
```

## クイックスタート

### 1. 初回セットアップ（インターネット接続が必要）

#### 方法A: 自動セットアップ（推奨）

1. `start-visualizer.bat` をダブルクリック
2. 確認ダイアログで「実行」を選択
3. Node.jsとPythonが自動的にダウンロード・セットアップされます

#### 方法B: 個別セットアップ

1. **Node.jsポータブル版のセットアップ**
   - `setup-node-portable.bat` を実行
   - 約50MBのダウンロードが必要です

2. **Pythonポータブル版のセットアップ**
   - `setup-python-portable.bat` を実行
   - 約25MBのダウンロードが必要です

### 2. 起動

1. `start-visualizer.bat` をダブルクリック
2. 以下のサーバーが自動的に起動します：
   - LeverAPI Server (ポート5000)
   - HTTP Server (ポート8000)
   - Bridge Server (ポート8123)
3. ブラウザでメインウィンドウとオーバーレイウィンドウが自動的に開きます

### 3. 終了

起動したサーバーウィンドウ（LeverAPI Server、HTTP Server、Bridge Server）を閉じると、アプリが終了します。

## システム要件

- **OS**: Windows 10/11 (64bit)
- **インターネット接続**: 初回セットアップ時のみ必要
- **ディスク容量**: 約100MB（ポータブル版含む）

## ポータブル版について

このプロジェクトには、Node.jsとPythonのポータブル版が含まれています：

- **Node.js v20.11.0** (約50MB)
- **Python 3.11.9** (約25MB)

これにより、システムにNode.jsやPythonをインストールする必要がありません。

### ポータブル版のセットアップ

#### 自動セットアップ

`start-visualizer.bat` を実行すると、ポータブル版が存在しない場合、自動的にダウンロード・セットアップされます。

#### 手動セットアップ

- **Node.js**: `setup-node-portable.bat` を実行
- **Python**: `setup-python-portable.bat` を実行

#### オフライン環境でのセットアップ

別のPCでダウンロードしたポータブル版を手動で配置することもできます：

1. **Node.js**
   - https://nodejs.org/dist/v20.11.0/node-v20.11.0-win-x64.zip をダウンロード
   - 展開して `node-portable` フォルダに配置

2. **Python**
   - https://www.python.org/ftp/python/3.11.9/python-3.11.9-embed-amd64.zip をダウンロード
   - 展開して `python-portable` フォルダに配置
   - pipをセットアップ（詳細は各セットアップスクリプトを参照）

## 実行ファイルのコンパイルについて

コードを更新した後に実行ファイルを再コンパイルする手順を説明します。初回のスタンドアロン化セットアップについては、`claudedocs/positionVisualizer_スタンドアロン化手順.md` を参照してください。

### Python (LeverAPI) の再コンパイル

LeverAPIのコードを更新した場合、PyInstallerを使用して再コンパイルします。

**重要**: PyInstallerは実行している環境（OS）向けの実行ファイルしか生成できません。クロスプラットフォームビルド（MacからWindows用バイナリを作成するなど）には対応していません。Windows用の実行ファイル（.exe）を生成するには、Windows環境でコマンドを実行する必要があります。

```bash
# 依存パッケージが追加された場合はインストール
cd ./LeverAPI
pip install -r requirements.txt

# コンパイル実行（実行環境と同じOS向けの実行ファイルが生成されます）
pyinstaller --onefile --collect-submodules=dns --collect-submodules=eventlet \
  --hidden-import=engineio.async_drivers.eventlet \
  --hidden-import=api.discovery --hidden-import=api.device_manager \
  --hidden-import=api.transformers --hidden-import=api.cache \
  --name LeverAPI app.py
```

Windows環境でコンパイルした場合、実行ファイルは `./LeverAPI/dist/LeverAPI.exe` に作成されます。
macOSでコンパイルした場合は `.exe` 拡張子なしの実行ファイルが作成されます。
更新する場合は `./app/[OS name]` の実行ファイルと置換してください。

### フロントエンドの再コンパイル

フロントエンドのコードを更新した場合、以下の手順で再コンパイルします。

**注意**: Node.jsの`pkg`ツールはクロスプラットフォームビルドをサポートしているため、macOSからでもWindows用の実行ファイルを生成できます。

```bash
# 依存パッケージが追加された場合はインストール
npm install

# Windows用実行ファイルの生成（macOSからでも実行可能）
npm run build:win

# macOS向けにビルドする場合
npm run build:mac

# Linux向けにビルドする場合
npm run build:linux
```

コンパイル後の実行ファイルは `./app/[OS name]/LeverScope.exe`（Windows向け）に作成されます。
プロジェクトで使用している実行ファイルを新しくコンパイルしたものと置き換えてください。

### 注意事項

1. **依存関係の変更**: 新しいライブラリやモジュールを追加した場合、コンパイル前に必ず依存パッケージをインストールしてください。

2. **隠れた依存関係**: PyInstallerで新しいモジュールを使用する場合、`--hidden-import` オプションの追加が必要になることがあります。

3. **クロスプラットフォームビルド**:
   - Python (LeverAPI): 実行している環境と同じOS向けの実行ファイルしか生成できません。Windows用の.exeファイルが必要な場合は、Windows環境でコンパイルする必要があります。
   - Node.js (フロントエンド): pkg ツールはクロスプラットフォームビルドをサポートしているため、macOSからでもWindows用の実行ファイルを生成できます。

4. **ファイルパス**: コンパイル後の実行ファイルは、それぞれ適切なディレクトリに移動・配置してください。

5. **配布**: 最終的な実行ファイル一式をまとめる場合は、配布用パッケージの作成手順を参照してください（`claudedocs/positionVisualizer_スタンドアロン化手順.md` の「配布パッケージの作成」セクション）。

## 使用方法

### メインウィンドウ

- レバーの位置を円グラフ・棒グラフで表示
- 複数のデバイスを同時に監視可能
- ログの記録・再生機能

### オーバーレイウィンドウ

- ゲーム画面に重ねて表示可能
- 常に前面に表示される設定
- シンプルな表示でゲームの邪魔にならない

### ログ機能

1. **記録開始**: メインウィンドウで「記録開始」ボタンをクリック
2. **記録停止**: 「記録停止」ボタンをクリック
3. **保存**: 記録したデータをJSON形式で保存
4. **再生**: 保存したログファイルを読み込んで再生

## 開発者向け情報

### プロジェクト構造

- **positionVisualizer/**: フロントエンド（Vanilla JavaScript）
- **LeverAPI/**: Python Flask APIサーバー
- **LeverFirmware/**: ESP8266 Arduinoファームウェア

### APIエンドポイント

詳細は `LeverAPI/API_DOCUMENTATION.md` を参照してください。

主なエンドポイント：
- `GET /api/devices` - 検出されたデバイスのリスト
- `GET /api/devices/{device_id}/value` - 特定デバイスの値
- `GET /api/values` - すべてのデバイスの値を一括取得

### ビルド・開発

#### フロントエンド

```bash
cd positionVisualizer
npm install
```

#### APIサーバー

```bash
cd LeverAPI
pip install -r requirements.txt
python app.py
```

#### ファームウェア

PlatformIOを使用してビルド・アップロード：

```bash
cd LeverFirmware
platformio run --target upload
```

## トラブルシューティング

### Node.jsが見つからない

- `setup-node-portable.bat` を実行してポータブル版をセットアップ
- または、システムにNode.jsをインストール

### Pythonが見つからない

- `setup-python-portable.bat` を実行してポータブル版をセットアップ
- または、システムにPythonをインストール

### ポートが使用中

- ポート5000、8000、8123が使用されている場合、他のアプリケーションを終了してください

### デバイスが検出されない

- ESP8266デバイスが同じネットワークに接続されているか確認
- LeverAPIサーバーが起動しているか確認
- ファームウェアが正しくアップロードされているか確認

## ライセンス

（プロジェクトのライセンス情報を記載）

## 貢献

（貢献方法を記載）

## 関連リンク

- [LeverAPI ドキュメント](LeverAPI/README.md)
- [LeverFirmware ドキュメント](LeverFirmware/README.md)
