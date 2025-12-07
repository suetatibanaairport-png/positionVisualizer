/**
 * ValueRangeRepository - Infra Layer
 * ValueRangeの永続化を管理するRepository
 */
(function() {
  'use strict';

  const ValueRange = window.ValueRange || (typeof module !== 'undefined' && module.exports ? require('../../domain/ValueRange') : null);

  function ValueRangeRepository(defaultMin, defaultMax, defaultUnit) {
    this.valueRange = new ValueRange(defaultMin || 0, defaultMax || 100, defaultUnit || '%');
  }

  /**
   * ValueRangeを取得
   */
  ValueRangeRepository.prototype.get = function() {
    return this.valueRange;
  };

  /**
   * ValueRangeを保存
   */
  ValueRangeRepository.prototype.save = function(valueRange) {
    if (valueRange && valueRange instanceof ValueRange) {
      this.valueRange = valueRange;
    }
  };

  /**
   * ValueRangeを更新
   */
  ValueRangeRepository.prototype.update = function(min, max, unit) {
    this.valueRange = new ValueRange(min, max, unit);
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ValueRangeRepository;
  } else {
    window.ValueRangeRepository = ValueRangeRepository;
  }
})();

