/**
 * DeviceRepository.js
 * デバイス情報の永続化・取得を行うリポジトリの実装
 * ドメイン層のIDeviceRepositoryインターフェースを実装
 */

import { Device } from '../../domain/entities/Device.js';
import { IDeviceRepository } from '../../domain/repositories/IDeviceRepository.js';
import { AppLogger } from '../services/Logger.js';

/**
 * デバイスリポジトリの実装
 */
export class DeviceRepository extends IDeviceRepository {
  /**
   * デバイスリポジトリのコンストラクタ
   * @param {Object} storageAdapter ストレージアダプター
   */
  constructor(storageAdapter) {
    super();
    this.storageAdapter = storageAdapter;
    this.devices = new Map(); // インメモリキャッシュ
    this.STORAGE_KEY = 'devices';
    this.logger = AppLogger.createLogger('DeviceRepository');

    // ストレージからデバイスをロード
    this._loadFromStorage();
  }

  /**
   * ストレージからデバイスをロード
   * @private
   */
  _loadFromStorage() {
    try {
      const storedDevices = this.storageAdapter.getItem(this.STORAGE_KEY, []);
      this.logger.debug(`Loading ${storedDevices.length} devices from storage`);

      this.devices.clear();
      storedDevices.forEach(deviceData => {
        const device = Device.fromJSON(deviceData);
        this.devices.set(device.id, device);
      });

      this.logger.info(`Loaded ${this.devices.size} devices from storage`);
    } catch (error) {
      this.logger.error('Error loading devices from storage:', error);
      this.devices.clear();
    }
  }

  /**
   * ストレージにデバイスを保存
   * @private
   */
  _saveToStorage() {
    try {
      const devicesToStore = Array.from(this.devices.values()).map(device => device.toJSON());
      this.storageAdapter.setItem(this.STORAGE_KEY, devicesToStore);
      this.logger.debug(`Saved ${devicesToStore.length} devices to storage`);
      return true;
    } catch (error) {
      this.logger.error('Error saving devices to storage:', error);
      return false;
    }
  }

  /**
   * すべてのデバイスを取得
   * @returns {Promise<Array<Device>>} デバイスの配列
   */
  async getAll() {
    return Array.from(this.devices.values());
  }

  /**
   * 接続されているすべてのデバイスを取得
   * @returns {Promise<Array<Device>>} 接続されているデバイスの配列
   */
  async getAllConnected() {
    return Array.from(this.devices.values())
      .filter(device => device.connected);
  }

  /**
   * IDでデバイスを取得
   * @param {string} id デバイスID
   * @returns {Promise<Device|null>} デバイスまたはnull
   */
  async getById(id) {
    return this.devices.get(id) || null;
  }

  /**
   * 条件に一致するデバイスを検索
   * @param {Function} predicate 検索条件（デバイス => boolean）
   * @returns {Promise<Array<Device>>} 条件に一致するデバイスの配列
   */
  async findByCondition(predicate) {
    if (typeof predicate !== 'function') {
      return [];
    }

    return Array.from(this.devices.values())
      .filter(device => predicate(device));
  }

  /**
   * デバイスを保存
   * @param {Device} device 保存するデバイス
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async save(device) {
    if (!device || !device.id) {
      this.logger.warn('Attempted to save invalid device:', device);
      return false;
    }

    this.devices.set(device.id, device);
    const result = this._saveToStorage();

    if (result) {
      this.logger.debug(`Device saved: ${device.id}`);
    }

    return result;
  }

  /**
   * 複数のデバイスを一括保存
   * @param {Array<Device>} devices 保存するデバイスの配列
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async saveAll(devices) {
    if (!Array.isArray(devices)) {
      this.logger.warn('Attempted to save non-array devices:', devices);
      return false;
    }

    let hasInvalidDevice = false;
    devices.forEach(device => {
      if (!device || !device.id) {
        this.logger.warn('Invalid device in saveAll:', device);
        hasInvalidDevice = true;
        return;
      }

      this.devices.set(device.id, device);
    });

    if (hasInvalidDevice) {
      this.logger.warn('Some devices were invalid and not saved');
    }

    const result = this._saveToStorage();

    if (result) {
      this.logger.debug(`Saved ${devices.length} devices`);
    }

    return result;
  }

  /**
   * デバイスを削除
   * @param {string} id 削除するデバイスのID
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async remove(id) {
    if (!id || !this.devices.has(id)) {
      this.logger.debug(`Attempted to remove non-existent device: ${id}`);
      return false;
    }

    this.devices.delete(id);
    const result = this._saveToStorage();

    if (result) {
      this.logger.debug(`Device removed: ${id}`);
    }

    return result;
  }

  /**
   * すべてのデバイスをリセット
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async reset() {
    this.devices.clear();
    const result = this._saveToStorage();

    if (result) {
      this.logger.info('All devices reset');
    }

    return result;
  }

  /**
   * デバイスの存在チェック
   * @param {string} id デバイスID
   * @returns {Promise<boolean>} 存在するかどうか
   */
  async exists(id) {
    return this.devices.has(id);
  }

  /**
   * 保存されているデバイスの総数を取得
   * @returns {Promise<number>} デバイスの総数
   */
  async count() {
    return this.devices.size;
  }

  /**
   * 変更を永続化
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async persist() {
    return this._saveToStorage();
  }
}