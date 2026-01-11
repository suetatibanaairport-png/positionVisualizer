/**
 * AppController.js
 * アプリケーション全体のコントローラー
 * 各レイヤー間の調整や依存関係の注入を担当
 */

import { LogManagerComponent } from '../components/log/LogManagerComponent.js';
import { PlaybackControlsComponent } from '../components/log/PlaybackControlsComponent.js';
import { DeviceListViewModel } from '../viewmodels/DeviceListViewModel.js';
import { ILogger } from '../services/ILogger.js';
import { IEventEmitter } from '../services/IEventEmitter.js';
import { EventTypes } from '../../domain/events/EventTypes.js';

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
    this.logService = dependencies.logService || null;
    this.settingsRepository = dependencies.settingsRepository || null;

    // デバイスリストViewModel（オプション）
    this.deviceListViewModel = dependencies.deviceListViewModel || null;

    // UIコンポーネント
    this.logManagerComponent = null;
    this.playbackControlsComponent = null;

    // 内部状態
    this.updateInterval = null;
    this.monitoringEnabled = false;
    this.recordingEnabled = false;
    this.replayingEnabled = false;

    // インターフェースを介した依存（依存性逆転の原則を適用）
    this.eventEmitter = dependencies.eventEmitter || null;
    this.logger = dependencies.logger || {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {}
    };

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

      // 3. デバイスリストViewModelの初期化（最優先で実行）
      this._initializeDeviceListViewModel();

      // デバイスリストViewModelが初期化されたかチェック
      if (!this.deviceListViewModel) {
        this.logger.warn('DeviceListViewModel initialization failed, will try to create one');
        // DeviceListViewModelが存在しない場合、作成を試みる
        this._createDeviceListViewModel();
      }

      // 4. デバイス値のモニタリング開始
      if (this.monitorUseCase) {
        this.startMonitoring();
      }

      // 5. ログ管理コンポーネントの初期化（ある場合）
      this._initializeLogComponents();

      // アプリケーション起動イベントを発行
      if (this.eventEmitter) {
        this.eventEmitter.emit('appStarted', { timestamp: Date.now() });
        // 新しいイベント命名規則でも発行
        if (typeof EventTypes !== 'undefined' && EventTypes.APP_STARTED) {
          this.eventEmitter.emit(EventTypes.APP_STARTED, { timestamp: Date.now() });
        }
      }

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
    if (!this.eventEmitter) {
      this.logger.warn('EventEmitter not available for event handlers');
      return;
    }

    // メモリリーク防止のためにバインドされたハンドラーを保存
    this.boundHandlers = {
      deviceConnected: this._handleDeviceConnected.bind(this),
      deviceDisconnected: this._handleDeviceDisconnected.bind(this),
      deviceUpdated: this._handleDeviceUpdated.bind(this),
      deviceValueUpdated: this._handleDeviceValueUpdated.bind(this),
      deviceError: this._handleDeviceError.bind(this),
      devicesReset: this._handleDevicesReset.bind(this),
      windowResize: this._handleWindowResize.bind(this)
    };

    // 新しいイベント命名規則を使用してイベントリスナーを登録
    // owner としてコントローラー自身を指定してメモリリーク対策
    this.eventEmitter.on(EventTypes.DEVICE_CONNECTED, this.boundHandlers.deviceConnected, this);
    this.eventEmitter.on(EventTypes.DEVICE_DISCONNECTED, this.boundHandlers.deviceDisconnected, this);
    this.eventEmitter.on(EventTypes.DEVICE_UPDATED, this.boundHandlers.deviceUpdated, this);
    this.eventEmitter.on(EventTypes.DEVICE_VALUE_UPDATED, this.boundHandlers.deviceValueUpdated, this);
    this.eventEmitter.on(EventTypes.DEVICE_ERROR, this.boundHandlers.deviceError, this);
    this.eventEmitter.on(EventTypes.DEVICES_RESET, this.boundHandlers.devicesReset, this);

    // ウィンドウのリサイズイベント
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.boundHandlers.windowResize);
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
      if (!deviceInfo || !deviceInfo.device) {
        this.logger.warn(`No device info available for ${deviceId}`);
        return;
      }

      const device = deviceInfo.device;
      const deviceIndex = this.meterViewModel.getOrAssignDeviceIndex(deviceId);

      if (deviceIndex >= 0) {
        // MeterViewModelを更新
        this.logger.debug(`Updating MeterViewModel for device ${deviceId} at index ${deviceIndex}`);

        // 名前の設定
        this.meterViewModel.setName(deviceIndex, device.name);

        // アイコンの設定（存在する場合）
        if (device.iconUrl) {
          this.meterViewModel.setIcon(deviceIndex, device.iconUrl);
        }

        // 接続状態を明示的に更新
        this.meterViewModel.state.connected[deviceIndex] = true;

        // 値の設定（存在する場合）
        if (deviceInfo.value) {
          const value = deviceInfo.value.normalizedValue || deviceInfo.value.rawValue;
          if (value !== null && value !== undefined) {
            this.meterViewModel.setValue(deviceIndex, value, true);
            this.logger.debug(`Set value ${value} for device ${deviceId}`);
          }
        }

        // 明示的に状態変更を通知
        this.meterViewModel._notifyChange();

        // DeviceListViewModelも更新（存在する場合）
        this._updateDeviceListViewModel();
      } else {
        this.logger.error(`Failed to assign index for device ${deviceId}`);
      }
    }).catch(error => {
      this.logger.error(`Error handling device connected event for ${deviceId}:`, error);
    });
  }

  /**
   * DeviceListViewModelの更新
   * @private
   */
  _updateDeviceListViewModel() {
    if (this.deviceListViewModel && typeof this.deviceListViewModel.updateDeviceList === 'function') {
      this.getAllDevices(true).then(devices => {
        this.logger.debug(`Updating DeviceListViewModel with ${devices.length} devices`);
        this.deviceListViewModel.updateDeviceList(devices);
      }).catch(error => {
        this.logger.warn(`Failed to update DeviceListViewModel: ${error.message}`);
      });
    } else {
      this.logger.debug('DeviceListViewModel not available for update');
    }
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

      // 接続状態を明示的に更新
      this.meterViewModel.state.connected[deviceIndex] = false;

      // 明示的に状態変更を通知
      this.meterViewModel._notifyChange();

      // DeviceListViewModelも更新
      this._updateDeviceListViewModel();
    } else {
      this.logger.warn(`Device ${deviceId} not found in MeterViewModel, cannot update disconnect state`);
    }

    // DeviceServiceにも切断を通知（必要に応じて）
    if (this.deviceService && typeof this.deviceService.disconnectDevice === 'function') {
      this.deviceService.disconnectDevice(deviceId, 'event_disconnected')
        .catch(error => {
          this.logger.warn(`Failed to notify DeviceService about disconnect: ${error.message}`);
        });
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

    // デバイスがViewModelに存在するか確認
    let deviceIndex = this.meterViewModel.getDeviceIndex(deviceId);

    // 存在しない場合は新規に割り当て
    if (deviceIndex < 0) {
      this.logger.debug(`Device ${deviceId} not found in ViewModel, assigning new index`);
      deviceIndex = this.meterViewModel.getOrAssignDeviceIndex(deviceId);

      if (deviceIndex < 0) {
        this.logger.error(`Failed to assign index for device ${deviceId}`);
        return;
      }

      // 接続状態を設定
      this.meterViewModel.state.connected[deviceIndex] = true;
      this.logger.debug(`Assigned new index ${deviceIndex} for device ${deviceId}`);
    }

    // 名前の更新
    if (device.name) {
      this.logger.debug(`Setting name for device ${deviceId}: ${device.name}`);
      this.meterViewModel.setName(deviceIndex, device.name);
    }

    // アイコンの更新
    if (device.iconUrl) {
      this.logger.debug(`Setting icon for device ${deviceId}`);
      this.meterViewModel.setIcon(deviceIndex, device.iconUrl);
    }

    // デバイス情報をDeviceServiceにも反映（必要に応じて）
    if (this.deviceService && typeof this.deviceService.updateDeviceInfo === 'function') {
      this.deviceService.updateDeviceInfo(deviceId, {
        name: device.name,
        iconUrl: device.iconUrl
      }).catch(error => {
        this.logger.warn(`Failed to update device info in DeviceService: ${error.message}`);
      });
    }

    // DeviceListViewModelも更新（存在する場合）
    if (this.deviceListViewModel && typeof this.deviceListViewModel.updateDeviceList === 'function') {
      // 現在のデバイス一覧を取得して更新
      this.getAllDevices(true).then(devices => {
        this.deviceListViewModel.updateDeviceList(devices);
      }).catch(error => {
        this.logger.warn(`Failed to update DeviceListViewModel: ${error.message}`);
      });
    }
  }

  /**
   * デバイス値更新イベントハンドラー
   * @private
   * @param {Object} event イベントデータ
   */
  _handleDeviceValueUpdated(event) {
    const { deviceId, value } = event;

    if (!deviceId) {
      this.logger.warn('Device value update event with no deviceId');
      return;
    }

    this.logger.debug(`Device value updated event for ${deviceId}:`, value);

    // ログ再生中の場合は、通常のデバイス値更新を無視する（競合を防ぐため）
    if (this.replayingEnabled) {
      // イベント自体がログ再生から来ているか確認（データソースを確認）
      const isReplayEvent = event.source === 'replay' ||
                            (event.metadata && event.metadata.source === 'replay');

      if (!isReplayEvent) {
        this.logger.debug(`Ignoring live device update during replay for device ${deviceId}`);
        return; // 再生中で、かつ通常のデバイス値更新なら処理せずに終了
      }
    }

    // デバイスIDからインデックスを取得
    let deviceIndex = this.meterViewModel.getDeviceIndex(deviceId);

    // デバイスインデックスが見つからない場合は新しいインデックスを割り当て
    if (deviceIndex < 0) {
      this.logger.info(`Device index not found for ${deviceId}, assigning new index`);
      deviceIndex = this.meterViewModel.getOrAssignDeviceIndex(deviceId);

      if (deviceIndex < 0) {
        this.logger.error(`Failed to assign device index for ${deviceId}`);
        return;
      }

      // 接続状態を確実に設定
      this.meterViewModel.state.connected[deviceIndex] = true;
      this.logger.debug(`Assigned device ${deviceId} to index ${deviceIndex}`);
    }

    // 値の抽出（様々な形式に対応）
    let normalizedValue = null;
    let rawValue = null;

    if (value) {
      // 異なる形式のオブジェクトに対応
      if (typeof value === 'object') {
        // normalizedValue/rawValue形式
        if (value.normalizedValue !== undefined) {
          normalizedValue = value.normalizedValue;
        }
        if (value.rawValue !== undefined) {
          rawValue = value.rawValue;
        }
        // raw/normalized形式
        else if (value.normalized !== undefined) {
          normalizedValue = value.normalized;
        }
        else if (value.raw !== undefined) {
          rawValue = value.raw;
        }
        // その他の可能性のあるフィールド
        else if (value.value !== undefined) {
          normalizedValue = value.value;
          rawValue = value.value;
        }
        else if (value.calibrated_value !== undefined) {
          normalizedValue = value.calibrated_value;
          rawValue = value.calibrated_value;
        }
        else if (value.smoothed !== undefined) {
          normalizedValue = value.smoothed;
          rawValue = value.smoothed;
        }
      }
      // 数値の場合は直接使用
      else if (typeof value === 'number') {
        normalizedValue = value;
        rawValue = value;
      }
    }

    // デバッグログ（現在の処理モードを含める）
    this.logger.debug(`Setting value for device ${deviceId} (index ${deviceIndex}, mode: ${this.replayingEnabled ? 'replay' : 'live'}):`, {
      normalizedValue,
      rawValue,
      connected: true
    });

    // 値を設定
    let valueSet = false;

    // 正規化値があれば優先して使用
    if (normalizedValue !== null && normalizedValue !== undefined) {
      this.meterViewModel.setValue(deviceIndex, normalizedValue, true);
      this.logger.debug(`Updated device ${deviceId} with normalized value: ${normalizedValue}`);
      valueSet = true;
    }
    // なければ生値を使用
    else if (rawValue !== null && rawValue !== undefined) {
      this.meterViewModel.setValue(deviceIndex, rawValue, true);
      this.logger.debug(`Updated device ${deviceId} with raw value: ${rawValue}`);
      valueSet = true;
    }

    // どの値も設定できなかった場合は警告
    if (!valueSet) {
      this.logger.warn(`No valid value could be extracted for device ${deviceId}:`, value);

      // 再生モードの場合は、とりあえず0を設定して動きを見せる（デバッグ用）
      if (this.replayingEnabled) {
        this.logger.debug(`Setting fallback value 0 for replay mode device ${deviceId}`);
        this.meterViewModel.setValue(deviceIndex, 0, true);
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
    if (this.eventEmitter) {
      this.eventEmitter.emit('monitoringStarted', { interval: this.options.monitorInterval });
    }

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
    if (this.eventEmitter) {
      this.eventEmitter.emit('monitoringStopped', {});
    }

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
    // すでに再生中の場合は一度停止してから再開
    if (this.replayingEnabled && this.replaySessionUseCase) {
      this.logger.info('Stopping current replay before starting new one');
      this.stopReplay();

      // 少し待機して状態が完全に切り替わるようにする
      await new Promise(resolve => setTimeout(resolve, 500));
    } else if (!this.replaySessionUseCase) {
      this.logger.error('ReplaySessionUseCase not available');
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
      // セッションデータを取得
      const sessionData = this.replaySessionUseCase.getSessionData();
      if (!sessionData) {
        this.logger.error('Failed to get session data');
        return false;
      }

      if (!sessionData.entries || !Array.isArray(sessionData.entries)) {
        this.logger.error('Session data has no entries or entries is not an array');
        return false;
      }

      this.logger.info('Session data loaded:', {
        entryCount: sessionData.entries.length,
        deviceCount: sessionData.metadata?.deviceCount || 'unknown',
        metadata: sessionData.metadata || 'no metadata'
      });

      // エントリに含まれるすべてのデバイスを特定
      const deviceIdsInEntries = new Set(sessionData.entries.map(entry => entry.deviceId));
      this.logger.info(`Devices in entries: ${Array.from(deviceIdsInEntries).join(', ')}`);

      // デバイス情報のログ出力
      if (sessionData.metadata && sessionData.metadata.deviceInfo) {
        this.logger.info('Device info from metadata:');
        Object.entries(sessionData.metadata.deviceInfo).forEach(([id, info]) => {
          this.logger.info(`  ${id}: name=${info.name || 'none'}, icon=${info.iconUrl ? 'present' : 'none'}`);
        });
      } else {
        this.logger.warn('No device info in metadata');
      }

      // すべてのデバイスが初期状態で登録されるようにする
      for (const deviceId of deviceIdsInEntries) {
        // デフォルト情報でデバイスを登録（後でメタデータから上書き）
        this.logger.info(`Pre-registering device: ${deviceId}`);
        await this.deviceService.registerDevice(deviceId, { name: deviceId });

        // デバイスインデックスを確実に割り当てる
        const deviceIndex = this.meterViewModel.getOrAssignDeviceIndex(deviceId);
        this.logger.info(`Assigned device ${deviceId} to index ${deviceIndex}`);

        if (deviceIndex >= 0) {
          // 接続状態と表示状態を確実に設定
          this.meterViewModel.state.connected[deviceIndex] = true;
          this.meterViewModel.setVisible(deviceIndex, true);

          // 初期値を仮で設定（表示が確実にされるように）
          this.meterViewModel.setValue(deviceIndex, 50, true);
        }
      }

      // デバイス情報の設定（アイコンや名前）
      if (sessionData && sessionData.metadata && sessionData.metadata.deviceInfo) {
        const deviceInfo = sessionData.metadata.deviceInfo;
        this.logger.info(`Device info from metadata:`, deviceInfo);

        for (const [deviceId, info] of Object.entries(deviceInfo)) {
          // デバイスの登録/更新
          this.logger.info(`Registering device with info: ${deviceId}`, info);
          await this.deviceService.registerDevice(deviceId, info);

          // アイコン情報があればアイコンを設定
          if (info.iconUrl) {
            this.logger.info(`Setting icon for device ${deviceId}`);
            await this.setDeviceIcon(deviceId, info.iconUrl);
          }

          // デバイス名があればデバイス名を設定
          if (info.name) {
            this.logger.info(`Setting name for device ${deviceId}: ${info.name}`);
            await this.setDeviceName(deviceId, info.name);
          }

          // デバイスインデックスを取得
          const deviceIndex = this.meterViewModel.getDeviceIndex(deviceId);
          if (deviceIndex >= 0) {
            this.logger.info(`Device ${deviceId} has index ${deviceIndex}`);

            // 接続状態を強制的にONにする
            this.meterViewModel.state.connected[deviceIndex] = true;
            this.meterViewModel._notifyChange();
          } else {
            this.logger.warn(`Failed to get index for device ${deviceId}`);
          }
        }
      } else {
        this.logger.warn('No device info in session metadata');
      }

      // 再生開始前にすべてのデバイスの接続状態を確認
      // deviceIdsInEntriesを使ってすべてのデバイスを最終確認
      this.logger.info('Final device connection check before starting playback');
      for (const deviceId of deviceIdsInEntries) {
        const deviceIndex = this.meterViewModel.getDeviceIndex(deviceId);
        if (deviceIndex >= 0) {
          // 接続状態と表示状態を再度強制的に設定
          this.meterViewModel.state.connected[deviceIndex] = true;
          this.meterViewModel.setVisible(deviceIndex, true);

          this.logger.info(`Final check: Device ${deviceId} (index ${deviceIndex}) is connected and visible`);
        }
      }

      // 再生開始前に2回通知を行う（確実に更新されるように）
      this.meterViewModel._notifyChange();
      setTimeout(() => this.meterViewModel._notifyChange(), 0);

      // 再生コントロールの初期化（存在すれば）
      if (!this.playbackControlsComponent) {
        const playbackControlsContainerId = 'playback-controls-container';
        const container = document.getElementById(playbackControlsContainerId);
        if (container) {
          this._initializePlaybackControls(playbackControlsContainerId);
        }
      }

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
   * 再生の一時停止
   * @returns {boolean} 成功したかどうか
   */
  pauseReplay() {
    if (!this.replayingEnabled || !this.replaySessionUseCase) {
      return false;
    }

    this.logger.info('Pausing replay');

    // 再生一時停止
    return this.replaySessionUseCase.pause();
  }

  /**
   * 再生の再開
   * @returns {boolean} 成功したかどうか
   */
  resumeReplay() {
    if (!this.replayingEnabled || !this.replaySessionUseCase) {
      return false;
    }

    this.logger.info('Resuming replay');

    // 再生再開
    return this.replaySessionUseCase.play();
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
      // MeterViewModelを更新
      const deviceIndex = this.meterViewModel.getDeviceIndex(deviceId);
      if (deviceIndex >= 0) {
        this.meterViewModel.setName(deviceIndex, name);

        // 明示的に状態変更を通知
        this.meterViewModel._notifyChange();
        this.logger.debug(`Device name updated in MeterViewModel and notification sent: ${deviceId} -> ${name}`);
      }

      // DeviceListViewModelも更新（存在する場合）
      this._updateDeviceListViewModel();

      // 変更イベントを発行して他のコンポーネントに通知（オーバーレイウィンドウなど）
      if (this.eventEmitter) {
        this.logger.debug('Emitting device updated event to propagate name change');
        this.eventEmitter.emit(EventTypes.DEVICE_UPDATED, {
          deviceId,
          device: {
            id: deviceId,
            name: name,
            // 他の既存のプロパティを含める
            iconUrl: this.deviceService.getDeviceIconUrl?.(deviceId)
          }
        });

        // 後方互換性のため
        this.eventEmitter.emit('deviceUpdated', {
          deviceId,
          device: {
            id: deviceId,
            name: name,
            iconUrl: this.deviceService.getDeviceIconUrl?.(deviceId)
          }
        });
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
      // MeterViewModelを更新
      const deviceIndex = this.meterViewModel.getDeviceIndex(deviceId);
      if (deviceIndex >= 0) {
        this.meterViewModel.setIcon(deviceIndex, iconUrl);

        // 明示的に状態変更を通知
        this.meterViewModel._notifyChange();
        this.logger.debug(`Device icon updated in MeterViewModel and notification sent: ${deviceId}`);
      }

      // DeviceListViewModelも更新（存在する場合）
      this._updateDeviceListViewModel();

      // 変更イベントを発行して他のコンポーネントに通知（オーバーレイウィンドウなど）
      if (this.eventEmitter) {
        this.logger.debug('Emitting device updated event to propagate icon change');
        this.eventEmitter.emit(EventTypes.DEVICE_UPDATED, {
          deviceId,
          device: {
            id: deviceId,
            iconUrl: iconUrl,
            // 他の既存のプロパティを含める
            name: this.deviceService.getDeviceName?.(deviceId)
          }
        });

        // 後方互換性のため
        this.eventEmitter.emit('deviceUpdated', {
          deviceId,
          device: {
            id: deviceId,
            iconUrl: iconUrl,
            name: this.deviceService.getDeviceName?.(deviceId)
          }
        });
      }

      return true;
    }

    return false;
  }

  /**
   * デバイスを削除
   * @param {string} deviceId デバイスID
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async removeDevice(deviceId) {
    if (!deviceId) {
      return false;
    }

    this.logger.info(`Removing device: ${deviceId}`);

    try {
      // DeviceServiceからデバイスを削除
      const success = await this.deviceService.removeDevice(deviceId);

      if (success) {
        // MeterViewModelからデバイスを削除
        this.meterViewModel.removeDevice(deviceId);

        // DeviceListViewModelを更新
        this._updateDeviceListViewModel();

        // イベントを発行
        if (this.eventEmitter) {
          this.eventEmitter.emit(EventTypes.DEVICE_REMOVED, { deviceId });
        }

        this.logger.info(`Device removed successfully: ${deviceId}`);
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error(`Error removing device ${deviceId}:`, error);
      return false;
    }
  }

  /**
   * デバイスの表示/非表示を設定
   * @param {string} deviceId デバイスID
   * @param {boolean} isVisible 表示するかどうか
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async setDeviceVisibility(deviceId, isVisible) {
    if (!deviceId) {
      return false;
    }

    this.logger.debug(`Setting device visibility: ${deviceId} -> ${isVisible ? 'visible' : 'hidden'}`);

    try {
      // 現在のデバイス表示状態を取得
      const deviceIndex = this.meterViewModel.getDeviceIndex(deviceId);
      if (deviceIndex >= 0) {
        // MeterViewModel経由でデバイス表示状態を更新
        this.meterViewModel.setVisible(deviceIndex, isVisible);

        // 明示的に状態変更を通知
        this.meterViewModel._notifyChange();
        this.logger.debug(`Device visibility updated in MeterViewModel and notification sent: ${deviceId} -> ${isVisible ? 'visible' : 'hidden'}`);

        // デバイスサービスが実装されていれば、そちらにも通知
        if (this.deviceService && typeof this.deviceService.setDeviceVisibility === 'function') {
          await this.deviceService.setDeviceVisibility(deviceId, isVisible);
          this.logger.debug(`Device visibility updated in DeviceService: ${deviceId} -> ${isVisible ? 'visible' : 'hidden'}`);
        }

        // DeviceListViewModelも更新（存在する場合）
        this._updateDeviceListViewModel();

        // 変更イベントを発行して他のコンポーネントに通知（オーバーレイウィンドウなど）
        if (this.eventEmitter) {
          this.logger.debug('Emitting device updated event to propagate visibility change');
          this.eventEmitter.emit(EventTypes.DEVICE_UPDATED, {
            deviceId,
            device: {
              id: deviceId,
              visible: isVisible,
              // 他の既存のプロパティを含める
              name: this.deviceService.getDeviceName?.(deviceId),
              iconUrl: this.deviceService.getDeviceIconUrl?.(deviceId)
            }
          });

          // 後方互換性のため
          this.eventEmitter.emit('deviceUpdated', {
            deviceId,
            device: {
              id: deviceId,
              visible: isVisible,
              name: this.deviceService.getDeviceName?.(deviceId),
              iconUrl: this.deviceService.getDeviceIconUrl?.(deviceId)
            }
          });
        }

        return true;
      }

      this.logger.warn(`Device with ID ${deviceId} not found in MeterViewModel`);
      return false;
    } catch (error) {
      this.logger.error(`Error setting device visibility for ${deviceId}:`, error);
      return false;
    }
  }

  /**
   * デバイスのリセット
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async resetDevices() {
    this.logger.info('Resetting all devices');

    try {
      // すべてのデバイスをリセット
      const success = await this.deviceService.resetAllDevices();

      if (success) {
        // MeterViewModelのすべてのデバイスマッピングをクリア
        if (this.meterViewModel.deviceMapping) {
          const deviceIds = Array.from(this.meterViewModel.deviceMapping.keys());
          deviceIds.forEach(deviceId => {
            this.meterViewModel.removeDevice(deviceId);
          });
          this.logger.debug(`Removed ${deviceIds.length} devices from MeterViewModel`);
        }

        // MeterViewModelをリセット
        this.meterViewModel.reset();
        this.logger.debug('MeterViewModel reset successful');

        // DeviceListViewModelもリセット（存在する場合）
        if (this.deviceListViewModel && typeof this.deviceListViewModel.updateDeviceList === 'function') {
          // 空の配列で更新することでリセット
          this.deviceListViewModel.updateDeviceList([]);
          this.logger.debug('DeviceListViewModel reset successful');
        } else {
          this.logger.debug('DeviceListViewModel not available for reset');
        }

        // イベント発行（新しい命名規則）
        if (this.eventEmitter) {
          this.logger.debug('Emitting device reset events');
          this.eventEmitter.emit(EventTypes.DEVICES_RESET, {
            timestamp: Date.now()
          });

          // 後方互換性のため
          this.eventEmitter.emit('devicesReset', {
            timestamp: Date.now()
          });
        }

        return true;
      } else {
        this.logger.warn('Device service reset returned false');
        return false;
      }
    } catch (error) {
      this.logger.error('Error resetting devices:', error);
      return false;
    }
  }

  /**
   * デバイスの再スキャン
   * LeverAPIの/api/scanエンドポイントを呼び出してデバイス検出を開始
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async scanDevices() {
    this.logger.info('Scanning for devices via LeverAPI');

    try {
      // LeverAPI URLを取得（デフォルトは http://127.0.0.1:5001）
      const leverApiUrl = this.options?.leverApiUrl || 'http://127.0.0.1:5001';
      const scanEndpoint = `${leverApiUrl}/api/scan`;

      this.logger.debug(`Sending scan request to: ${scanEndpoint}`);

      // POSTリクエストを送信
      const response = await fetch(scanEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.logger.info('Device scan initiated successfully:', data);
        return true;
      } else {
        this.logger.warn(`Device scan request failed with status ${response.status}`);
        return false;
      }
    } catch (error) {
      this.logger.error('Error scanning for devices:', error);
      return false;
    }
  }

  /**
   * すべてのデバイスを取得
   * @param {boolean} connectedOnly 接続済みデバイスのみ取得するかどうか
   * @returns {Promise<Array>} デバイスの配列
   */
  async getAllDevices(connectedOnly = false) {
    if (!this.deviceService) {
      this.logger.warn('DeviceService not available for getAllDevices');
      return [];
    }
    return await this.deviceService.getAllDevices(connectedOnly);
  }

  /**
   * ログコンポーネントの初期化
   * @private
   */
  _initializeLogComponents() {
    // ログ管理と再生が可能な場合のみ
    if (this.logService && this.replaySessionUseCase) {
      this.logger.debug('Initializing log components');

      try {
        // ログ管理コンポーネントの初期化
        const logManagerContainerId = 'log-manager-container';
        if (document.getElementById(logManagerContainerId)) {
          this.logger.debug('Initializing LogManagerComponent');
          this.logManagerComponent = new LogManagerComponent(
            logManagerContainerId,
            this,
            this.logService
          );
        } else {
          this.logger.debug(`LogManagerComponent container not found: ${logManagerContainerId}`);
        }

        // ログ再生コンポーネントの初期表示を非表示に設定（動的に生成されるコンポーネント）
        const logReplayComponent = document.getElementById('log-replay-component-dynamic') ||
                                  document.querySelector('.log-replay-component');
        if (logReplayComponent) {
          this.logger.debug('Setting log replay component to hidden');
          logReplayComponent.style.display = 'none';
        }

        // 再生コントロールコンポーネントは動的に作成される
        // この時点では初期化しない
      } catch (error) {
        this.logger.error('Error initializing log components:', error);
      }
    }
  }

  /**
   * 再生コントロールコンポーネントの初期化
   * @private
   * @param {string} containerId コンテナID
   * @returns {PlaybackControlsComponent|null} 初期化されたコンポーネントまたはnull
   */
  _initializePlaybackControls(containerId) {
    if (!this.replaySessionUseCase || !containerId) {
      this.logger.warn('Cannot initialize playback controls: missing dependencies or container');
      return null;
    }

    try {
      // 再生コントロールのコンテナを取得
      const container = document.getElementById(containerId);
      if (!container) {
        this.logger.error(`Playback controls container not found: ${containerId}`);
        return null;
      }

      // コンテナを確実に表示状態に設定
      container.style.display = 'block';
      container.style.visibility = 'visible';
      container.style.opacity = '1';

      this.logger.debug(`Initializing PlaybackControlsComponent in ${containerId}`);

      // 既存のコンポーネントがある場合は削除
      if (this.playbackControlsComponent) {
        try {
          if (typeof this.playbackControlsComponent.destroy === 'function') {
            this.playbackControlsComponent.destroy();
            this.logger.debug('Destroyed existing PlaybackControlsComponent');
          }
        } catch (destroyError) {
          this.logger.warn('Error destroying existing PlaybackControlsComponent:', destroyError);
        }
      }

      // 新しいPlaybackControlsComponentを作成
      this.playbackControlsComponent = new PlaybackControlsComponent(
        containerId,
        this,
        this.replaySessionUseCase
      );

      // 初期化成功を確認
      if (this.playbackControlsComponent && this.playbackControlsComponent.isInitialized) {
        // 明示的に表示
        if (typeof this.playbackControlsComponent.show === 'function') {
          this.playbackControlsComponent.show();
        }

        this.logger.info('PlaybackControlsComponent initialized and shown successfully');

        // 再生コントロール要素を取得して確実に表示
        const playbackControlsEl = document.getElementById('playback-controls');
        if (playbackControlsEl) {
          playbackControlsEl.style.display = 'block';
          playbackControlsEl.style.visibility = 'visible';
          playbackControlsEl.style.opacity = '1';
        }

        return this.playbackControlsComponent;
      } else {
        this.logger.warn('PlaybackControlsComponent created but not properly initialized');
        return null;
      }
    } catch (error) {
      this.logger.error('Error initializing PlaybackControlsComponent:', error);
      return null;
    }
  }

  /**
   * デバイスリストViewModelの初期化
   * @private
   */
  _initializeDeviceListViewModel() {
    if (this.deviceListViewModel) {
      this.logger.debug('DeviceListViewModel already initialized, setting up events');
      // 既存のViewModelでもイベントリスナーは設定する
      this._setupDeviceListViewModelEvents();
      return;
    }

    try {
      // コンテナセレクタの設定
      const containerSelector = '#device-inputs';
      const noDevicesSelector = '#no-devices-message';

      // ViewModelの作成（依存性注入によるインスタンス化）
      // イベントエミッタを渡して初期化
      this.deviceListViewModel = new DeviceListViewModel({
        containerSelector,
        noDevicesSelector
      }, this.eventEmitter, this.logger);

      // グローバルアクセスのためにwindowオブジェクトに保存（後方互換性のため）
      if (typeof window !== 'undefined') {
        window.deviceListViewModel = this.deviceListViewModel;
      }

      // 初期化
      const initialized = this.deviceListViewModel.initialize();
      if (initialized) {
        this.logger.debug('DeviceListViewModel initialized successfully');
      } else {
        this.logger.warn('DeviceListViewModel initialized with warnings');
      }

      // イベントリスナーの設定
      this._setupDeviceListViewModelEvents();
    } catch (error) {
      this.logger.error('Error initializing DeviceListViewModel:', error);
    }
  }

  /**
   * DeviceListViewModelの新規作成（フォールバック）
   * 初期化に失敗した場合に呼び出される
   * @private
   */
  _createDeviceListViewModel() {
    try {
      this.logger.debug('Attempting to create DeviceListViewModel as fallback');

      // DeviceListViewModelクラスが利用可能かチェック
      if (typeof DeviceListViewModel === 'undefined') {
        // DeviceListViewModelをインポート
        import('../viewmodels/DeviceListViewModel.js')
          .then(module => {
            const DeviceListViewModelClass = module.DeviceListViewModel;
            // インスタンス作成
            this._createDeviceListViewModelInstance(DeviceListViewModelClass);
          })
          .catch(error => {
            this.logger.error('Failed to import DeviceListViewModel:', error);
          });
      } else {
        // DeviceListViewModelが既に利用可能な場合
        this._createDeviceListViewModelInstance(DeviceListViewModel);
      }
    } catch (error) {
      this.logger.error('Failed to create DeviceListViewModel:', error);
    }
  }

  /**
   * DeviceListViewModelのインスタンスを作成
   * @param {Class} DeviceListViewModelClass DeviceListViewModelクラス
   * @private
   */
  _createDeviceListViewModelInstance(DeviceListViewModelClass) {
    try {
      // 基本オプション
      const options = {
        containerSelector: '#device-inputs',
        noDevicesSelector: '#no-devices-message'
      };

      // インスタンス化
      this.deviceListViewModel = new DeviceListViewModelClass(
        options,
        this.eventEmitter,
        this.logger
      );

      // 初期化
      const initialized = this.deviceListViewModel.initialize();
      if (initialized) {
        this.logger.debug('DeviceListViewModel created and initialized successfully as fallback');
        // イベントリスナーの設定
        this._setupDeviceListViewModelEvents();
      } else {
        this.logger.warn('DeviceListViewModel created but initialization returned false');
      }
    } catch (error) {
      this.logger.error('Error creating DeviceListViewModel instance:', error);
    }
  }

  /**
   * DeviceListViewModel用のイベントリスナーを設定
   * @private
   */
  _setupDeviceListViewModelEvents() {
    if (!this.deviceListViewModel || !this.eventEmitter) return;

    // デバイスの可視性変更イベント（新しいイベント型）
    this.eventEmitter.on(EventTypes.DEVICE_VISIBILITY_CHANGED, async (data) => {
      if (!data || !data.deviceId) return;

      try {
        // 現在のデバイス表示状態を取得
        const deviceIndex = this.meterViewModel.getDeviceIndex(data.deviceId);
        if (deviceIndex >= 0) {
          // デバッグ：更新前の状態
          this.logger.debug(`Visibility BEFORE: ${data.deviceId} (index ${deviceIndex}) -> ${this.meterViewModel.state.visible[deviceIndex]}`);

          // MeterViewModel経由でデバイス表示状態を更新
          this.meterViewModel.setVisible(deviceIndex, data.isVisible);

          // デバッグ：更新後の状態
          this.logger.debug(`Visibility AFTER: ${data.deviceId} (index ${deviceIndex}) -> ${this.meterViewModel.state.visible[deviceIndex]}`);

          // デバイスサービスが実装されていれば、そちらにも通知
          if (this.deviceService && typeof this.deviceService.setDeviceVisibility === 'function') {
            await this.deviceService.setDeviceVisibility(data.deviceId, data.isVisible);
          }

          this.logger.debug(`Device visibility changed: ${data.deviceId} -> ${data.isVisible ? 'visible' : 'hidden'}`);

          // プレビューの更新を強制
          this.meterViewModel._notifyChange();

          // DeviceListViewModelも更新（存在する場合）
          this._updateDeviceListViewModel();
        }
      } catch (error) {
        this.logger.error(`Error handling device visibility change for ${data.deviceId}:`, error);
      }
    });

    // デバイス削除イベント（新しいイベント型）
    this.eventEmitter.on(EventTypes.COMMAND_REMOVE_DEVICE, async (data) => {
      if (!data || !data.deviceId) return;

      try {
        await this.removeDevice(data.deviceId);
        this.logger.info(`Device deleted: ${data.deviceId}`);
      } catch (error) {
        this.logger.error(`Error deleting device ${data.deviceId}:`, error);
      }
    });

    this.logger.debug('DeviceListViewModel events setup complete');
  }

  /**
   * オーバーレイウィンドウを開く
   * @returns {boolean} 成功したかどうか
   */
  openOverlay() {
    this.logger.info('Opening overlay window');

    try {
      // 現在のパスを取得してオーバーレイパラメータを追加
      const overlayUrl = window.location.href.split('?')[0] + '?overlay=true';
      const overlayWindow = window.open(overlayUrl, 'MeterOverlay', 'width=800,height=600');

      if (!overlayWindow) {
        this.logger.warn('Failed to open overlay window - popup might be blocked');
        return false;
      }

      this.logger.info('Overlay window opened successfully');
      return true;
    } catch (error) {
      this.logger.error('Error opening overlay window:', error);
      return false;
    }
  }

  /**
   * オーバーレイモードを設定
   * @param {boolean} isOverlay オーバーレイモードかどうか
   * @returns {boolean} 成功したかどうか
   */
  setOverlayMode(isOverlay = true) {
    this.logger.info(`Setting overlay mode to: ${isOverlay}`);

    try {
      // オーバーレイモードの内部状態を更新
      if (!this.options) {
        this.options = {};
      }
      this.options.isOverlayMode = isOverlay;

      // MeterViewModelにオーバーレイモードを設定
      if (this.meterViewModel) {
        // MeterViewModelにオーバーレイモード設定メソッドがあれば使用
        if (typeof this.meterViewModel.setOverlayMode === 'function') {
          this.meterViewModel.setOverlayMode(isOverlay);
        }
        // なければ状態を直接設定
        else if (this.meterViewModel.state) {
          this.meterViewModel.state.isOverlayMode = isOverlay;
          // 状態変更を通知
          if (typeof this.meterViewModel._notifyChange === 'function') {
            this.meterViewModel._notifyChange();
          }
        }
      }

      // MeterRendererにオーバーレイモードを設定
      if (this.meterRenderer && typeof this.meterRenderer.setOverlayMode === 'function') {
        this.meterRenderer.setOverlayMode(isOverlay);
      }

      // DeviceListViewModelにもオーバーレイモードを設定（存在する場合）
      if (this.deviceListViewModel && typeof this.deviceListViewModel.setOverlayMode === 'function') {
        this.deviceListViewModel.setOverlayMode(isOverlay);
      }

      // イベント発行（オプショナル）
      if (this.eventEmitter) {
        this.eventEmitter.emit('overlayModeChanged', { isOverlay });
      }

      this.logger.info(`Overlay mode set to: ${isOverlay}`);
      return true;
    } catch (error) {
      this.logger.error('Error setting overlay mode:', error);
      return false;
    }
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

    // デバイスリストViewModelの解放
    if (this.deviceListViewModel) {
      // deviceListViewModelにdisposeメソッドがある場合は呼び出し
      if (typeof this.deviceListViewModel.dispose === 'function') {
        this.deviceListViewModel.dispose();
      }
      this.deviceListViewModel = null;
    }

    // ログコンポーネントの解放
    if (this.playbackControlsComponent && this.playbackControlsComponent.destroy) {
      this.playbackControlsComponent.destroy();
      this.playbackControlsComponent = null;
    }

    // イベントリスナーの削除 - メモリリーク対策
    if (this.eventEmitter) {
      // 新しいイベントリスナー削除メソッドを使用
      this.eventEmitter.removeListenersByOwner(this);

      // バインドされたハンドラーが存在する場合は個別に削除（念のため）
      if (this.boundHandlers) {
        // 新しいイベント名の解除
        this.eventEmitter.off(EventTypes.DEVICE_CONNECTED, this.boundHandlers.deviceConnected);
        this.eventEmitter.off(EventTypes.DEVICE_DISCONNECTED, this.boundHandlers.deviceDisconnected);
        this.eventEmitter.off(EventTypes.DEVICE_UPDATED, this.boundHandlers.deviceUpdated);
        this.eventEmitter.off(EventTypes.DEVICE_VALUE_UPDATED, this.boundHandlers.deviceValueUpdated);
        this.eventEmitter.off(EventTypes.DEVICE_ERROR, this.boundHandlers.deviceError);
        this.eventEmitter.off(EventTypes.DEVICES_RESET, this.boundHandlers.devicesReset);
      }
    }

    // ウィンドウイベントリスナーの削除
    if (typeof window !== 'undefined' && this.boundHandlers) {
      window.removeEventListener('resize', this.boundHandlers.windowResize);
    }

    // バインドされたハンドラーの参照を解放
    this.boundHandlers = null;

    this.logger.info('Application disposed successfully');
  }
}