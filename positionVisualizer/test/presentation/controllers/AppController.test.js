/**
 * AppController.test.js
 * AppControllerクラスのユニットテスト
 */

import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import { AppController } from '../../../src/presentation/controllers/AppController.js';
import { EventBus } from '../../../src/infrastructure/services/EventBus.js';

describe('AppController', () => {
  // モックの依存関係
  const createMocks = () => {
    return {
      monitorUseCase: {
        startMonitoring: mock(() => {}),
        stopMonitoring: mock(() => {})
      },
      deviceService: {
        registerDevice: mock(() => Promise.resolve({
          id: 'device-1',
          name: 'テストデバイス',
          iconUrl: 'assets/icon.svg'
        })),
        disconnectDevice: mock(() => Promise.resolve(true)),
        getDeviceInfo: mock(() => Promise.resolve({
          device: {
            id: 'device-1',
            name: 'テストデバイス',
            iconUrl: 'assets/icon.svg'
          },
          value: {
            normalizedValue: 50,
            rawValue: 512
          }
        })),
        getAllDevices: mock(() => Promise.resolve([
          { id: 'device-1', name: 'テストデバイス' }
        ])),
        setDeviceName: mock(() => Promise.resolve(true)),
        setDeviceIcon: mock(() => Promise.resolve(true)),
        resetAllDevices: mock(() => Promise.resolve(true))
      },
      meterViewModel: {
        onChange: mock(() => () => {}),
        getOrAssignDeviceIndex: mock(() => 0),
        getDeviceIndex: mock(() => 0),
        setName: mock(() => true),
        setIcon: mock(() => true),
        setValue: mock(() => true),
        reset: mock(() => true),
        dispose: mock(() => {})
      },
      meterRenderer: {
        update: mock(() => {}),
        resize: mock(() => {}),
        container: {
          clientWidth: 500,
          clientHeight: 300
        },
        dispose: mock(() => {})
      },
      webSocketClient: {
        connect: mock(() => Promise.resolve(true)),
        disconnect: mock(() => {}),
        on: mock((event, callback) => {
          return () => {};
        }),
        send: mock(() => true)
      },
      storageAdapter: {
        get: mock(() => null),
        set: mock(() => Promise.resolve(true))
      },
      recordSessionUseCase: {
        startRecording: mock(() => Promise.resolve(true)),
        stopRecording: mock(() => Promise.resolve([{ timestamp: Date.now() }])),
        recordDeviceData: mock(() => {})
      },
      replaySessionUseCase: {
        loadSession: mock(() => Promise.resolve(true)),
        play: mock(() => {}),
        stop: mock(() => {})
      },
      settingsRepository: {
        getSettings: mock(() => Promise.resolve({})),
        saveSettings: mock(() => Promise.resolve(true))
      }
    };
  };

  let controller;
  let mocks;

  // 各テストの前に実行
  beforeEach(() => {
    // モックの依存関係を作成
    mocks = createMocks();

    // EventBus.emitのスパイ設定
    spyOn(EventBus, 'emit');

    // AppControllerのインスタンス作成
    controller = new AppController({
      monitorUseCase: mocks.monitorUseCase,
      deviceService: mocks.deviceService,
      meterViewModel: mocks.meterViewModel,
      meterRenderer: mocks.meterRenderer,
      webSocketClient: mocks.webSocketClient,
      storageAdapter: mocks.storageAdapter,
      recordSessionUseCase: mocks.recordSessionUseCase,
      replaySessionUseCase: mocks.replaySessionUseCase,
      settingsRepository: mocks.settingsRepository,
      webSocketUrl: 'ws://test-server:8123',
      options: {
        monitorInterval: 200,
        autoConnect: false
      }
    });
  });

  // 各テストの後に実行
  afterEach(() => {
    if (controller) {
      controller.dispose();
    }
    EventBus.emit.mockRestore();
  });

  test('コンストラクタで正しく初期化される', () => {
    expect(controller.webSocketClient).toBe(mocks.webSocketClient);
    expect(controller.deviceService).toBe(mocks.deviceService);
    expect(controller.options.monitorInterval).toBe(200);
    expect(controller.options.autoConnect).toBe(false);

    // 内部状態
    expect(controller.monitoringEnabled).toBe(false);
    expect(controller.recordingEnabled).toBe(false);
    expect(controller.replayingEnabled).toBe(false);
  });

  test('start - アプリケーションが正常に起動する', async () => {
    // 起動を実行
    const result = await controller.start();

    // ViewModelのバインディングが行われる
    expect(mocks.meterViewModel.onChange).toHaveBeenCalled();

    // autoConnect=falseなのでWebSocket接続は行われない
    expect(mocks.webSocketClient.connect).not.toHaveBeenCalled();

    // モニタリングが開始される
    expect(mocks.monitorUseCase.startMonitoring).toHaveBeenCalled();
    expect(result).toBe(true);
    expect(EventBus.emit).toHaveBeenCalledWith('appStarted', expect.any(Object));
  });

  test('start - autoConnectがtrueの場合はWebSocketに接続する', async () => {
    // autoConnectをtrueに変更
    controller.options.autoConnect = true;

    // 起動を実行
    await controller.start();

    // WebSocket接続が行われる
    expect(mocks.webSocketClient.connect).toHaveBeenCalled();

    // WebSocketイベントリスナーが登録される
    expect(mocks.webSocketClient.on).toHaveBeenCalledWith('device', expect.any(Function));
    expect(mocks.webSocketClient.on).toHaveBeenCalledWith('device_disconnected', expect.any(Function));
  });

  test('_handleDeviceMessage - デバイスメッセージを正しく処理する', async () => {
    // デバイスメッセージ
    const message = {
      device_id: 'device-1',
      name: 'テストデバイス',
      data: {
        value: 75
      }
    };

    // メッセージハンドラーを実行
    await controller._handleDeviceMessage(message);

    // デバイス登録が行われる
    expect(mocks.deviceService.registerDevice).toHaveBeenCalledWith('device-1', expect.any(Object));

    // ViewModelにデバイスが割り当てられる
    expect(mocks.meterViewModel.getOrAssignDeviceIndex).toHaveBeenCalledWith('device-1');

    // ViewModelに名前が設定される
    expect(mocks.meterViewModel.setName).toHaveBeenCalled();

    // ViewModelに値が設定される
    expect(mocks.meterViewModel.setValue).toHaveBeenCalledWith(0, 75, true);

    // 記録は無効なので記録は行われない
    expect(mocks.recordSessionUseCase.recordDeviceData).not.toHaveBeenCalled();
  });

  test('_handleDeviceDisconnected - デバイス切断処理が可能', () => {
    // メソッドの存在を確認
    expect(typeof controller._handleDeviceDisconnected).toBe('function');
  });

  test('startMonitoring - モニタリングが正しく開始される', () => {
    // モニタリング開始
    const result = controller.startMonitoring();

    expect(result).toBe(true);
    expect(controller.monitoringEnabled).toBe(true);
    expect(mocks.monitorUseCase.startMonitoring).toHaveBeenCalledWith(200);
    expect(EventBus.emit).toHaveBeenCalledWith('monitoringStarted', expect.any(Object));

    // 既に有効な場合は何もしない
    const secondResult = controller.startMonitoring();
    expect(secondResult).toBe(false);
  });

  test('stopMonitoring - モニタリングが正しく停止される', () => {
    // まずモニタリングを有効にする
    controller.monitoringEnabled = true;

    // モニタリング停止
    const result = controller.stopMonitoring();

    expect(result).toBe(true);
    expect(controller.monitoringEnabled).toBe(false);
    expect(mocks.monitorUseCase.stopMonitoring).toHaveBeenCalled();
    expect(EventBus.emit).toHaveBeenCalledWith('monitoringStopped', expect.any(Object));

    // 既に無効な場合は何もしない
    const secondResult = controller.stopMonitoring();
    expect(secondResult).toBe(false);
  });

  test('startRecording - 記録が正しく開始される', async () => {
    // 記録開始
    const result = await controller.startRecording();

    expect(result).toBe(true);
    expect(controller.recordingEnabled).toBe(true);
    expect(mocks.deviceService.getAllDevices).toHaveBeenCalledWith(true);
    expect(mocks.recordSessionUseCase.startRecording).toHaveBeenCalled();

    // 既に有効な場合は何もしない
    controller.recordingEnabled = true;
    const secondResult = await controller.startRecording();
    expect(secondResult).toBe(false);
  });

  test('stopRecording - 記録が正しく停止される', async () => {
    // まず記録を有効にする
    controller.recordingEnabled = true;

    // 記録停止
    const result = await controller.stopRecording();

    expect(result).toBe(true);
    expect(controller.recordingEnabled).toBe(false);
    expect(mocks.recordSessionUseCase.stopRecording).toHaveBeenCalled();

    // 既に無効な場合は何もしない
    const secondResult = await controller.stopRecording();
    expect(secondResult).toBe(false);
  });

  test('startReplay - 再生が正しく開始される', async () => {
    // 再生開始
    const result = await controller.startReplay('session-1');

    expect(result).toBe(true);
    expect(controller.replayingEnabled).toBe(true);
    expect(mocks.replaySessionUseCase.loadSession).toHaveBeenCalledWith('session-1');
    expect(mocks.replaySessionUseCase.play).toHaveBeenCalled();

    // 既に有効な場合は何もしない
    controller.replayingEnabled = true;
    const secondResult = await controller.startReplay('session-2');
    expect(secondResult).toBe(false);
  });

  test('stopReplay - 再生が正しく停止される', () => {
    // まず再生を有効にする
    controller.replayingEnabled = true;

    // 再生停止
    const result = controller.stopReplay();

    expect(result).toBe(true);
    expect(controller.replayingEnabled).toBe(false);
    expect(mocks.replaySessionUseCase.stop).toHaveBeenCalled();
    // モニタリングが再開される
    expect(controller.monitoringEnabled).toBe(true);

    // 既に無効な場合は何もしない
    const secondResult = controller.stopReplay();
    expect(secondResult).toBe(false);
  });

  test('setDeviceName - デバイス名が正しく設定される', async () => {
    // デバイス名設定
    const result = await controller.setDeviceName('device-1', 'デバイス1');

    expect(result).toBe(true);
    expect(mocks.deviceService.setDeviceName).toHaveBeenCalledWith('device-1', 'デバイス1');
    expect(mocks.meterViewModel.setName).toHaveBeenCalledWith(0, 'デバイス1');
  });

  test('setDeviceIcon - デバイスアイコンが正しく設定される', async () => {
    // アイコン設定
    const result = await controller.setDeviceIcon('device-1', 'assets/new-icon.svg');

    expect(result).toBe(true);
    expect(mocks.deviceService.setDeviceIcon).toHaveBeenCalledWith('device-1', 'assets/new-icon.svg');
    expect(mocks.meterViewModel.setIcon).toHaveBeenCalledWith(0, 'assets/new-icon.svg');
  });

  test('resetDevices - デバイスが正しくリセットされる', async () => {
    // デバイスリセット
    const result = await controller.resetDevices();

    expect(result).toBe(true);
    expect(mocks.deviceService.resetAllDevices).toHaveBeenCalled();
    expect(mocks.meterViewModel.reset).toHaveBeenCalled();
  });

  test('dispose - リソースが適切に解放される', () => {
    // モニタリング有効の状態
    controller.monitoringEnabled = true;
    controller.recordingEnabled = true;
    controller.replayingEnabled = true;

    // リソース解放
    controller.dispose();

    // モニタリングが停止される
    expect(mocks.monitorUseCase.stopMonitoring).toHaveBeenCalled();

    // 記録が停止される
    expect(mocks.recordSessionUseCase.stopRecording).toHaveBeenCalled();

    // 再生が停止される
    expect(mocks.replaySessionUseCase.stop).toHaveBeenCalled();

    // WebSocketが切断される
    expect(mocks.webSocketClient.disconnect).toHaveBeenCalled();

    // ViewModelが解放される
    expect(mocks.meterViewModel.dispose).toHaveBeenCalled();

    // レンダラーが解放される
    expect(mocks.meterRenderer.dispose).toHaveBeenCalled();
  });
});