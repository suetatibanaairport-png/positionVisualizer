/**
 * Settings.js
 * アプリケーション設定を表すエンティティ
 * システム全体の動作設定を管理
 */

export class Settings {
  /**
   * 設定コンストラクタ
   * @param {Object} options 初期設定オプション
   */
  constructor(options = {}) {
    // デバイス関連設定
    this.maxDevices = options.maxDevices || 6;
    this.deviceTimeoutMs = options.deviceTimeoutMs || 10000; // デバイス応答タイムアウト（ミリ秒）
    this.defaultDeviceIcon = options.defaultDeviceIcon || null;

    // 表示関連設定
    this.meterType = options.meterType || 'circular'; // 'circular' または 'bar'
    this.showValues = options.showValues !== undefined ? options.showValues : true;
    this.showIcons = options.showIcons !== undefined ? options.showIcons : true;
    this.showNames = options.showNames !== undefined ? options.showNames : true;
    this.theme = options.theme || 'light'; // 'light' または 'dark'

    // 補間関連設定
    this.interpolationEnabled = options.interpolationEnabled !== undefined ? options.interpolationEnabled : true;
    this.interpolationTimeMs = options.interpolationTimeMs || 200;

    // 更新関連設定
    this.pollingIntervalMs = options.pollingIntervalMs || 100;

    // ログ関連設定
    this.loggingEnabled = options.loggingEnabled !== undefined ? options.loggingEnabled : false;
    this.logLevelVerbose = options.logLevelVerbose !== undefined ? options.logLevelVerbose : false;

    // カスタム設定（拡張用）
    this.customSettings = options.customSettings || {};
  }

  /**
   * 設定値を更新
   * @param {string} key 設定キー
   * @param {any} value 設定値
   */
  updateSetting(key, value) {
    if (this.hasOwnProperty(key)) {
      this[key] = value;
      return true;
    } else if (key.includes('.')) {
      // ネストされた設定（customSettings内）
      try {
        const path = key.split('.');
        if (path[0] === 'customSettings') {
          let target = this;
          for (let i = 0; i < path.length - 1; i++) {
            if (target[path[i]] === undefined) {
              target[path[i]] = {};
            }
            target = target[path[i]];
          }
          target[path[path.length - 1]] = value;
          return true;
        }
      } catch (e) {
        return false;
      }
    }
    return false;
  }

  /**
   * 複数の設定値を一括更新
   * @param {Object} settings 設定オブジェクト
   */
  updateSettings(settings = {}) {
    Object.keys(settings).forEach(key => {
      this.updateSetting(key, settings[key]);
    });
  }

  /**
   * 設定値を取得
   * @param {string} key 設定キー
   * @param {any} defaultValue デフォルト値
   * @returns {any} 設定値
   */
  getSetting(key, defaultValue = null) {
    if (this.hasOwnProperty(key)) {
      return this[key];
    } else if (key.includes('.')) {
      // ネストされた設定（customSettings内）
      try {
        const path = key.split('.');
        let target = this;
        for (let i = 0; i < path.length; i++) {
          if (target[path[i]] === undefined) {
            return defaultValue;
          }
          target = target[path[i]];
        }
        return target;
      } catch (e) {
        return defaultValue;
      }
    }
    return defaultValue;
  }

  /**
   * 設定をシリアライズ可能な形式に変換
   * @returns {Object} シリアライズ用オブジェクト
   */
  toJSON() {
    return {
      maxDevices: this.maxDevices,
      deviceTimeoutMs: this.deviceTimeoutMs,
      defaultDeviceIcon: this.defaultDeviceIcon,
      meterType: this.meterType,
      showValues: this.showValues,
      showIcons: this.showIcons,
      showNames: this.showNames,
      theme: this.theme,
      interpolationEnabled: this.interpolationEnabled,
      interpolationTimeMs: this.interpolationTimeMs,
      pollingIntervalMs: this.pollingIntervalMs,
      loggingEnabled: this.loggingEnabled,
      logLevelVerbose: this.logLevelVerbose,
      customSettings: this.customSettings
    };
  }

  /**
   * シリアライズされたオブジェクトから設定インスタンスを作成
   * @param {Object} data シリアライズされた設定データ
   * @returns {Settings} 新しいSettingsインスタンス
   */
  static fromJSON(data) {
    return new Settings(data);
  }
}