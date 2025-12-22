/**
 * SettingsRepository.js
 * アプリケーション設定の永続化・取得を行うリポジトリの実装
 * ドメイン層のISettingsRepositoryインターフェースを実装
 */

import { Settings } from '../../domain/entities/Settings.js';
import { ISettingsRepository } from '../../domain/repositories/ISettingsRepository.js';
import { EventBus } from '../services/EventBus.js';
import { AppLogger } from '../services/Logger.js';

/**
 * 設定リポジトリの実装
 */
export class SettingsRepository extends ISettingsRepository {
  /**
   * 設定リポジトリのコンストラクタ
   * @param {Object} storageAdapter ストレージアダプター
   * @param {Object} options オプション設定
   */
  constructor(storageAdapter, options = {}) {
    super();
    this.storageAdapter = storageAdapter;
    this.options = {
      settingsKey: 'app_settings',   // 保存時のキー
      autoSave: true,                // 変更時に自動的に保存するか
      ...options
    };

    // 設定オブジェクト
    this.settings = new Settings();

    // ウォッチャーのリスト
    this.watchers = [];

    // ロガー
    this.logger = AppLogger.createLogger('SettingsRepository');

    // ストレージからロード
    this._loadFromStorage();
  }

  /**
   * ストレージから設定をロード
   * @private
   */
  _loadFromStorage() {
    try {
      const storedSettings = this.storageAdapter.getItem(this.options.settingsKey);

      if (storedSettings) {
        this.settings = Settings.fromJSON(storedSettings);
        this.logger.debug('Settings loaded from storage');
      } else {
        this.logger.debug('No stored settings found, using defaults');
      }
    } catch (error) {
      this.logger.error('Error loading settings from storage:', error);
      // デフォルト設定を使用
      this.settings = new Settings();
    }
  }

  /**
   * ストレージに設定を保存
   * @private
   * @returns {boolean} 成功したかどうか
   */
  _saveToStorage() {
    try {
      this.storageAdapter.setItem(
        this.options.settingsKey,
        this.settings.toJSON()
      );
      this.logger.debug('Settings saved to storage');
      return true;
    } catch (error) {
      this.logger.error('Error saving settings to storage:', error);
      return false;
    }
  }

  /**
   * 設定の変更を通知
   * @param {string} key 変更されたキー
   * @param {any} value 新しい値
   * @param {any} oldValue 古い値
   * @private
   */
  _notifyChange(key, value, oldValue) {
    // ウォッチャーに通知
    for (const watcher of this.watchers) {
      try {
        watcher({ key, value, oldValue });
      } catch (error) {
        this.logger.error('Error in settings watcher:', error);
      }
    }

    // イベントバスで通知
    EventBus.emit('settingsChanged', { key, value, oldValue });
  }

  /**
   * すべての設定を取得
   * @returns {Promise<Object>} 設定オブジェクト
   */
  async getAll() {
    return this.settings.toJSON();
  }

  /**
   * キーで設定値を取得
   * @param {string} key 設定キー
   * @param {any} defaultValue デフォルト値
   * @returns {Promise<any>} 設定値
   */
  async get(key, defaultValue = null) {
    return this.settings.getSetting(key, defaultValue);
  }

  /**
   * 設定値を保存
   * @param {string} key 設定キー
   * @param {any} value 設定値
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async set(key, value) {
    const oldValue = this.settings.getSetting(key);

    // 値が変わらない場合は何もしない
    if (oldValue === value) {
      return true;
    }

    const success = this.settings.updateSetting(key, value);

    if (!success) {
      this.logger.warn(`Failed to update setting: ${key}`);
      return false;
    }

    // 変更を通知
    this._notifyChange(key, value, oldValue);

    // 自動保存が有効なら保存
    if (this.options.autoSave) {
      return this._saveToStorage();
    }

    return true;
  }

  /**
   * 複数の設定値を一括保存
   * @param {Object} settings 設定オブジェクト
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async setAll(settings) {
    if (!settings || typeof settings !== 'object') {
      return false;
    }

    // 変更された設定キーのトラッキング
    const changedSettings = [];

    // 各設定を更新
    for (const [key, value] of Object.entries(settings)) {
      const oldValue = this.settings.getSetting(key);

      // 値が変わらない場合はスキップ
      if (oldValue === value) {
        continue;
      }

      const success = this.settings.updateSetting(key, value);

      if (success) {
        changedSettings.push({ key, value, oldValue });
      } else {
        this.logger.warn(`Failed to update setting: ${key}`);
      }
    }

    // 変更を通知
    for (const change of changedSettings) {
      this._notifyChange(change.key, change.value, change.oldValue);
    }

    // 変更があり、自動保存が有効なら保存
    if (changedSettings.length > 0 && this.options.autoSave) {
      return this._saveToStorage();
    }

    return true;
  }

  /**
   * 設定値を削除
   * @param {string} key 設定キー
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async remove(key) {
    // 設定クラスに削除メソッドがない場合は null を設定
    const oldValue = this.settings.getSetting(key);

    if (oldValue === null) {
      // すでに存在しない
      return true;
    }

    const success = this.settings.updateSetting(key, null);

    if (success) {
      // 変更を通知
      this._notifyChange(key, null, oldValue);

      // 自動保存が有効なら保存
      if (this.options.autoSave) {
        return this._saveToStorage();
      }

      return true;
    }

    return false;
  }

  /**
   * すべての設定をリセット
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async reset() {
    const oldSettings = this.settings.toJSON();

    // 設定を初期化
    this.settings = new Settings();

    // 変更を通知
    this._notifyChange('*', this.settings.toJSON(), oldSettings);

    // 自動保存が有効なら保存
    if (this.options.autoSave) {
      return this._saveToStorage();
    }

    return true;
  }

  /**
   * 設定キーの存在確認
   * @param {string} key 設定キー
   * @returns {Promise<boolean>} 存在するかどうか
   */
  async has(key) {
    return this.settings.getSetting(key) !== null;
  }

  /**
   * すべての設定キーを取得
   * @returns {Promise<Array<string>>} 設定キーの配列
   */
  async keys() {
    const settingsObj = this.settings.toJSON();
    return Object.keys(settingsObj);
  }

  /**
   * 設定をエクスポート
   * @param {string} format エクスポート形式 ('json', 'yaml', etc.)
   * @returns {Promise<string>} エクスポートされたデータ
   */
  async exportSettings(format = 'json') {
    const settingsObj = this.settings.toJSON();

    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(settingsObj, null, 2);
      default:
        this.logger.warn(`Unsupported export format: ${format}, using JSON`);
        return JSON.stringify(settingsObj, null, 2);
    }
  }

  /**
   * 外部データから設定をインポート
   * @param {string} data インポートするデータ
   * @param {string} format インポート形式 ('json', 'yaml', etc.)
   * @param {boolean} overwrite 既存の設定を上書きするかどうか
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async importSettings(data, format = 'json', overwrite = false) {
    try {
      let settingsObj;

      switch (format.toLowerCase()) {
        case 'json':
          settingsObj = JSON.parse(data);
          break;
        default:
          this.logger.warn(`Unsupported import format: ${format}`);
          return false;
      }

      const oldSettings = this.settings.toJSON();

      if (overwrite) {
        // 完全に置き換え
        this.settings = Settings.fromJSON(settingsObj);
      } else {
        // 既存の設定をマージ
        Object.entries(settingsObj).forEach(([key, value]) => {
          this.settings.updateSetting(key, value);
        });
      }

      // 変更を通知
      this._notifyChange('*', this.settings.toJSON(), oldSettings);

      // 自動保存が有効なら保存
      if (this.options.autoSave) {
        return this._saveToStorage();
      }

      return true;
    } catch (error) {
      this.logger.error('Error importing settings:', error);
      return false;
    }
  }

  /**
   * 設定の変更を監視
   * @param {Function} callback コールバック関数
   * @returns {Function} 監視解除用の関数
   */
  watchSettings(callback) {
    if (typeof callback !== 'function') {
      return () => {};
    }

    this.watchers.push(callback);

    // 監視解除関数を返す
    return () => {
      const index = this.watchers.indexOf(callback);
      if (index !== -1) {
        this.watchers.splice(index, 1);
      }
    };
  }

  /**
   * 手動で変更を永続化
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async persist() {
    return this._saveToStorage();
  }
}