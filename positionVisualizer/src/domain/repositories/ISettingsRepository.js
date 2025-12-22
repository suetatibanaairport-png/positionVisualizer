/**
 * ISettingsRepository.js
 * アプリケーション設定を永続化・取得するためのリポジトリインターフェース
 * 具体的な実装はインフラストラクチャ層で行う
 */

/**
 * 設定リポジトリのインターフェース
 * アプリケーション設定の永続化と取得操作を定義
 */
export class ISettingsRepository {
  /**
   * すべての設定を取得
   * @returns {Promise<Object>} 設定オブジェクト
   */
  async getAll() {
    throw new Error("Not implemented");
  }

  /**
   * キーで設定値を取得
   * @param {string} key 設定キー
   * @param {any} defaultValue デフォルト値
   * @returns {Promise<any>} 設定値
   */
  async get(key, defaultValue = null) {
    throw new Error("Not implemented");
  }

  /**
   * 設定値を保存
   * @param {string} key 設定キー
   * @param {any} value 設定値
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async set(key, value) {
    throw new Error("Not implemented");
  }

  /**
   * 複数の設定値を一括保存
   * @param {Object} settings 設定オブジェクト
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async setAll(settings) {
    throw new Error("Not implemented");
  }

  /**
   * 設定値を削除
   * @param {string} key 設定キー
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async remove(key) {
    throw new Error("Not implemented");
  }

  /**
   * すべての設定をリセット
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async reset() {
    throw new Error("Not implemented");
  }

  /**
   * 設定キーの存在確認
   * @param {string} key 設定キー
   * @returns {Promise<boolean>} 存在するかどうか
   */
  async has(key) {
    throw new Error("Not implemented");
  }

  /**
   * すべての設定キーを取得
   * @returns {Promise<Array>} 設定キーの配列
   */
  async keys() {
    throw new Error("Not implemented");
  }

  /**
   * 設定を別のストレージにエクスポート
   * @param {string} format エクスポート形式 ('json', 'yaml', etc.)
   * @returns {Promise<string>} エクスポートされたデータ
   */
  async exportSettings(format = 'json') {
    throw new Error("Not implemented");
  }

  /**
   * 外部データから設定をインポート
   * @param {string} data インポートするデータ
   * @param {string} format インポート形式 ('json', 'yaml', etc.)
   * @param {boolean} overwrite 既存の設定を上書きするかどうか
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async importSettings(data, format = 'json', overwrite = false) {
    throw new Error("Not implemented");
  }

  /**
   * 設定の変更を監視
   * @param {Function} callback コールバック関数
   * @returns {Function} 監視解除用の関数
   */
  watchSettings(callback) {
    throw new Error("Not implemented");
  }
}