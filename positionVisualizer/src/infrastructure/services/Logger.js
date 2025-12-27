/**
 * Logger.js
 * アプリケーション全体でのログ出力を管理するサービス
 * ログレベル、フォーマット、永続化などを提供
 */

/**
 * ログレベルの定義
 */
export const LogLevel = {
  TRACE: 0,
  DEBUG: 1,
  INFO: 2,
  WARN: 3,
  ERROR: 4,
  FATAL: 5,
  NONE: 6
};

/**
 * ロガーのクラス
 */
export class Logger {
  /**
   * ロガーのコンストラクタ
   * @param {string} name ロガー名
   * @param {Object} options オプション設定
   */
  constructor(name = 'app', options = {}) {
    this.name = name;
    this.options = {
      level: LogLevel.INFO,          // デフォルトのログレベル
      useColors: true,               // 色付きログを使用するか
      includeTimestamp: true,        // タイムスタンプを含めるか
      persistLogs: false,            // ログを永続化するか
      maxLogSize: 1000,              // 最大ログサイズ（永続化時）
      consoleOutput: true,           // コンソール出力を行うか
      ...options
    };

    // ログ履歴（永続化有効時に使用）
    this.logs = [];

    // レベル名のマッピング
    this.levelNames = {
      [LogLevel.TRACE]: 'TRACE',
      [LogLevel.DEBUG]: 'DEBUG',
      [LogLevel.INFO]: 'INFO',
      [LogLevel.WARN]: 'WARN',
      [LogLevel.ERROR]: 'ERROR',
      [LogLevel.FATAL]: 'FATAL',
    };

    // コンソール出力の色（ブラウザコンソール用）
    this.colors = {
      [LogLevel.TRACE]: 'color: #6c757d', // グレー
      [LogLevel.DEBUG]: 'color: #17a2b8', // 青緑
      [LogLevel.INFO]: 'color: #28a745',  // 緑
      [LogLevel.WARN]: 'color: #ffc107',  // 黄
      [LogLevel.ERROR]: 'color: #dc3545', // 赤
      [LogLevel.FATAL]: 'color: #dc3545; font-weight: bold', // 太字赤
    };
  }

  /**
   * ログレベルの設定
   * @param {number} level ログレベル
   */
  setLevel(level) {
    if (typeof level === 'number' && level >= LogLevel.TRACE && level <= LogLevel.NONE) {
      this.options.level = level;
    }
  }

  /**
   * TRACEレベルのログ出力
   * @param {...any} args ログ引数
   */
  trace(...args) {
    this._log(LogLevel.TRACE, ...args);
  }

  /**
   * DEBUGレベルのログ出力
   * @param {...any} args ログ引数
   */
  debug(...args) {
    this._log(LogLevel.DEBUG, ...args);
  }

  /**
   * INFOレベルのログ出力
   * @param {...any} args ログ引数
   */
  info(...args) {
    this._log(LogLevel.INFO, ...args);
  }

  /**
   * WARNレベルのログ出力
   * @param {...any} args ログ引数
   */
  warn(...args) {
    this._log(LogLevel.WARN, ...args);
  }

  /**
   * ERRORレベルのログ出力
   * @param {...any} args ログ引数
   */
  error(...args) {
    this._log(LogLevel.ERROR, ...args);
  }

  /**
   * FATALレベルのログ出力
   * @param {...any} args ログ引数
   */
  fatal(...args) {
    this._log(LogLevel.FATAL, ...args);
  }

  /**
   * 内部ログ出力処理
   * @param {number} level ログレベル
   * @param {...any} args ログ引数
   * @private
   */
  _log(level, ...args) {
    // 現在のログレベルより低いレベルは出力しない
    if (level < this.options.level) {
      return;
    }

    // ログメッセージの作成
    const logInfo = this._createLogInfo(level, args);

    // ログの永続化（必要な場合）
    if (this.options.persistLogs) {
      this._persistLog(logInfo);
    }

    // コンソール出力（必要な場合）
    if (this.options.consoleOutput) {
      this._consoleOutput(level, logInfo);
    }
  }

  /**
   * ログ情報オブジェクトの作成
   * @param {number} level ログレベル
   * @param {Array<any>} args ログ引数
   * @returns {Object} ログ情報オブジェクト
   * @private
   */
  _createLogInfo(level, args) {
    const timestamp = new Date();

    return {
      timestamp,
      level,
      levelName: this.levelNames[level] || 'UNKNOWN',
      name: this.name,
      message: args.map(arg => {
        if (arg instanceof Error) {
          return `${arg.message}\n${arg.stack}`;
        } else if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg);
          } catch (e) {
            return String(arg);
          }
        } else {
          return String(arg);
        }
      }).join(' '),
      args,
    };
  }

  /**
   * コンソールへのログ出力
   * @param {number} level ログレベル
   * @param {Object} logInfo ログ情報オブジェクト
   * @private
   */
  _consoleOutput(level, logInfo) {
    // ログのプレフィックス作成
    let prefix = '';

    if (this.options.includeTimestamp) {
      prefix += `[${logInfo.timestamp.toISOString()}] `;
    }

    prefix += `[${logInfo.name}] [${logInfo.levelName}]`;

    // コンソール出力関数の選択
    let consoleMethod;

    switch (level) {
      case LogLevel.TRACE:
      case LogLevel.DEBUG:
        consoleMethod = console.debug;
        break;
      case LogLevel.INFO:
        consoleMethod = console.info;
        break;
      case LogLevel.WARN:
        consoleMethod = console.warn;
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        consoleMethod = console.error;
        break;
      default:
        consoleMethod = console.log;
    }

    // 色付きログ出力（対応ブラウザのみ）
    if (this.options.useColors && typeof window !== 'undefined') {
      const color = this.colors[level] || '';

      // 引数が存在し、かつ空でない場合のみ引数を追加
      if (logInfo.args && logInfo.args.length > 0 && logInfo.args[0] !== undefined) {
        consoleMethod(`%c${prefix}`, color, ...logInfo.args);
      } else {
        // 引数がない場合は prefix のみ出力（undefined が追加されるのを防止）
        consoleMethod(`%c${prefix}`, color);
      }
    } else {
      // 色なしログ出力も同様に修正
      if (logInfo.args && logInfo.args.length > 0 && logInfo.args[0] !== undefined) {
        consoleMethod(prefix, ...logInfo.args);
      } else {
        consoleMethod(prefix);
      }
    }
  }

  /**
   * ログの永続化
   * @param {Object} logInfo ログ情報オブジェクト
   * @private
   */
  _persistLog(logInfo) {
    this.logs.push(logInfo);

    // 最大サイズを超えた場合、古いログを削除
    if (this.logs.length > this.options.maxLogSize) {
      this.logs = this.logs.slice(-this.options.maxLogSize);
    }
  }

  /**
   * ログ履歴の取得
   * @param {number} limit 取得する最大数（0=すべて）
   * @param {number} level 最小ログレベル（デフォルト=INFO）
   * @returns {Array} ログ履歴
   */
  getLogs(limit = 0, level = LogLevel.INFO) {
    const filteredLogs = this.logs.filter(log => log.level >= level);

    if (limit <= 0 || limit >= filteredLogs.length) {
      return filteredLogs;
    } else {
      return filteredLogs.slice(-limit);
    }
  }

  /**
   * ログ履歴のクリア
   */
  clearLogs() {
    this.logs = [];
  }

  /**
   * ログのエクスポート
   * @param {string} format フォーマット（'json'または'text'）
   * @returns {string} エクスポートされたログ
   */
  exportLogs(format = 'json') {
    if (format === 'json') {
      return JSON.stringify(this.logs, null, 2);
    } else {
      return this.logs.map(log => {
        const timestamp = log.timestamp.toISOString();
        return `[${timestamp}] [${log.name}] [${log.levelName}] ${log.message}`;
      }).join('\n');
    }
  }

  /**
   * 新しいロガーインスタンスの作成（サブロガー）
   * @param {string} name サブロガー名
   * @returns {Logger} 新しいロガーインスタンス
   */
  createLogger(name) {
    const childName = `${this.name}.${name}`;
    return new Logger(childName, this.options);
  }
}

/**
 * アプリケーション全体で共有するシングルトンのロガー
 */
export const AppLogger = new Logger();