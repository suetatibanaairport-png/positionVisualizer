/**
 * LiveMonitorService - UseCase Layer
 * 値の購読を管理するUseCase
 * Domain Layerのみに依存し、外部実装には依存しない
 */
(function() {
  'use strict';

  function LiveMonitorService(deviceStateRepository, valueRangeRepository) {
    this.deviceStateRepository = deviceStateRepository;
    this.valueRangeRepository = valueRangeRepository;
    this.subscribers = [];
    this.isMonitoring = false;
  }

  /**
   * 値の変更を購読
   */
  LiveMonitorService.prototype.subscribe = function(callback) {
    if (typeof callback === 'function') {
      this.subscribers.push(callback);
    }
  };

  /**
   * 購読を解除
   */
  LiveMonitorService.prototype.unsubscribe = function(callback) {
    const index = this.subscribers.indexOf(callback);
    if (index >= 0) {
      this.subscribers.splice(index, 1);
    }
  };

  /**
   * デバイス値の更新を処理
   */
  LiveMonitorService.prototype.updateDeviceValue = function(deviceId, actualValue) {
    // Domain LayerのValueRangeを使用して正規化
    const valueRange = this.valueRangeRepository.get();
    const normalizedValue = valueRange.normalize(actualValue);
    
    // Domain LayerのDeviceStateを更新
    const deviceState = this.deviceStateRepository.getByDeviceId(deviceId);
    if (deviceState) {
      const oldState = deviceState.clone();
      deviceState.normalizedValue = normalizedValue;
      deviceState.actualValue = actualValue;
      deviceState.connected = true;
      
      // 変更があった場合のみ通知
      if (deviceState.hasChanged(oldState)) {
        this._notifySubscribers(deviceState);
      }
    }
  };

  /**
   * デバイスの接続状態を更新
   */
  LiveMonitorService.prototype.updateConnectionState = function(deviceId, connected) {
    const deviceState = this.deviceStateRepository.getByDeviceId(deviceId);
    if (deviceState) {
      deviceState.connected = connected;
      if (!connected) {
        deviceState.normalizedValue = null;
        deviceState.actualValue = null;
      }
      this._notifySubscribers(deviceState);
    }
  };

  /**
   * 購読者に通知
   */
  LiveMonitorService.prototype._notifySubscribers = function(deviceState) {
    this.subscribers.forEach(callback => {
      try {
        callback(deviceState);
      } catch (e) {
        console.error('Error in subscriber callback:', e);
      }
    });
  };

  /**
   * 監視を開始
   */
  LiveMonitorService.prototype.start = function() {
    this.isMonitoring = true;
  };

  /**
   * 監視を停止
   */
  LiveMonitorService.prototype.stop = function() {
    this.isMonitoring = false;
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = LiveMonitorService;
  } else {
    window.LiveMonitorService = LiveMonitorService;
  }
})();

