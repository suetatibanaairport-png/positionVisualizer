/**
 * LocalStorageAdapter.js
 * ブラウザのlocalStorageを抽象化するアダプター
 * ネームスペース管理、JSON変換、エラーハンドリングを提供
 */

export class LocalStorageAdapter {
  /**
   * ローカルストレージアダプタのコンストラクタ
   * @param {string} namespace ストレージのネームスペース
   * @param {Object} options オプション設定
   */
  constructor(namespace = 'app', options = {}) {
    this.namespace = namespace;
    this.options = {
      useSessionStorage: false,       // sessionStorageを使用するか
      encrypt: false,                 // データを暗号化するか（将来の拡張用）
      compressLargeValues: false,     // 大きな値を圧縮するか（将来の拡張用）
      logErrors: true,                // エラーをログ出力するか
      ...options
    };

    // ストレージエンジンの選択
    this.storage = this.options.useSessionStorage ? sessionStorage : localStorage;

    // ストレージが利用可能か確認
    this._checkStorageAvailability();
  }

  /**
   * キー名にネームスペースを付与
   * @private
   * @param {string} key キー名
   * @returns {string} ネームスペース付きのキー名
   */
  _getNamespacedKey(key) {
    return `${this.namespace}.${key}`;
  }

  /**
   * ストレージの可用性をチェック
   * @private
   * @returns {boolean} 利用可能かどうか
   */
  _checkStorageAvailability() {
    try {
      const testKey = `__test_${Date.now()}__`;
      this.storage.setItem(testKey, 'test');
      this.storage.removeItem(testKey);
      return true;
    } catch (error) {
      if (this.options.logErrors) {
        console.error('LocalStorage is not available:', error);
      }
      return false;
    }
  }

  /**
   * 値の取得
   * @param {string} key キー名
   * @param {any} defaultValue デフォルト値
   * @returns {any} 保存された値またはデフォルト値
   */
  getItem(key, defaultValue = null) {
    try {
      const namespacedKey = this._getNamespacedKey(key);
      const value = this.storage.getItem(namespacedKey);

      if (value === null) {
        return defaultValue;
      }

      // JSON形式の場合はパース
      try {
        return JSON.parse(value);
      } catch (parseError) {
        // JSON形式でない場合はそのまま返す
        return value;
      }
    } catch (error) {
      if (this.options.logErrors) {
        console.error(`LocalStorage getItem error for key ${key}:`, error);
      }
      return defaultValue;
    }
  }

  /**
   * 値の保存
   * @param {string} key キー名
   * @param {any} value 保存する値
   * @returns {boolean} 保存に成功したかどうか
   */
  setItem(key, value) {
    try {
      const namespacedKey = this._getNamespacedKey(key);

      // オブジェクトや配列の場合はJSON文字列に変換
      const valueToStore =
        typeof value === 'object' && value !== null ?
          JSON.stringify(value) : String(value);

      this.storage.setItem(namespacedKey, valueToStore);
      return true;
    } catch (error) {
      if (this.options.logErrors) {
        console.error(`LocalStorage setItem error for key ${key}:`, error);
      }
      return false;
    }
  }

  /**
   * 値の削除
   * @param {string} key キー名
   * @returns {boolean} 削除に成功したかどうか
   */
  removeItem(key) {
    try {
      const namespacedKey = this._getNamespacedKey(key);
      this.storage.removeItem(namespacedKey);
      return true;
    } catch (error) {
      if (this.options.logErrors) {
        console.error(`LocalStorage removeItem error for key ${key}:`, error);
      }
      return false;
    }
  }

  /**
   * 特定のネームスペース内のすべての値を削除
   * @returns {boolean} 削除に成功したかどうか
   */
  clear() {
    try {
      const prefix = `${this.namespace}.`;
      const keysToRemove = [];

      // まず削除するキーを集める
      for (let i = 0; i < this.storage.length; i++) {
        const key = this.storage.key(i);
        if (key && key.startsWith(prefix)) {
          keysToRemove.push(key);
        }
      }

      // 次に一括削除（削除中にインデックスが変わるのを防ぐため）
      keysToRemove.forEach(key => {
        this.storage.removeItem(key);
      });

      return true;
    } catch (error) {
      if (this.options.logErrors) {
        console.error(`LocalStorage clear error:`, error);
      }
      return false;
    }
  }

  /**
   * このネームスペースに属するすべてのキーを取得
   * @returns {Array<string>} ネームスペースなしのキーの配列
   */
  getAllKeys() {
    try {
      const prefix = `${this.namespace}.`;
      const keys = [];

      for (let i = 0; i < this.storage.length; i++) {
        const key = this.storage.key(i);
        if (key && key.startsWith(prefix)) {
          // ネームスペースを除去したキー名を追加
          keys.push(key.substring(prefix.length));
        }
      }

      return keys;
    } catch (error) {
      if (this.options.logErrors) {
        console.error(`LocalStorage getAllKeys error:`, error);
      }
      return [];
    }
  }

  /**
   * このネームスペースに属するすべての値をオブジェクトとして取得
   * @returns {Object} キーと値のペアを持つオブジェクト
   */
  getAllItems() {
    try {
      const keys = this.getAllKeys();
      const result = {};

      keys.forEach(key => {
        result[key] = this.getItem(key);
      });

      return result;
    } catch (error) {
      if (this.options.logErrors) {
        console.error(`LocalStorage getAllItems error:`, error);
      }
      return {};
    }
  }

  /**
   * 現在のネームスペース内のアイテム数を取得
   * @returns {number} アイテム数
   */
  size() {
    try {
      return this.getAllKeys().length;
    } catch (error) {
      if (this.options.logErrors) {
        console.error(`LocalStorage size error:`, error);
      }
      return 0;
    }
  }

  /**
   * キーの存在確認
   * @param {string} key キー名
   * @returns {boolean} キーが存在するかどうか
   */
  hasItem(key) {
    try {
      const namespacedKey = this._getNamespacedKey(key);
      return this.storage.getItem(namespacedKey) !== null;
    } catch (error) {
      if (this.options.logErrors) {
        console.error(`LocalStorage hasItem error for key ${key}:`, error);
      }
      return false;
    }
  }

  /**
   * バルクデータの保存
   * @param {Object} items キーと値のペアを持つオブジェクト
   * @returns {boolean} 保存に成功したかどうか
   */
  setItems(items) {
    try {
      Object.entries(items).forEach(([key, value]) => {
        this.setItem(key, value);
      });
      return true;
    } catch (error) {
      if (this.options.logErrors) {
        console.error(`LocalStorage setItems error:`, error);
      }
      return false;
    }
  }

  /**
   * データをJSON文字列としてエクスポート
   * @returns {string} JSON文字列
   */
  exportToJSON() {
    try {
      const data = this.getAllItems();
      return JSON.stringify(data);
    } catch (error) {
      if (this.options.logErrors) {
        console.error(`LocalStorage exportToJSON error:`, error);
      }
      return '{}';
    }
  }

  /**
   * JSON文字列からデータをインポート
   * @param {string} jsonString JSON文字列
   * @param {boolean} clearExisting 既存のデータをクリアするかどうか
   * @returns {boolean} インポートに成功したかどうか
   */
  importFromJSON(jsonString, clearExisting = true) {
    try {
      const data = JSON.parse(jsonString);

      if (clearExisting) {
        this.clear();
      }

      return this.setItems(data);
    } catch (error) {
      if (this.options.logErrors) {
        console.error(`LocalStorage importFromJSON error:`, error);
      }
      return false;
    }
  }
}