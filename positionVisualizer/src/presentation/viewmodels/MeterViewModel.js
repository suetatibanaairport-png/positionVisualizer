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
      lastUpdate: Array(this.options.maxDevices).fill(null),    // 最終更新時間
      tempDisconnected: Array(this.options.maxDevices).fill(false) // 一時的な切断状態
    };

    // 一時的な切断状態を自動的に元に戻すためのタイマーを保持
    this._disconnectTimers = Array(this.options.maxDevices).fill(null);

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
   *
   * 注意: この関数はデバイスの値の設定と共に接続状態も管理します。
   * 値の更新があるたびに、デバイスが応答していると判断し、タイムアウト処理をリセットします。
   */
  setValue(index, value, connected = true) {
    if (index < 0 || index >= this.options.maxDevices) {
      this.logger.warn(`Attempt to set value for invalid device index: ${index}`);
      return false;
    }

    this.logger.debug(`Setting value for device index ${index}: value=${value}, connected=${connected}`);

    // 値の更新があるたびにリセット処理を行う（接続中のデバイス）
    if (connected) {
      // 現在一時的な切断状態の場合は、それをクリアする
      if (this.state.tempDisconnected[index]) {
        this.logger.debug(`Device ${index} was temporarily disconnected but is now responsive, clearing temporary disconnection`);

        // タイマーをクリア
        if (this._disconnectTimers[index]) {
          clearTimeout(this._disconnectTimers[index]);
          this._disconnectTimers[index] = null;
        }

        // 一時的な切断状態をクリア
        this.state.tempDisconnected[index] = false;
      }

      // 接続状態が変わった場合に更新
      if (!this.state.connected[index]) {
        this.logger.debug(`Device ${index} connection state updated to connected`);
        this.state.connected[index] = true;
      }

      // 最終更新時間を更新
      this.state.lastUpdate[index] = Date.now();
    }
    // 接続 → 切断への変更
    else if (this.state.connected[index] && !connected) {
      this.logger.debug(`Device ${index} disconnected, handling as temporary disconnection`);

      // 一時的な切断状態を設定（タイマーをセット）
      this._handleDisconnection(index, true);

      return true;
    }

    // 切断状態で値がnullの場合
    if (!connected && !this.state.tempDisconnected[index]) {
      return true; // 完全な切断状態では値を更新しない
    }

    // 一時的な切断状態では値の更新を許可
    // この時点で、connected=falseでもtempDisconnected=trueの場合は、値の更新を処理する

    // 値がnullまたは未定義の場合はスキップ
    if (value === null || value === undefined) {
      this.logger.debug(`Skipping null/undefined value for device ${index}`);
      return false;
    }

    // 値の変化が小さい場合は即時更新
    if (this.state.values[index] === null ||
        Math.abs((this.state.values[index] || 0) - value) < 1) {
      this.logger.debug(`Small change or initial value for device ${index}, setting directly: ${value}`);
      this._setValueDirectly(index, value);
      return true;
    }

    // 値の補間を開始
    this.logger.debug(`Starting interpolation for device ${index}: ${this.state.values[index]} -> ${value}`);
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
    this.state.tempDisconnected = Array(this.options.maxDevices).fill(false);

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

    // タイマーのクリア
    this._disconnectTimers.forEach((timer, index) => {
      if (timer) {
        clearTimeout(timer);
        this._disconnectTimers[index] = null;
      }
    });

    this.logger.debug('MeterViewModel reset');
    this._notifyChange();

    return true;
  }

  /**
   * 切断処理を行う
   * @param {number} index デバイスインデックス
   * @param {boolean} isTemporary 一時的な切断かどうか
   * @private
   */
  _handleDisconnection(index, isTemporary = true) {
    // インデックスの範囲チェック
    if (index < 0 || index >= this.options.maxDevices) {
      this.logger.warn(`Invalid device index for disconnection handler: ${index}`);
      return;
    }

    // 再切断の場合はタイマーをリセットする（タイムアウト時間を延長）
    if (this._disconnectTimers[index]) {
      this.logger.debug(`Device ${index} disconnection timer reset due to new disconnect event`);
      clearTimeout(this._disconnectTimers[index]);
      this._disconnectTimers[index] = null;
    }

    if (isTemporary) {
      // 一時的な切断状態にする（接続状態は true のまま維持）
      this.state.tempDisconnected[index] = true;

      // デバイスの接続状態を維持（UXの安定性のため）
      // this.state.connected[index] = true;

      // 値は維持し、タイムアウト後に完全に切断する
      // 60秒間（通常のタイムアウトの6倍）一時的な切断状態を維持
      this._disconnectTimers[index] = setTimeout(() => {
        // タイマーが終了したときに、そのデバイスがまだ一時的な切断状態にあるかを確認
        if (this.state.tempDisconnected[index]) {
          this.logger.debug(`Device ${index} temporary disconnection timed out after 60 seconds, fully disconnecting`);

          // 接続状態を切断に変更
          this.state.connected[index] = false;
          this.state.tempDisconnected[index] = false;

          // 値をクリア
          this._setValueDirectly(index, null);

          // タイマー参照をクリア
          this._disconnectTimers[index] = null;

          // 変更を通知
          this._notifyChange();
        } else {
          this.logger.debug(`Device ${index} temporary disconnection timer expired but device is already reconnected`);
        }
      }, 60000); // 60秒後（タイムアウト時間を長くして、短期的な切断に対応）

      this.logger.debug(`Device ${index} set to temporary disconnection state with 60 second timeout`);
    } else {
      // 即座に完全に切断
      this.state.connected[index] = false;
      this.state.tempDisconnected[index] = false;
      this._setValueDirectly(index, null);
      this.logger.debug(`Device ${index} fully disconnected`);
    }
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
    this.logger.debug('Notifying state change', {
      connectedCount: this.state.connected.filter(c => c).length,
      valuesStatus: this.state.values.map(v => v !== null ? '値あり' : '値なし')
    });
    EventBus.emit('meterViewModel:change', { ...this.state });
  }

  /**
   * クリーンアップ処理
   */
  dispose() {
    // 切断タイマーをクリア
    this._disconnectTimers.forEach((timer, index) => {
      if (timer) {
        clearTimeout(timer);
        this._disconnectTimers[index] = null;
      }
    });

    this.logger.debug('MeterViewModel disposed');
  }
}