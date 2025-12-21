/**
 * SettingsService - UseCase Layer
 * 設定管理を行うUseCase
 * Domain Layerのみに依存し、外部実装には依存しない
 */
(function() {
  'use strict';

  function SettingsService(valueRangeRepository, settingsStorage) {
    this.valueRangeRepository = valueRangeRepository;
    this.settingsStorage = settingsStorage;
    this.subscribers = [];
    this.systemSettings = this.settingsStorage ? this.settingsStorage.loadSystemSettings() : { maxDevices: 6 };
  }

  /**
   * 値の範囲を更新
   */
  SettingsService.prototype.updateRange = function(min, max, unit) {
    const valueRange = this.valueRangeRepository.get();
    const oldRange = valueRange.clone();
    
    valueRange.min = Number(min) || 0;
    valueRange.max = Number(max) || 100;
    valueRange.unit = String(unit || '%').trim() || '%';
    
    // Validation: ensure min < max
    if (valueRange.min >= valueRange.max) {
      valueRange.max = valueRange.min + 1;
    }
    
    // 変更があった場合のみ通知
    if (valueRange.min !== oldRange.min || 
        valueRange.max !== oldRange.max || 
        valueRange.unit !== oldRange.unit) {
      this._notifySubscribers(valueRange);
    }
  };

  /**
   * 値の範囲を取得
   */
  SettingsService.prototype.getRange = function() {
    return this.valueRangeRepository.get().clone();
  };

  /**
   * 変更を購読
   */
  SettingsService.prototype.subscribe = function(callback) {
    if (typeof callback === 'function') {
      this.subscribers.push(callback);
    }
  };

  /**
   * 購読を解除
   */
  SettingsService.prototype.unsubscribe = function(callback) {
    const index = this.subscribers.indexOf(callback);
    if (index >= 0) {
      this.subscribers.splice(index, 1);
    }
  };

  /**
   * 購読者に通知
   */
  SettingsService.prototype._notifySubscribers = function(valueRange) {
    this.subscribers.forEach(callback => {
      try {
        callback(valueRange);
      } catch (e) {
        console.error('Error in subscriber callback:', e);
      }
    });
  };

  /**
   * デバイス最大数を取得
   */
  SettingsService.prototype.getMaxDevices = function() {
    return this.systemSettings.maxDevices;
  };

  /**
   * デバイス最大数を設定
   */
  SettingsService.prototype.setMaxDevices = function(maxDevices) {
    const value = parseInt(maxDevices, 10);
    if (isNaN(value) || value < 1) return false;

    this.systemSettings.maxDevices = value;

    if (this.settingsStorage) {
      this.settingsStorage.saveSystemSettings(this.systemSettings);
    }

    return true;
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SettingsService;
  } else {
    window.SettingsService = SettingsService;
  }
})();

