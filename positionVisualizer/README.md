# positionVisualizer

レバーデバイスの位置をリアルタイムで可視化するフロントエンドアプリケーション

## 概要

positionVisualizerは、ESP8266ベースのレバーデバイスから送信される値をリアルタイムで可視化するWebアプリケーションです。メインウィンドウとオーバーレイウィンドウ（クロマキー対応）の2つの表示モードを提供します。

## 主な機能

- **リアルタイム可視化**: レバーの位置をリアルタイムで表示
- **複数デバイス対応**: 最大6つのデバイスを同時に監視
- **カスタムアイコン**: 各デバイスに画像アイコンを設定可能
- **ログ記録・再生**: データの記録と再生機能
- **オーバーレイ表示**: クロマキー対応の録画用ウィンドウ
- **自動デバイス検出**: LeverAPIとの連携による自動デバイス検出

## ディレクトリ構造

```
positionVisualizer/
├── index.html              # メインウィンドウ
├── overlay.html            # オーバーレイウィンドウ（クロマキー対応）
├── css/
│   └── style.css          # スタイルシート
├── js/
│   ├── app.js             # メインアプリケーション
│   ├── overlay.js         # オーバーレイウィンドウ用スクリプト
│   ├── core/              # コア機能
│   │   ├── event.js       # イベント管理
│   │   ├── model.js       # データモデル
│   │   └── viewModel.js   # ビューモデル
│   ├── views/             # ビューコンポーネント
│   │   ├── iconRenderer.js    # アイコン描画
│   │   └── meterRenderer.js   # メーター描画
│   ├── bindings/          # データバインディング
│   │   └── bindings.js
│   └── services/          # サービス
│       └── replay.js      # ログ再生機能
├── http-server.js         # HTTPサーバー（静的ファイル配信）
├── bridge-server.js       # WebSocketブリッジサーバー
├── generate-log.js        # ログ生成ツール
├── bundle-static.js       # 静的リソースバンドルツール
├── http-server-bundled.js # バンドル済みHTTPサーバー
├── integrated-server.js   # 統合サーバー
├── assets/
│   └── icon.svg           # デフォルトアイコン
├── sw.js                   # Service Worker（PWA対応）
└── package.json            # 依存パッケージ定義
```

## 起動方法

### 自動起動（推奨）

プロジェクトルートの `start-visualizer.bat` を実行すると、以下のサーバーが自動的に起動します：

- HTTP Server (ポート8000) - 静的ファイル配信
- Bridge Server (ポート8123) - WebSocketブリッジ
- LeverAPI Server (ポート5000) - APIサーバー

### 手動起動

#### 1. 依存パッケージのインストール

```bash
npm install
```

#### 2. HTTPサーバーの起動

```bash
node http-server.js
```

デフォルトで `http://127.0.0.1:8000` で起動します。

#### 3. Bridgeサーバーの起動（別ターミナル）

```bash
node bridge-server.js
```

デフォルトでポート8123で起動します。

#### 4. ブラウザでアクセス

- メインウィンドウ: http://127.0.0.1:8000/
- オーバーレイウィンドウ: http://127.0.0.1:8000/overlay.html

## 使用方法

### メインウィンドウ

1. **デバイス設定**
   - 各デバイス（最大6つ）に名前とアイコン画像を設定
   - レンジ設定で最小値・最大値を調整

2. **リアルタイム表示**
   - LeverAPIから自動的にデバイスを検出
   - レバーの位置がリアルタイムで表示される

3. **ログ機能**
   - 「記録開始」ボタンでデータ記録を開始
   - 「記録停止」ボタンで記録を停止
   - 「保存」ボタンでJSON形式でダウンロード
   - 「ファイルを選択」で保存したログを読み込んで再生

### オーバーレイウィンドウ

- クロマキー対応の録画用ウィンドウ
- ゲーム画面に重ねて表示可能
- 常に前面に表示される設定

## 技術スタック

- **フロントエンド**: Vanilla JavaScript
- **通信**: WebSocket、Socket.IO
- **サーバー**: Node.js
- **スタイリング**: CSS3

## 依存パッケージ

```json
{
  "ws": "^8.18.3",
  "socket.io-client": "^4.7.5"
}
```

## API連携

### LeverAPIとの連携

positionVisualizerは、LeverAPIサーバーと以下の方法で連携します：

1. **WebSocket接続**: Bridgeサーバー経由でSocket.IOを使用
2. **デバイス検出**: `/api/devices` エンドポイントからデバイスリストを取得
3. **値の取得**: WebSocket経由でリアルタイムに値を受信

### Bridgeサーバー

`bridge-server.js`（以前は `tools/bridge-server.js`）は以下の役割を果たします：

- LeverAPI（Socket.IO）とフロントエンド（WebSocket）のブリッジ
- デバイスIDをインデックスにマッピング（lever1 → 0, lever2 → 1, etc.）
- 最新の値をキャッシュしてクライアントに配信

## 開発

### ファイル構成

- **app.js**: メインアプリケーションロジック
- **core/**: MVCパターンに基づくコア機能
  - `model.js`: データモデル（デバイス情報、値など）
  - `viewModel.js`: ビューモデル（UI状態管理）
  - `event.js`: イベントシステム
- **views/**: 描画コンポーネント
  - `meterRenderer.js`: メーターの描画
  - `iconRenderer.js`: アイコンの描画
- **services/**: サービス層
  - `replay.js`: ログ再生機能

### カスタマイズ

#### デバイス数の変更

デフォルトでは最大6つのデバイスをサポートしています。変更する場合は：

1. `index.html` のデバイス入力フィールドを変更
2. `js/core/model.js` のデバイス配列サイズを変更
3. `bridge-server.js` のデバイスインデックスマッピングを調整

#### スタイルの変更

`css/style.css` を編集してスタイルをカスタマイズできます。

## トラブルシューティング

### デバイスが表示されない

1. LeverAPIサーバーが起動しているか確認
2. Bridgeサーバーが起動しているか確認
3. ブラウザのコンソールでエラーを確認

### WebSocket接続エラー

1. Bridgeサーバーがポート8123で起動しているか確認
2. ファイアウォールの設定を確認
3. `bridge-server.js` の設定を確認

### ログが再生されない

1. ログファイルの形式が正しいか確認（JSON形式）
2. ブラウザのコンソールでエラーを確認
3. `js/services/replay.js` のログ形式を確認
