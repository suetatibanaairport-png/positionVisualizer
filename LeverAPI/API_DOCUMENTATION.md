# PedanticLeverController API ドキュメント

## 概要

このドキュメントでは、PedanticLeverControllerのBFF（Backend For Frontend）として機能するAPIサーバーのエンドポイントと使用方法について説明します。

このAPIサーバーは、レバーデバイスを検出、監視、管理するためのインターフェースを提供し、フロントエンドアプリケーションとレバーデバイス間の通信を仲介します。

## 基本情報

- ベースURL: `http://[サーバーアドレス]:5000`
- コンテンツタイプ: `application/json`
- CORS: すべてのオリジンからのリクエストを許可

## APIエンドポイント

APIエンドポイントは以下のカテゴリに分けられています：

1. コアAPI（`/api/`プレフィックス付き）
2. 拡張BFFエンドポイント（データ集約、バッチ処理など）
3. シミュレーションモード関連

### 1. コアAPI

#### 1.1 デバイス管理

##### デバイスリストの取得

```
GET /api/devices
```

**レスポンス例**:
```json
{
  "devices": [
    {
      "id": "lever_001",
      "name": "レバー 1",
      "ip": "192.168.1.100",
      "status": "online",
      "last_seen": 1636540800.123
    },
    {
      "id": "lever_002",
      "name": "レバー 2",
      "ip": "192.168.1.101",
      "status": "offline",
      "last_seen": 1636540500.456
    }
  ]
}
```

##### デバイスの現在値を取得

```
GET /api/devices/{device_id}/value
```

**パラメータ**:
- `device_id`: デバイスのID

**レスポンス例（成功）**:
```json
{
  "device_id": "lever_001",
  "name": "レバー 1",
  "value": 75,
  "raw": 768,
  "timestamp": 1636540800.123
}
```

**レスポンス例（失敗）**:
```json
{
  "status": "error",
  "code": 404,
  "message": "Device not found or offline"
}
```

##### すべてのデバイスの値を一括取得

```
GET /api/values
```

**レスポンス例**:
```json
{
  "values": {
    "lever_001": {
      "name": "レバー 1",
      "value": 75,
      "raw": 768,
      "timestamp": 1636540800.123
    },
    "lever_003": {
      "name": "レバー 3",
      "value": 42,
      "raw": 430,
      "timestamp": 1636540801.456
    }
  }
}
```

##### デバイス検出スキャンの実行

```
POST /api/scan
```

**レスポンス例**:
```json
{
  "status": "success",
  "message": "スキャンを開始しました"
}
```

##### デバイス名の更新

```
PUT /api/devices/{device_id}/name
```

**パラメータ**:
- `device_id`: デバイスのID

**リクエスト本文**:
```json
{
  "name": "新しいデバイス名"
}
```

**レスポンス例（成功）**:
```json
{
  "status": "success",
  "device_id": "lever_001",
  "new_name": "新しいデバイス名"
}
```

**レスポンス例（失敗）**:
```json
{
  "status": "error",
  "code": 404,
  "message": "Device not found"
}
```

#### 1.2 APIステータス

```
GET /api/status
```

**レスポンス例**:
```json
{
  "status": "online",
  "version": "1.0.0",
  "simulation_mode": false,
  "device_count": 3,
  "timestamp": 1636540800.123
}
```

### 2. 拡張BFFエンドポイント

#### 2.1 統計情報

```
GET /api/statistics
```

**レスポンス例**:
```json
{
  "statistics": {
    "count": 3,
    "online_count": 2,
    "average_value": 58.5,
    "min_value": 42,
    "max_value": 75
  }
}
```

#### 2.2 デバイス要約

```
GET /api/devices/summary
```

**レスポンス例**:
```json
{
  "statistics": {
    "count": 3,
    "online_count": 2,
    "average_value": 58.5,
    "min_value": 42,
    "max_value": 75
  },
  "devices": [
    {
      "id": "lever_001",
      "name": "レバー 1",
      "status": "online",
      "ip": "192.168.1.100",
      "last_seen": 1636540800.123,
      "value": 75,
      "raw": 768,
      "timestamp": 1636540800.123
    },
    {
      "id": "lever_002",
      "name": "レバー 2",
      "status": "offline",
      "ip": "192.168.1.101",
      "last_seen": 1636540500.456
    },
    {
      "id": "lever_003",
      "name": "レバー 3",
      "status": "online",
      "ip": "192.168.1.102",
      "last_seen": 1636540801.456,
      "value": 42,
      "raw": 430,
      "timestamp": 1636540801.456
    }
  ]
}
```

#### 2.3 バッチ操作

```
POST /api/batch
```

**リクエスト本文**:
```json
{
  "operations": [
    {
      "type": "get_device",
      "params": {
        "device_id": "lever_001"
      }
    },
    {
      "type": "get_device_value",
      "params": {
        "device_id": "lever_001"
      }
    },
    {
      "type": "get_statistics"
    }
  ]
}
```

**レスポンス例**:
```json
{
  "results": [
    {
      "type": "get_device",
      "result": {
        "id": "lever_001",
        "name": "レバー 1",
        "status": "online",
        "ip": "192.168.1.100",
        "last_seen": 1636540800.123
      }
    },
    {
      "type": "get_device_value",
      "result": {
        "value": 75,
        "raw": 768,
        "timestamp": 1636540800.123
      }
    },
    {
      "type": "get_statistics",
      "result": {
        "count": 3,
        "online_count": 2,
        "average_value": 58.5,
        "min_value": 42,
        "max_value": 75
      }
    }
  ]
}
```

### 3. シミュレーションモード関連

#### 3.1 シミュレーションモードの切り替え

```
POST /api/simulation/toggle
```

**レスポンス例**:
```json
{
  "status": "success",
  "data": {
    "simulation_mode": true
  }
}
```

#### 3.2 シミュレーションモードの状態取得

```
GET /api/simulation/status
```

**レスポンス例**:
```json
{
  "status": "success",
  "data": {
    "simulation_mode": true,
    "device_count": 3
  }
}
```

#### 3.3 シミュレーション設定の取得

```
GET /api/simulation/config
```

**レスポンス例**:
```json
{
  "status": "success",
  "data": {
    "device_count": 3
  }
}
```

#### 3.4 シミュレーション設定の変更

```
POST /api/simulation/config
```

**リクエスト本文**:
```json
{
  "device_count": 6
}
```

**レスポンス例**:
```json
{
  "status": "success",
  "data": {
    "device_count": 6
  }
}
```

#### 3.5 シミュレーションデバイスの追加

```
POST /api/simulation/devices/add
```

**レスポンス例**:
```json
{
  "status": "success",
  "data": {
    "added_device_id": "sim_4",
    "simulation_devices": [
      {"id": "sim_1", "name": "シミュレーション 1", "ip": "127.0.0.1"},
      {"id": "sim_2", "name": "シミュレーション 2", "ip": "127.0.0.2"},
      {"id": "sim_3", "name": "シミュレーション 3", "ip": "127.0.0.3"},
      {"id": "sim_4", "name": "シミュレーション 4", "ip": "127.0.0.4"}
    ]
  }
}
```

#### 3.6 シミュレーションデバイスの削除

```
POST /api/simulation/devices/remove
```

**リクエスト本文（オプション）**:
```json
{
  "device_id": "sim_2"
}
```

**レスポンス例**:
```json
{
  "status": "success",
  "data": {
    "removed_device_id": "sim_2",
    "remaining_devices": [
      {"id": "sim_1", "name": "シミュレーション 1", "ip": "127.0.0.1"},
      {"id": "sim_3", "name": "シミュレーション 3", "ip": "127.0.0.3"}
    ]
  }
}
```

#### 3.7 シミュレーションデバイス一覧の取得

```
GET /api/simulation/devices
```

**レスポンス例**:
```json
{
  "status": "success",
  "data": {
    "devices": [
      {"id": "sim_1", "name": "シミュレーション 1", "ip": "127.0.0.1"},
      {"id": "sim_3", "name": "シミュレーション 3", "ip": "127.0.0.3"}
    ],
    "count": 2
  }
}
```


## エラーレスポンス

APIエラー時には、以下の形式でレスポンスが返されます：

```json
{
  "status": "error",
  "code": 404,
  "message": "Device not found"
}
```

**主なエラーコード**:

- `400`: リクエスト不正（必須パラメータの欠落など）
- `404`: リソースが見つからない
- `500`: サーバー内部エラー

## BFFとしての機能

このAPIサーバーは以下のBFF（Backend For Frontend）機能を提供します：

1. **データ集約**: 複数のデバイスからのデータを単一のAPIコールで取得
2. **データ変換**: フロントエンド向けにデータ形式を整形
3. **バッチ処理**: 複数の操作を一度のリクエストで実行
4. **統計計算**: 平均値や最大/最小値などのリアルタイム統計情報を提供
5. **WebSocketリアルタイム通信**: レバーの値をリアルタイムでクライアントに通知

## WebSocketインターフェース

リアルタイム通信のためにWebSocketインターフェースを提供します：

### 接続方法

```javascript
// socket.ioを使用した接続
const socket = io('http://[サーバーアドレス]:5000');
```

### サーバーから送信されるイベント

#### `all_values`

接続時に送信される、すべてのデバイスの最新値：

```json
{
  "device_id_1": {
    "value": 75,
    "raw": 768,
    "timestamp": 1636540800.123
  },
  "device_id_2": {
    "value": 42,
    "raw": 430,
    "timestamp": 1636540801.456
  }
}
```

#### `device_update`

デバイスの値が変更されたときに送信されるイベント：

```json
{
  "device_id": "lever_001",
  "data": {
    "value": 75,
    "raw": 768,
    "timestamp": 1636540800.123
  }
}
```

### クライアントから送信できるイベント

#### `subscribe`

特定のデバイスの更新を購読するイベント：

```javascript
socket.emit('subscribe', { device_id: 'lever_001' });
```

## 開発者向け補足情報

### 1. リアルタイム通信

リアルタイムデバイス値の取得には、WebSocket接続を使用します。このアプローチにより、100ms未満のレイテンシで値の変更をリアルタイムに検出できます：

- **WebSocket接続**: クライアントはSocket.IOを使用して接続
- **初期値**: 接続時に`all_values`イベントですべてのデバイスの最新値を受信
- **リアルタイム更新**: デバイスの値が変化するたびに`device_update`イベントを受信
- **最適化**: デバイスごとの購読（`subscribe`イベント）で通信を最適化可能

この実装により、ポーリングの必要がなく、バックグラウンドでサーバーが値を監視し、変更があった場合にのみ通知を送信します。これによって、ネットワークトラフィックを削減し、最小限のレイテンシでリアルタイム性を確保します。

### 2. シミュレーションモード

テスト環境では、シミュレーションモードを使用して実際のデバイスなしでAPIの動作をテストできます。
シミュレーションモードでは以下の機能が提供されます：

- **動的なデバイス管理**: デバイスの追加・削除が可能
- **デバイス数の設定**: `/api/simulation/config`エンドポイントでデバイス数を設定可能（1～20）
- **ランダム値の生成**: シミュレーションデバイスは自動的に値を変動させる
- **リアルデバイスと同様のAPI**: 実デバイスと同じインターフェースで操作可能

### 3. エラーハンドリング

フロントエンドアプリケーションでは、以下のエラーハンドリングを実装することを推奨します：

- ネットワーク接続エラーの処理
- デバイスがオフラインの場合の表示処理
- 定期的な自動再接続の実装

---

このドキュメントは今後のAPIアップデートに伴い更新される可能性があります。最新のAPIバージョンとドキュメントを確認してください。