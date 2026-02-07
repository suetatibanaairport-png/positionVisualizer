/**
 * OverlaySyncService.js
 * BroadcastChannelを使用してメインウィンドウとオーバーレイウィンドウ間でイベントを同期
 */

import { EventTypes } from '../../domain/events/EventTypes.js';

/**
 * オーバーレイ同期サービスクラス
 */
export class OverlaySyncService {
  /**
   * OverlaySyncServiceのコンストラクタ
   * @param {Object} eventBus イベントバス（IEventEmitter実装）
   * @param {Object} logger ロガー
   * @param {boolean} isOverlay このウィンドウがオーバーレイかどうか
   */
  constructor(eventBus, logger, isOverlay = false) {
    this.eventBus = eventBus;
    this.logger = logger || { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };
    this.isOverlay = isOverlay;
    this.channel = null;
    this.channelName = 'meter-overlay-sync';
    this.virtualLeverService = null; // メインウィンドウのみで使用

    try {
      this.channel = new BroadcastChannel(this.channelName);
      this.logger.info(`OverlaySyncService initialized (isOverlay: ${this.isOverlay})`);
      this._setupListeners();

      // オーバーレイの場合、初期化後に状態同期を要求
      // 十分な遅延を設けて、ViewModelとRendererが完全に初期化されるのを待つ
      if (this.isOverlay) {
        setTimeout(() => this._requestInitialState(), 500);
      }
    } catch (error) {
      this.logger.warn('BroadcastChannel not supported:', error);
    }
  }

  /**
   * リスナーのセットアップ
   * @private
   */
  _setupListeners() {
    if (!this.channel) return;

    // BroadcastChannelからのメッセージを受信
    this.channel.onmessage = (event) => {
      this._handleIncomingMessage(event.data);
    };

    // EventBusのイベントを監視してBroadcastChannelに転送
    this._subscribeToEvents();
  }

  /**
   * 同期対象イベントを購読
   * @private
   */
  _subscribeToEvents() {
    // 同期対象のイベント一覧
    const eventsToSync = [
      // MeterViewModel状態変更
      'meterViewModel:change',

      // デバイス値更新（ライブデータ）
      EventTypes.DEVICE_VALUE_UPDATED,

      // デバイス値更新（再生データ）
      EventTypes.DEVICE_VALUE_REPLAYED,

      // デバイス設定変更
      EventTypes.DEVICE_ICON_CHANGED,
      EventTypes.DEVICE_NAME_CHANGED,
      EventTypes.DEVICE_VISIBILITY_CHANGED,

      // 再生状態
      'playbackStarted',
      'playbackStopped',
      'playbackCompleted',
      'playbackPaused',
      'playbackResumed',
      'playbackModeChanged',
      'playbackFullyStopped',

      // 仮想レバー関連
      EventTypes.VIRTUAL_LEVER_MODE_ENABLED,
      EventTypes.VIRTUAL_LEVER_MODE_DISABLED,
      EventTypes.VIRTUAL_LEVER_ADDED,
      EventTypes.VIRTUAL_LEVER_REMOVED,
      EventTypes.VIRTUAL_LEVER_UPDATED,
      EventTypes.VIRTUAL_LEVER_ANIMATION_STARTED,
      EventTypes.VIRTUAL_LEVER_ANIMATION_STOPPED,
      EventTypes.VIRTUAL_LEVER_ANIMATION_COMPLETED,

      // その他重要なイベント
      EventTypes.DEVICE_CONNECTED,
      EventTypes.DEVICE_DISCONNECTED,
      EventTypes.DEVICE_UPDATED,
      EventTypes.DEVICE_REMOVED
    ];

    eventsToSync.forEach(eventName => {
      this.eventBus.on(eventName, (data) => {
        this._broadcastEvent(eventName, data);
      });
    });

    this.logger.debug(`Subscribed to ${eventsToSync.length} events for synchronization`);
  }

  /**
   * イベントをBroadcastChannelで送信
   * @private
   * @param {string} eventName イベント名
   * @param {*} data イベントデータ
   */
  _broadcastEvent(eventName, data) {
    // オーバーレイは送信しない（メインからの一方向同期）
    if (this.isOverlay) return;

    if (!this.channel) return;

    try {
      const message = {
        eventName,
        data,
        timestamp: Date.now(),
        source: 'main'
      };

      this.channel.postMessage(message);
      this.logger.debug(`Broadcasted event: ${eventName}`);
    } catch (error) {
      this.logger.error(`Failed to broadcast event ${eventName}:`, error);
    }
  }

  /**
   * BroadcastChannelからのメッセージを処理
   * @private
   * @param {Object} message メッセージ
   */
  _handleIncomingMessage(message) {
    if (!message) {
      this.logger.warn('Invalid message received:', message);
      return;
    }

    // 初期状態リクエストの処理（メインウィンドウのみ）
    if (!this.isOverlay && message.type === 'REQUEST_INITIAL_STATE') {
      this.logger.debug('Received initial state request from overlay');
      this._sendInitialState();
      return;
    }

    // 初期状態の受信処理（オーバーレイのみ）
    if (this.isOverlay && message.type === 'INITIAL_STATE') {
      this.logger.debug('Received initial state from main window');
      this._applyInitialState(message.data);
      return;
    }

    // 通常のイベント処理（オーバーレイのみ）
    if (!this.isOverlay) return;

    if (!message.eventName) {
      this.logger.warn('Invalid message received:', message);
      return;
    }

    const { eventName, data } = message;

    try {
      this.logger.debug(`Received event from main window: ${eventName}`);

      // EventBusにイベントを再発行
      this.eventBus.emit(eventName, data);
    } catch (error) {
      this.logger.error(`Error handling incoming message for ${eventName}:`, error);
    }
  }

  /**
   * 初期状態を要求（オーバーレイ側）
   * @private
   */
  _requestInitialState() {
    if (!this.isOverlay || !this.channel) return;

    try {
      this.channel.postMessage({
        type: 'REQUEST_INITIAL_STATE',
        timestamp: Date.now()
      });
      this.logger.debug('Requested initial state from main window');
    } catch (error) {
      this.logger.error('Failed to request initial state:', error);
    }
  }

  /**
   * 初期状態を送信（メインウィンドウ側）
   * @private
   */
  _sendInitialState() {
    if (this.isOverlay || !this.channel) return;

    try {
      // VirtualLeverServiceから現在の状態を取得
      const virtualLevers = this.virtualLeverService
        ? this.virtualLeverService.getAllVirtualLevers().map(lever => lever.toJSON())
        : [];

      const isVirtualMode = this.virtualLeverService
        ? this.virtualLeverService.isVirtualModeEnabled()
        : false;

      this.channel.postMessage({
        type: 'INITIAL_STATE',
        timestamp: Date.now(),
        data: {
          isVirtualMode,
          virtualLevers
        }
      });

      this.logger.debug(`Sent initial state: ${virtualLevers.length} virtual levers, mode: ${isVirtualMode}`);
    } catch (error) {
      this.logger.error('Failed to send initial state:', error);
    }
  }

  /**
   * 初期状態を適用（オーバーレイ側）
   * @private
   * @param {Object} state 初期状態
   */
  _applyInitialState(state) {
    if (!this.isOverlay) return;

    try {
      const { isVirtualMode, virtualLevers } = state;

      // 仮想モード状態を適用
      if (isVirtualMode) {
        this.logger.debug('Applying virtual mode state');
        this.eventBus.emit(EventTypes.VIRTUAL_LEVER_MODE_ENABLED, {
          leverCount: virtualLevers.length,
          restored: true
        });

        // 各仮想レバーの状態を適用
        virtualLevers.forEach((lever, index) => {
          // 仮想レバー追加イベントを発行
          this.eventBus.emit(EventTypes.VIRTUAL_LEVER_ADDED, { lever });

          // 初期値を反映（デバイスマッピングを作成）
          this.eventBus.emit(EventTypes.DEVICE_VALUE_UPDATED, {
            deviceId: lever.id,
            value: {
              rawValue: lever.initialValue,
              normalizedValue: lever.initialValue,
              timestamp: Date.now()
            },
            isVirtual: true,
            visible: lever.visible
          });

          // アイコンと名前は少し遅延させて設定（デバイスマッピングが確実に作成されるのを待つ）
          setTimeout(() => {
            // アイコンが設定されている場合、アイコン変更イベントも発行
            if (lever.iconUrl) {
              this.eventBus.emit(EventTypes.DEVICE_ICON_CHANGED, {
                deviceId: lever.id,
                iconUrl: lever.iconUrl
              });
              this.logger.debug(`Applied icon for lever ${lever.id}: ${lever.iconUrl.substring(0, 50)}...`);
            }

            // 名前が設定されている場合、名前変更イベントも発行
            if (lever.name) {
              this.eventBus.emit(EventTypes.DEVICE_NAME_CHANGED, {
                deviceId: lever.id,
                newName: lever.name
              });
              this.logger.debug(`Applied name for lever ${lever.id}: ${lever.name}`);
            }
          }, 100 * (index + 1)); // 各レバーごとに少しずつ遅延
        });

        this.logger.info(`Applied initial state: ${virtualLevers.length} virtual levers`);
      }
    } catch (error) {
      this.logger.error('Failed to apply initial state:', error);
    }
  }

  /**
   * VirtualLeverServiceを設定（メインウィンドウのみ）
   * @param {Object} virtualLeverService 仮想レバーサービス
   */
  setVirtualLeverService(virtualLeverService) {
    if (!this.isOverlay) {
      this.virtualLeverService = virtualLeverService;
      this.logger.debug('VirtualLeverService set for state synchronization');
    }
  }

  /**
   * クリーンアップ
   */
  dispose() {
    if (this.channel) {
      try {
        this.channel.close();
        this.logger.info('OverlaySyncService disposed');
      } catch (error) {
        this.logger.error('Error closing BroadcastChannel:', error);
      }
      this.channel = null;
    }
  }
}
