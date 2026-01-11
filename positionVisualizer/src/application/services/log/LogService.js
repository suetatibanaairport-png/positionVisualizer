/**
 * LogService.js
 * ログ関連のビジネスロジックを提供するサービス
 */

import { LogSession } from '../../../domain/entities/log/LogSession.js';
import { LogEntry } from '../../../domain/entities/log/LogEntry.js';
// 注: IEventBus, ILogger はドメイン層のインターフェース
// 実装はAppBootstrapで注入される

/**
 * ログサービスクラス
 */
export class LogService {
  /**
   * LogServiceコンストラクタ
   * @param {Object} logSessionRepository ログセッションリポジトリ
   * @param {Object} deviceRepository デバイスリポジトリ
   * @param {Object} eventBus イベントバス（IEventBus実装）
   * @param {Object} logger ロガー（ILogger実装）
   */
  constructor(logSessionRepository, deviceRepository, eventBus, logger) {
    this.logSessionRepository = logSessionRepository;
    this.deviceRepository = deviceRepository;
    this.eventBus = eventBus;
    this.logger = logger || { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };
    this.currentSessionId = null;
  }

  /**
   * ログファイルをロード
   * @param {File} file ログファイル
   * @returns {Promise<string>} セッションID
   */
  async loadLogFile(file) {
    return new Promise((resolve, reject) => {
      try {
        const reader = new FileReader();

        reader.onload = async (e) => {
          try {
            // JSONデータをパースする
            const parsedData = JSON.parse(e.target.result);

            // ログセッションオブジェクトに変換
            const logSession = LogSession.fromJSON(parsedData);

            // 一時セッションIDを生成
            const sessionId = `temp_${Date.now()}`;

            // セッションを一時保存
            this.logSessionRepository.saveTemporarySession(sessionId, logSession);

            // セッションIDを返す
            resolve(sessionId);
          } catch (error) {
            this.logger.error('Error processing log file:', error);
            reject(error);
          }
        };

        reader.onerror = (error) => {
          this.logger.error('Error reading log file:', error);
          reject(error);
        };

        reader.readAsText(file);
      } catch (error) {
        this.logger.error('Error loading log file:', error);
        reject(error);
      }
    });
  }

  /**
   * セッションからデバイス情報を取得
   * @param {string} sessionId セッションID
   * @returns {Promise<Array>} デバイス情報の配列
   */
  async getDevicesFromSession(sessionId) {
    try {
      // セッションを取得
      const session = await this.logSessionRepository.getSession(sessionId);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      // デバイスIDのセットを作成
      const deviceIds = new Set();
      session.entries.forEach(entry => {
        if (entry.deviceId) {
          deviceIds.add(entry.deviceId);
        }
      });

      // デバイス情報を収集
      const devices = [];
      for (const deviceId of deviceIds) {
        // デフォルトのデバイス情報
        let deviceInfo = {
          id: deviceId,
          connected: true,
          name: deviceId,
          iconUrl: null,
          value: null,
          visible: true
        };

        // セッションのメタデータからデバイス情報を取得
        if (session.metadata && session.metadata.deviceInfo && session.metadata.deviceInfo[deviceId]) {
          const info = session.metadata.deviceInfo[deviceId];
          if (info.name) {
            deviceInfo.name = info.name;
          }
          if (info.iconUrl) {
            deviceInfo.iconUrl = info.iconUrl;
          }
        }

        // 最初のエントリから値を取得（存在する場合）
        if (session.entries && session.entries.length > 0) {
          const entry = session.entries.find(e => e.deviceId === deviceId);
          if (entry && entry.value) {
            deviceInfo.value = entry.value;
          }
        }

        // LocalStorageから保存された設定を適用（表示/非表示など）
        deviceInfo = await this._applyStoredDeviceSettings(deviceInfo);

        devices.push(deviceInfo);
      }

      return devices;
    } catch (error) {
      this.logger.error(`Error getting devices from session ${sessionId}:`, error);
      return [];
    }
  }

  /**
   * LocalStorageから保存された設定を適用
   * @private
   * @param {Object} deviceInfo デバイス情報
   * @returns {Promise<Object>} 更新されたデバイス情報
   */
  async _applyStoredDeviceSettings(deviceInfo) {
    try {
      // デバイス名の設定を取得
      const savedName = await this._loadDeviceNameSetting(deviceInfo.id);
      if (savedName) {
        deviceInfo.name = savedName;
      }

      // 表示/非表示設定を取得
      const isVisible = await this._loadDeviceVisibilitySetting(deviceInfo.id);
      deviceInfo.visible = isVisible;

      return deviceInfo;
    } catch (error) {
      this.logger.error(`Error applying stored settings for device ${deviceInfo.id}:`, error);
      return deviceInfo;
    }
  }

  /**
   * デバイス名の設定を取得
   * @private
   * @param {string} deviceId デバイスID
   * @returns {Promise<string|null>} デバイス名またはnull
   */
  async _loadDeviceNameSetting(deviceId) {
    try {
      const settings = JSON.parse(localStorage.getItem('deviceNameSettings') || '{}');
      return settings[deviceId] || null;
    } catch (error) {
      this.logger.error(`Error loading name settings for ${deviceId}:`, error);
      return null;
    }
  }

  /**
   * デバイス表示設定を取得
   * @private
   * @param {string} deviceId デバイスID
   * @returns {Promise<boolean>} 表示するかどうか（デフォルトはtrue）
   */
  async _loadDeviceVisibilitySetting(deviceId) {
    try {
      const settings = JSON.parse(localStorage.getItem('deviceVisibilitySettings') || '{}');
      return settings[deviceId] !== false; // 明示的にfalseの場合のみ非表示
    } catch (error) {
      this.logger.error(`Error loading visibility settings for ${deviceId}:`, error);
      return true; // エラーの場合はデフォルトで表示
    }
  }

  /**
   * セッションのクリーンアップ
   * @param {string} sessionId セッションID
   */
  cleanupSession(sessionId) {
    try {
      this.logSessionRepository.removeTemporarySession(sessionId);
      this.logger.debug(`Cleaned up session ${sessionId}`);
      return true;
    } catch (error) {
      this.logger.error(`Error cleaning up session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * 古い一時セッションをクリーンアップ
   * @param {number} maxAgeMs 最大経過時間（ミリ秒）
   */
  cleanupOldTemporarySessions(maxAgeMs = 30 * 60 * 1000) { // デフォルトは30分
    try {
      const now = Date.now();
      const sessionIds = Object.keys(this.logSessionRepository.temporarySessionStorage);

      for (const id of sessionIds) {
        // temp_のプレフィックスと作成時間のタイムスタンプを抽出
        if (id.startsWith('temp_')) {
          const timestamp = Number(id.replace('temp_', ''));
          if (now - timestamp > maxAgeMs) {
            this.logSessionRepository.removeTemporarySession(id);
            this.logger.debug(`Removed old temporary session ${id}`);
          }
        }
      }
    } catch (error) {
      this.logger.error('Error cleaning up old temporary sessions:', error);
    }
  }
}