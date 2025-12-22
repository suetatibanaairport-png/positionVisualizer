# positionVisualizer

レバーデバイスの位置をリアルタイムで可視化するフロントエンドアプリケーション

## 概要

positionVisualizerは、ESP8266ベースのレバーデバイスから送信される値をリアルタイムで可視化するWebアプリケーションです。メインウィンドウとオーバーレイウィンドウ（クロマキー対応）の2つの表示モードを提供します。

## 新アーキテクチャ（クリーンアーキテクチャ）

このプロジェクトは最近、クリーンアーキテクチャパターンに基づいて再構築されました。新しいアーキテクチャは以下の層に分かれています：

```
positionVisualizer/
├── src/
│   ├── domain/           # ドメイン層：ビジネスロジックとエンティティ
│   ├── application/      # アプリケーション層：ユースケースとサービス
│   ├── infrastructure/   # インフラ層：外部サービスとの連携
│   └── presentation/     # プレゼンテーション層：UI管理
└── dist/                # ビルド済みアプリケーション
```

### 各レイヤーの役割

#### ドメイン層 (Domain Layer)
ビジネスのコアロジックと基本的なエンティティを含み、他の層に依存しない純粋な実装です。

- `domain/entities/`: Device、DeviceValueなどのエンティティクラス
- `domain/repositories/`: リポジトリのインターフェース定義
- `domain/events/`: ドメインイベントの定義

#### アプリケーション層 (Application Layer)
ユースケースを実装し、ドメインオブジェクトの調整を行います。

- `application/usecases/`: MonitorValues、RecordSession、ReplaySessionなどのユースケース
- `application/services/`: DeviceServiceなどのサービスクラス

#### インフラストラクチャ層 (Infrastructure Layer)
外部システムとの接続を担当し、リポジトリの具体的な実装などを含みます。

- `infrastructure/adapters/`: WebSocketClient、LocalStorageAdapterなどのアダプター
- `infrastructure/repositories/`: リポジトリの実装
- `infrastructure/services/`: EventBus、Loggerなどのインフラサービス

#### プレゼンテーション層 (Presentation Layer)
ユーザーインターフェースとのやり取りを担当します。

- `presentation/viewmodels/`: MeterViewModelなどのビューモデル
- `presentation/renderers/`: MeterRendererなどのレンダラー
- `presentation/controllers/`: AppControllerなどのコントローラー

## 主な機能

- **リアルタイム可視化**: レバーの位置をリアルタイムで表示
- **複数デバイス対応**: 最大6つのデバイスを同時に監視
- **カスタムアイコン**: 各デバイスに画像アイコンを設定可能
- **ログ記録・再生**: データの記録と再生機能
- **オーバーレイ表示**: クロマキー対応の録画用ウィンドウ
- **自動デバイス検出**: LeverAPIとの連携による自動デバイス検出

## 主要クラスの概要

### DeviceService
デバイスの登録・管理・値の設定などを担当するアプリケーションサービス。

```javascript
const deviceService = new DeviceService(deviceRepository, valueRepository);
await deviceService.registerDevice('device-1', { name: 'センサー1' });
```

### MeterViewModel
メーター表示のためのビューモデル。状態管理と値の補間処理を担当。

```javascript
const viewModel = new MeterViewModel({ maxDevices: 6 });
viewModel.setValue(0, 75, true); // デバイス0の値を75に設定
```

### MeterRenderer
SVGを使用してメーターを描画するレンダラー。

```javascript
const renderer = new MeterRenderer(document.getElementById('meter-container'));
renderer.update(viewModelState);
```

### AppController
アプリケーション全体のコントローラー。各コンポーネントを調整し、ユーザーインターフェースとのやり取りを管理。

```javascript
const app = new AppController({ /* 依存関係 */ });
await app.start();
```

## イベントの流れ

1. WebSocketからデバイスメッセージを受信
2. DeviceServiceがデバイスを登録・管理
3. MonitorValuesUseCaseがデバイスの値をモニタリング
4. MeterViewModelが値の状態を管理
5. MeterRendererが値を視覚化
6. ユーザー操作はAppControllerを通じてシステムに伝達

## 改良点

新アーキテクチャでは、以下の問題点を解決しています：

1. **責任の分離**: 各クラスが単一の責任を持ち、密結合を回避
2. **状態管理の一元化**: MeterViewModelによる一貫した状態管理
3. **デバイスライフサイクル管理**: 接続・切断・タイムアウトの明確な処理
4. **アイコン表示制御**: アイコンの表示・非表示の適切な管理
5. **テスト容易性**: 依存性注入による単体テストの容易化

## 起動方法（従来の方法）

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
- **通信**: WebSocket
- **サーバー**: Node.js
- **スタイリング**: CSS3

## API連携

### LeverAPIとの連携

positionVisualizerは、LeverAPIサーバーと以下の方法で連携します：

1. **WebSocket接続**: Bridgeサーバー経由でWebSocketを使用
2. **デバイス検出**: WebSocket経由でデバイス情報を受信
3. **値の取得**: WebSocket経由でリアルタイムに値を受信

### Bridgeサーバー

`bridge-server.js` は以下の役割を果たします：

- LeverAPIとフロントエンド（WebSocket）のブリッジ
- デバイスIDをインデックスにマッピング（lever1 → 0, lever2 → 1, etc.）
- 最新の値をキャッシュしてクライアントに配信

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
3. ログ形式を確認