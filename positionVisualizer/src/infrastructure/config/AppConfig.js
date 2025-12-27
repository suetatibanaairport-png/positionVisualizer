/**
 * AppConfig.js
 * アプリケーション設定の管理クラス
 * 設定値を一元管理し、window.APP_CONFIGへの依存を解消する
 */

/**
 * アプリケーション設定クラス
 * シングルトンパターンで実装
 */
class AppConfig {
  /**
   * シングルトンインスタンス
   * @type {AppConfig}
   * @private
   */
  static _instance = null;

  /**
   * シングルトンインスタンスの取得
   * @returns {AppConfig} アプリケーション設定インスタンス
   */
  static getInstance() {
    if (!this._instance) {
      this._instance = new AppConfig();
    }
    return this._instance;
  }

  /**
   * コンストラクタ
   * @private
   */
  constructor() {
    // 外部設定（存在すれば）
    const externalConfig = typeof window !== 'undefined' && window.APP_CONFIG ? window.APP_CONFIG : {};

    // デフォルト設定と外部設定をマージ
    this.config = {
      // UI設定
      containerId: 'meter-container',

      // 通信設定
      webSocketUrl: 'ws://localhost:8123',

      // デバイス設定
      maxDevices: 6,

      // その他設定
      debug: false,

      // 外部設定で上書き
      ...externalConfig
    };
  }

  /**
   * 指定されたキーの設定値を取得
   * @param {string} key 設定キー
   * @param {*} defaultValue キーが存在しない場合のデフォルト値
   * @returns {*} 設定値
   */
  get(key, defaultValue = null) {
    return key in this.config ? this.config[key] : defaultValue;
  }

  /**
   * 設定値を設定
   * @param {string} key 設定キー
   * @param {*} value 設定値
   */
  set(key, value) {
    this.config[key] = value;
  }

  /**
   * 全ての設定を取得
   * @returns {Object} 設定オブジェクト
   */
  getAll() {
    return { ...this.config };
  }

  /**
   * 設定の更新（一部）
   * @param {Object} configUpdates 更新する設定のオブジェクト
   */
  update(configUpdates) {
    this.config = {
      ...this.config,
      ...configUpdates
    };
  }
}

// 直接のインスタンス化ではなくgetInstanceを使うように促す
export const appConfig = AppConfig.getInstance();
export default appConfig;