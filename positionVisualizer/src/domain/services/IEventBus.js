/**
 * IEventBus.js
 * イベントバスのインターフェース定義（ドメイン層）
 *
 * クリーンアーキテクチャにおける依存性逆転の原則(DIP)を適用するためのインターフェース。
 * Application層はこのインターフェースに依存し、
 * Infrastructure層がこのインターフェースを実装する。
 */

/**
 * イベントバスのインターフェース
 * @interface
 */
export class IEventBus {
  /**
   * イベントの発行
   * @param {string} eventName イベント名
   * @param {Object} data イベントデータ
   */
  emit(eventName, data) {
    throw new Error('Not implemented: IEventBus.emit()');
  }

  /**
   * イベントリスナーを登録
   * @param {string} eventName イベント名
   * @param {Function} callback コールバック関数
   * @param {Object} owner リスナーの所有者（オプション、メモリリーク防止用）
   * @returns {Function} 購読解除用の関数
   */
  on(eventName, callback, owner = null) {
    throw new Error('Not implemented: IEventBus.on()');
  }

  /**
   * イベントリスナーを解除
   * @param {string} eventName イベント名
   * @param {Function} callback コールバック関数
   */
  off(eventName, callback) {
    throw new Error('Not implemented: IEventBus.off()');
  }

  /**
   * 一度だけ実行されるイベントリスナーを登録
   * @param {string} eventName イベント名
   * @param {Function} callback コールバック関数
   * @returns {Function} リスナー削除用の関数
   */
  once(eventName, callback) {
    throw new Error('Not implemented: IEventBus.once()');
  }

  /**
   * 特定の所有者に関連するすべてのリスナーを削除
   * @param {Object} owner リスナーの所有者
   * @returns {number} 削除したリスナーの数
   */
  removeListenersByOwner(owner) {
    throw new Error('Not implemented: IEventBus.removeListenersByOwner()');
  }
}
