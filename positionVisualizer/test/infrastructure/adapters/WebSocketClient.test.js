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

    // console.logとconsole.errorのモック
    global.console.log = jest.fn();
    global.console.error = jest.fn();
  });

  // 各テストの後に実行
  afterEach(() => {
    if (client && client.socket) {
      client.disconnect();
    }
    jest.useRealTimers();
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
    jest.useFakeTimers();

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

  test('connect - タイムアウトが発生する', async () => {
    jest.useFakeTimers();

    // タイムアウトを検知するためにPromiseをキャッチせず保持
    const connectPromise = client.connect();

    // タイマーを進める
    jest.advanceTimersByTime(mockOptions.connectTimeout + 10);

    await expect(connectPromise).rejects.toThrow('Connection timeout');
    expect(client.connecting).toBe(false);
  });

  test('disconnect - 接続を正しく切断する', async () => {
    // モックWebSocketを設定
    client.socket = {
      close: jest.fn(),
      readyState: 1
    };
    client.connected = true;

    client.disconnect(1000, 'Test reason');

    expect(client.socket.close).toHaveBeenCalledWith(1000, 'Test reason');
    expect(client.connected).toBe(false);
    expect(client.socket).toBeNull();
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
    const callback = jest.fn();

    client.once('test', callback);

    // 内部的にはラッパー関数が登録される
    expect(client.listeners.has('test')).toBe(true);
    expect(client.listeners.get('test').size).toBe(1);

    // イベント発行
    client._emitEvent('test', { data: 'test' });

    // コールバックが呼ばれ、リスナーが削除されるはず
    expect(callback).toHaveBeenCalledTimes(1);
    expect(client.listeners.has('test')).toBe(false);
  });

  test('send - 接続中は正しくデータが送信される', () => {
    client.socket = { send: jest.fn() };
    client.connected = true;

    // 文字列を送信
    const stringResult = client.send('test message');
    expect(client.socket.send).toHaveBeenCalledWith('test message');
    expect(stringResult).toBe(true);

    // オブジェクトを送信（JSON.stringify される）
    const objResult = client.send({ test: 'data' });
    expect(client.socket.send).toHaveBeenCalledWith('{"test":"data"}');
    expect(objResult).toBe(true);
  });

  test('send - 非接続時は送信に失敗する', () => {
    client.connected = false;
    const result = client.send('test message');
    expect(result).toBe(false);
  });

  test('_handleMessage - 受信したJSONメッセージを正しく処理する', () => {
    const messageListener = jest.fn();
    const deviceListener = jest.fn();
    const stateListener = jest.fn();

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
    expect(messageListener).toHaveBeenCalled();

    // stateイベントが発行される
    expect(stateListener).toHaveBeenCalledWith(expect.objectContaining({
      type: 'state',
      payload: expect.any(Object)
    }));

    // deviceイベントが発行される（3回、null値を除く）
    expect(deviceListener).toHaveBeenCalledTimes(3);
    expect(deviceListener).toHaveBeenCalledWith(expect.objectContaining({
      device_id: 'lever1',
      name: 'デバイス1',
      data: { value: 25 }
    }));
  });

  test('_emitEvent - 登録されたリスナーに正しくイベントを発行する', () => {
    const listener1 = jest.fn();
    const listener2 = jest.fn();

    client.on('test', listener1);
    client.on('test', listener2);

    const data = { value: 123 };
    client._emitEvent('test', data);

    expect(listener1).toHaveBeenCalledWith(data);
    expect(listener2).toHaveBeenCalledWith(data);
  });

  test('_attemptReconnect - 再接続処理が正しく動作する', () => {
    jest.useFakeTimers();

    // 再接続イベントリスナー
    const reconnectingListener = jest.fn();
    client.on('reconnecting', reconnectingListener);

    // connectメソッドをモック
    const originalConnect = client.connect;
    client.connect = jest.fn().mockImplementation(() => Promise.resolve(true));

    client._attemptReconnect();

    // 再接続タイマーが設定されるはず
    expect(client.reconnectAttempts).toBe(1);
    expect(client.reconnectTimer).not.toBeNull();

    // タイマーを進める
    jest.advanceTimersByTime(mockOptions.reconnectInterval + 10);

    // イベントが発行され、connect が呼ばれるはず
    expect(reconnectingListener).toHaveBeenCalledWith({ attempt: 1 });
    expect(client.connect).toHaveBeenCalled();

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