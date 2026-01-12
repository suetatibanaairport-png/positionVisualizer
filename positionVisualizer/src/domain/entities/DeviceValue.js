/**
 * DeviceValue.js
 * デバイスから取得した値を表すエンティティ
 * 値のノーマライズや変換機能を持つ
 */

import { ValueCalculator } from '../services/ValueCalculator.js';

export class DeviceValue {
  /**
   * デバイス値コンストラクタ
   * @param {string} deviceId デバイスID
   * @param {number} rawValue 生の値
   * @param {number} normalizedValue 正規化された値（0-100）
   * @param {number} timestamp タイムスタンプ（ミリ秒）
   */
  constructor(deviceId, rawValue, normalizedValue = null, timestamp = Date.now()) {
    this.deviceId = deviceId;
    this.rawValue = rawValue;
    this.normalizedValue = normalizedValue !== null ?
      normalizedValue :
      DeviceValue.normalize(rawValue);
    this.timestamp = timestamp;
  }

  /**
   * 生の値を0-100の範囲に正規化
   * @param {number} rawValue 生の値
   * @param {number} minValue 最小値（デフォルト0）
   * @param {number} maxValue 最大値（デフォルト100）
   * @returns {number} 正規化された値（0-100）
   */
  static normalize(rawValue, minValue = 0, maxValue = 100) {
    return ValueCalculator.normalize(rawValue, minValue, maxValue);
  }

  /**
   * 値が閾値の範囲内にあるか確認
   * @param {number} threshold 閾値
   * @returns {boolean} 閾値内かどうか
   */
  isWithinThreshold(threshold) {
    if (!this.normalizedValue) return false;
    return this.normalizedValue >= 0 && this.normalizedValue <= threshold;
  }

  /**
   * 2つの値の間の変化率を計算
   * @param {DeviceValue} other 比較対象のデバイス値
   * @returns {number} 変化率（0-1）
   */
  changeRateFrom(other) {
    if (!other || other.normalizedValue === null || this.normalizedValue === null) {
      return 0;
    }

    return Math.abs(this.normalizedValue - other.normalizedValue) / 100;
  }

  /**
   * 値が古いかどうかを判定
   * @param {number} maxAgeMs 許容する最大経過時間（ミリ秒）
   * @returns {boolean} 値が古いかどうか
   */
  isStale(maxAgeMs) {
    return Date.now() - this.timestamp > maxAgeMs;
  }

  /**
   * デバイス値をシリアライズ可能な形式に変換
   * @returns {Object} シリアライズ用オブジェクト
   */
  toJSON() {
    return {
      deviceId: this.deviceId,
      rawValue: this.rawValue,
      normalizedValue: this.normalizedValue,
      timestamp: this.timestamp
    };
  }

  /**
   * シリアライズされたオブジェクトからデバイス値インスタンスを作成
   * @param {Object} data シリアライズされたデバイス値データ
   * @returns {DeviceValue} 新しいDeviceValueインスタンス
   */
  static fromJSON(data) {
    return new DeviceValue(
      data.deviceId,
      data.rawValue,
      data.normalizedValue,
      data.timestamp || Date.now()
    );
  }
}