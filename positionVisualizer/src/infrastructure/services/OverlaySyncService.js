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

    try {
      this.channel = new BroadcastChannel(this.channelName);
      this.logger.info(`OverlaySyncService initialized (isOverlay: ${this.isOverlay})`);
      this._setupListeners();
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
    // メインウィンドウは受信しない（オーバーレイのみ受信）
    if (!this.isOverlay) return;

    if (!message || !message.eventName) {
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
