/**
 * SessionLog - Domain Model
 * セッションログ（開始時刻、終了時刻、ログエントリのリスト）を表す純粋なデータクラス
 */
(function() {
  'use strict';

  function SessionLog(startedAt, endedAt, entries) {
    this.startedAt = startedAt ? new Date(startedAt) : new Date();
    this.endedAt = endedAt ? new Date(endedAt) : null;
    this.entries = Array.isArray(entries) ? entries.slice() : [];
  }

  /**
   * ログエントリを追加
   */
  SessionLog.prototype.addEntry = function(entry) {
    if (entry && typeof entry.timestamp !== 'undefined') {
      this.entries.push(entry);
    }
  };

  /**
   * セッションが終了しているかどうか
   */
  SessionLog.prototype.isEnded = function() {
    return this.endedAt !== null;
  };

  /**
   * セッションを終了
   */
  SessionLog.prototype.end = function() {
    if (!this.isEnded()) {
      this.endedAt = new Date();
    }
  };

  /**
   * エントリ数を取得
   */
  SessionLog.prototype.getEntryCount = function() {
    return this.entries.length;
  };

  /**
   * クローンを作成
   */
  SessionLog.prototype.clone = function() {
    return new SessionLog(this.startedAt, this.endedAt, this.entries.slice());
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SessionLog;
  } else {
    window.SessionLog = SessionLog;
  }
})();

