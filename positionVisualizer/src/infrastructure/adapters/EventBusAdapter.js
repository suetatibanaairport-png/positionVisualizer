/**
 * EventBusAdapter.js
 * イベントバスのアダプター
 * インフラストラクチャのEventBusをIEventBusインターフェースに適合させる
 */

import { EventBus } from '../services/EventBus.js';
import { IEventBus } from '../../domain/services/IEventBus.js';
import { EventTypes } from '../../domain/events/EventTypes.js';

/**
 * EventBusのアダプタークラス
 * IEventBusインターフェースを実装し、実際の処理はEventBusに委譲する
 */
export class EventBusAdapter extends IEventBus {
  /**
   * コンストラクタ
   * @param {Object} options オプション設定
   */
  constructor(options = {}) {
    super();

    this.options = {
      debug: false,
      ...options
    };

    if (this.options.debug) {
      EventBus.setDebug(true);
    }
  }

  /**
   * イベントの発行
   * @param {string} eventName イベント名
   * @param {Object} data イベントデータ
   */
  emit(eventName, data) {
    return EventBus.emit(eventName, data);
  }

  /**
   * イベントの購読
   * @param {string} eventName イベント名
   * @param {Function} callback コールバック関数
   * @param {Object} owner リスナーの所有者（オプション）
   * @returns {Function} 購読解除用の関数
   */
  on(eventName, callback, owner = null) {
    return EventBus.on(eventName, callback, owner);
  }

  /**
   * イベントの購読解除
   * @param {string} eventName イベント名
   * @param {Function} callback コールバック関数
   */
  off(eventName, callback) {
    return EventBus.off(eventName, callback);
  }

  /**
   * 一度だけ実行されるイベントリスナーを登録
   * @param {string} eventName イベント名
   * @param {Function} callback コールバック関数
   * @returns {Function} リスナー削除用の関数
   */
  once(eventName, callback) {
    return EventBus.once(eventName, callback);
  }

  /**
   * 特定の所有者に関連するすべてのリスナーを削除
   * @param {Object} owner リスナーの所有者
   * @returns {number} 削除したリスナーの数
   */
  removeListenersByOwner(owner) {
    return EventBus.removeListenersByOwner(owner);
  }

  /**
   * イベント履歴を取得
   * @param {string} eventFilter 特定のイベントタイプでフィルタリング（オプション）
   * @param {number} limit 取得する履歴の最大数（オプション）
   * @returns {Array} イベント履歴
   */
  getEventHistory(eventFilter = null, limit = null) {
    return EventBus.getEventHistory(eventFilter, limit);
  }

  /**
   * イベントバスの状態を取得
   * @returns {Object} イベントバスの状態
   */
  getStatus() {
    return EventBus.getStatus();
  }

  /**
   * デバッグモードの設定
   * @param {boolean} enabled デバッグモードの有効/無効
   */
  setDebug(enabled) {
    EventBus.setDebug(enabled);
  }
}