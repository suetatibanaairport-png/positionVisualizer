# テスト実装について

## 概要

このディレクトリには、positionVisualizer（レバー位置可視化アプリケーション）の単体テストが含まれています。テストはBunのテストランナーを使用して実装されています。

## テストの構成

テストは以下のディレクトリ構造に従って実装されています：

- `test/domain/`: ドメイン層のテスト
  - `services/`: ValueCalculatorなどのドメインサービスのテスト
- `test/presentation/`: プレゼンテーション層のテスト
  - `controllers/`: コントローラーのテスト
  - `viewmodels/`: ViewModelのテスト
  - `renderers/`: レンダラーのテスト
- `test/infrastructure/`: インフラストラクチャ層のテスト
  - `adapters/`: WebSocketClientなどのアダプターのテスト

## テスト実行方法

テストを実行するには、プロジェクトルートで以下のコマンドを実行します：

```bash
# 全テストを実行
bun test

# 特定のディレクトリやファイルのテストを実行
bun test test/domain/services/ValueCalculator.test.js
```

## 主要なテストファイル

### 動作確認済みのテスト

- `test/domain/services/ValueCalculator.test.js`: 値の正規化、補間、統計計算などのテスト

### 開発中のテスト

以下のテストファイルは実装中であり、一部のテストケースはまだ失敗します：

- `test/presentation/viewmodels/MeterViewModel.test.js`: メーター表示のデータモデルのテスト
- `test/presentation/renderers/MeterRenderer.test.js`: SVG描画のテスト（DOM依存性があり）
- `test/presentation/controllers/AppController.test.js`: アプリケーションコントローラーのテスト
- `test/infrastructure/adapters/WebSocketClient.test.js`: WebSocket通信のテスト

## テスト設定

テストの共通設定は `test/setup.js` に定義されています。このファイルには以下の設定が含まれます：

- DOMモック（document, window オブジェクト）
- モック関数のユーティリティ
- タイマー関数のモック

## 今後の課題

1. DOMテストの改善（happy-domなどを使用して、より実際のブラウザに近い環境でテスト）
2. WebSocketクライアントのモックの改善
3. コンポーネント間の結合テストの追加
4. E2Eテストの検討（実際のブラウザ環境でのテスト）

## 注意事項

- DOM操作に依存するテストは、実際のブラウザ環境と挙動が異なる場合があります。
- WebSocketのテストは、実際のサーバーとの通信を模倣するモックを使用しています。
- デバイス通信のテストは、モックデータを使用しています。実際のデバイスとの通信は含まれていません。