/**
 * LogEntry - Domain Model
 * ログエントリ（タイムスタンプ、正規化値、id）を表す純粋なデータクラス
 */
(function () {
  'use strict';

  function LogEntry(timestamp, id, value) {
    this.timestamp = timestamp ? new Date(timestamp) : new Date();
    this.id = id;
    this.value = value;
  }

  /**
   * クローンを作成
   */
  LogEntry.prototype.clone = function () {
    return new LogEntry(this.timestamp, this.id, this.value);
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = LogEntry;
  } else {
    window.LogEntry = LogEntry;
  }
})();

