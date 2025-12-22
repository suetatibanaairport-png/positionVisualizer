/**
 * IValueRepository.js
 * デバイスの値情報を管理するためのリポジトリインターフェース
 * 具体的な実装はインフラストラクチャ層で行う
 */

/**
 * 値リポジトリのインターフェース
 * デバイス値の取得・保存・履歴管理などの操作を定義
 */
export class IValueRepository {
  /**
   * デバイスの現在値を取得
   * @param {string} deviceId デバイスID
   * @returns {Promise<Object|null>} デバイス値またはnull
   */
  async getCurrentValue(deviceId) {
    throw new Error("Not implemented");
  }

  /**
   * すべてのデバイスの現在値を取得
   * @returns {Promise<Object>} デバイスIDをキーとするデバイス値のマップ
   */
  async getAllCurrentValues() {
    throw new Error("Not implemented");
  }

  /**
   * デバイスの値を保存
   * @param {string} deviceId デバイスID
   * @param {Object} value 保存する値
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async saveValue(deviceId, value) {
    throw new Error("Not implemented");
  }

  /**
   * デバイスの値履歴を取得
   * @param {string} deviceId デバイスID
   * @param {number} limit 取得する履歴の最大数
   * @param {number} offset 取得開始オフセット
   * @returns {Promise<Array>} 値の履歴配列
   */
  async getValueHistory(deviceId, limit = 100, offset = 0) {
    throw new Error("Not implemented");
  }

  /**
   * 特定の時間範囲のデバイス値を取得
   * @param {string} deviceId デバイスID
   * @param {number} startTime 開始時間（ミリ秒）
   * @param {number} endTime 終了時間（ミリ秒）
   * @returns {Promise<Array>} 時間範囲内の値の配列
   */
  async getValuesByTimeRange(deviceId, startTime, endTime) {
    throw new Error("Not implemented");
  }

  /**
   * デバイスの値履歴をクリア
   * @param {string} deviceId デバイスID
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async clearHistory(deviceId) {
    throw new Error("Not implemented");
  }

  /**
   * すべてのデバイスの値履歴をクリア
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async clearAllHistory() {
    throw new Error("Not implemented");
  }

  /**
   * デバイスの統計情報を計算
   * @param {string} deviceId デバイスID
   * @param {number} timeRangeMs 計算対象の時間範囲（ミリ秒）
   * @returns {Promise<Object>} 統計情報
   */
  async calculateStatistics(deviceId, timeRangeMs = 3600000) {
    throw new Error("Not implemented");
  }

  /**
   * 古い値データを削除（クリーンアップ）
   * @param {number} maxAgeMs 保持する最大期間（ミリ秒）
   * @returns {Promise<number>} 削除されたエントリ数
   */
  async pruneOldData(maxAgeMs) {
    throw new Error("Not implemented");
  }

  /**
   * 値の変更をリアルタイムに購読
   * @param {string} deviceId デバイスID
   * @param {Function} callback コールバック関数
   * @returns {Function} 購読解除用の関数
   */
  subscribeToValueChanges(deviceId, callback) {
    throw new Error("Not implemented");
  }
}