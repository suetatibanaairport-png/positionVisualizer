/**
 * AppController.js
 * アプリケーション全体のコントローラー
 * 各レイヤー間の調整や依存関係の注入を担当
 *
 * 責務: コーディネーション（Managerクラスへの委譲）
 */

import { EventTypes } from '../../domain/events/EventTypes.js';
import { DeviceConnectionManager } from '../managers/DeviceConnectionManager.js';
import { SessionManager } from '../managers/SessionManager.js';
import { DeviceSettingsManager } from '../managers/DeviceSettingsManager.js';
import { UIComponentManager } from '../managers/UIComponentManager.js';
import { VirtualLeverManager } from '../managers/VirtualLeverManager.js';

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
    this.virtualLeverService = dependencies.virtualLeverService || null;

    // 内部状態
    this.monitoringEnabled = false;

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
      monitorInterval: 100,
      webSocketUrl: dependencies.webSocketUrl || 'ws://localhost:8123',
      autoConnect: true,
      leverApiUrl: dependencies.leverApiUrl || 'http://127.0.0.1:5001',
      ...dependencies.options
    };

    // Managerクラスの初期化
    this._initializeManagers();

    // イベントハンドラーの設定
    this._setupEventHandlers();

    this.logger.debug('AppController initialized');
  }

  /**
   * Managerクラスの初期化
   * @private
   */
  _initializeManagers() {
    // DeviceConnectionManager
    this.deviceConnectionManager = new DeviceConnectionManager(
      this.webSocketClient,
      this.deviceService,
      this.meterViewModel,
      this.eventEmitter,
      this.logger
    );

    // SessionManager
    this.sessionManager = new SessionManager(
      this.recordSessionUseCase,
      this.replaySessionUseCase,
      this.deviceService,
      this.meterViewModel,
      this.eventEmitter,
      this.logger
    );

    // DeviceSettingsManager
    this.deviceSettingsManager = new DeviceSettingsManager(
      this.deviceService,
      this.meterViewModel,
      this.eventEmitter,
      this.logger
    );
    this.deviceSettingsManager.setLeverApiUrl(this.options.leverApiUrl);

    // UIComponentManager
    this.uiComponentManager = new UIComponentManager(
      this.options,
      this.eventEmitter,
      this.logger
    );

    // VirtualLeverManager
    if (this.virtualLeverService) {
      this.virtualLeverManager = new VirtualLeverManager(
        this.virtualLeverService,
        this.meterViewModel,
        this.eventEmitter,
        this.logger
      );
    }

    // Manager間のコールバック設定
    this._setupManagerCallbacks();
  }

  /**
   * Manager間のコールバック設定
   * @private
   */
  _setupManagerCallbacks() {
    // DeviceConnectionManager: 記録用コールバック
    this.deviceConnectionManager.setDeviceDataCallback((deviceId, value) => {
      this.sessionManager.recordDeviceData(deviceId, value);
    });

    // DeviceConnectionManager: デバイスリスト更新コールバック
    this.deviceConnectionManager.onDeviceListUpdate = () => {
      this._updateDeviceListViewModel();
    };

    // SessionManager: モニタリング制御コールバック
    this.sessionManager.onMonitoringStop = () => this.stopMonitoring();
    this.sessionManager.onMonitoringStart = () => this.startMonitoring();

    // SessionManager: デバイス設定コールバック
    this.sessionManager.onDeviceNameSet = async (deviceId, name) => {
      await this.deviceSettingsManager.setDeviceName(deviceId, name);
    };
    this.sessionManager.onDeviceIconSet = async (deviceId, iconUrl) => {
      await this.deviceSettingsManager.setDeviceIcon(deviceId, iconUrl);
    };

    // SessionManager: 再生コントロール初期化コールバック
    this.sessionManager.onPlaybackControlsInit = () => {
      const containerId = 'playback-controls-container';
      const container = document.getElementById(containerId);
      if (container) {
        this.uiComponentManager.initializePlaybackControls(containerId);
      }
    };

    // UIComponentManager: デバイス表示/削除コールバック
    this.uiComponentManager.onDeviceVisibilityChange = async (deviceId, isVisible) => {
      await this.deviceSettingsManager.setDeviceVisibility(deviceId, isVisible);
      this.meterViewModel._notifyChange();
      this._updateDeviceListViewModel();
    };
    this.uiComponentManager.onDeviceRemove = async (deviceId) => {
      await this.deviceSettingsManager.removeDevice(deviceId);
    };

    // DeviceSettingsManager: デバイスリスト更新コールバック
    this.deviceSettingsManager.onDeviceListUpdate = () => {
      this._updateDeviceListViewModel();
    };

    // UIComponentManagerの依存関係設定
    this.uiComponentManager.setDependencies({
      meterViewModel: this.meterViewModel,
      meterRenderer: this.meterRenderer,
      deviceService: this.deviceService,
      virtualLeverManager: this.virtualLeverManager,
      logService: this.logService,
      replaySessionUseCase: this.replaySessionUseCase,
      appController: this
    });
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

      // 2. WebSocket接続の開始（DeviceConnectionManagerに委譲）
      if (this.options.autoConnect && this.webSocketClient) {
        await this.deviceConnectionManager.connect();
      }

      // 3. デバイスリストViewModelの初期化（UIComponentManagerに委譲）
      // オーバーレイモードではデバイス設定UIがないため初期化をスキップ
      let deviceListVM = null;
      if (!this.options.isOverlayMode) {
        deviceListVM = this.uiComponentManager.initializeDeviceListViewModel();
        if (!deviceListVM) {
          this.logger.warn('DeviceListViewModel initialization failed');
        } else {
          // 初期デバイスリストを設定
          this._updateDeviceListViewModel();
        }
      } else {
        this.logger.debug('Skipping DeviceListViewModel initialization in overlay mode');
      }

      // 4. デバイス値のモニタリング開始
      if (this.monitorUseCase) {
        this.startMonitoring();
      }

      // 5. ログ管理コンポーネントの初期化（UIComponentManagerに委譲）
      this.uiComponentManager.initializeLogComponents();

      // 6. 仮想レバーコンポーネントの初期化
      if (this.virtualLeverService) {
        await this.virtualLeverService.initialize();
        this.uiComponentManager.initializeVirtualLeverComponents();
      }

      // アプリケーション起動イベントを発行
      if (this.eventEmitter) {
        this.eventEmitter.emit('appStarted', { timestamp: Date.now() });
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
        this.meterRenderer.update(state);
      });
      this.logger.debug('ViewModel binding setup complete');
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
    const deviceListViewModel = this.uiComponentManager?.getDeviceListViewModel();
    if (deviceListViewModel && typeof deviceListViewModel.updateDeviceList === 'function') {
      this.getAllDevices(true).then(devices => {
        this.logger.debug(`Updating DeviceListViewModel with ${devices.length} devices`);
        deviceListViewModel.updateDeviceList(devices);
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
  }

  /**
   * デバイス値更新イベントハンドラー
   * @private
   * @param {Object} event イベントデータ
   *
   * 注意: MeterViewModelがDEVICE_VALUE_UPDATEDイベントを処理するため、
   * このメソッドでのsetValue()呼び出しは削除されました。
   * 必要に応じて、アプリケーションレベルの調整処理のみをここで行います。
   */
  _handleDeviceValueUpdated(event) {
    const { deviceId, value } = event;

    if (!deviceId) {
      this.logger.warn('Device value update event with no deviceId');
      return;
    }

    this.logger.debug(`Device value updated event for ${deviceId}:`, value);

    // MeterViewModelがイベント処理を行うため、ここでは何もしない
    // 将来的にアプリケーションレベルの調整処理が必要な場合はここに追加
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
   * 記録の開始（SessionManagerに委譲）
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async startRecording() {
    return await this.sessionManager.startRecording();
  }

  /**
   * 記録の停止（SessionManagerに委譲）
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async stopRecording() {
    return await this.sessionManager.stopRecording();
  }

  /**
   * 再生の開始（SessionManagerに委譲）
   * @param {string} sessionId セッションID
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async startReplay(sessionId) {
    return await this.sessionManager.startReplay(sessionId);
  }

  /**
   * 再生の停止（SessionManagerに委譲）
   * @returns {boolean} 成功したかどうか
   */
  stopReplay() {
    return this.sessionManager.stopReplay();
  }

  /**
   * 再生の一時停止（SessionManagerに委譲）
   * @returns {boolean} 成功したかどうか
   */
  pauseReplay() {
    return this.sessionManager.pauseReplay();
  }

  /**
   * 再生の再開（SessionManagerに委譲）
   * @returns {boolean} 成功したかどうか
   */
  resumeReplay() {
    return this.sessionManager.resumeReplay();
  }

  /**
   * 記録中かどうか
   * @returns {boolean}
   */
  isRecording() {
    return this.sessionManager.isRecording();
  }

  /**
   * 再生中かどうか
   * @returns {boolean}
   */
  isReplaying() {
    return this.sessionManager.isReplaying();
  }

  /**
   * モニタリング中かどうか
   * @returns {boolean}
   */
  isMonitoring() {
    return this.monitoringEnabled;
  }

  /**
   * 名前の設定（DeviceSettingsManagerに委譲）
   * @param {string} deviceId デバイスID
   * @param {string} name デバイス名
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async setDeviceName(deviceId, name) {
    return await this.deviceSettingsManager.setDeviceName(deviceId, name);
  }

  /**
   * アイコンの設定（DeviceSettingsManagerに委譲）
   * @param {string} deviceId デバイスID
   * @param {string} iconUrl アイコンURL
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async setDeviceIcon(deviceId, iconUrl) {
    return await this.deviceSettingsManager.setDeviceIcon(deviceId, iconUrl);
  }

  /**
   * デバイスを削除（DeviceSettingsManagerに委譲）
   * @param {string} deviceId デバイスID
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async removeDevice(deviceId) {
    return await this.deviceSettingsManager.removeDevice(deviceId);
  }

  /**
   * デバイスの表示/非表示を設定（DeviceSettingsManagerに委譲）
   * @param {string} deviceId デバイスID
   * @param {boolean} isVisible 表示するかどうか
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async setDeviceVisibility(deviceId, isVisible) {
    return await this.deviceSettingsManager.setDeviceVisibility(deviceId, isVisible);
  }

  /**
   * デバイスのリセット（DeviceSettingsManagerに委譲）
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async resetDevices() {
    const deviceListVM = this.uiComponentManager.getDeviceListViewModel();
    return await this.deviceSettingsManager.resetDevices(deviceListVM);
  }

  /**
   * デバイスの再スキャン（DeviceSettingsManagerに委譲）
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async scanDevices() {
    return await this.deviceSettingsManager.scanDevices();
  }

  /**
   * すべてのデバイスを取得（DeviceSettingsManagerに委譲）
   * @param {boolean} connectedOnly 接続済みデバイスのみ取得するかどうか
   * @returns {Promise<Array>} デバイスの配列
   */
  async getAllDevices(connectedOnly = false) {
    return await this.deviceSettingsManager.getAllDevices(connectedOnly);
  }

  /**
   * オーバーレイウィンドウを開く（UIComponentManagerに委譲）
   * @returns {boolean} 成功したかどうか
   */
  openOverlay() {
    return this.uiComponentManager.openOverlay();
  }

  /**
   * オーバーレイモードを設定（UIComponentManagerに委譲）
   * @param {boolean} isOverlay オーバーレイモードかどうか
   * @returns {boolean} 成功したかどうか
   */
  setOverlayMode(isOverlay = true) {
    return this.uiComponentManager.setOverlayMode(isOverlay);
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

    // SessionManagerの状態を確認して停止
    if (this.sessionManager.isRecording()) {
      this.sessionManager.stopRecording().catch(error => {
        this.logger.error('Error stopping recording during cleanup:', error);
      });
    }
    if (this.sessionManager.isReplaying()) {
      this.sessionManager.stopReplay();
    }

    // DeviceConnectionManagerの切断
    if (this.deviceConnectionManager) {
      this.deviceConnectionManager.disconnect();
    }

    // UIComponentManagerの解放
    if (this.uiComponentManager) {
      this.uiComponentManager.dispose();
    }

    // ViewModel解放
    if (this.meterViewModel) {
      this.meterViewModel.dispose();
    }

    // レンダラー解放
    if (this.meterRenderer) {
      this.meterRenderer.dispose();
    }

    // イベントリスナーの削除 - メモリリーク対策
    if (this.eventEmitter) {
      this.eventEmitter.removeListenersByOwner(this);

      if (this.boundHandlers) {
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

    this.boundHandlers = null;

    this.logger.info('Application disposed successfully');
  }
}