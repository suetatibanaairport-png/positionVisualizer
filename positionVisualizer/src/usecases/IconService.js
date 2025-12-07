/**
 * IconService - UseCase Layer
 * アイコン設定を管理するUseCase
 * Domain Layerのみに依存し、外部実装には依存しない
 */
(function() {
  'use strict';

  function IconService(deviceConfigRepository) {
    this.deviceConfigRepository = deviceConfigRepository;
    this.subscribers = [];
  }

  /**
   * デバイスのアイコンを設定
   */
  IconService.prototype.setIcon = function(deviceIndex, iconUrl) {
    const deviceConfig = this.deviceConfigRepository.getByIndex(deviceIndex);
    if (deviceConfig) {
      const oldConfig = deviceConfig.clone();
      deviceConfig.iconUrl = String(iconUrl || '').trim();
      
      // 変更があった場合のみ通知
      if (deviceConfig.iconUrl !== oldConfig.iconUrl) {
        this._notifySubscribers(deviceIndex, deviceConfig);
      }
    }
  };

  /**
   * デバイスのアイコンを取得
   */
  IconService.prototype.getIcon = function(deviceIndex) {
    const deviceConfig = this.deviceConfigRepository.getByIndex(deviceIndex);
    return deviceConfig ? deviceConfig.iconUrl : '';
  };

  /**
   * 変更を購読
   */
  IconService.prototype.subscribe = function(callback) {
    if (typeof callback === 'function') {
      this.subscribers.push(callback);
    }
  };

  /**
   * 購読を解除
   */
  IconService.prototype.unsubscribe = function(callback) {
    const index = this.subscribers.indexOf(callback);
    if (index >= 0) {
      this.subscribers.splice(index, 1);
    }
  };

  /**
   * 購読者に通知
   */
  IconService.prototype._notifySubscribers = function(deviceIndex, deviceConfig) {
    this.subscribers.forEach(callback => {
      try {
        callback(deviceIndex, deviceConfig);
      } catch (e) {
        console.error('Error in subscriber callback:', e);
      }
    });
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = IconService;
  } else {
    window.IconService = IconService;
  }
})();

