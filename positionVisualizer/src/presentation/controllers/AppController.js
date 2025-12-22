/**
 * AppController.js
 * アプリケーション全体のコントローラー
 * 各レイヤー間の調整や依存関係の注入を担当
 */

import { AppLogger } from '../../infrastructure/services/Logger.js';
import { EventBus } from '../../infrastructure/services/EventBus.js';

/**
 * アプリケーションコントローラークラス
 */
export class AppController {
  /**
   * アプリケーションコントローラーのコンストラクタ
   * @param {Object} dependencies 依存関係
   */
  constructor(dependencies) {
    // 必須の依存関係
    this.monitorUseCase = dependencies.monitorUseCase;
    this.deviceService = dependencies.deviceService;
    this.meterViewModel = dependencies.meterViewModel;
    this.meterRenderer = dependencies.meterRenderer;
    this.webSocketClient = dependencies.webSocketClient;
    this.storageAdapter = dependencies.storageAdapter;

    // オプションの依存関係
    this.recordSessionUseCase = dependencies.recordSessionUseCase || null;
    this.replaySessionUseCase = dependencies.replaySessionUseCase || null;
    this.settingsRepository = dependencies.settingsRepository || null;

    // 内部状態
    this.updateInterval = null;
    this.monitoringEnabled = false;
    this.recordingEnabled = false;
    this.replayingEnabled = false;

    // ロガー
    this.logger = AppLogger.createLogger('AppController');

    // 設定
    this.options = {
      monitorInterval: 100,   // モニタリング間隔（ミリ秒）
      webSocketUrl: dependencies.webSocketUrl || 'ws://localhost:8123',
      autoConnect: true,      // 自動接続するかどうか
      ...dependencies.options
    };

    // イベントハンドラーの設定
    this._setupEventHandlers();

    this.logger.debug('AppController initialized');
  }

  /**
   * アプリケーション起動
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async start() {
    this.logger.info('Starting application...');

    try {
      // 1. ViewModelの変更監視
      this._setupViewModelBinding();

      // 2. WebSocket接続の開始（設定がある場合）
      if (this.options.autoConnect && this.webSocketClient) {
        await this._connectWebSocket();
      }

      // 3. デバイス値のモニタリング開始
      if (this.monitorUseCase) {
        this.startMonitoring();
      }

      // アプリケーション起動イベントを発行
      EventBus.emit('appStarted', { timestamp: Date.now() });

      this.logger.info('Application started successfully');
      return true;
    } catch (error) {
      this.logger.error('Error starting application:', error);
      return false;
    }
  }

  /**
   * ViewModelバインディングのセットアップ
   * @private
   */
  _setupViewModelBinding() {
    if (this.meterViewModel && this.meterRenderer) {
      this.meterViewModel.onChange(state => {
        // レンダラーの更新
        this.meterRenderer.update(state);
      });
      this.logger.debug('ViewModel binding setup complete');
    }
  }

  /**
   * WebSocket接続
   * @private
   * @returns {Promise<void>}
   */
  async _connectWebSocket() {
    if (!this.webSocketClient) {
      this.logger.warn('WebSocketClient not available');
      return;
    }

    try {
      await this.webSocketClient.connect();
      this.logger.info('WebSocket connected successfully');

      // デバイスメッセージのリスナー登録 - 新しいインターフェースを使用
      this.webSocketClient.on('device', this._handleDeviceMessage.bind(this));
      this.webSocketClient.on('device_disconnected', this._handleDeviceDisconnected.bind(this));
    } catch (error) {
      this.logger.error('WebSocket connection error:', error);
      throw error;
    }
  }

  /**
   * デバイスメッセージの処理
   * @private
   * @param {Object} message デバイスメッセージ
   */
  _handleDeviceMessage(message) {
    if (!message || !message.device_id || !message.data) {
      this.logger.debug('Invalid device message received');
      return;
    }

    const deviceId = message.device_id;
    const data = message.data;

    this.logger.debug(`Device message received from ${deviceId}:`, data);

    // デバイス登録
    this.deviceService.registerDevice(deviceId, { name: message.name }).then(device => {
      // デバイスインデックスの取得
      const deviceIndex = this.meterViewModel.getOrAssignDeviceIndex(deviceId);

      if (deviceIndex >= 0) {
        // 名前の設定
        if (device.name) {
          this.meterViewModel.setName(deviceIndex, device.name);
        }

        // アイコンの設定
        if (device.iconUrl) {
          this.meterViewModel.setIcon(deviceIndex, device.iconUrl);
        }

        // 値の設定
        let value = null;
        if (typeof data.value === 'number') {
          value = data.value;
        } else if (typeof data.smoothed === 'number') {
          value = data.smoothed;
        } else if (typeof data.raw === 'number') {
          value = data.raw;
        } else if (typeof data.calibrated_value === 'number') {
          value = data.calibrated_value;
        }

        if (value !== null) {
          this.meterViewModel.setValue(deviceIndex, value, true);

          // 記録が有効な場合、値を記録
          if (this.recordingEnabled && this.recordSessionUseCase) {
            this.recordSessionUseCase.recordDeviceData(deviceId, { rawValue: value });
          }
        }
      }
    }).catch(error => {
      this.logger.error(`Error handling device message for ${deviceId}:`, error);
    });
  }

  /**
   * デバイス切断の処理
   * @private
   * @param {Object} message デバイス切断メッセージ
   */
  _handleDeviceDisconnected(message) {
    if (!message || !message.device_id) {
      this.logger.debug('Invalid device disconnection message received');
      return;
    }

    const deviceId = message.device_id;
    this.logger.debug(`Device disconnected: ${deviceId}`);

    const deviceIndex = this.meterViewModel.getDeviceIndex(deviceId);

    if (deviceIndex >= 0) {
      // デバイスの切断を反映
      this.meterViewModel.setValue(deviceIndex, null, false);
      this.deviceService.disconnectDevice(deviceId, 'websocket_disconnect')
        .catch(error => {
          this.logger.error(`Error disconnecting device ${deviceId}:`, error);
        });
    }
  }

  /**
   * イベントハンドラーの設定
   * @private
   */
  _setupEventHandlers() {
    // デバイスの接続イベント
    EventBus.on('deviceConnected', this._handleDeviceConnected.bind(this));

    // デバイスの切断イベント
    EventBus.on('deviceDisconnected', this._handleDeviceDisconnected.bind(this));

    // デバイスの更新イベント
    EventBus.on('deviceUpdated', this._handleDeviceUpdated.bind(this));

    // デバイスの値更新イベント
    EventBus.on('deviceValueUpdated', this._handleDeviceValueUpdated.bind(this));

    // デバイスのエラーイベント
    EventBus.on('deviceError', this._handleDeviceError.bind(this));

    // すべてのデバイスリセットイベント
    EventBus.on('devicesReset', this._handleDevicesReset.bind(this));

    // ウィンドウのリサイズイベント
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this._handleWindowResize.bind(this));
    }

    this.logger.debug('Event handlers setup complete');
  }

  /**
   * デバイス接続イベントハンドラー
   * @private
   * @param {Object} event イベントデータ
   */
  _handleDeviceConnected(event) {
    const { deviceId } = event;
    this.logger.debug(`Device connected event: ${deviceId}`);

    // デバイスの状態を取得して更新
    this.deviceService.getDeviceInfo(deviceId).then(deviceInfo => {
      if (!deviceInfo || !deviceInfo.device) return;

      const device = deviceInfo.device;
      const deviceIndex = this.meterViewModel.getOrAssignDeviceIndex(deviceId);

      if (deviceIndex >= 0) {
        this.meterViewModel.setName(deviceIndex, device.name);

        if (device.iconUrl) {
          this.meterViewModel.setIcon(deviceIndex, device.iconUrl);
        }

        if (deviceInfo.value) {
          const value = deviceInfo.value.normalizedValue || deviceInfo.value.rawValue;
          if (value !== null && value !== undefined) {
            this.meterViewModel.setValue(deviceIndex, value, true);
          }
        }
      }
    }).catch(error => {
      this.logger.error(`Error handling device connected event for ${deviceId}:`, error);
    });
  }

  /**
   * デバイス切断イベントハンドラー
   * @private
   * @param {Object} event イベントデータ
   */
  _handleDeviceDisconnected(event) {
    const { deviceId } = event;
    this.logger.debug(`Device disconnected event: ${deviceId}`);

    const deviceIndex = this.meterViewModel.getDeviceIndex(deviceId);
    if (deviceIndex >= 0) {
      // ViewModelで接続状態を更新
      this.meterViewModel.setValue(deviceIndex, null, false);
    }
  }

  /**
   * デバイス更新イベントハンドラー
   * @private
   * @param {Object} event イベントデータ
   */
  _handleDeviceUpdated(event) {
    const { deviceId, device } = event;
    this.logger.debug(`Device updated event: ${deviceId}`);

    if (!device) return;

    const deviceIndex = this.meterViewModel.getDeviceIndex(deviceId);
    if (deviceIndex >= 0) {
      // 名前の更新
      if (device.name) {
        this.meterViewModel.setName(deviceIndex, device.name);
      }

      // アイコンの更新
      if (device.iconUrl) {
        this.meterViewModel.setIcon(deviceIndex, device.iconUrl);
      }
    }
  }

  /**
   * デバイス値更新イベントハンドラー
   * @private
   * @param {Object} event イベントデータ
   */
  _handleDeviceValueUpdated(event) {
    const { deviceId, value } = event;

    if (!value) return;

    const deviceIndex = this.meterViewModel.getDeviceIndex(deviceId);
    if (deviceIndex >= 0) {
      // 正規化値または生値を使用
      const normalizedValue = value.normalizedValue !== undefined ? value.normalizedValue : null;
      const rawValue = value.rawValue !== undefined ? value.rawValue : null;

      // どちらかの値があれば更新
      if (normalizedValue !== null) {
        this.meterViewModel.setValue(deviceIndex, normalizedValue, true);
      } else if (rawValue !== null) {
        this.meterViewModel.setValue(deviceIndex, rawValue, true);
      }
    }
  }

  /**
   * デバイスエラーイベントハンドラー
   * @private
   * @param {Object} event イベントデータ
   */
  _handleDeviceError(event) {
    const { deviceId, errorType, errorMessage } = event;
    this.logger.warn(`Device error: ${deviceId} - ${errorType}: ${errorMessage}`);

    // エラータイプに応じた処理
    if (errorType === 'timeout') {
      // タイムアウトの場合、デバイスを切断状態に
      const deviceIndex = this.meterViewModel.getDeviceIndex(deviceId);
      if (deviceIndex >= 0) {
        this.meterViewModel.setValue(deviceIndex, null, false);
      }
    }
  }

  /**
   * デバイスリセットイベントハンドラー
   * @private
   */
  _handleDevicesReset() {
    this.logger.debug('Devices reset event received');

    // ViewModelもリセット
    this.meterViewModel.reset();
  }

  /**
   * ウィンドウリサイズイベントハンドラー
   * @private
   */
  _handleWindowResize() {
    if (this.meterRenderer && this.meterRenderer.resize) {
      const container = this.meterRenderer.container;
      if (container) {
        const width = container.clientWidth;
        const height = container.clientHeight;
        this.meterRenderer.resize(width, height);
      }
    }
  }

  /**
   * デバイス値のモニタリング開始
   * @returns {boolean} 成功したかどうか
   */
  startMonitoring() {
    if (this.monitoringEnabled || !this.monitorUseCase) {
      return false;
    }

    this.monitoringEnabled = true;
    this.logger.info('Starting device monitoring');

    // モニタリングユースケースを使用
    this.monitorUseCase.startMonitoring(this.options.monitorInterval);

    // イベント通知
    EventBus.emit('monitoringStarted', { interval: this.options.monitorInterval });

    return true;
  }

  /**
   * デバイス値のモニタリング停止
   * @returns {boolean} 成功したかどうか
   */
  stopMonitoring() {
    if (!this.monitoringEnabled || !this.monitorUseCase) {
      return false;
    }

    this.monitoringEnabled = false;
    this.logger.info('Stopping device monitoring');

    // モニタリングユースケースを停止
    this.monitorUseCase.stopMonitoring();

    // イベント通知
    EventBus.emit('monitoringStopped', {});

    return true;
  }

  /**
   * 記録の開始
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async startRecording() {
    if (this.recordingEnabled || !this.recordSessionUseCase) {
      return false;
    }

    this.logger.info('Starting recording session');

    // 初期値を取得
    const initialValues = {};
    const connectedDevices = await this.deviceService.getAllDevices(true);

    for (const device of connectedDevices) {
      const deviceInfo = await this.deviceService.getDeviceInfo(device.id);
      if (deviceInfo && deviceInfo.value) {
        initialValues[device.id] = deviceInfo.value;
      }
    }

    // 記録開始
    const success = await this.recordSessionUseCase.startRecording(initialValues);

    if (success) {
      this.recordingEnabled = true;
      this.logger.info('Recording started successfully');
      return true;
    } else {
      this.logger.warn('Failed to start recording');
      return false;
    }
  }

  /**
   * 記録の停止
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async stopRecording() {
    if (!this.recordingEnabled || !this.recordSessionUseCase) {
      return false;
    }

    this.logger.info('Stopping recording session');

    // 記録停止
    const entries = await this.recordSessionUseCase.stopRecording();
    this.recordingEnabled = false;

    if (entries.length > 0) {
      this.logger.info(`Recording stopped with ${entries.length} entries`);
      return true;
    } else {
      this.logger.warn('Recording stopped with no entries');
      return false;
    }
  }

  /**
   * 再生の開始
   * @param {string} sessionId セッションID
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async startReplay(sessionId) {
    if (this.replayingEnabled || !this.replaySessionUseCase) {
      return false;
    }

    this.logger.info(`Starting replay for session: ${sessionId}`);

    // モニタリングが有効なら一時停止
    const wasMonitoring = this.monitoringEnabled;
    if (wasMonitoring) {
      this.stopMonitoring();
    }

    // セッションをロード
    const success = await this.replaySessionUseCase.loadSession(sessionId);

    if (success) {
      // 再生開始
      this.replaySessionUseCase.play();
      this.replayingEnabled = true;
      this.logger.info('Replay started successfully');
      return true;
    } else {
      // モニタリングを再開
      if (wasMonitoring) {
        this.startMonitoring();
      }
      this.logger.warn(`Failed to load session: ${sessionId}`);
      return false;
    }
  }

  /**
   * 再生の停止
   * @returns {boolean} 成功したかどうか
   */
  stopReplay() {
    if (!this.replayingEnabled || !this.replaySessionUseCase) {
      return false;
    }

    this.logger.info('Stopping replay');

    // 再生停止
    this.replaySessionUseCase.stop();
    this.replayingEnabled = false;

    // モニタリングを再開
    this.startMonitoring();

    return true;
  }

  /**
   * 名前の設定
   * @param {string} deviceId デバイスID
   * @param {string} name デバイス名
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async setDeviceName(deviceId, name) {
    if (!deviceId || !name) {
      return false;
    }

    this.logger.debug(`Setting device name: ${deviceId} -> ${name}`);

    // デバイス名を設定
    const success = await this.deviceService.setDeviceName(deviceId, name);

    if (success) {
      // ViewModelも更新
      const deviceIndex = this.meterViewModel.getDeviceIndex(deviceId);
      if (deviceIndex >= 0) {
        this.meterViewModel.setName(deviceIndex, name);
      }
      return true;
    }

    return false;
  }

  /**
   * アイコンの設定
   * @param {string} deviceId デバイスID
   * @param {string} iconUrl アイコンURL
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async setDeviceIcon(deviceId, iconUrl) {
    if (!deviceId || !iconUrl) {
      return false;
    }

    this.logger.debug(`Setting device icon: ${deviceId} -> ${iconUrl}`);

    // デバイスアイコンを設定
    const success = await this.deviceService.setDeviceIcon(deviceId, iconUrl);

    if (success) {
      // ViewModelも更新
      const deviceIndex = this.meterViewModel.getDeviceIndex(deviceId);
      if (deviceIndex >= 0) {
        this.meterViewModel.setIcon(deviceIndex, iconUrl);
      }
      return true;
    }

    return false;
  }

  /**
   * デバイスのリセット
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async resetDevices() {
    this.logger.info('Resetting all devices');

    // すべてのデバイスをリセット
    const success = await this.deviceService.resetAllDevices();

    if (success) {
      // ViewModelもリセット
      this.meterViewModel.reset();
      return true;
    }

    return false;
  }

  /**
   * アプリケーションの終了（クリーンアップ）
   */
  dispose() {
    this.logger.info('Disposing application resources');

    // モニタリング停止
    if (this.monitoringEnabled) {
      this.stopMonitoring();
    }

    // 記録停止
    if (this.recordingEnabled && this.recordSessionUseCase) {
      this.recordSessionUseCase.stopRecording().catch(error => {
        this.logger.error('Error stopping recording during cleanup:', error);
      });
    }

    // 再生停止
    if (this.replayingEnabled && this.replaySessionUseCase) {
      this.replaySessionUseCase.stop();
    }

    // WebSocket切断
    if (this.webSocketClient) {
      this.webSocketClient.disconnect();
    }

    // ViewModel解放
    if (this.meterViewModel) {
      this.meterViewModel.dispose();
    }

    // レンダラー解放
    if (this.meterRenderer) {
      this.meterRenderer.dispose();
    }

    // イベントリスナーの削除
    EventBus.off('deviceConnected', this._handleDeviceConnected.bind(this));
    EventBus.off('deviceDisconnected', this._handleDeviceDisconnected.bind(this));
    EventBus.off('deviceUpdated', this._handleDeviceUpdated.bind(this));
    EventBus.off('deviceValueUpdated', this._handleDeviceValueUpdated.bind(this));
    EventBus.off('deviceError', this._handleDeviceError.bind(this));
    EventBus.off('devicesReset', this._handleDevicesReset.bind(this));

    // ウィンドウイベントリスナーの削除
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this._handleWindowResize.bind(this));
    }

    this.logger.info('Application disposed successfully');
  }
}