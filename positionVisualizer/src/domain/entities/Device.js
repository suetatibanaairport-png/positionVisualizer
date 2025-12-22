/**
 * Device.js
 * デバイスエンティティを表すクラス
 * ドメイン層のコアとなるエンティティ
 */

export class Device {
  /**
   * デバイスコンストラクタ
   * @param {string} id デバイスのID
   * @param {string|null} name デバイスの名前（未設定の場合はデフォルト名を使用）
   */
  constructor(id, name = null) {
    this.id = id;
    this.name = name || `デバイス ${id}`;
    this.connected = false;
    this.iconUrl = null;
    this.lastSeen = Date.now();
    this.metadata = {};
  }

  /**
   * デバイスを接続状態に設定
   */
  connect() {
    this.connected = true;
    this.lastSeen = Date.now();
  }

  /**
   * デバイスを切断状態に設定
   */
  disconnect() {
    this.connected = false;
  }

  /**
   * デバイスの名前を設定
   * @param {string} name 設定する名前
   */
  setName(name) {
    if (name && typeof name === 'string') {
      this.name = name;
    }
  }

  /**
   * デバイスのアイコンURLを設定
   * @param {string} iconUrl アイコンのURL
   */
  setIcon(iconUrl) {
    this.iconUrl = iconUrl;
  }

  /**
   * 最終接続時間を更新
   */
  updateLastSeen() {
    this.lastSeen = Date.now();
  }

  /**
   * メタデータを更新
   * @param {Object} metadata メタデータオブジェクト
   */
  updateMetadata(metadata = {}) {
    this.metadata = { ...this.metadata, ...metadata };
  }

  /**
   * デバイスが指定された時間内に応答しているかを確認
   * @param {number} timeoutMs タイムアウト時間（ミリ秒）
   * @returns {boolean} タイムアウト内かどうか
   */
  isResponsiveWithin(timeoutMs) {
    return Date.now() - this.lastSeen < timeoutMs;
  }

  /**
   * デバイス情報をシリアライズ可能な形式に変換
   * @returns {Object} シリアライズ用オブジェクト
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      connected: this.connected,
      iconUrl: this.iconUrl,
      lastSeen: this.lastSeen,
      metadata: this.metadata
    };
  }

  /**
   * シリアライズされたオブジェクトからデバイスインスタンスを作成
   * @param {Object} data シリアライズされたデバイスデータ
   * @returns {Device} 新しいDeviceインスタンス
   */
  static fromJSON(data) {
    const device = new Device(data.id, data.name);
    device.connected = data.connected || false;
    device.iconUrl = data.iconUrl || null;
    device.lastSeen = data.lastSeen || Date.now();
    device.metadata = data.metadata || {};
    return device;
  }
}