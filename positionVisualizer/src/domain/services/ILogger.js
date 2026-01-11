/**
 * ILogger.js
 * ロガーのインターフェース定義（ドメイン層）
 *
 * クリーンアーキテクチャにおける依存性逆転の原則(DIP)を適用するためのインターフェース。
 * Application層はこのインターフェースに依存し、
 * Infrastructure層がこのインターフェースを実装する。
 */

/**
 * ロガーのインターフェース
 * @interface
 */
export class ILogger {
  /**
   * デバッグログ
   * @param {string} message メッセージ
   * @param {...any} args 追加引数
   */
  debug(message, ...args) {
    throw new Error('Not implemented: ILogger.debug()');
  }

  /**
   * 情報ログ
   * @param {string} message メッセージ
   * @param {...any} args 追加引数
   */
  info(message, ...args) {
    throw new Error('Not implemented: ILogger.info()');
  }

  /**
   * 警告ログ
   * @param {string} message メッセージ
   * @param {...any} args 追加引数
   */
  warn(message, ...args) {
    throw new Error('Not implemented: ILogger.warn()');
  }

  /**
   * エラーログ
   * @param {string} message メッセージ
   * @param {...any} args 追加引数
   */
  error(message, ...args) {
    throw new Error('Not implemented: ILogger.error()');
  }
}
