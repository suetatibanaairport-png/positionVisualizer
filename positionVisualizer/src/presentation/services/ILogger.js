/**
 * ILogger.js
 * ロガーのインターフェース
 * プレゼンテーション層とインフラストラクチャ層の間の依存性を逆転するためのインターフェース
 */

/**
 * ロガーのインターフェース
 * 具体的な実装を隠蔽し、依存性を逆転させる
 */
export class ILogger {
  /**
   * デバッグログ
   * @param {string} message メッセージ
   * @param {Object} data 追加データ
   */
  debug(message, data) {
    throw new Error('このメソッドは実装クラスで定義する必要があります');
  }

  /**
   * 情報ログ
   * @param {string} message メッセージ
   * @param {Object} data 追加データ
   */
  info(message, data) {
    throw new Error('このメソッドは実装クラスで定義する必要があります');
  }

  /**
   * 警告ログ
   * @param {string} message メッセージ
   * @param {Object} data 追加データ
   */
  warn(message, data) {
    throw new Error('このメソッドは実装クラスで定義する必要があります');
  }

  /**
   * エラーログ
   * @param {string} message メッセージ
   * @param {Object} data 追加データ
   */
  error(message, data) {
    throw new Error('このメソッドは実装クラスで定義する必要があります');
  }

  /**
   * ロガーレベルの設定
   * @param {string} level ログレベル
   */
  set level(level) {
    throw new Error('このメソッドは実装クラスで定義する必要があります');
  }

  /**
   * ロガーレベルの取得
   * @returns {string} ログレベル
   */
  get level() {
    throw new Error('このメソッドは実装クラスで定義する必要があります');
  }
}