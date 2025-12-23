/**
 * RecordSessionUseCase.js
 * デバイスの値を記録するユースケース
 * セッションの記録と管理を担当
 */

import { AppLogger } from '../../infrastructure/services/Logger.js';
import { EventBus } from '../../infrastructure/services/EventBus.js';

/**
 * セッション記録のユースケースクラス
 */
export class RecordSessionUseCase {
  /**
   * セッション記録ユースケースのコンストラクタ
   * @param {Object} sessionRepository セッションリポジトリ
   * @param {Object} valueRepository 値リポジトリ
   * @param {Object} options オプション設定
   */
  constructor(sessionRepository, valueRepository, options = {}) {
    this.sessionRepository = sessionRepository;
    this.valueRepository = valueRepository;
    this.options = {
      autoSave: true,                // 記録停止時に自動保存するか
      maxRecordingTime: 3600000,     // 最大記録時間（1時間）
      maxEntries: 10000,             // 最大エントリ数
      compressionEnabled: false,     // データ圧縮を有効にするか
      ...options
    };

    // 記録状態
    this.isRecording = false;
    this.currentSessionId = null;
    this.startTime = null;
    this.entries = [];
    this.autoStopTimer = null;
    this.deviceValueSubscriptions = new Map();

    // ロガー
    this.logger = AppLogger.createLogger('RecordSessionUseCase');
  }

  /**
   * 記録開始
   * @param {Object} initialValues 初期値（デバイスID => 値）
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async startRecording(initialValues = {}) {
    if (this.isRecording) {
      this.logger.warn('Recording already in progress');
      return false;
    }

    // 新しいセッションを作成
    const sessionId = `session_${Date.now()}`;
    this.currentSessionId = sessionId;
    this.isRecording = true;
    this.startTime = Date.now();
    this.entries = [];

    this.logger.info(`Starting recording session: ${sessionId}`);

    // 初期値があれば記録
    if (initialValues && Object.keys(initialValues).length > 0) {
      for (const deviceId in initialValues) {
        const value = initialValues[deviceId];
        this.recordDeviceData(deviceId, value);
      }
    }

    // デバイス値の変更を監視
    this._subscribeToDeviceValues();

    // 最大記録時間を設定
    this._setupAutoStop();

    // イベント通知
    EventBus.emit('recordingStarted', {
      sessionId,
      startTime: this.startTime
    });

    return true;
  }

  /**
   * 記録停止
   * @param {boolean} save 記録を保存するかどうか
   * @returns {Promise<Array>} 記録されたエントリの配列
   */
  async stopRecording(save = true) {
    if (!this.isRecording) {
      this.logger.warn('No active recording to stop');
      return [];
    }

    this.isRecording = false;
    const entries = [...this.entries];
    const sessionId = this.currentSessionId;
    const endTime = Date.now();
    const duration = endTime - this.startTime;

    this.logger.info(`Stopping recording session: ${sessionId} (duration: ${duration}ms, entries: ${entries.length})`);

    // 自動停止タイマーをクリア
    if (this.autoStopTimer) {
      clearTimeout(this.autoStopTimer);
      this.autoStopTimer = null;
    }

    // デバイス値の購読解除
    this._unsubscribeFromDeviceValues();

    // セッションを保存（オプション）
    if (save && this.options.autoSave && sessionId) {
      await this.sessionRepository.saveSession(
        sessionId,
        {
          startTime: this.startTime,
          endTime,
          duration,
          entryCount: entries.length,
          entries
        }
      );

      this.logger.info(`Saved recording session: ${sessionId}`);

      // エントリがある場合は自動的にダウンロード
      if (entries.length > 0) {
        await this.saveRecordedData(entries);
      }
    }

    // イベント通知
    EventBus.emit('recordingStopped', {
      sessionId,
      duration,
      entriesCount: entries.length
    });

    // 状態をリセット
    this.currentSessionId = null;
    this.startTime = null;
    this.entries = [];

    return entries;
  }

  /**
   * デバイスデータを記録
   * @param {string} deviceId デバイスID
   * @param {Object} value デバイス値
   * @returns {boolean} 成功したかどうか
   */
  recordDeviceData(deviceId, value) {
    if (!this.isRecording) {
      this.logger.debug(`Cannot record data: no active recording session`);
      return false;
    }

    if (!deviceId) {
      this.logger.warn('Invalid device ID for recording');
      return false;
    }

    // 最大エントリ数をチェック
    if (this.entries.length >= this.options.maxEntries) {
      this.logger.warn(`Maximum entries (${this.options.maxEntries}) reached, stopping recording`);
      this.stopRecording().catch(error => {
        this.logger.error('Error stopping recording:', error);
      });
      return false;
    }

    const timestamp = Date.now();
    const relativeTime = timestamp - this.startTime;

    // エントリを作成
    const entry = {
      deviceId,
      value,
      timestamp,
      relativeTime
    };

    // エントリを追加
    this.entries.push(entry);

    // イベント通知
    EventBus.emit('entryRecorded', {
      entry,
      sessionId: this.currentSessionId,
      entriesCount: this.entries.length
    });

    return true;
  }

  /**
   * 記録状態の取得
   * @returns {Object} 記録状態
   */
  getRecordingStatus() {
    return {
      isRecording: this.isRecording,
      sessionId: this.currentSessionId,
      startTime: this.startTime,
      recordCount: this.entries.length,
      elapsedTime: this.startTime ? Date.now() - this.startTime : 0,
      maxEntries: this.options.maxEntries,
      maxRecordingTime: this.options.maxRecordingTime
    };
  }

  /**
   * 記録データの保存
   * @param {Array} entries エントリの配列（未指定時は現在の記録を使用）
   * @param {string} filename ファイル名
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async saveRecordedData(entries = null, filename = null) {
    const dataToSave = entries || this.entries;
    if (!dataToSave.length) {
      this.logger.warn('No data to save');
      return false;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultFilename = `recording_${timestamp}.json`;
    const saveFilename = filename || defaultFilename;

    try {
      // デバイスIDを収集
      const deviceIds = new Set(dataToSave.map(e => e.deviceId));

      // デバイス情報を収集
      const deviceInfo = {};

      // 各デバイスIDについてデバイス情報を収集
      for (const deviceId of deviceIds) {
        try {
          // EventBusを通じてデバイス情報を取得
          const device = await this.valueRepository.getDeviceInfo?.(deviceId);
          if (device) {
            deviceInfo[deviceId] = {
              name: device.name,
              iconUrl: device.iconUrl
            };
          }
        } catch (error) {
          this.logger.warn(`Could not get device info for ${deviceId}`);
        }
      }

      // データのフォーマット
      const formattedData = {
        metadata: {
          version: "1.0",
          createdAt: new Date().toISOString(),
          deviceCount: deviceIds.size,
          entriesCount: dataToSave.length,
          startTime: this.startTime,
          endTime: Date.now(),
          deviceInfo: deviceInfo // デバイス情報を追加
        },
        entries: this._formatEntriesForExport(dataToSave)
      };

      // ブラウザ環境の場合、ファイルをダウンロード
      if (typeof Blob !== 'undefined' && typeof URL !== 'undefined') {
        const jsonContent = JSON.stringify(formattedData, null, 2);
        const blob = new Blob([jsonContent], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        // ダウンロードリンクを作成
        const a = document.createElement('a');
        a.href = url;
        a.download = saveFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.logger.info(`Recording downloaded as ${saveFilename} (${dataToSave.length} entries)`);

        // イベント通知
        EventBus.emit('recordingSaved', {
          filename: saveFilename,
          entriesCount: dataToSave.length
        });

        return true;
      }

      // ブラウザ環境以外またはバックアップとして、リポジトリも使用
      const result = await this.sessionRepository.exportSession(formattedData, saveFilename);

      if (result) {
        this.logger.info(`Recording saved to ${saveFilename} (${dataToSave.length} entries)`);

        // イベント通知
        EventBus.emit('recordingSaved', {
          filename: saveFilename,
          entriesCount: dataToSave.length
        });
      } else {
        this.logger.error(`Failed to save recording to ${saveFilename}`);
      }

      return result;
    } catch (error) {
      this.logger.error('Failed to save recording:', error);
      return false;
    }
  }

  /**
   * 記録されたセッションのリストを取得
   * @param {number} limit 取得する最大数
   * @returns {Promise<Array>} セッションの配列
   */
  async getRecordedSessions(limit = 10) {
    try {
      return await this.sessionRepository.getSessions(limit);
    } catch (error) {
      this.logger.error('Error getting recorded sessions:', error);
      return [];
    }
  }

  /**
   * セッションのロード
   * @param {string} sessionId セッションID
   * @returns {Promise<Object>} セッションデータ
   */
  async loadSession(sessionId) {
    try {
      return await this.sessionRepository.getSession(sessionId);
    } catch (error) {
      this.logger.error(`Error loading session ${sessionId}:`, error);
      return null;
    }
  }

  /**
   * デバイス値の変更を購読
   * @private
   */
  _subscribeToDeviceValues() {
    // 既存の購読を解除
    this._unsubscribeFromDeviceValues();

    // ValueRepositoryの変更イベントを購読
    EventBus.on('deviceValueChanged', this._handleDeviceValueChanged.bind(this));
  }

  /**
   * デバイス値の変更の購読を解除
   * @private
   */
  _unsubscribeFromDeviceValues() {
    EventBus.off('deviceValueChanged', this._handleDeviceValueChanged.bind(this));

    this.deviceValueSubscriptions.forEach(unsubscribe => {
      unsubscribe();
    });
    this.deviceValueSubscriptions.clear();
  }

  /**
   * デバイス値変更のハンドラ
   * @param {Object} event イベント
   * @private
   */
  _handleDeviceValueChanged(event) {
    if (!event || !event.deviceId || !event.value) return;

    this.recordDeviceData(event.deviceId, event.value);
  }

  /**
   * エクスポート用にエントリをフォーマット
   * @param {Array} entries エントリの配列
   * @returns {Array} フォーマットされたエントリの配列
   * @private
   */
  _formatEntriesForExport(entries) {
    return entries.map(entry => ({
      deviceId: entry.deviceId,
      value: this._extractValueForExport(entry.value),
      timestamp: entry.timestamp,
      relativeTime: entry.relativeTime
    }));
  }

  /**
   * エクスポート用に値を抽出
   * @param {Object} value 値オブジェクト
   * @returns {Object} 抽出された値
   * @private
   */
  _extractValueForExport(value) {
    // 値オブジェクトの形式によって抽出方法を変える
    if (!value) return null;

    // DeviceValueインスタンスの場合
    if (value.toJSON && typeof value.toJSON === 'function') {
      return value.toJSON();
    }

    // rawValueとnormalizedValueを持つオブジェクトの場合
    if (value.rawValue !== undefined || value.normalizedValue !== undefined) {
      return {
        raw: value.rawValue !== undefined ? value.rawValue : null,
        normalized: value.normalizedValue !== undefined ? value.normalizedValue : null,
        timestamp: value.timestamp || null
      };
    }

    // 数値の場合
    if (typeof value === 'number') {
      return {
        raw: value,
        normalized: null
      };
    }

    // その他の場合はそのまま
    return value;
  }

  /**
   * 自動停止タイマーの設定
   * @private
   */
  _setupAutoStop() {
    // 既存のタイマーをクリア
    if (this.autoStopTimer) {
      clearTimeout(this.autoStopTimer);
    }

    // 最大記録時間後に自動停止
    this.autoStopTimer = setTimeout(() => {
      if (this.isRecording) {
        this.logger.warn(`Maximum recording time (${this.options.maxRecordingTime}ms) reached, stopping recording`);
        this.stopRecording().catch(error => {
          this.logger.error('Error during auto-stop:', error);
        });
      }
    }, this.options.maxRecordingTime);
  }
}