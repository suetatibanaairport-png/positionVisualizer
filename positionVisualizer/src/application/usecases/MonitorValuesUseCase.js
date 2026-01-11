/**
 * MonitorValuesUseCase.js
 * デバイス値のモニタリングを行うユースケース
 * デバイスからの値取得と監視を担当
 */

import { DeviceValueUpdatedEvent } from '../../domain/events/DeviceEvents.js';
// 注: IEventBus, ILogger はドメイン層のインターフェース
// 実装はAppBootstrapで注入される

/**
 * デバイス値モニタリングのユースケースクラス
 */
export class MonitorValuesUseCase {
  /**
   * モニタリングユースケースのコンストラクタ
   * @param {Object} deviceRepository デバイスリポジトリ
   * @param {Object} valueRepository 値リポジトリ
   * @param {Object} eventBus イベントバス（IEventBus実装）
   * @param {Object} logger ロガー（ILogger実装）
   * @param {Object} options オプション設定
   */
  constructor(deviceRepository, valueRepository, eventBus, logger, options = {}) {
    this.deviceRepository = deviceRepository;
    this.valueRepository = valueRepository;
    this.eventBus = eventBus;
    this.logger = logger || { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };
    this.options = {
      monitoringInterval: 100,       // モニタリング間隔（ミリ秒）
      useWebSocketUpdates: true,     // WebSocketからの更新を使用するか
      adaptivePolling: true,         // 適応的なポーリングを使用するか
      minPollingInterval: 50,        // 最小ポーリング間隔（ミリ秒）
      maxPollingInterval: 1000,      // 最大ポーリング間隔（ミリ秒）
      valueChangeThreshold: 5,       // 値変更通知のしきい値
      ...options
    };

    // モニタリング状態
    this.monitoring = false;
    this.monitoringTimer = null;
    this.deviceUpdateTimes = new Map(); // 最終更新時間を追跡
    this.devicePollingIntervals = new Map(); // デバイスごとのポーリング間隔
  }

  /**
   * デバイスの値をモニタリング
   * @param {string} deviceId デバイスID
   * @returns {Promise<Object|null>} デバイス値またはnull
   */
  async monitorDeviceValue(deviceId) {
    try {
      // デバイスの存在確認
      const device = await this.deviceRepository.getById(deviceId);
      if (!device) {
        this.logger.debug(`Device not found: ${deviceId}`);
        return null;
      }

      // デバイスが接続されていないかチェック
      if (!device.connected) {
        this.logger.debug(`Device not connected: ${deviceId}`);
        return null;
      }

      // 前回の値を取得
      const previousValue = await this.valueRepository.getCurrentValue(deviceId);

      // 外部から値が更新されているかチェック
      // 注：実装によっては、ここでWebSocketや外部APIから最新値を取得する必要がある
      // このサンプルでは、直接ValueRepositoryから取得する
      const currentValue = await this.valueRepository.getCurrentValue(deviceId);

      // 値の比較と更新
      if (currentValue) {
        // 最終更新時間を記録
        this.deviceUpdateTimes.set(deviceId, Date.now());

        // 値の変更が閾値を超える場合にイベント発行
        if (previousValue && this._shouldNotifyValueChange(previousValue, currentValue)) {
          const event = new DeviceValueUpdatedEvent(deviceId, currentValue, previousValue);
          this.eventBus.emit('deviceValueUpdated', event);
        }

        // ポーリング間隔の調整（適応的ポーリングが有効な場合）
        if (this.options.adaptivePolling) {
          this._adjustPollingInterval(deviceId, previousValue, currentValue);
        }

        return currentValue;
      }

      return null;
    } catch (error) {
      this.logger.error(`Error monitoring device ${deviceId}:`, error);
      return null;
    }
  }

  /**
   * すべてのデバイスをモニタリング
   * @returns {Promise<Array>} デバイス値の配列
   */
  async monitorAllDevices() {
    try {
      // 接続中のデバイスを取得
      const devices = await this.deviceRepository.getAllConnected();
      const results = [];

      // 各デバイスの値を監視
      for (const device of devices) {
        const value = await this.monitorDeviceValue(device.id);
        if (value) {
          results.push({ deviceId: device.id, value });
        }
      }

      return results;
    } catch (error) {
      this.logger.error('Error monitoring all devices:', error);
      return [];
    }
  }

  /**
   * モニタリングを開始
   * @param {number} interval モニタリング間隔（ミリ秒）
   * @returns {boolean} 開始に成功したかどうか
   */
  startMonitoring(interval = null) {
    if (this.monitoring) {
      this.logger.debug('Monitoring already started');
      return false;
    }

    // 間隔を設定
    const monitoringInterval = interval || this.options.monitoringInterval;

    this.monitoring = true;
    this.logger.info(`Starting monitoring with interval: ${monitoringInterval}ms`);

    // モニタリングループを開始
    this.monitoringTimer = setInterval(() => {
      this.monitorAllDevices().catch(error => {
        this.logger.error('Error in monitoring loop:', error);
      });
    }, monitoringInterval);

    // 開始イベントを発行
    this.eventBus.emit('monitoringStarted', { interval: monitoringInterval });

    return true;
  }

  /**
   * モニタリングを停止
   * @returns {boolean} 停止に成功したかどうか
   */
  stopMonitoring() {
    if (!this.monitoring) {
      this.logger.debug('Monitoring not running');
      return false;
    }

    this.monitoring = false;

    // タイマーをクリア
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }

    this.logger.info('Monitoring stopped');

    // 停止イベントを発行
    this.eventBus.emit('monitoringStopped', {});

    return true;
  }

  /**
   * モニタリング状態を取得
   * @returns {Object} モニタリング状態
   */
  getMonitoringStatus() {
    return {
      monitoring: this.monitoring,
      interval: this.options.monitoringInterval,
      deviceCount: this.deviceUpdateTimes.size
    };
  }

  /**
   * WebSocketによる値更新ハンドラ
   * @param {string} deviceId デバイスID
   * @param {Object} data デバイスデータ
   */
  handleWebSocketUpdate(deviceId, data) {
    if (!deviceId || !data) return;

    // デバイス値を保存
    this.valueRepository.saveValue(deviceId, data).catch(error => {
      this.logger.error(`Error saving WebSocket update for device ${deviceId}:`, error);
    });
  }

  /**
   * 値変更通知の判定
   * @param {Object} previousValue 前回の値
   * @param {Object} currentValue 現在の値
   * @returns {boolean} 通知すべきかどうか
   * @private
   */
  _shouldNotifyValueChange(previousValue, currentValue) {
    if (!previousValue || !currentValue) return true;

    // 正規化値の変化を確認
    const prevNormalized = previousValue.normalizedValue;
    const currNormalized = currentValue.normalizedValue;

    if (prevNormalized === null || currNormalized === null) return true;

    // 変化量がしきい値を超えるか確認
    return Math.abs(currNormalized - prevNormalized) >= this.options.valueChangeThreshold;
  }

  /**
   * ポーリング間隔を調整
   * @param {string} deviceId デバイスID
   * @param {Object} previousValue 前回の値
   * @param {Object} currentValue 現在の値
   * @private
   */
  _adjustPollingInterval(deviceId, previousValue, currentValue) {
    if (!previousValue || !currentValue) return;

    // 現在のポーリング間隔を取得
    let currentInterval = this.devicePollingIntervals.get(deviceId) || this.options.monitoringInterval;

    // 変化率を計算（0-1）
    let changeRate = 0;

    if (previousValue.normalizedValue !== null && currentValue.normalizedValue !== null) {
      changeRate = Math.abs(currentValue.normalizedValue - previousValue.normalizedValue) / 100;
    }

    // 変化率に基づいて新しい間隔を計算
    let newInterval;

    if (changeRate > 0.1) {
      // 大きな変化がある場合は頻繁にポーリング
      newInterval = this.options.minPollingInterval;
    } else if (changeRate > 0.05) {
      // 中程度の変化の場合
      newInterval = Math.max(
        this.options.minPollingInterval,
        this.options.monitoringInterval * 0.75
      );
    } else if (changeRate > 0.01) {
      // 小さな変化の場合
      newInterval = this.options.monitoringInterval;
    } else {
      // ほとんど変化がない場合は間隔を伸ばす
      newInterval = Math.min(
        this.options.maxPollingInterval,
        currentInterval * 1.25
      );
    }

    // 最小・最大範囲に制限
    newInterval = Math.max(this.options.minPollingInterval, Math.min(newInterval, this.options.maxPollingInterval));

    // 間隔を更新
    this.devicePollingIntervals.set(deviceId, newInterval);
  }
}