/**
 * DeviceEvents.js
 * デバイス関連のドメインイベントを定義
 * イベントは状態変化を表し、他のコンポーネントに通知するために使用
 */

import { EventTypes } from './EventTypes.js';

/**
 * デバイスイベントの基底クラス
 */
export class DeviceEvent {
  /**
   * @param {string} deviceId イベントに関連するデバイスのID
   * @param {Date} timestamp イベント発生時刻
   */
  constructor(deviceId, timestamp = new Date()) {
    this.deviceId = deviceId;
    this.timestamp = timestamp;
    this.eventType = this.constructor.name;
  }

  /**
   * イベントをシリアライズ可能な形式に変換
   * @returns {Object} シリアライズ用オブジェクト
   */
  toJSON() {
    return {
      deviceId: this.deviceId,
      timestamp: this.timestamp,
      eventType: this.eventType
    };
  }
}

/**
 * デバイス検出イベント
 * 新しいデバイスが見つかった時に発行される
 */
export class DeviceDiscoveredEvent extends DeviceEvent {
  /**
   * @param {string} deviceId 発見されたデバイスのID
   * @param {Object} deviceInfo デバイス情報
   */
  constructor(deviceId, deviceInfo = {}) {
    super(deviceId);
    this.deviceInfo = deviceInfo;
  }

  /**
   * @override
   */
  toJSON() {
    return {
      ...super.toJSON(),
      deviceInfo: this.deviceInfo
    };
  }
}

/**
 * デバイス接続イベント
 * デバイスが接続された時に発行される
 */
export class DeviceConnectedEvent extends DeviceEvent {
  /**
   * @param {string} deviceId 接続されたデバイスのID
   * @param {Object} connectionInfo 接続情報
   */
  constructor(deviceId, connectionInfo = {}) {
    super(deviceId);
    this.connectionInfo = connectionInfo;
  }

  /**
   * @override
   */
  toJSON() {
    return {
      ...super.toJSON(),
      connectionInfo: this.connectionInfo
    };
  }
}

/**
 * デバイス切断イベント
 * デバイスが切断された時に発行される
 */
export class DeviceDisconnectedEvent extends DeviceEvent {
  /**
   * @param {string} deviceId 切断されたデバイスのID
   * @param {string} reason 切断理由
   */
  constructor(deviceId, reason = 'unknown') {
    super(deviceId);
    this.reason = reason;
  }

  /**
   * @override
   */
  toJSON() {
    return {
      ...super.toJSON(),
      reason: this.reason
    };
  }
}

/**
 * デバイス値更新イベント
 * デバイスの値が更新された時に発行される
 */
export class DeviceValueUpdatedEvent extends DeviceEvent {
  /**
   * @param {string} deviceId 更新されたデバイスのID
   * @param {Object} value 新しい値
   * @param {Object} previousValue 前回の値（オプション）
   */
  constructor(deviceId, value, previousValue = null) {
    super(deviceId);
    this.value = value;
    this.previousValue = previousValue;
  }

  /**
   * 変化率を計算
   * @returns {number} 変化率（0-1）
   */
  calculateChangeRate() {
    if (!this.previousValue ||
        !this.value ||
        this.value.normalizedValue === null ||
        this.previousValue.normalizedValue === null) {
      return 0;
    }

    return Math.abs(
      this.value.normalizedValue - this.previousValue.normalizedValue
    ) / 100;
  }

  /**
   * @override
   */
  toJSON() {
    return {
      ...super.toJSON(),
      value: this.value,
      previousValue: this.previousValue,
      changeRate: this.calculateChangeRate()
    };
  }
}

/**
 * デバイス更新イベント
 * デバイス情報（名前、アイコンなど）が更新された時に発行される
 */
export class DeviceUpdatedEvent extends DeviceEvent {
  /**
   * @param {string} deviceId 更新されたデバイスのID
   * @param {Object} changes 変更内容
   */
  constructor(deviceId, changes = {}) {
    super(deviceId);
    this.changes = changes;
  }

  /**
   * @override
   */
  toJSON() {
    return {
      ...super.toJSON(),
      changes: this.changes
    };
  }
}

/**
 * デバイスエラーイベント
 * デバイス処理中にエラーが発生した時に発行される
 */
export class DeviceErrorEvent extends DeviceEvent {
  /**
   * @param {string} deviceId エラーが発生したデバイスのID
   * @param {string} errorCode エラーコード
   * @param {string} errorMessage エラーメッセージ
   */
  constructor(deviceId, errorCode, errorMessage = '') {
    super(deviceId);
    this.errorCode = errorCode;
    this.errorMessage = errorMessage;
    this.handled = false;
  }

  /**
   * エラーを処理済みとしてマーク
   */
  markAsHandled() {
    this.handled = true;
  }

  /**
   * @override
   */
  toJSON() {
    return {
      ...super.toJSON(),
      errorCode: this.errorCode,
      errorMessage: this.errorMessage,
      handled: this.handled
    };
  }
}

/**
 * デバイスリセットイベント
 * すべてのデバイス情報がリセットされた時に発行される
 */
export class DevicesResetEvent extends DeviceEvent {
  /**
   * @param {string} initiator リセットを開始したコンポーネント
   */
  constructor(initiator = 'system') {
    super('all');
    this.initiator = initiator;
  }

  /**
   * @override
   */
  toJSON() {
    return {
      ...super.toJSON(),
      initiator: this.initiator
    };
  }
}

/**
 * すべてのデバイスイベントタイプのリスト
 * 古いイベント名と新しいイベント名のマッピング
 */
export const DeviceEventTypes = {
  // 旧タイプ名（クラス名）
  DEVICE_DISCOVERED: 'DeviceDiscoveredEvent',
  DEVICE_CONNECTED: 'DeviceConnectedEvent',
  DEVICE_DISCONNECTED: 'DeviceDisconnectedEvent',
  DEVICE_VALUE_UPDATED: 'DeviceValueUpdatedEvent',
  DEVICE_UPDATED: 'DeviceUpdatedEvent',
  DEVICE_ERROR: 'DeviceErrorEvent',
  DEVICES_RESET: 'DevicesResetEvent',

  // EventTypesとの対応
  DISCOVERED: EventTypes.DEVICE_DISCOVERED,
  CONNECTED: EventTypes.DEVICE_CONNECTED,
  DISCONNECTED: EventTypes.DEVICE_DISCONNECTED,
  VALUE_UPDATED: EventTypes.DEVICE_VALUE_UPDATED,
  UPDATED: EventTypes.DEVICE_UPDATED,
  ERROR: EventTypes.DEVICE_ERROR,
  RESET: EventTypes.DEVICES_RESET,
  VISIBILITY_CHANGED: EventTypes.DEVICE_VISIBILITY_CHANGED,
  NAME_CHANGED: EventTypes.DEVICE_NAME_CHANGED,
  ICON_CHANGED: EventTypes.DEVICE_ICON_CHANGED
};