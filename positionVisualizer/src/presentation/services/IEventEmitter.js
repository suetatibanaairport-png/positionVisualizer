/**
 * IEventEmitter.js
 * イベントエミッターのインターフェース
 * プレゼンテーション層とインフラストラクチャ層の間の依存性を逆転するためのインターフェース
 */

import { EventTypes } from '../../domain/events/EventTypes.js';

/**
 * イベントエミッターのインターフェース
 * EventBusに依存せず、プレゼンテーション層で使用するためのインターフェース
 */
export class IEventEmitter {
  /**
   * イベントの発行
   * @param {string} eventName イベント名
   * @param {Object} data イベントデータ
   */
  emit(eventName, data) {
    throw new Error('このメソッドは実装クラスで定義する必要があります');
  }

  /**
   * イベントの購読
   * @param {string} eventName イベント名
   * @param {Function} callback コールバック関数
   * @param {Object} owner リスナーの所有者（オプション）
   * @returns {Function} 購読解除用の関数
   */
  on(eventName, callback, owner = null) {
    throw new Error('このメソッドは実装クラスで定義する必要があります');
  }

  /**
   * イベントの購読解除
   * @param {string} eventName イベント名
   * @param {Function} callback コールバック関数
   */
  off(eventName, callback) {
    throw new Error('このメソッドは実装クラスで定義する必要があります');
  }

  /**
   * 一度だけ実行されるイベントリスナーを登録
   * @param {string} eventName イベント名
   * @param {Function} callback コールバック関数
   * @returns {Function} リスナー削除用の関数
   */
  once(eventName, callback) {
    throw new Error('このメソッドは実装クラスで定義する必要があります');
  }

  /**
   * 特定の所有者に関連するすべてのリスナーを削除
   * @param {Object} owner リスナーの所有者
   * @returns {number} 削除したリスナーの数
   */
  removeListenersByOwner(owner) {
    throw new Error('このメソッドは実装クラスで定義する必要があります');
  }

  /**
   * イベント名の正規化（新しい命名規則への変換）
   * @param {string} eventName イベント名
   * @returns {string} 正規化されたイベント名
   */
  static normalizeEventName(eventName) {
    return EventTypes[eventName] || eventName;
  }
}