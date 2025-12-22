/**
 * DeviceService.js
 * デバイス関連のビジネスロジックを提供するサービス
 * デバイスの登録、管理、検出などを担当
 */

import { Device } from '../../domain/entities/Device.js';
import { DeviceValue } from '../../domain/entities/DeviceValue.js';
import {
  DeviceDiscoveredEvent,
  DeviceConnectedEvent,
  DeviceDisconnectedEvent,
  DeviceUpdatedEvent,
  DeviceErrorEvent,
  DevicesResetEvent
} from '../../domain/events/DeviceEvents.js';
import { EventBus } from '../../infrastructure/services/EventBus.js';
import { AppLogger } from '../../infrastructure/services/Logger.js';

/**
 * デバイス管理サービスクラス
 */
export class DeviceService {
  /**
   * デバイスサービスのコンストラクタ
   * @param {Object} deviceRepository デバイスリポジトリ
   * @param {Object} valueRepository 値リポジトリ
   * @param {Object} options オプション設定
   */
  constructor(deviceRepository, valueRepository, options = {}) {
    this.deviceRepository = deviceRepository;
    this.valueRepository = valueRepository;
    this.options = {
      maxDevices: 6,                 // 最大デバイス数
      deviceTimeoutMs: 10000,        // デバイスタイムアウト（ミリ秒）
      autoConnect: true,             // 自動接続するかどうか
      ...options
    };

    // 定期的なチェックのタイマー
    this.timeoutCheckTimer = null;

    // ロガー
    this.logger = AppLogger.createLogger('DeviceService');

    // タイムアウトチェック開始
    if (this.options.deviceTimeoutMs > 0) {
      this._startTimeoutCheck();
    }
  }

  /**
   * デバイスの検出と登録
   * @param {string} deviceId デバイスID
   * @param {Object} deviceInfo デバイス情報
   * @returns {Promise<Object>} デバイスオブジェクト
   */
  async registerDevice(deviceId, deviceInfo = {}) {
    if (!deviceId) {
      throw new Error('Device ID is required');
    }

    this.logger.debug(`Registering device: ${deviceId}`);

    // デバイスの存在確認
    let device = await this.deviceRepository.getById(deviceId);
    let isNew = false;

    if (!device) {
      // 最大デバイス数チェック
      const deviceCount = await this.deviceRepository.count();
      if (deviceCount >= this.options.maxDevices) {
        this.logger.warn(`Maximum device limit reached (${this.options.maxDevices})`);
        throw new Error(`Maximum device limit reached (${this.options.maxDevices})`);
      }

      // 新しいデバイスを作成
      isNew = true;
      const name = deviceInfo.name || `Device ${deviceId}`;
      device = new Device(deviceId, name);

      // イベント発火
      EventBus.emit('deviceDiscovered', new DeviceDiscoveredEvent(deviceId, deviceInfo));

      this.logger.info(`New device created: ${deviceId} (${name})`);
    }

    // 接続状態の更新
    if (!device.connected) {
      device.connect();

      // イベント発火
      EventBus.emit('deviceConnected', new DeviceConnectedEvent(deviceId, {
        timestamp: Date.now(),
        isNew
      }));

      this.logger.info(`Device connected: ${deviceId}`);
    }

    // メタデータの更新
    if (deviceInfo && typeof deviceInfo === 'object') {
      device.updateMetadata(deviceInfo);
    }

    // デバイスを保存
    await this.deviceRepository.save(device);

    return device;
  }

  /**
   * デバイスの接続
   * @param {string} deviceId デバイスID
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async connectDevice(deviceId) {
    const device = await this.deviceRepository.getById(deviceId);

    if (!device) {
      this.logger.warn(`Cannot connect non-existent device: ${deviceId}`);
      return false;
    }

    if (device.connected) {
      // すでに接続済み
      return true;
    }

    // 接続状態に設定
    device.connect();

    // イベント発火
    EventBus.emit('deviceConnected', new DeviceConnectedEvent(deviceId, {
      timestamp: Date.now(),
      isReconnect: true
    }));

    // 保存
    await this.deviceRepository.save(device);

    this.logger.info(`Device connected: ${deviceId}`);
    return true;
  }

  /**
   * デバイスの切断
   * @param {string} deviceId デバイスID
   * @param {string} reason 切断理由
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async disconnectDevice(deviceId, reason = 'manual') {
    const device = await this.deviceRepository.getById(deviceId);

    if (!device) {
      this.logger.warn(`Cannot disconnect non-existent device: ${deviceId}`);
      return false;
    }

    if (!device.connected) {
      // すでに切断済み
      return true;
    }

    // 切断状態に設定
    device.disconnect();

    // イベント発火
    EventBus.emit('deviceDisconnected', new DeviceDisconnectedEvent(deviceId, reason));

    // 保存
    await this.deviceRepository.save(device);

    this.logger.info(`Device disconnected: ${deviceId} (reason: ${reason})`);
    return true;
  }

  /**
   * デバイス名の設定
   * @param {string} deviceId デバイスID
   * @param {string} name デバイス名
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async setDeviceName(deviceId, name) {
    if (!name || typeof name !== 'string') {
      this.logger.warn(`Invalid device name: ${name}`);
      return false;
    }

    const device = await this.deviceRepository.getById(deviceId);

    if (!device) {
      this.logger.warn(`Cannot set name for non-existent device: ${deviceId}`);
      return false;
    }

    const oldName = device.name;
    device.setName(name);

    // イベント発火
    EventBus.emit('deviceUpdated', new DeviceUpdatedEvent(deviceId, {
      name: {
        old: oldName,
        new: name
      }
    }));

    // 保存
    await this.deviceRepository.save(device);

    this.logger.info(`Device name updated: ${deviceId} (${oldName} -> ${name})`);
    return true;
  }

  /**
   * デバイスアイコンの設定
   * @param {string} deviceId デバイスID
   * @param {string} iconUrl アイコンURL
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async setDeviceIcon(deviceId, iconUrl) {
    const device = await this.deviceRepository.getById(deviceId);

    if (!device) {
      this.logger.warn(`Cannot set icon for non-existent device: ${deviceId}`);
      return false;
    }

    const oldIconUrl = device.iconUrl;
    device.setIcon(iconUrl);

    // イベント発火
    EventBus.emit('deviceUpdated', new DeviceUpdatedEvent(deviceId, {
      iconUrl: {
        old: oldIconUrl,
        new: iconUrl
      }
    }));

    // 保存
    await this.deviceRepository.save(device);

    this.logger.info(`Device icon updated: ${deviceId}`);
    return true;
  }

  /**
   * デバイス値の設定
   * @param {string} deviceId デバイスID
   * @param {number|Object} value デバイス値（数値またはオブジェクト）
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async setDeviceValue(deviceId, value) {
    const device = await this.deviceRepository.getById(deviceId);

    if (!device) {
      this.logger.warn(`Cannot set value for non-existent device: ${deviceId}`);
      return false;
    }

    // デバイスが接続されていなければ接続
    if (!device.connected && this.options.autoConnect) {
      await this.connectDevice(deviceId);
    }

    // 値オブジェクトを作成
    let deviceValue;

    if (value instanceof DeviceValue) {
      deviceValue = value;
    } else if (typeof value === 'number') {
      deviceValue = new DeviceValue(deviceId, value);
    } else if (value && typeof value === 'object') {
      const { rawValue, normalizedValue, timestamp } = value;
      deviceValue = new DeviceValue(
        deviceId,
        rawValue !== undefined ? rawValue : null,
        normalizedValue !== undefined ? normalizedValue : null,
        timestamp || Date.now()
      );
    } else {
      this.logger.warn(`Invalid value format for device ${deviceId}`);
      return false;
    }

    // 値を保存
    await this.valueRepository.saveValue(deviceId, deviceValue);

    // 最終接続時間を更新
    device.updateLastSeen();
    await this.deviceRepository.save(device);

    return true;
  }

  /**
   * すべてのデバイスをリセット
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async resetAllDevices() {
    // デバイスリポジトリをリセット
    await this.deviceRepository.reset();

    // 値リポジトリもリセット
    await this.valueRepository.clearAllHistory();

    // イベント発火
    EventBus.emit('devicesReset', new DevicesResetEvent());

    this.logger.info('All devices have been reset');
    return true;
  }

  /**
   * すべてのデバイスを取得
   * @param {boolean} connectedOnly 接続済みデバイスのみ取得するかどうか
   * @returns {Promise<Array>} デバイスの配列
   */
  async getAllDevices(connectedOnly = false) {
    if (connectedOnly) {
      return await this.deviceRepository.getAllConnected();
    } else {
      return await this.deviceRepository.getAll();
    }
  }

  /**
   * デバイス情報を取得
   * @param {string} deviceId デバイスID
   * @returns {Promise<Object>} デバイス情報
   */
  async getDeviceInfo(deviceId) {
    const device = await this.deviceRepository.getById(deviceId);

    if (!device) {
      return null;
    }

    // 現在値も取得
    const value = await this.valueRepository.getCurrentValue(deviceId);

    return {
      device,
      value,
      lastUpdated: Date.now()
    };
  }

  /**
   * タイムアウトチェックの開始
   * @private
   */
  _startTimeoutCheck() {
    // 既存のタイマーをクリア
    if (this.timeoutCheckTimer) {
      clearInterval(this.timeoutCheckTimer);
    }

    // 定期的にチェック（タイムアウト時間の1/4の頻度）
    const checkInterval = Math.max(1000, this.options.deviceTimeoutMs / 4);

    this.timeoutCheckTimer = setInterval(() => {
      this._checkDeviceTimeouts().catch(error => {
        this.logger.error('Error checking device timeouts:', error);
      });
    }, checkInterval);

    this.logger.debug(`Device timeout checker started (interval: ${checkInterval}ms)`);
  }

  /**
   * デバイスのタイムアウトチェック
   * @private
   */
  async _checkDeviceTimeouts() {
    // 接続中のデバイスを取得
    const devices = await this.deviceRepository.getAllConnected();

    for (const device of devices) {
      // 応答期間内かチェック
      if (!device.isResponsiveWithin(this.options.deviceTimeoutMs)) {
        this.logger.debug(`Device ${device.id} timed out (${this.options.deviceTimeoutMs}ms)`);

        // タイムアウトで切断
        await this.disconnectDevice(device.id, 'timeout');

        // エラーイベント発火
        const errorEvent = new DeviceErrorEvent(
          device.id,
          'timeout',
          `Device timed out after ${this.options.deviceTimeoutMs}ms`
        );
        EventBus.emit('deviceError', errorEvent);
      }
    }
  }

  /**
   * クリーンアップ
   */
  dispose() {
    // タイマーの停止
    if (this.timeoutCheckTimer) {
      clearInterval(this.timeoutCheckTimer);
      this.timeoutCheckTimer = null;
    }

    this.logger.debug('DeviceService disposed');
  }
}