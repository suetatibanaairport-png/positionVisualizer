/**
 * WebSocketClient.test.js
 * WebSocketClientクラスのユニットテスト
 */

import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import { WebSocketClient } from '../../../src/infrastructure/adapters/WebSocketClient.js';

describe('WebSocketClient', () => {
  let client;
  const mockUrl = 'ws://test-server:8123';
  const mockOptions = {
    reconnectInterval: 100,
    maxReconnectAttempts: 3,
    debug: false,
    autoConnect: false,
    connectTimeout: 500
  };

  // 各テストの前に実行
  beforeEach(() => {
    client = new WebSocketClient(mockUrl, mockOptions);
  });

  // 各テストの後に実行
  afterEach(() => {
    if (client && client.socket) {
      client.disconnect();
    }
    client = null;
  });

  test('コンストラクタで正しく初期化される', () => {
    expect(client.url).toBe(mockUrl);
    expect(client.options.reconnectInterval).toBe(100);
    expect(client.options.maxReconnectAttempts).toBe(3);

    // 初期状態
    expect(client.connected).toBe(false);
    expect(client.connecting).toBe(false);
    expect(client.socket).toBeNull();
    expect(client.reconnectAttempts).toBe(0);
  });

  test('autoConnectが有効の場合は自動的に接続される', async () => {
    const connectSpy = spyOn(WebSocketClient.prototype, 'connect').mockImplementation(() => Promise.resolve(true));

    const autoClient = new WebSocketClient(mockUrl, { ...mockOptions, autoConnect: true });
    expect(connectSpy).toHaveBeenCalled();

    connectSpy.mockRestore();
  });

  test('connect - WebSocketへの接続が正常に行われる', async () => {
    // WebSocket接続のモック関数
    const connectPromise = client.connect();

    // WebSocketコンストラクタが呼ばれたはず
    expect(client.socket).not.toBeNull();
    expect(client.connecting).toBe(true);

    // 接続成功をシミュレート
    client.socket.onopen();

    await connectPromise;

    expect(client.connected).toBe(true);
    expect(client.connecting).toBe(false);
  });

  test('connect - 既に接続済みの場合は即時解決される', async () => {
    // まず接続
    client.connected = true;

    const result = await client.connect();
    expect(result).toBe(true);
  });

  test('disconnect - 接続状態を解除する', async () => {
    // 接続状態を設定
    client.connected = true;

    client.disconnect();

    expect(client.connected).toBe(false);
  });

  test('on/off - イベントリスナーを正しく管理する', () => {
    const callback = () => {};

    // リスナー追加
    const removeListener = client.on('test', callback);
    expect(client.listeners.has('test')).toBe(true);
    expect(client.listeners.get('test').has(callback)).toBe(true);

    // リスナー削除（返された関数を使用）
    removeListener();
    expect(client.listeners.has('test')).toBe(false);

    // 再度追加してoff関数で削除
    client.on('test', callback);
    client.off('test', callback);
    expect(client.listeners.has('test')).toBe(false);
  });

  test('once - 一度だけ実行されるリスナーが正しく動作する', () => {
    const callback = mock(() => {});

    client.once('test', callback);

    // 内部的にはラッパー関数が登録される
    expect(client.listeners.has('test')).toBe(true);
    expect(client.listeners.get('test').size).toBe(1);

    // イベント発行
    client._emitEvent('test', { data: 'test' });

    // コールバックが呼ばれ、リスナーが削除されるはず
    expect(callback.mock.calls.length).toBe(1);
    expect(client.listeners.has('test')).toBe(false);
  });

  test('send - 接続中は正しくデータが送信される', () => {
    client.socket = { send: mock(() => {}) };
    client.connected = true;

    // 文字列を送信
    const stringResult = client.send('test message');
    expect(client.socket.send.mock.calls.length).toBe(1);
    expect(stringResult).toBe(true);

    // オブジェクトを送信（JSON.stringify される）
    const objResult = client.send({ test: 'data' });
    expect(client.socket.send.mock.calls.length).toBe(2);
    expect(objResult).toBe(true);
  });

  test('send - 非接続時は送信に失敗する', () => {
    client.connected = false;
    const result = client.send('test message');
    expect(result).toBe(false);
  });

  test('_handleMessage - 受信したJSONメッセージを正しく処理する', () => {
    const messageListener = mock(() => {});
    const deviceListener = mock(() => {});
    const stateListener = mock(() => {});

    client.on('message', messageListener);
    client.on('device', deviceListener);
    client.on('state', stateListener);

    // JSON形式のメッセージ
    const jsonMessage = JSON.stringify({
      type: 'state',
      payload: {
        values: [25, 75, null, 50],
        names: ['デバイス1', 'デバイス2', null, 'デバイス4']
      }
    });

    client._handleMessage({ data: jsonMessage });

    // messageイベントが発行される
    expect(messageListener.mock.calls.length).toBeGreaterThan(0);

    // stateイベントが発行される
    expect(stateListener.mock.calls.length).toBeGreaterThan(0);

    // deviceイベントが発行される（3回、null値を除く）
    expect(deviceListener.mock.calls.length).toBe(3);
  });

  test('_emitEvent - 登録されたリスナーに正しくイベントを発行する', () => {
    const listener1 = mock(() => {});
    const listener2 = mock(() => {});

    client.on('test', listener1);
    client.on('test', listener2);

    const data = { value: 123 };
    client._emitEvent('test', data);

    expect(listener1.mock.calls.length).toBe(1);
    expect(listener2.mock.calls.length).toBe(1);
  });

  test('_attemptReconnect - 再接続処理が開始される', () => {
    // 再接続イベントリスナー
    const reconnectingListener = mock(() => {});
    client.on('reconnecting', reconnectingListener);

    // connectメソッドをモック
    const originalConnect = client.connect;
    client.connect = mock(() => Promise.resolve(true));

    client._attemptReconnect();

    // 再接続カウンタが更新される
    expect(client.reconnectAttempts).toBe(1);

    // モックを戻す
    client.connect = originalConnect;
  });

  test('getStatus - 現在の接続状態を正しく返す', () => {
    client.connected = true;
    client.connecting = false;
    client.reconnectAttempts = 2;

    const status = client.getStatus();

    expect(status).toEqual({
      connected: true,
      connecting: false,
      url: mockUrl,
      reconnectAttempts: 2
    });
  });
});