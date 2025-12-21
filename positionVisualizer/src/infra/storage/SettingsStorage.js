/**
 * SettingsStorage - Infra Layer
 * 設定（値の範囲、デバイス設定など）の保存・読み込みを管理するストレージ
 */
(function() {
  'use strict';

  function SettingsStorage() {
    this.storageKey = 'positionVisualizer-settings';
  }

  /**
   * 設定を保存
   */
  SettingsStorage.prototype.save = function(settings) {
    try {
      const data = JSON.stringify(settings);
      localStorage.setItem(this.storageKey, data);
      return true;
    } catch (e) {
      console.error('Failed to save settings:', e);
      return false;
    }
  };

  /**
   * 設定を読み込む
   */
  SettingsStorage.prototype.load = function() {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (!data) return null;
      return JSON.parse(data);
    } catch (e) {
      console.error('Failed to load settings:', e);
      return null;
    }
  };

  /**
   * 設定を削除
   */
  SettingsStorage.prototype.clear = function() {
    try {
      localStorage.removeItem(this.storageKey);
      return true;
    } catch (e) {
      console.error('Failed to clear settings:', e);
      return false;
    }
  };

  /**
   * 値の範囲を保存
   */
  SettingsStorage.prototype.saveValueRange = function(valueRange) {
    const settings = this.load() || {};
    settings.valueRange = {
      min: valueRange.min,
      max: valueRange.max,
      unit: valueRange.unit
    };
    return this.save(settings);
  };

  /**
   * 値の範囲を読み込む
   */
  SettingsStorage.prototype.loadValueRange = function() {
    const settings = this.load();
    if (settings && settings.valueRange) {
      return settings.valueRange;
    }
    return null;
  };

  /**
   * デバイス設定を保存
   */
  SettingsStorage.prototype.saveDeviceConfigs = function(configs) {
    const settings = this.load() || {};
    settings.deviceConfigs = configs.map(config => ({
      id: config.id,
      ip: config.ip,
      iconUrl: config.iconUrl,
      name: config.name
    }));
    return this.save(settings);
  };

  /**
   * システム設定を保存
   */
  SettingsStorage.prototype.saveSystemSettings = function(systemSettings) {
    const settings = this.load() || {};
    settings.systemSettings = systemSettings;
    return this.save(settings);
  };

  /**
   * システム設定を読み込む
   */
  SettingsStorage.prototype.loadSystemSettings = function() {
    const settings = this.load();
    if (settings && settings.systemSettings) {
      return settings.systemSettings;
    }
    return {
      maxDevices: 6 // デフォルト値
    };
  };

  /**
   * デバイス設定を読み込む
   */
  SettingsStorage.prototype.loadDeviceConfigs = function() {
    const settings = this.load();
    if (settings && settings.deviceConfigs) {
      return settings.deviceConfigs;
    }
    return null;
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SettingsStorage;
  } else {
    window.SettingsStorage = SettingsStorage;
  }
})();

