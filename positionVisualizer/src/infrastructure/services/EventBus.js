/**
 * EventBus.js
 * イベント伝播のためのパブリッシュ/サブスクライブパターンの実装
 * アプリケーション全体のイベント管理を提供
 */

/**
 * イベントエミッターのクラス
 */
export class EventEmitter {
  /**
   * イベントエミッターのコンストラクタ
   */
  constructor() {
    // イベントリスナーのマップ
    // イベントタイプをキー、リスナーのセットを値とする
    this.listeners = new Map();
    this.maxListeners = 10; // 1イベントあたりの最大リスナー数
    this.debug = false;     // デバッグモード
  }

  /**
   * デバッグモードの設定
   * @param {boolean} enabled デバッグモードの有効/無効
   */
  setDebug(enabled) {
    this.debug = Boolean(enabled);
  }

  /**
   * イベント最大リスナー数の設定
   * @param {number} max 最大リスナー数
   */
  setMaxListeners(max) {
    if (typeof max === 'number' && max > 0) {
      this.maxListeners = max;
    }
  }

  /**
   * イベントリスナーを登録
   * @param {string} event イベント名
   * @param {Function} callback コールバック関数
   * @returns {Function} リスナー削除用の関数
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    const eventListeners = this.listeners.get(event);

    // 最大リスナー数のチェック
    if (eventListeners.size >= this.maxListeners) {
      this._debugLog(`Warning: Event '${event}' has exceeded max listeners (${this.maxListeners})`);
    }

    eventListeners.add(callback);

    // リスナー削除用の関数を返す
    return () => this.off(event, callback);
  }

  /**
   * 一度だけ実行されるイベントリスナーを登録
   * @param {string} event イベント名
   * @param {Function} callback コールバック関数
   * @returns {Function} リスナー削除用の関数
   */
  once(event, callback) {
    // ラッパー関数を作成
    const onceWrapper = (...args) => {
      // リスナーを削除してからコールバックを実行
      this.off(event, onceWrapper);
      callback(...args);
    };

    return this.on(event, onceWrapper);
  }

  /**
   * イベントリスナーを削除
   * @param {string} event イベント名
   * @param {Function} callback コールバック関数
   */
  off(event, callback) {
    if (!this.listeners.has(event)) return;

    if (callback) {
      // 特定のコールバックを削除
      this.listeners.get(event).delete(callback);

      // リスナーが0になったらイベント自体を削除
      if (this.listeners.get(event).size === 0) {
        this.listeners.delete(event);
      }
    } else {
      // イベントのすべてのリスナーを削除
      this.listeners.delete(event);
    }
  }

  /**
   * イベントを発行
   * @param {string} event イベント名
   * @param {any} data イベントデータ
   */
  emit(event, data) {
    this._debugLog(`Event emitted: ${event}`, data);

    // 特定のイベントリスナーを実行
    if (this.listeners.has(event)) {
      this._executeListeners(event, data);
    }

    // ワイルドカードリスナーを実行
    if (event !== '*' && this.listeners.has('*')) {
      this._executeListeners('*', { event, data });
    }
  }

  /**
   * 特定のイベントのリスナーを実行
   * @param {string} event イベント名
   * @param {any} data イベントデータ
   * @private
   */
  _executeListeners(event, data) {
    // リスナー実行中に削除される可能性があるため、実行前にコピーを作成
    const listeners = Array.from(this.listeners.get(event));

    for (const listener of listeners) {
      try {
        listener(data);
      } catch (error) {
        this._debugLog(`Error in event listener for ${event}:`, error);
        console.error(`イベントリスナー実行エラー (${event}):`, error);
      }
    }
  }

  /**
   * すべてのイベントリスナーを削除
   */
  clear() {
    this.listeners.clear();
  }

  /**
   * イベントの登録リスナー数を取得
   * @param {string} event イベント名
   * @returns {number} リスナー数
   */
  listenerCount(event) {
    return this.listeners.has(event) ? this.listeners.get(event).size : 0;
  }

  /**
   * すべてのイベント名を取得
   * @returns {Array<string>} イベント名の配列
   */
  eventNames() {
    return Array.from(this.listeners.keys());
  }

  /**
   * デバッグログの出力
   * @param {...any} args ログ引数
   * @private
   */
  _debugLog(...args) {
    if (this.debug) {
      console.log('[EventEmitter]', ...args);
    }
  }
}

/**
 * アプリケーション全体で共有するシングルトンのEventBus
 */
export const EventBus = new EventEmitter();