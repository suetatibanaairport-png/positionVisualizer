/**
 * DeviceConfig - Domain Model
 * デバイスの設定情報（IP、アイコンURLなど）を表す純粋なデータクラス
 */
(function() {
  'use strict';

  function DeviceConfig(id, ip, iconUrl, name) {
    this.id = id || null;
    this.ip = String(ip || '').trim();
    this.iconUrl = String(iconUrl || '').trim();
    this.name = String(name || '').trim();
  }

  /**
   * デバイスが設定されているかどうか
   */
  DeviceConfig.prototype.isConfigured = function() {
    return this.ip.length > 0 || this.name.length > 0;
  };

  /**
   * クローンを作成
   */
  DeviceConfig.prototype.clone = function() {
    return new DeviceConfig(this.id, this.ip, this.iconUrl, this.name);
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DeviceConfig;
  } else {
    window.DeviceConfig = DeviceConfig;
  }
})();

