/**
 * MeterViewModel.js
 * メーター表示のためのビューモデルクラス
 * UIの状態を管理し、アプリケーション層とプレゼンテーション層の橋渡しをする
 */

import { EventBus } from '../../infrastructure/services/EventBus.js';
import { AppLogger } from '../../infrastructure/services/Logger.js';

/**
 * メーターのビューモデルクラス
 */
export class MeterViewModel {
  /**
   * メーターのビューモデルを初期化
   * @param {Object} options オプション設定
   */
  constructor(options = {}) {
    this.options = {
      maxDevices: 6,                // 最大デバイス数
      interpolationTime: 200,       // 値の補間時間（ミリ秒）
      ...options
    };

    // ロガー
    this.logger = AppLogger.createLogger('MeterViewModel');

    // 初期状態
    this.state = {
      values: Array(this.options.maxDevices).fill(null),        // デバイス値
      names: Array(this.options.maxDevices).fill(null),         // デバイス名
      icons: Array(this.options.maxDevices).fill(null),         // デバイスアイコン
      connected: Array(this.options.maxDevices).fill(false),    // 接続状態
      lastUpdate: Array(this.options.maxDevices).fill(null)     // 最終更新時間
    };

    // デバイスのインデックスマッピング
    this.deviceMapping = new Map();

    // 補間用の状態
    this._targetValues = Array(this.options.maxDevices).fill(null);
    this._startValues = Array(this.options.maxDevices).fill(null);
    this._startTime = Array(this.options.maxDevices).fill(null);
    this._interpolating = Array(this.options.maxDevices).fill(false);

    // 補間の更新ループ
    this._setupInterpolationLoop();

    this.logger.debug('MeterViewModel initialized');
  }

  /**
   * デバイスIDに基づいてインデックスを取得または割り当て
   * @param {string} deviceId デバイスID
   * @returns {number} デバイスインデックス（空きがない場合は-1）
   */
  getOrAssignDeviceIndex(deviceId) {
    if (!deviceId) return -1;

    if (this.deviceMapping.has(deviceId)) {
      return this.deviceMapping.get(deviceId);
    }

    // 空きインデックスを探す
    for (let i = 0; i < this.options.maxDevices; i++) {
      if (!this.state.connected[i]) {
        this.deviceMapping.set(deviceId, i);
        this.logger.debug(`Assigned device ${deviceId} to index ${i}`);
        return i;
      }
    }

    this.logger.warn(`No available slots for device ${deviceId}`);
    return -1; // 空きなし
  }

  /**
   * デバイスIDからインデックスを取得
   * @param {string} deviceId デバイスID
   * @returns {number} デバイスインデックス（見つからない場合は-1）
   */
  getDeviceIndex(deviceId) {
    return this.deviceMapping.has(deviceId) ? this.deviceMapping.get(deviceId) : -1;
  }

  /**
   * インデックスからデバイスIDを取得
   * @param {number} index デバイスインデックス
   * @returns {string|null} デバイスID
   */
  getDeviceIdByIndex(index) {
    if (index < 0 || index >= this.options.maxDevices) return null;

    for (const [id, idx] of this.deviceMapping.entries()) {
      if (idx === index) return id;
    }
    return null;
  }

  /**
   * デバイス値の設定
   * @param {number} index デバイスインデックス
   * @param {number} value デバイス値
   * @param {boolean} connected 接続状態
   * @returns {boolean} 成功したかどうか
   */
  setValue(index, value, connected = true) {
    if (index < 0 || index >= this.options.maxDevices) return false;

    // 接続状態の更新
    if (this.state.connected[index] !== connected) {
      this.state.connected[index] = connected;
      this.state.lastUpdate[index] = connected ? Date.now() : null;

      // 未接続の場合は値をnullに
      if (!connected) {
        this._setValueDirectly(index, null);
        this._hideIcon(index);
        return true;
      }
    }

    // 値がnullまたは未定義の場合はスキップ
    if (value === null || value === undefined) return false;

    // 値の変化が小さい場合は即時更新
    if (this.state.values[index] === null ||
        Math.abs((this.state.values[index] || 0) - value) < 1) {
      this._setValueDirectly(index, value);
      return true;
    }

    // 値の補間を開始
    this._startInterpolation(index, value);
    return true;
  }

  /**
   * デバイス名の設定
   * @param {number} index デバイスインデックス
   * @param {string} name デバイス名
   * @returns {boolean} 成功したかどうか
   */
  setName(index, name) {
    if (index < 0 || index >= this.options.maxDevices) return false;

    if (this.state.names[index] !== name) {
      this.state.names[index] = name;
      this.state.lastUpdate[index] = Date.now();
      this._notifyChange();
      return true;
    }
    return false;
  }

  /**
   * デバイスアイコンの設定
   * @param {number} index デバイスインデックス
   * @param {string} iconUrl アイコンURL
   * @returns {boolean} 成功したかどうか
   */
  setIcon(index, iconUrl) {
    if (index < 0 || index >= this.options.maxDevices) return false;

    if (this.state.icons[index] !== iconUrl) {
      this.state.icons[index] = iconUrl;
      this.state.lastUpdate[index] = Date.now();
      this._notifyChange();
      return true;
    }
    return false;
  }

  /**
   * リセット処理
   * すべてのデバイスの状態をリセット
   */
  reset() {
    // 全デバイスの状態をリセット
    this.state.values = Array(this.options.maxDevices).fill(null);
    this.state.connected = Array(this.options.maxDevices).fill(false);
    this.state.lastUpdate = Array(this.options.maxDevices).fill(null);

    // 名前とアイコンは保持するオプションもあるが、クリーンなリセットのため全てクリア
    this.state.names = Array(this.options.maxDevices).fill(null);
    this.state.icons = Array(this.options.maxDevices).fill(null);

    // デバイスマッピングをクリア
    this.deviceMapping.clear();

    // 補間状態のリセット
    this._targetValues = Array(this.options.maxDevices).fill(null);
    this._startValues = Array(this.options.maxDevices).fill(null);
    this._startTime = Array(this.options.maxDevices).fill(null);
    this._interpolating = Array(this.options.maxDevices).fill(false);

    this.logger.debug('MeterViewModel reset');
    this._notifyChange();

    return true;
  }

  /**
   * 変更リスナーの登録
   * @param {Function} callback コールバック関数
   * @returns {Function} リスナー削除関数
   */
  onChange(callback) {
    return EventBus.on('meterViewModel:change', callback);
  }

  /**
   * 接続されているデバイスのインデックスを取得
   * @returns {Array<number>} 接続されているデバイスのインデックス配列
   */
  getConnectedDeviceIndices() {
    return this.state.connected
      .map((connected, index) => connected ? index : -1)
      .filter(index => index !== -1);
  }

  /**
   * 直接値を設定（補間なし）
   * @param {number} index デバイスインデックス
   * @param {number} value デバイス値
   * @private
   */
  _setValueDirectly(index, value) {
    if (this.state.values[index] !== value) {
      this.state.values[index] = value;
      this.state.lastUpdate[index] = Date.now();
      this._interpolating[index] = false;
      this._notifyChange();
    }
  }

  /**
   * 補間の開始
   * @param {number} index デバイスインデックス
   * @param {number} targetValue 目標値
   * @private
   */
  _startInterpolation(index, targetValue) {
    this._startValues[index] = this.state.values[index] || 0;
    this._targetValues[index] = targetValue;
    this._startTime[index] = performance.now();
    this._interpolating[index] = true;
    this.state.lastUpdate[index] = Date.now();
  }

  /**
   * 補間ループの設定
   * @private
   */
  _setupInterpolationLoop() {
    const updateInterpolation = () => {
      const now = performance.now();
      let updated = false;

      for (let i = 0; i < this.options.maxDevices; i++) {
        if (!this._interpolating[i]) continue;

        const elapsed = now - this._startTime[i];
        const progress = Math.min(elapsed / this.options.interpolationTime, 1);

        if (progress >= 1) {
          // 補間完了
          this.state.values[i] = this._targetValues[i];
          this._interpolating[i] = false;
        } else {
          // 補間中
          this.state.values[i] = this._startValues[i] +
            (this._targetValues[i] - this._startValues[i]) * progress;
        }

        updated = true;
      }

      if (updated) {
        this._notifyChange();
      }

      // 次のフレームを要求
      requestAnimationFrame(updateInterpolation);
    };

    // 補間ループを開始
    requestAnimationFrame(updateInterpolation);
  }

  /**
   * 変更通知
   * @private
   */
  _notifyChange() {
    EventBus.emit('meterViewModel:change', { ...this.state });
  }

  /**
   * クリーンアップ処理
   */
  dispose() {
    // タイマーをクリア
    this._iconTimers.forEach((timer, index) => {
      if (timer) {
        clearTimeout(timer);
        this._iconTimers[index] = null;
      }
    });

    this.logger.debug('MeterViewModel disposed');
  }
}