/**
 * ValueRange - Domain Model
 * 値の範囲（最小値、最大値、単位）を表す純粋なデータクラス
 */
(function() {
  'use strict';

  function ValueRange(min, max, unit) {
    this.min = Number(min) || 0;
    this.max = Number(max) || 100;
    this.unit = String(unit || '%').trim() || '%';
    
    // Validation: ensure min < max
    if (this.min >= this.max) {
      this.max = this.min + 1;
    }
  }

  /**
   * 実際の値を0-100の正規化値に変換
   */
  ValueRange.prototype.normalize = function(actualValue) {
    const range = this.max - this.min;
    if (range === 0) return 50; // Default to middle if range is invalid
    const normalized = ((actualValue - this.min) / range) * 100;
    return Math.max(0, Math.min(100, normalized));
  };

  /**
   * 正規化値（0-100）を実際の値に変換
   */
  ValueRange.prototype.denormalize = function(normalizedValue) {
    const range = this.max - this.min;
    return this.min + (normalizedValue / 100) * range;
  };

  /**
   * 値が範囲内かどうかをチェック
   */
  ValueRange.prototype.isInRange = function(value) {
    return value >= this.min && value <= this.max;
  };

  /**
   * クローンを作成
   */
  ValueRange.prototype.clone = function() {
    return new ValueRange(this.min, this.max, this.unit);
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ValueRange;
  } else {
    window.ValueRange = ValueRange;
  }
})();

