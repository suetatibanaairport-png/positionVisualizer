/**
 * ValueRepository.js
 * デバイス値の保存と取得を行うリポジトリの実装
 * ドメイン層のIValueRepositoryインターフェースを実装
 */

import { DeviceValue } from '../../domain/entities/DeviceValue.js';
import { IValueRepository } from '../../domain/repositories/IValueRepository.js';
import { ValueCalculator } from '../../domain/services/ValueCalculator.js';
import { EventBus } from '../services/EventBus.js';
import { AppLogger } from '../services/Logger.js';
import { EventTypes } from '../../domain/events/EventTypes.js';

/**
 * 値リポジトリの実装
 */
export class ValueRepository extends IValueRepository {
  /**
   * 値リポジトリのコンストラクタ
   * @param {Object} storageAdapter ストレージアダプター
   * @param {Object} options オプション設定
   */
  constructor(storageAdapter, options = {}) {
    super();
    this.storageAdapter = storageAdapter;
    this.options = {
      historySize: 50,               // デバイスごとの履歴サイズ
      persistValues: true,           // 値を永続化するか
      maxHistoryAge: 1000 * 60 * 60, // 履歴の最大期間（ミリ秒）
      ...options
    };

    // 現在の値のマップ（deviceId => DeviceValue）
    this.currentValues = new Map();

    // 値履歴のマップ（deviceId => DeviceValue[]）
    this.valueHistory = new Map();

    // イベントリスナーのマップ（deviceId => callback[]）
    this.listeners = new Map();

    this.logger = AppLogger.createLogger('ValueRepository');

    // ストレージからデータをロード
    if (this.options.persistValues) {
      this._loadFromStorage();
    }
  }

  /**
   * ストレージからデータをロード
   * @private
   */
  _loadFromStorage() {
    try {
      // 現在値のロード
      const storedValues = this.storageAdapter.getItem('device_values', {});

      // 履歴のロード
      const storedHistory = this.storageAdapter.getItem('value_history', {});

      this.logger.debug(`Loading values for ${Object.keys(storedValues).length} devices`);

      // 現在値を復元
      Object.entries(storedValues).forEach(([deviceId, valueData]) => {
        if (valueData) {
          this.currentValues.set(deviceId, DeviceValue.fromJSON(valueData));
        }
      });

      // 履歴を復元
      Object.entries(storedHistory).forEach(([deviceId, historyData]) => {
        if (Array.isArray(historyData)) {
          this.valueHistory.set(
            deviceId,
            historyData.map(item => DeviceValue.fromJSON(item))
          );
        }
      });

      // 古いデータのクリーンアップ
      this._cleanupOldData();

      this.logger.info(`Loaded values for ${this.currentValues.size} devices with history`);
    } catch (error) {
      this.logger.error('Error loading device values from storage:', error);

      // エラー時は初期化
      this.currentValues.clear();
      this.valueHistory.clear();
    }
  }

  /**
   * ストレージにデータを保存
   * @private
   */
  _saveToStorage() {
    if (!this.options.persistValues) return true;

    try {
      // 現在値をJSON形式に変換して保存
      const valuesToStore = {};
      this.currentValues.forEach((value, deviceId) => {
        valuesToStore[deviceId] = value.toJSON();
      });
      this.storageAdapter.setItem('device_values', valuesToStore);

      // 履歴をJSON形式に変換して保存
      const historyToStore = {};
      this.valueHistory.forEach((history, deviceId) => {
        historyToStore[deviceId] = history.map(value => value.toJSON());
      });
      this.storageAdapter.setItem('value_history', historyToStore);

      return true;
    } catch (error) {
      this.logger.error('Error saving device values to storage:', error);
      return false;
    }
  }

  /**
   * デバイスの現在値を取得
   * @param {string} deviceId デバイスID
   * @returns {Promise<DeviceValue|null>} デバイス値またはnull
   */
  async getCurrentValue(deviceId) {
    return this.currentValues.get(deviceId) || null;
  }

  /**
   * すべてのデバイスの現在値を取得
   * @returns {Promise<Object>} デバイスIDをキーとするデバイス値のマップ
   */
  async getAllCurrentValues() {
    const result = {};

    this.currentValues.forEach((value, deviceId) => {
      result[deviceId] = value;
    });

    return result;
  }

  /**
   * デバイスの値を保存
   * @param {string} deviceId デバイスID
   * @param {Object|DeviceValue} value 保存する値
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async saveValue(deviceId, value) {
    if (!deviceId) return false;

    let deviceValue;

    // 値がDeviceValueインスタンスかどうか確認
    if (value instanceof DeviceValue) {
      deviceValue = value;
    } else if (value && typeof value === 'object') {
      // オブジェクトからDeviceValueを作成
      const { rawValue, normalizedValue, timestamp } = value;
      deviceValue = new DeviceValue(
        deviceId,
        rawValue !== undefined ? rawValue : null,
        normalizedValue !== undefined ? normalizedValue : null,
        timestamp || Date.now()
      );
    } else {
      // 数値の場合は生の値として扱う
      const rawValue = typeof value === 'number' ? value : null;
      deviceValue = new DeviceValue(deviceId, rawValue);
    }

    // 前回の値を保存
    const previousValue = this.currentValues.get(deviceId);

    // 現在値を更新
    this.currentValues.set(deviceId, deviceValue);

    // 履歴に追加
    this._addToHistory(deviceId, deviceValue);

    // ストレージに保存
    if (this.options.persistValues) {
      this._saveToStorage();
    }

    // 値変更イベントを発火
    this._notifyValueChange(deviceId, deviceValue, previousValue);

    return true;
  }

  /**
   * 履歴に値を追加
   * @param {string} deviceId デバイスID
   * @param {DeviceValue} value デバイス値
   * @private
   */
  _addToHistory(deviceId, value) {
    if (!this.valueHistory.has(deviceId)) {
      this.valueHistory.set(deviceId, []);
    }

    const history = this.valueHistory.get(deviceId);

    // 履歴に追加
    history.push(value);

    // 履歴サイズを制限
    if (history.length > this.options.historySize) {
      history.shift(); // 最も古い項目を削除
    }
  }

  /**
   * 値変更をリスナーに通知
   * @param {string} deviceId デバイスID
   * @param {DeviceValue} value 新しい値
   * @param {DeviceValue} previousValue 前回の値
   * @private
   */
  _notifyValueChange(deviceId, value, previousValue) {
    // デバッグログ追加：値変更のイベント発行タイミング
    this.logger.debug(`値変更イベント発行: デバイスID=${deviceId}, 値=${JSON.stringify(value)}, 前回値あり=${!!previousValue}`);

    // デバイスごとのリスナーに通知
    if (this.listeners.has(deviceId)) {
      const listenersCount = this.listeners.get(deviceId).length;
      this.logger.debug(`デバイス ${deviceId} に対する直接リスナー数: ${listenersCount}`);

      this.listeners.get(deviceId).forEach(callback => {
        try {
          callback(value, previousValue);
        } catch (error) {
          this.logger.error(`Error in value change listener for ${deviceId}:`, error);
        }
      });
    }

    // イベントバスでグローバルに通知（新しいイベント命名規則を使用）
    this.logger.debug(`EventBus経由で DEVICE_VALUE_UPDATED イベントを発行: ${deviceId}`);
    EventBus.emit(EventTypes.DEVICE_VALUE_UPDATED, {
      deviceId,
      value,
      previousValue,
      timestamp: Date.now() // タイムスタンプを追加して発行時間を記録
    });

    // 後方互換性のために旧イベント名でも発行
    EventBus.emit('deviceValueChanged', {
      deviceId,
      value,
      previousValue,
      timestamp: Date.now()
    });
  }

  /**
   * デバイスの値履歴を取得
   * @param {string} deviceId デバイスID
   * @param {number} limit 取得する履歴の最大数
   * @param {number} offset 取得開始オフセット
   * @returns {Promise<Array<DeviceValue>>} 値の履歴配列
   */
  async getValueHistory(deviceId, limit = 100, offset = 0) {
    if (!this.valueHistory.has(deviceId)) {
      return [];
    }

    const history = this.valueHistory.get(deviceId);

    // オフセットと制限を適用
    if (offset >= history.length) {
      return [];
    }

    const start = Math.max(0, history.length - offset - limit);
    const end = Math.max(0, history.length - offset);

    return history.slice(start, end).reverse();
  }

  /**
   * 特定の時間範囲のデバイス値を取得
   * @param {string} deviceId デバイスID
   * @param {number} startTime 開始時間（ミリ秒）
   * @param {number} endTime 終了時間（ミリ秒）
   * @returns {Promise<Array<DeviceValue>>} 時間範囲内の値の配列
   */
  async getValuesByTimeRange(deviceId, startTime, endTime) {
    if (!this.valueHistory.has(deviceId)) {
      return [];
    }

    const history = this.valueHistory.get(deviceId);

    // 時間範囲でフィルタリング
    return history.filter(value => {
      return value.timestamp >= startTime && value.timestamp <= endTime;
    });
  }

  /**
   * デバイスの値履歴をクリア
   * @param {string} deviceId デバイスID
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async clearHistory(deviceId) {
    if (this.valueHistory.has(deviceId)) {
      this.valueHistory.set(deviceId, []);

      if (this.options.persistValues) {
        return this._saveToStorage();
      }
    }

    return true;
  }

  /**
   * すべてのデバイスの値履歴をクリア
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async clearAllHistory() {
    this.valueHistory.clear();

    if (this.options.persistValues) {
      return this._saveToStorage();
    }

    return true;
  }

  /**
   * デバイスの統計情報を計算
   * @param {string} deviceId デバイスID
   * @param {number} timeRangeMs 計算対象の時間範囲（ミリ秒）
   * @returns {Promise<Object>} 統計情報
   */
  async calculateStatistics(deviceId, timeRangeMs = 3600000) {
    const now = Date.now();
    const startTime = now - timeRangeMs;

    // 時間範囲内の値を取得
    const values = await this.getValuesByTimeRange(
      deviceId,
      startTime,
      now
    );

    if (values.length === 0) {
      return {
        count: 0,
        min: null,
        max: null,
        average: null,
        median: null,
        movingAverage: [],
        current: null,
        timestamp: now
      };
    }

    // 正規化値の配列を取得
    const normalizedValues = values.map(v => v.normalizedValue);

    // ValueCalculatorを使用して統計情報を計算
    const stats = ValueCalculator.calculateStatistics(normalizedValues);

    // 移動平均を計算（窓サイズ5）
    const movingAverage = ValueCalculator.calculateMovingAverage(normalizedValues, 5);

    // 現在値を取得
    const current = this.currentValues.get(deviceId);

    return {
      count: values.length,
      min: stats.min,
      max: stats.max,
      average: stats.average,
      median: stats.median,
      movingAverage,
      current: current ? current.normalizedValue : null,
      timestamp: now
    };
  }

  /**
   * デバイスの移動平均データを取得
   * @param {string} deviceId デバイスID
   * @param {number} windowSize 移動平均の窓サイズ
   * @param {number} limit 取得するデータポイント数
   * @returns {Promise<Array<number>>} 移動平均値の配列
   */
  async getMovingAverageData(deviceId, windowSize = 5, limit = 100) {
    const history = await this.getValueHistory(deviceId, limit);

    if (history.length === 0) {
      return [];
    }

    const normalizedValues = history.map(v => v.normalizedValue);
    return ValueCalculator.calculateMovingAverage(normalizedValues, windowSize);
  }

  /**
   * 古い値データを削除（クリーンアップ）
   * @param {number} maxAgeMs 保持する最大期間（ミリ秒）
   * @returns {Promise<number>} 削除されたエントリ数
   */
  async pruneOldData(maxAgeMs = null) {
    // 最大期間が指定されていない場合はオプションの値を使用
    const maxAge = maxAgeMs || this.options.maxHistoryAge;
    const cutoffTime = Date.now() - maxAge;

    let removedCount = 0;

    // 各デバイスの履歴をフィルタリング
    this.valueHistory.forEach((history, deviceId) => {
      const filteredHistory = history.filter(value => value.timestamp >= cutoffTime);

      removedCount += history.length - filteredHistory.length;

      this.valueHistory.set(deviceId, filteredHistory);
    });

    // 変更があった場合は保存
    if (removedCount > 0 && this.options.persistValues) {
      this._saveToStorage();
    }

    return removedCount;
  }

  /**
   * 古いデータをクリーンアップ
   * @private
   */
  _cleanupOldData() {
    this.pruneOldData().then(removedCount => {
      if (removedCount > 0) {
        this.logger.debug(`Cleaned up ${removedCount} old history entries`);
      }
    });
  }

  /**
   * 値の変更をリアルタイムに購読
   * @param {string} deviceId デバイスID
   * @param {Function} callback コールバック関数
   * @returns {Function} 購読解除用の関数
   */
  subscribeToValueChanges(deviceId, callback) {
    if (!this.listeners.has(deviceId)) {
      this.listeners.set(deviceId, []);
    }

    this.listeners.get(deviceId).push(callback);

    // 購読解除関数を返す
    return () => {
      if (!this.listeners.has(deviceId)) return;

      const listeners = this.listeners.get(deviceId);
      const index = listeners.indexOf(callback);

      if (index !== -1) {
        listeners.splice(index, 1);

        // リスナーがなくなったら削除
        if (listeners.length === 0) {
          this.listeners.delete(deviceId);
        }
      }
    };
  }

  /**
   * デバイス情報を取得
   * @param {string} deviceId デバイスID
   * @returns {Promise<Object|null>} デバイス情報またはnull
   */
  async getDeviceInfo(deviceId) {
    try {
      // デバイス情報をEventBusから取得する代わりに、アプリケーション内で保持しているデータを使用
      // 通常、デバイスサービスからデバイス情報を取得すべきだが、ここでは代替として現在の値から情報を取得
      const value = this.currentValues.get(deviceId);

      if (!value) {
        this.logger.debug(`No device info available for ${deviceId}`);
        return null;
      }

      // デバイス情報を構築
      // 実際のデバイス名やアイコンは別のサービスから取得することが望ましいが、
      // ここでは簡易的に現在の値から取得可能な情報を返す
      return {
        id: deviceId,
        name: deviceId, // デフォルト名としてデバイスIDを使用
        iconUrl: null,   // デフォルトアイコンはnull
        lastSeen: value.timestamp,
        connected: true
      };
    } catch (error) {
      this.logger.error(`Error getting device info for ${deviceId}:`, error);
      return null;
    }
  }
}