/**
 * LogEntry.js
 * ログエントリのデータ構造を定義
 * 各デバイスの値とタイムスタンプを管理
 */

/**
 * ログエントリクラス
 * 各デバイスの値と時間情報をカプセル化
 */
export class LogEntry {
  /**
   * LogEntryコンストラクタ
   * @param {string} deviceId デバイスID
   * @param {Object} value デバイスの値 (raw, normalizedなどのプロパティを含む)
   * @param {number} timestamp タイムスタンプ (ミリ秒単位)
   * @param {number} relativeTime セッション開始からの相対時間 (ミリ秒単位)
   */
  constructor(deviceId, value, timestamp, relativeTime) {
    this.deviceId = deviceId;
    this.value = value || { raw: 0, normalized: 0 };
    this.timestamp = timestamp || Date.now();
    this.relativeTime = relativeTime !== undefined ? relativeTime : 0;
  }

  /**
   * JSONオブジェクトからLogEntryインスタンスを生成
   * @param {Object} data JSONオブジェクト
   * @returns {LogEntry} 生成されたLogEntryインスタンス
   */
  static fromJSON(data) {
    return new LogEntry(
      data.deviceId,
      data.value,
      data.timestamp,
      data.relativeTime
    );
  }

  /**
   * JSONオブジェクトに変換
   * @returns {Object} JSONオブジェクト
   */
  toJSON() {
    return {
      deviceId: this.deviceId,
      value: this.value,
      timestamp: this.timestamp,
      relativeTime: this.relativeTime
    };
  }
}