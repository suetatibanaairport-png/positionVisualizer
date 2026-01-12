/**
 * DeviceConnectionManager.js
 * WebSocket接続とデバイスメッセージ処理を担当
 */

import { EventTypes } from '../../domain/events/EventTypes.js';

/**
 * デバイス接続管理クラス
 */
export class DeviceConnectionManager {
  /**
   * DeviceConnectionManagerのコンストラクタ
   * @param {Object} webSocketClient WebSocketクライアント
   * @param {Object} deviceService デバイスサービス
   * @param {Object} meterViewModel メータービューモデル
   * @param {Object} eventBus EventBusインターフェース（IEventEmitter実装）
   * @param {Object} logger ロガー
   */
  constructor(webSocketClient, deviceService, meterViewModel, eventBus, logger) {
    this.webSocketClient = webSocketClient;
    this.deviceService = deviceService;
    this.meterViewModel = meterViewModel;
    this.eventBus = eventBus;
    this.logger = logger || { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

    // 記録コールバック（外部から設定）
    this.onDeviceDataReceived = null;

    // デバイスリスト更新コールバック（外部から設定）
    this.onDeviceListUpdate = null;
  }

  /**
   * WebSocket接続を開始
   * @returns {Promise<void>}
   */
  async connect() {
    if (!this.webSocketClient) {
      this.logger.warn('WebSocketClient not available');
      return;
    }

    try {
      await this.webSocketClient.connect();
      this.logger.info('WebSocket connected successfully');

      // デバイスメッセージのリスナー登録
      this.webSocketClient.on('device', this._handleDeviceMessage.bind(this));
      this.webSocketClient.on('device_disconnected', this._handleDeviceDisconnected.bind(this));
    } catch (error) {
      this.logger.error('WebSocket connection error:', error);
      throw error;
    }
  }

  /**
   * WebSocket接続を切断
   */
  disconnect() {
    if (this.webSocketClient) {
      this.webSocketClient.disconnect();
      this.logger.info('WebSocket disconnected');
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
          // EventBus経由でメーター更新イベントを発行
          this.eventBus.emit(EventTypes.DEVICE_VALUE_UPDATED, {
            deviceId: deviceId,
            value: { normalizedValue: value },
            source: 'websocket'
          });

          // 記録コールバックがあれば呼び出す
          if (this.onDeviceDataReceived) {
            this.onDeviceDataReceived(deviceId, { rawValue: value });
          }
        }

        // デバイスリスト更新コールバックがあれば呼び出す
        if (this.onDeviceListUpdate) {
          this.onDeviceListUpdate();
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

    // EventBus経由でデバイス切断イベントを発行
    this.eventBus.emit(EventTypes.DEVICE_DISCONNECTED, {
      deviceId: deviceId,
      reason: 'websocket_disconnect'
    });

    this.deviceService.disconnectDevice(deviceId, 'websocket_disconnect')
      .catch(error => {
        this.logger.error(`Error disconnecting device ${deviceId}:`, error);
      });
  }

  /**
   * 記録用のコールバックを設定
   * @param {Function} callback コールバック関数 (deviceId, value) => void
   */
  setDeviceDataCallback(callback) {
    this.onDeviceDataReceived = callback;
  }
}
