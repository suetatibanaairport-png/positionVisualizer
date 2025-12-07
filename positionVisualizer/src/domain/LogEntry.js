/**
 * LogEntry - Domain Model
 * ログエントリ（タイムスタンプ、正規化値のJSON）を表す純粋なデータクラス
 */
(function() {
  'use strict';

  function LogEntry(timestamp, normalizedValuesJson) {
    this.timestamp = timestamp ? new Date(timestamp) : new Date();
    this.normalizedValuesJson = normalizedValuesJson || '[]';
  }

  /**
   * 正規化値を配列として取得
   */
  LogEntry.prototype.getNormalizedValues = function() {
    try {
      return JSON.parse(this.normalizedValuesJson);
    } catch (e) {
      return [];
    }
  };

  /**
   * 正規化値を設定
   */
  LogEntry.prototype.setNormalizedValues = function(values) {
    if (Array.isArray(values)) {
      this.normalizedValuesJson = JSON.stringify(values);
    }
  };

  /**
   * クローンを作成
   */
  LogEntry.prototype.clone = function() {
    return new LogEntry(this.timestamp, this.normalizedValuesJson);
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = LogEntry;
  } else {
    window.LogEntry = LogEntry;
  }
})();

