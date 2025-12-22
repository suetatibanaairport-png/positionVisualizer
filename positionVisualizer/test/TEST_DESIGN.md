# 単体テスト設計書

## 1. テスト対象コンポーネント

主要なUI関連コンポーネントの動作を確認するため、以下のコンポーネントのテストを実装します：

1. **MeterRenderer** (`src/presentation/renderers/MeterRenderer.js`)
   - SVGを使用したメーター表示の描画を担当
   - 値に基づくアイコンの位置計算や表示更新

2. **MeterViewModel** (`src/presentation/viewmodels/MeterViewModel.js`)
   - メーター表示のデータモデル
   - 値の保持と状態管理

3. **AppController** (`src/presentation/controllers/AppController.js`)
   - UIとビジネスロジックの橋渡し
   - ユーザーインタラクションのハンドリング

4. **WebSocketClient** (`src/infrastructure/adapters/WebSocketClient.js`)
   - WebSocket通信処理
   - サーバーからのデータ受信と接続管理

5. **ValueCalculator** (`src/domain/services/ValueCalculator.js`)
   - 値の計算処理
   - 生データの正規化など

## 2. テスト方針

### 2.1 MeterRenderer のテスト

- **テスト内容**:
  - コンストラクタ: 適切なSVG要素が作成されるか
  - update メソッド: 値更新時に正しいSVG要素が更新されるか
  - _calculateIconPosition メソッド: 値に応じて正しい位置が計算されるか
  - resize メソッド: サイズ変更が正しく適用されるか
  - dispose メソッド: リソースが適切に解放されるか

- **テスト手法**:
  - DOM操作のテストとして、happy-domを使用
  - SVG要素の属性や構造を検証

### 2.2 MeterViewModel のテスト

- **テスト内容**:
  - コンストラクタ: 初期状態が正しく設定されるか
  - updateDeviceValue メソッド: デバイス値が正しく更新されるか
  - updateDeviceConnection メソッド: 接続状態が正しく更新されるか
  - getValue/getValues メソッド: 値の取得が正しく機能するか
  - アイコン関連の操作: アイコンの設定・取得が正しく機能するか

- **テスト手法**:
  - 状態変更後の内部状態の検証
  - エッジケース（無効な値、境界値など）のテスト

### 2.3 AppController のテスト

- **テスト内容**:
  - start メソッド: アプリケーションが正しく起動するか
  - getAllDevices メソッド: デバイスリストが正しく取得できるか
  - resetDevices メソッド: デバイスのリセットが機能するか
  - startRecording/stopRecording メソッド: 記録機能が正しく動作するか
  - playLog/stopPlayback メソッド: ログ再生機能が正しく動作するか

- **テスト手法**:
  - 依存コンポーネントのモック化
  - WebSocketClientのモックを使用した通信テスト

### 2.4 WebSocketClient のテスト

- **テスト内容**:
  - connect メソッド: 接続が正しく確立されるか
  - disconnect メソッド: 接続が正しく切断されるか
  - send メソッド: メッセージが正しく送信されるか
  - onMessage コールバック: メッセージ受信時の処理が正しく機能するか
  - 再接続機能: 接続切断時に適切に再接続が試みられるか

- **テスト手法**:
  - WebSocketのモック実装を使用
  - イベントハンドラのテスト
  - エラーケースのテスト

### 2.5 ValueCalculator のテスト

- **テスト内容**:
  - normalizeValue メソッド: 値が正しく正規化されるか
  - calculateAverageValue メソッド: 平均値が正しく計算されるか
  - その他の計算関数: 入力に対して正しい出力が得られるか

- **テスト手法**:
  - 既知の入力と予測される出力の比較
  - 境界値・エッジケースのテスト（0, null, NaN, Infinity など）

## 3. テストデータ設計

### 3.1 デバイスデータのモック

```javascript
const mockDeviceData = [
  {
    id: "device-1",
    name: "デバイス1",
    value: { normalizedValue: 25, rawValue: 256 },
    connected: true,
    iconUrl: "assets/icon1.svg"
  },
  {
    id: "device-2",
    name: "デバイス2",
    value: { normalizedValue: 75, rawValue: 768 },
    connected: true,
    iconUrl: "assets/icon2.svg"
  }
];
```

### 3.2 WebSocketメッセージのモック

```javascript
// デバイス更新メッセージ
const mockDeviceUpdateMessage = {
  type: "device_update",
  data: {
    devices: [
      { id: "device-1", value: 30, connected: true },
      { id: "device-2", value: 50, connected: false }
    ]
  }
};

// デバイスリストメッセージ
const mockDeviceListMessage = {
  type: "device_list",
  data: {
    devices: [
      { id: "device-1", name: "デバイス1", connected: true },
      { id: "device-2", name: "デバイス2", connected: true },
      { id: "device-3", name: "デバイス3", connected: false }
    ]
  }
};
```

### 3.3 設定値のモック

```javascript
const mockSettings = {
  displayMode: "circular",
  updateInterval: 100,
  showLabels: true,
  iconSize: 48,
  theme: "dark"
};
```

## 4. テスト実行計画

1. 個別コンポーネントのテストを実装
2. `bun test`コマンドによる全テスト実行
3. コードカバレッジの測定と不足部分の特定
4. エッジケースのテスト追加
5. 統合テストの追加（必要に応じて）

## 5. 将来的な拡張

- E2Eテストの追加
- WebSocketサーバーを含めた統合テスト
- パフォーマンステストの追加