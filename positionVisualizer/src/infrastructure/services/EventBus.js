/**
 * EventBus.js
 * イベント伝播のためのパブリッシュ/サブスクライブパターンの実装
 * アプリケーション全体のイベント管理を提供
 */

import { EventTypes } from '../../domain/events/EventTypes.js';

/**
 * イベントエミッターのクラス
 */
class EventEmitter {
  /**
   * イベントエミッターのコンストラクタ
   */
  constructor() {
    // イベントリスナーのマップ
    // イベントタイプをキー、リスナーのセットを値とする
    this.listeners = new Map();
    this.maxListeners = 10; // 1イベントあたりの最大リスナー数
    this.debug = false;     // デバッグモード

    // リスナー登録元の追跡（メモリリーク防止のため）
    this.listenerOwners = new WeakMap();

    // イベント履歴（デバッグ用）
    this.eventHistory = [];
    this.maxHistorySize = 100;

    // イベントリスナー登録数のトラッキング
    this.listenerCounts = {};
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
   * イベント履歴の最大サイズを設定
   * @param {number} size 最大サイズ
   */
  setMaxHistorySize(size) {
    if (typeof size === 'number' && size >= 0) {
      this.maxHistorySize = size;
      // サイズ変更時に履歴を調整
      if (this.eventHistory.length > this.maxHistorySize) {
        this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
      }
    }
  }

  /**
   * イベント履歴を取得
   * @param {string} eventFilter 特定のイベントタイプでフィルタリング（オプション）
   * @param {number} limit 取得する履歴の最大数（オプション）
   * @returns {Array} イベント履歴
   */
  getEventHistory(eventFilter = null, limit = null) {
    let history = this.eventHistory;

    if (eventFilter) {
      history = history.filter(entry => entry.event === eventFilter);
    }

    if (limit && limit > 0) {
      history = history.slice(-limit);
    }

    return history;
  }

  /**
   * イベント履歴をクリア
   */
  clearEventHistory() {
    this.eventHistory = [];
  }

  /**
   * イベントリスナーを登録
   * @param {string} event イベント名
   * @param {Function} callback コールバック関数
   * @param {Object} owner リスナーの所有者（オプション）
   * @returns {Function} リスナー削除用の関数
   */
  on(event, callback, owner = null) {
    // 新しいイベント命名規則をサポート（EventTypes対応）
    const eventName = EventTypes[event] || event;

    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }

    const eventListeners = this.listeners.get(eventName);

    // 最大リスナー数のチェック
    if (eventListeners.size >= this.maxListeners) {
      this._debugLog(`Warning: Event '${eventName}' has exceeded max listeners (${this.maxListeners})`);
    }

    eventListeners.add(callback);

    // リスナーカウントの更新
    this.listenerCounts[eventName] = (this.listenerCounts[eventName] || 0) + 1;

    // 所有者が指定されていれば、WeakMapに登録（メモリリーク防止）
    if (owner && typeof owner === 'object') {
      if (!this.listenerOwners.has(owner)) {
        this.listenerOwners.set(owner, []);
      }
      this.listenerOwners.get(owner).push({ event: eventName, callback });
    }

    // リスナー登録をデバッグログに出力
    this._debugLog(`Event listener registered: ${eventName}`, {
      eventName,
      totalListeners: eventListeners.size,
      owner: owner ? 'provided' : 'none'
    });

    // リスナー削除用の関数を返す
    return () => this.off(eventName, callback);
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
    // 新しいイベント命名規則をサポート（EventTypes対応）
    const eventName = EventTypes[event] || event;

    if (!this.listeners.has(eventName)) return;

    if (callback) {
      // 特定のコールバックを削除
      const removed = this.listeners.get(eventName).delete(callback);

      if (removed) {
        // リスナーカウントの更新
        this.listenerCounts[eventName] = (this.listenerCounts[eventName] || 1) - 1;
        this._debugLog(`Event listener removed: ${eventName}`, {
          eventName,
          remainingListeners: this.listenerCounts[eventName]
        });
      }

      // リスナーが0になったらイベント自体を削除
      if (this.listeners.get(eventName).size === 0) {
        this.listeners.delete(eventName);
        delete this.listenerCounts[eventName];
      }
    } else {
      // イベントのすべてのリスナーを削除
      const count = this.listeners.get(eventName).size;
      this.listeners.delete(eventName);
      delete this.listenerCounts[eventName];
      this._debugLog(`All event listeners removed: ${eventName}`, { count });
    }
  }

  /**
   * 特定の所有者に関連するすべてのリスナーを削除
   * @param {Object} owner リスナーの所有者
   * @returns {number} 削除したリスナーの数
   */
  removeListenersByOwner(owner) {
    if (!owner || !this.listenerOwners.has(owner)) {
      return 0;
    }

    const listeners = this.listenerOwners.get(owner);
    let removedCount = 0;

    for (const { event, callback } of listeners) {
      if (this.listeners.has(event)) {
        const removed = this.listeners.get(event).delete(callback);
        if (removed) {
          removedCount++;
          this.listenerCounts[event] = (this.listenerCounts[event] || 1) - 1;

          // リスナーが0になったらイベント自体を削除
          if (this.listeners.get(event).size === 0) {
            this.listeners.delete(event);
            delete this.listenerCounts[event];
          }
        }
      }
    }

    // 所有者からリスナーを削除
    this.listenerOwners.delete(owner);

    if (removedCount > 0) {
      this._debugLog(`Removed ${removedCount} listeners by owner`, { owner });
    }

    return removedCount;
  }

  /**
   * イベントを発行
   * @param {string} event イベント名
   * @param {any} data イベントデータ
   */
  emit(event, data) {
    // 新しいイベント命名規則をサポート（EventTypes対応）
    const eventName = EventTypes[event] || event;

    // イベント発行時刻
    const timestamp = Date.now();

    // イベント履歴に追加（デバッグモードまたは履歴サイズが0より大きい場合）
    if (this.debug || this.maxHistorySize > 0) {
      const historyEntry = {
        event: eventName,
        data,
        timestamp,
        listeners: this.listeners.has(eventName)
          ? this.listeners.get(eventName).size
          : 0
      };

      this.eventHistory.push(historyEntry);

      // 履歴サイズの制限
      if (this.eventHistory.length > this.maxHistorySize) {
        this.eventHistory.shift();
      }
    }

    this._debugLog(`Event emitted: ${eventName}`, {
      event: eventName,
      data,
      timestamp,
      listeners: this.listeners.has(eventName)
        ? this.listeners.get(eventName).size
        : 0
    });

    // 特定のイベントリスナーを実行
    if (this.listeners.has(eventName)) {
      this._executeListeners(eventName, data);
    }

    // ワイルドカードリスナーを実行
    if (eventName !== '*' && this.listeners.has('*')) {
      this._executeListeners('*', { event: eventName, data });
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
   * イベントリスナーの状態を取得
   * @returns {Object} イベントリスナーの状態情報
   */
  getStatus() {
    const eventNames = this.eventNames();
    const status = {
      totalEvents: eventNames.length,
      totalListeners: 0,
      events: {}
    };

    for (const event of eventNames) {
      const count = this.listenerCount(event);
      status.totalListeners += count;
      status.events[event] = count;
    }

    return status;
  }

  /**
   * イベントバスの詳細レポートを取得
   * @returns {Object} イベントバスの詳細情報
   */
  getDetailedReport() {
    const report = {
      status: this.getStatus(),
      history: {
        enabled: this.maxHistorySize > 0,
        size: this.eventHistory.length,
        maxSize: this.maxHistorySize,
        recentEvents: this.getEventHistory(null, 10)
      },
      debug: this.debug,
      maxListeners: this.maxListeners
    };

    return report;
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