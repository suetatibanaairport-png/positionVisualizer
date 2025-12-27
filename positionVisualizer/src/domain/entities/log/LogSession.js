/**
 * LogSession.js
 * ログセッションの基本データ構造を定義
 * ログデータの構造とメタデータを管理
 */

/**
 * ログセッションクラス
 * ログデータとメタデータをカプセル化
 */
export class LogSession {
  /**
   * LogSessionコンストラクタ
   * @param {Object} metadata セッションのメタデータ
   * @param {Array} entries ログエントリの配列
   */
  constructor(metadata = {}, entries = []) {
    this.metadata = {
      version: "1.0",
      createdAt: metadata.createdAt || new Date().toISOString(),
      deviceCount: metadata.deviceCount || 0,
      entriesCount: metadata.entriesCount || entries.length,
      startTime: metadata.startTime || Date.now(),
      endTime: metadata.endTime || Date.now(),
      deviceInfo: metadata.deviceInfo || {},
      ...metadata
    };

    this.entries = entries;
  }

  /**
   * JSONデータからLogSessionインスタンスを生成
   * @param {Object|string} data パース済みJSONデータまたはJSON文字列
   * @returns {LogSession} 生成されたLogSessionインスタンス
   */
  static fromJSON(data) {
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (e) {
        throw new Error('Invalid JSON format for LogSession');
      }
    }

    // 新形式（metadata/entriesを含むオブジェクト）
    if (data && data.metadata && Array.isArray(data.entries)) {
      return new LogSession(data.metadata, data.entries);
    }

    // 旧形式の変換処理
    return LogSession.convertFromLegacyFormat(data);
  }

  /**
   * 旧形式のログデータを新形式に変換
   * @param {Object|Array} data 旧形式のログデータ
   * @returns {LogSession} 変換されたLogSessionインスタンス
   */
  static convertFromLegacyFormat(data) {
    // 旧形式の場合は変換する
    const entries = Array.isArray(data)
      ? data
      : (data.records && Array.isArray(data.records) ? data.records : []);

    if (entries.length === 0) {
      throw new Error('Invalid log format: No entries found');
    }

    // デバイスIDの収集
    const deviceIds = new Set();
    entries.forEach(entry => {
      if (entry.id) {
        deviceIds.add(`lever${entry.id}`);
      }
    });

    // 相対時間の開始点を計算
    const baseTimestamp = Math.min(...entries.map(e => Number(e.ts) || 0));

    // 新形式のエントリーに変換
    const convertedEntries = entries.map(entry => {
      const deviceId = `lever${entry.id}`;
      return {
        deviceId: deviceId,
        value: {
          raw: Number(entry.value),
          normalized: Number(entry.value),
        },
        timestamp: Date.now() - baseTimestamp + (Number(entry.ts) || 0),
        relativeTime: Number(entry.ts) || 0
      };
    });

    // 新形式のメタデータを作成
    const metadata = {
      version: "1.0",
      createdAt: new Date().toISOString(),
      deviceCount: deviceIds.size,
      entriesCount: convertedEntries.length,
      startTime: Date.now() - baseTimestamp,
      endTime: Date.now(),
      deviceInfo: {}
    };

    return new LogSession(metadata, convertedEntries);
  }

  /**
   * デバイス情報を追加
   * @param {string} deviceId デバイスID
   * @param {Object} info デバイス情報
   */
  addDeviceInfo(deviceId, info) {
    if (!this.metadata.deviceInfo) {
      this.metadata.deviceInfo = {};
    }

    this.metadata.deviceInfo[deviceId] = {
      ...this.metadata.deviceInfo[deviceId],
      ...info
    };
  }

  /**
   * エントリを追加
   * @param {Object} entry 追加するログエントリ
   */
  addEntry(entry) {
    this.entries.push(entry);
    this.metadata.entriesCount = this.entries.length;
  }

  /**
   * JSON文字列に変換
   * @returns {string} JSON文字列
   */
  toJSON() {
    return JSON.stringify({
      metadata: this.metadata,
      entries: this.entries
    });
  }
}