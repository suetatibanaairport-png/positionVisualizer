/**
 * DeviceConfigRepository - Infra Layer
 * DeviceConfigの永続化を管理するRepository
 */
(function() {
  'use strict';

  const DeviceConfig = window.DeviceConfig || (typeof module !== 'undefined' && module.exports ? require('../../domain/DeviceConfig') : null);

  function DeviceConfigRepository() {
    this.configs = new Array(6).fill(null).map((_, i) => {
      return new DeviceConfig(i, '', '', '');
    });
  }

  /**
   * インデックスで取得
   */
  DeviceConfigRepository.prototype.getByIndex = function(index) {
    if (index < 0 || index >= 6) return null;
    return this.configs[index];
  };

  /**
   * デバイスIDで取得
   */
  DeviceConfigRepository.prototype.getByDeviceId = function(deviceId) {
    const index = this._deviceIdToIndex(deviceId);
    if (index >= 0 && index < 6) {
      return this.configs[index];
    }
    return null;
  };

  /**
   * すべての設定を取得
   */
  DeviceConfigRepository.prototype.getAll = function() {
    return this.configs.slice();
  };

  /**
   * 設定を保存
   */
  DeviceConfigRepository.prototype.save = function(config) {
    if (!config || !(config instanceof DeviceConfig)) return;
    if (config.id >= 0 && config.id < 6) {
      this.configs[config.id] = config;
    }
  };

  /**
   * デバイスIDをインデックスに変換
   */
  DeviceConfigRepository.prototype._deviceIdToIndex = function(deviceId) {
    if (!deviceId) return -1;
    const match = String(deviceId).match(/(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num >= 1 && num <= 6) {
        return num - 1;
      }
    }
    return -1;
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DeviceConfigRepository;
  } else {
    window.DeviceConfigRepository = DeviceConfigRepository;
  }
})();

