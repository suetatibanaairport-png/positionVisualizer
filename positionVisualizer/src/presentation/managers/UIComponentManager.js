/**
 * UIComponentManager.js
 * UIコンポーネントの初期化と管理を担当
 */

import { LogManagerComponent } from '../components/log/LogManagerComponent.js';
import { PlaybackControlsComponent } from '../components/log/PlaybackControlsComponent.js';
import { DeviceListViewModel } from '../viewmodels/DeviceListViewModel.js';
import { EventTypes } from '../../domain/events/EventTypes.js';

/**
 * UIコンポーネント管理クラス
 */
export class UIComponentManager {
  /**
   * UIComponentManagerのコンストラクタ
   * @param {Object} options オプション設定
   * @param {Object} eventEmitter イベントエミッター
   * @param {Object} logger ロガー
   */
  constructor(options, eventEmitter, logger) {
    this.options = options || {};
    this.eventEmitter = eventEmitter;
    this.logger = logger || { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

    // UIコンポーネント
    this.logManagerComponent = null;
    this.playbackControlsComponent = null;
    this.deviceListViewModel = null;

    // 外部依存（後から設定）
    this.meterViewModel = null;
    this.meterRenderer = null;
    this.deviceService = null;
    this.logService = null;
    this.replaySessionUseCase = null;
    this.appController = null;

    // コールバック
    this.onDeviceVisibilityChange = null;
    this.onDeviceRemove = null;
  }

  /**
   * 依存関係を設定
   * @param {Object} dependencies 依存関係オブジェクト
   */
  setDependencies(dependencies) {
    this.meterViewModel = dependencies.meterViewModel;
    this.meterRenderer = dependencies.meterRenderer;
    this.deviceService = dependencies.deviceService;
    this.logService = dependencies.logService;
    this.replaySessionUseCase = dependencies.replaySessionUseCase;
    this.appController = dependencies.appController;
  }

  /**
   * ログコンポーネントの初期化
   */
  initializeLogComponents() {
    if (!this.logService || !this.replaySessionUseCase) {
      this.logger.debug('Log components cannot be initialized: missing dependencies');
      return;
    }

    this.logger.debug('Initializing log components');

    try {
      const logManagerContainerId = 'log-manager-container';
      if (document.getElementById(logManagerContainerId)) {
        this.logger.debug('Initializing LogManagerComponent');
        this.logManagerComponent = new LogManagerComponent(
          logManagerContainerId,
          this.appController,
          this.logService
        );
      } else {
        this.logger.debug(`LogManagerComponent container not found: ${logManagerContainerId}`);
      }

      // ログ再生コンポーネントの初期表示を非表示に設定
      const logReplayComponent = document.getElementById('log-replay-component-dynamic') ||
                                document.querySelector('.log-replay-component');
      if (logReplayComponent) {
        this.logger.debug('Setting log replay component to hidden');
        logReplayComponent.style.display = 'none';
      }
    } catch (error) {
      this.logger.error('Error initializing log components:', error);
    }
  }

  /**
   * 再生コントロールコンポーネントの初期化
   * @param {string} containerId コンテナID
   * @returns {PlaybackControlsComponent|null} 初期化されたコンポーネントまたはnull
   */
  initializePlaybackControls(containerId) {
    if (!this.replaySessionUseCase || !containerId) {
      this.logger.warn('Cannot initialize playback controls: missing dependencies or container');
      return null;
    }

    try {
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
        this.appController,
        this.replaySessionUseCase
      );

      // 初期化成功を確認
      if (this.playbackControlsComponent && this.playbackControlsComponent.isInitialized) {
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
   * @returns {DeviceListViewModel|null}
   */
  initializeDeviceListViewModel() {
    if (this.deviceListViewModel) {
      this.logger.debug('DeviceListViewModel already initialized, setting up events');
      this._setupDeviceListViewModelEvents();
      return this.deviceListViewModel;
    }

    try {
      const containerSelector = '#device-inputs';
      const noDevicesSelector = '#no-devices-message';

      this.deviceListViewModel = new DeviceListViewModel({
        containerSelector,
        noDevicesSelector
      }, this.eventEmitter, this.logger);

      // グローバルアクセスのために保存（後方互換性）
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

      return this.deviceListViewModel;
    } catch (error) {
      this.logger.error('Error initializing DeviceListViewModel:', error);
      return null;
    }
  }

  /**
   * DeviceListViewModelを取得
   * @returns {DeviceListViewModel|null}
   */
  getDeviceListViewModel() {
    return this.deviceListViewModel;
  }

  /**
   * DeviceListViewModelを外部から設定
   * @param {DeviceListViewModel} viewModel
   */
  setDeviceListViewModel(viewModel) {
    this.deviceListViewModel = viewModel;
    this._setupDeviceListViewModelEvents();
  }

  /**
   * DeviceListViewModel用のイベントリスナーを設定
   * @private
   */
  _setupDeviceListViewModelEvents() {
    if (!this.deviceListViewModel || !this.eventEmitter) return;

    // デバイスの可視性変更イベント
    this.eventEmitter.on(EventTypes.DEVICE_VISIBILITY_CHANGED, async (data) => {
      if (!data || !data.deviceId) return;

      try {
        if (this.onDeviceVisibilityChange) {
          await this.onDeviceVisibilityChange(data.deviceId, data.isVisible);
        }
        this.logger.debug(`Device visibility changed: ${data.deviceId} -> ${data.isVisible ? 'visible' : 'hidden'}`);
      } catch (error) {
        this.logger.error(`Error handling device visibility change for ${data.deviceId}:`, error);
      }
    });

    // デバイス削除イベント
    this.eventEmitter.on(EventTypes.COMMAND_REMOVE_DEVICE, async (data) => {
      if (!data || !data.deviceId) return;

      try {
        if (this.onDeviceRemove) {
          await this.onDeviceRemove(data.deviceId);
        }
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
      // オプションを更新
      this.options.isOverlayMode = isOverlay;

      // MeterViewModelにオーバーレイモードを設定
      if (this.meterViewModel) {
        if (typeof this.meterViewModel.setOverlayMode === 'function') {
          this.meterViewModel.setOverlayMode(isOverlay);
        } else if (this.meterViewModel.state) {
          this.meterViewModel.state.isOverlayMode = isOverlay;
          if (typeof this.meterViewModel._notifyChange === 'function') {
            this.meterViewModel._notifyChange();
          }
        }
      }

      // MeterRendererにオーバーレイモードを設定
      if (this.meterRenderer && typeof this.meterRenderer.setOverlayMode === 'function') {
        this.meterRenderer.setOverlayMode(isOverlay);
      }

      // DeviceListViewModelにもオーバーレイモードを設定
      if (this.deviceListViewModel && typeof this.deviceListViewModel.setOverlayMode === 'function') {
        this.deviceListViewModel.setOverlayMode(isOverlay);
      }

      // イベント発行
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
   * クリーンアップ
   */
  dispose() {
    // LogManagerComponentのクリーンアップ
    if (this.logManagerComponent && typeof this.logManagerComponent.destroy === 'function') {
      this.logManagerComponent.destroy();
    }

    // PlaybackControlsComponentのクリーンアップ
    if (this.playbackControlsComponent && typeof this.playbackControlsComponent.destroy === 'function') {
      this.playbackControlsComponent.destroy();
    }

    // DeviceListViewModelのクリーンアップ
    if (this.deviceListViewModel && typeof this.deviceListViewModel.destroy === 'function') {
      this.deviceListViewModel.destroy();
    }

    this.logManagerComponent = null;
    this.playbackControlsComponent = null;
    this.deviceListViewModel = null;

    this.logger.debug('UIComponentManager disposed');
  }
}
