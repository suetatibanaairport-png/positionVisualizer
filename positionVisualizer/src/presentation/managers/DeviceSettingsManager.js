/**
 * DeviceSettingsManager.js
 * デバイス設定（名前・アイコン・表示）の管理を担当
 */

import { EventTypes } from '../../domain/events/EventTypes.js';

/**
 * デバイス設定管理クラス
 */
export class DeviceSettingsManager {
  /**
   * DeviceSettingsManagerのコンストラクタ
   * @param {Object} deviceService デバイスサービス
   * @param {Object} meterViewModel メータービューモデル
   * @param {Object} eventEmitter イベントエミッター
   * @param {Object} logger ロガー
   */
  constructor(deviceService, meterViewModel, eventEmitter, logger) {
    this.deviceService = deviceService;
    this.meterViewModel = meterViewModel;
    this.eventEmitter = eventEmitter;
    this.logger = logger || { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

    // 外部コールバック
    this.onDeviceListUpdate = null;

    // LeverAPI URL
    this.leverApiUrl = 'http://127.0.0.1:5001';
  }

  /**
   * LeverAPI URLを設定
   * @param {string} url URL
   */
  setLeverApiUrl(url) {
    this.leverApiUrl = url;
  }

  /**
   * 名前の設定
   * @param {string} deviceId デバイスID
   * @param {string} name デバイス名
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async setDeviceName(deviceId, name) {
    if (!deviceId || !name) {
      return false;
    }

    this.logger.debug(`Setting device name: ${deviceId} -> ${name}`);

    const success = await this.deviceService.setDeviceName(deviceId, name);

    if (success) {
      // MeterViewModelを更新
      const deviceIndex = this.meterViewModel.getDeviceIndex(deviceId);
      if (deviceIndex >= 0) {
        this.meterViewModel.setName(deviceIndex, name);
        this.meterViewModel._notifyChange();
        this.logger.debug(`Device name updated in MeterViewModel and notification sent: ${deviceId} -> ${name}`);
      }

      // DeviceListViewModelを更新
      this._notifyDeviceListUpdate();

      // 変更イベントを発行
      if (this.eventEmitter) {
        this.logger.debug('Emitting device updated event to propagate name change');
        this.eventEmitter.emit(EventTypes.DEVICE_UPDATED, {
          deviceId,
          device: {
            id: deviceId,
            name: name,
            iconUrl: this.deviceService.getDeviceIconUrl?.(deviceId)
          }
        });
      }

      return true;
    }

    return false;
  }

  /**
   * アイコンの設定
   * @param {string} deviceId デバイスID
   * @param {string} iconUrl アイコンURL
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async setDeviceIcon(deviceId, iconUrl) {
    if (!deviceId || !iconUrl) {
      return false;
    }

    this.logger.debug(`Setting device icon: ${deviceId} -> ${iconUrl}`);

    const success = await this.deviceService.setDeviceIcon(deviceId, iconUrl);

    if (success) {
      // MeterViewModelを更新
      const deviceIndex = this.meterViewModel.getDeviceIndex(deviceId);
      if (deviceIndex >= 0) {
        this.meterViewModel.setIcon(deviceIndex, iconUrl);
        this.meterViewModel._notifyChange();
        this.logger.debug(`Device icon updated in MeterViewModel and notification sent: ${deviceId}`);
      }

      // DeviceListViewModelを更新
      this._notifyDeviceListUpdate();

      // 変更イベントを発行
      if (this.eventEmitter) {
        this.logger.debug('Emitting device updated event to propagate icon change');
        this.eventEmitter.emit(EventTypes.DEVICE_UPDATED, {
          deviceId,
          device: {
            id: deviceId,
            iconUrl: iconUrl,
            name: this.deviceService.getDeviceName?.(deviceId)
          }
        });
      }

      return true;
    }

    return false;
  }

  /**
   * デバイスを削除
   * @param {string} deviceId デバイスID
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async removeDevice(deviceId) {
    if (!deviceId) {
      return false;
    }

    this.logger.info(`Removing device: ${deviceId}`);

    try {
      const success = await this.deviceService.removeDevice(deviceId);

      if (success) {
        // MeterViewModelからデバイスを削除
        this.meterViewModel.removeDevice(deviceId);

        // DeviceListViewModelを更新
        this._notifyDeviceListUpdate();

        // イベントを発行
        if (this.eventEmitter) {
          this.eventEmitter.emit(EventTypes.DEVICE_REMOVED, { deviceId });
        }

        this.logger.info(`Device removed successfully: ${deviceId}`);
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error(`Error removing device ${deviceId}:`, error);
      return false;
    }
  }

  /**
   * デバイスの表示/非表示を設定
   * @param {string} deviceId デバイスID
   * @param {boolean} isVisible 表示するかどうか
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async setDeviceVisibility(deviceId, isVisible) {
    if (!deviceId) {
      return false;
    }

    this.logger.debug(`Setting device visibility: ${deviceId} -> ${isVisible ? 'visible' : 'hidden'}`);

    try {
      const deviceIndex = this.meterViewModel.getDeviceIndex(deviceId);
      if (deviceIndex >= 0) {
        // MeterViewModel経由でデバイス表示状態を更新
        this.meterViewModel.setVisible(deviceIndex, isVisible);
        this.meterViewModel._notifyChange();
        this.logger.debug(`Device visibility updated in MeterViewModel and notification sent: ${deviceId} -> ${isVisible ? 'visible' : 'hidden'}`);

        // デバイスサービスにも通知
        if (this.deviceService && typeof this.deviceService.setDeviceVisibility === 'function') {
          await this.deviceService.setDeviceVisibility(deviceId, isVisible);
          this.logger.debug(`Device visibility updated in DeviceService: ${deviceId} -> ${isVisible ? 'visible' : 'hidden'}`);
        }

        // DeviceListViewModelを更新
        this._notifyDeviceListUpdate();

        // 変更イベントを発行
        if (this.eventEmitter) {
          this.logger.debug('Emitting device updated event to propagate visibility change');
          this.eventEmitter.emit(EventTypes.DEVICE_UPDATED, {
            deviceId,
            device: {
              id: deviceId,
              visible: isVisible,
              name: this.deviceService.getDeviceName?.(deviceId),
              iconUrl: this.deviceService.getDeviceIconUrl?.(deviceId)
            }
          });
        }

        return true;
      }

      this.logger.warn(`Device with ID ${deviceId} not found in MeterViewModel`);
      return false;
    } catch (error) {
      this.logger.error(`Error setting device visibility for ${deviceId}:`, error);
      return false;
    }
  }

  /**
   * デバイスのリセット
   * @param {Object} deviceListViewModel DeviceListViewModel（オプション）
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async resetDevices(deviceListViewModel = null) {
    this.logger.info('Resetting all devices');

    try {
      const success = await this.deviceService.resetAllDevices();

      if (success) {
        // MeterViewModelのすべてのデバイスマッピングをクリア
        if (this.meterViewModel.deviceMapping) {
          const deviceIds = Array.from(this.meterViewModel.deviceMapping.keys());
          deviceIds.forEach(deviceId => {
            this.meterViewModel.removeDevice(deviceId);
          });
          this.logger.debug(`Removed ${deviceIds.length} devices from MeterViewModel`);
        }

        // MeterViewModelをリセット
        this.meterViewModel.reset();
        this.logger.debug('MeterViewModel reset successful');

        // DeviceListViewModelもリセット（存在する場合）
        if (deviceListViewModel && typeof deviceListViewModel.updateDeviceList === 'function') {
          deviceListViewModel.updateDeviceList([]);
          this.logger.debug('DeviceListViewModel reset successful');
        }

        // イベント発行
        if (this.eventEmitter) {
          this.logger.debug('Emitting device reset events');
          this.eventEmitter.emit(EventTypes.DEVICES_RESET, { timestamp: Date.now() });
          this.eventEmitter.emit('devicesReset', { timestamp: Date.now() });
        }

        return true;
      } else {
        this.logger.warn('Device service reset returned false');
        return false;
      }
    } catch (error) {
      this.logger.error('Error resetting devices:', error);
      return false;
    }
  }

  /**
   * デバイスの再スキャン
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async scanDevices() {
    this.logger.info('Scanning for devices via LeverAPI');

    try {
      const scanEndpoint = `${this.leverApiUrl}/api/scan`;

      this.logger.debug(`Sending scan request to: ${scanEndpoint}`);

      const response = await fetch(scanEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.logger.info('Device scan initiated successfully:', data);
        return true;
      } else {
        this.logger.warn(`Device scan request failed with status ${response.status}`);
        return false;
      }
    } catch (error) {
      this.logger.error('Error scanning for devices:', error);
      return false;
    }
  }

  /**
   * すべてのデバイスを取得
   * @param {boolean} connectedOnly 接続済みデバイスのみ取得するかどうか
   * @returns {Promise<Array>} デバイスの配列
   */
  async getAllDevices(connectedOnly = false) {
    if (!this.deviceService) {
      this.logger.warn('DeviceService not available for getAllDevices');
      return [];
    }
    return await this.deviceService.getAllDevices(connectedOnly);
  }

  /**
   * DeviceListViewModelの更新を通知
   * @private
   */
  _notifyDeviceListUpdate() {
    if (this.onDeviceListUpdate) {
      this.onDeviceListUpdate();
    }
  }
}
