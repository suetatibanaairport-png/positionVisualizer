/**
 * DeviceState - Domain Model
 * デバイスの状態（正規化値、実際の値、接続状態）を表す純粋なデータクラス
 */
(function() {
  'use strict';

  function DeviceState(index, normalizedValue, actualValue, connected) {
    this.index = Number(index) || 0;
    this.normalizedValue = normalizedValue !== null && normalizedValue !== undefined ? Number(normalizedValue) : null;
    this.actualValue = actualValue !== null && actualValue !== undefined ? Number(actualValue) : null;
    this.connected = Boolean(connected);
  }

  /**
   * デバイスが接続されているかどうか
   */
  DeviceState.prototype.isConnected = function() {
    return this.connected && this.normalizedValue !== null;
  };

  /**
   * 値が更新されたかどうか
   */
  DeviceState.prototype.hasChanged = function(other) {
    if (!other || !(other instanceof DeviceState)) return true;
    return this.normalizedValue !== other.normalizedValue ||
           this.actualValue !== other.actualValue ||
           this.connected !== other.connected;
  };

  /**
   * クローンを作成
   */
  DeviceState.prototype.clone = function() {
    return new DeviceState(this.index, this.normalizedValue, this.actualValue, this.connected);
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DeviceState;
  } else {
    window.DeviceState = DeviceState;
  }
})();

