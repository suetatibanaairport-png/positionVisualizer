/**
 * LoggerAdapter.js
 * ロガーのアダプター
 * インフラストラクチャのAppLoggerをILoggerインターフェースに適合させる
 */

import { AppLogger } from '../services/Logger.js';
import { ILogger } from '../../presentation/services/ILogger.js';

/**
 * AppLoggerのアダプタークラス
 * ILoggerインターフェースを実装し、実際の処理はAppLoggerに委譲する
 */
export class LoggerAdapter extends ILogger {
  /**
   * ロガーアダプターのコンストラクタ
   * @param {string} category ロガーのカテゴリ名
   */
  constructor(category) {
    super();
    this._logger = AppLogger.createLogger(category);
  }

  /**
   * デバッグログ
   * @param {string} message メッセージ
   * @param {Object} data 追加データ
   */
  debug(message, data) {
    return this._logger.debug(message, data);
  }

  /**
   * 情報ログ
   * @param {string} message メッセージ
   * @param {Object} data 追加データ
   */
  info(message, data) {
    return this._logger.info(message, data);
  }

  /**
   * 警告ログ
   * @param {string} message メッセージ
   * @param {Object} data 追加データ
   */
  warn(message, data) {
    return this._logger.warn(message, data);
  }

  /**
   * エラーログ
   * @param {string} message メッセージ
   * @param {Object} data 追加データ
   */
  error(message, data) {
    return this._logger.error(message, data);
  }

  /**
   * ロガーレベルの設定
   * @param {string} level ログレベル
   */
  set level(level) {
    this._logger.level = level;
  }

  /**
   * ロガーレベルの取得
   * @returns {string} ログレベル
   */
  get level() {
    return this._logger.level;
  }
}