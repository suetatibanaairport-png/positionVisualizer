/**
 * DeviceStateRepository - Infra Layer
 * DeviceStateの永続化を管理するRepository
 */
(function() {
  'use strict';

  const DeviceState = window.DeviceState || (typeof module !== 'undefined' && module.exports ? require('../../domain/DeviceState') : null);

  function DeviceStateRepository() {
    this.states = new Map(); // Map<deviceId, DeviceState>
    this.statesByIndex = new Array(6).fill(null); // Array<DeviceState>
  }

  /**
   * デバイスIDで取得
   */
  DeviceStateRepository.prototype.getByDeviceId = function(deviceId) {
    if (!this.states.has(deviceId)) {
      // インデックスを推測
      const index = this._deviceIdToIndex(deviceId);
      const state = new DeviceState(index, null, null, false);
      this.states.set(deviceId, state);
      if (index >= 0 && index < 6) {
        this.statesByIndex[index] = state;
      }
    }
    return this.states.get(deviceId);
  };

  /**
   * インデックスで取得
   */
  DeviceStateRepository.prototype.getByIndex = function(index) {
    if (index < 0 || index >= 6) return null;
    
    if (!this.statesByIndex[index]) {
      const deviceId = `lever${index + 1}`;
      const state = new DeviceState(index, null, null, false);
      this.states.set(deviceId, state);
      this.statesByIndex[index] = state;
    }
    return this.statesByIndex[index];
  };

  /**
   * すべての状態を取得
   */
  DeviceStateRepository.prototype.getAll = function() {
    return Array.from(this.states.values());
  };

  /**
   * 状態を保存
   */
  DeviceStateRepository.prototype.save = function(deviceState) {
    if (!deviceState || !(deviceState instanceof DeviceState)) return;
    
    this.states.set(`lever${deviceState.index + 1}`, deviceState);
    if (deviceState.index >= 0 && deviceState.index < 6) {
      this.statesByIndex[deviceState.index] = deviceState;
    }
  };

  /**
   * デバイスIDをインデックスに変換
   */
  DeviceStateRepository.prototype._deviceIdToIndex = function(deviceId) {
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
    module.exports = DeviceStateRepository;
  } else {
    window.DeviceStateRepository = DeviceStateRepository;
  }
})();

