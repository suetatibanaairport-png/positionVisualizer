/**
 * RecordSessionUseCase.js
 * デバイスの値を記録するユースケース
 * セッションの記録と管理を担当
 */

import { EventTypes } from '../../domain/events/EventTypes.js';
// 注: IEventBus, ILogger はドメイン層のインターフェース
// 実装はAppBootstrapで注入される

/**
 * セッション記録のユースケースクラス
 */
export class RecordSessionUseCase {
  /**
   * セッション記録ユースケースのコンストラクタ
   * @param {Object} sessionRepository セッションリポジトリ
   * @param {Object} valueRepository 値リポジトリ
   * @param {Object} eventBus イベントバス（IEventBus実装）
   * @param {Object} logger ロガー（ILogger実装）
   * @param {Object} options オプション設定
   */
  constructor(sessionRepository, valueRepository, eventBus, logger, options = {}) {
    this.sessionRepository = sessionRepository;
    this.valueRepository = valueRepository;
    this.eventBus = eventBus;
    this.logger = logger || { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };
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
  }

  /**
   * 記録開始
   * @param {Object} initialValues 初期値（デバイスID => 値）
   * @param {Object} deviceMapping デバイスマッピング（デバイスID => インデックス）
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async startRecording(initialValues = {}, deviceMapping = null) {
    this.logger.debug('記録開始リクエストを受信しました');

    if (this.isRecording) {
      this.logger.warn('すでに記録中です');
      return false;
    }

    // 新しいセッションを作成
    const sessionId = `session_${Date.now()}`;
    this.currentSessionId = sessionId;
    this.isRecording = true;
    this.startTime = Date.now();
    this.entries = [];
    this.deviceMapping = deviceMapping || {};

    this.logger.info(`記録セッションを開始します: ${sessionId}`);

    // 初期値があれば記録
    if (initialValues && Object.keys(initialValues).length > 0) {
      this.logger.debug(`初期値を記録します: デバイス数=${Object.keys(initialValues).length}`);
      for (const deviceId in initialValues) {
        const value = initialValues[deviceId];
        this.recordDeviceData(deviceId, value);
      }
    } else {
      this.logger.debug('初期値はありません');
    }

    // セッション情報をリポジトリに一時保存（空セッションとして）
    // ただし自動ダウンロードはしない
    try {
      await this.sessionRepository.saveTemporarySession(
        sessionId,
        {
          startTime: this.startTime,
          endTime: null,
          duration: 0,
          entryCount: this.entries.length,
          entries: [],
          deviceMapping: this.deviceMapping
        }
      );
      this.logger.debug(`一時的なセッション情報を保存しました: ${sessionId}`);
    } catch (error) {
      // セッション保存の失敗はエラーログを残すが、記録自体は継続する
      this.logger.error(`一時的なセッション情報の保存に失敗しました: ${error.message}`);
    }

    // デバイス値の変更を監視
    this._subscribeToDeviceValues();

    // 最大記録時間を設定
    this._setupAutoStop();

    // ポーリング機能を開始（イベント監視の補完として）
    this.startPolling();

    // イベント通知
    this.logger.debug('RECORDING_STARTED イベントを発行します');
    this.eventBus.emit(EventTypes.RECORDING_STARTED, {
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

    // ポーリングを停止
    this.stopPolling();

    // 一時セッションがあれば削除
    try {
      this.sessionRepository.removeTemporarySession(sessionId);
    } catch (error) {
      this.logger.warn(`一時セッションの削除中にエラーが発生: ${error.message}`);
    }

    // セッションを保存（オプション）
    if (save && this.options.autoSave && sessionId) {
      try {
        await this.sessionRepository.saveSession(
          sessionId,
          {
            startTime: this.startTime,
            endTime,
            duration,
            entryCount: entries.length,
            entries,
            deviceMapping: this.deviceMapping
          }
        );

        this.logger.info(`Saved recording session: ${sessionId}`);

        // エントリがある場合は自動的にダウンロード
        if (entries.length > 0) {
          await this.saveRecordedData(entries);
        } else {
          this.logger.warn(`記録を停止しましたが、エントリが0件のためダウンロードしません: ${sessionId}`);
        }
      } catch (error) {
        this.logger.error(`セッション保存中にエラーが発生: ${error.message}`);
      }
    }

    // イベント通知
    this.eventBus.emit(EventTypes.RECORDING_STOPPED, {
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
      this.logger.debug(`記録できません: アクティブな記録セッションがありません (deviceId: ${deviceId})`);
      return false;
    }

    if (!deviceId) {
      this.logger.warn('デバイスIDが無効なため記録できません');
      return false;
    }

    // 再生モード関連のチェックを削除（イベントタイプで区別する方式に変更）

    // 最大エントリ数をチェック
    if (this.entries.length >= this.options.maxEntries) {
      this.logger.warn(`最大エントリ数 (${this.options.maxEntries}) に達しました。記録を停止します。`);
      this.stopRecording().catch(error => {
        this.logger.error('記録停止中にエラーが発生しました:', error);
      });
      return false;
    }

    // 値の内容をログ出力
    const valueStr = typeof value === 'object' ?
      JSON.stringify(value, (key, val) => {
        if (key === 'deviceId' || key === 'timestamp' || key === 'relativeTime') return undefined;
        return val;
      }) : value;
    this.logger.debug(`デバイス ${deviceId} の値を記録: ${valueStr}`);

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

    // 定期的にエントリ数をログ出力
    if (this.entries.length % 10 === 0 || this.entries.length === 1) {
      this.logger.info(`現在のエントリ数: ${this.entries.length}`);
    }

    // イベント通知
    const ENTRY_RECORDED_EVENT = 'event:recording:entry:recorded';
    this.eventBus.emit(ENTRY_RECORDED_EVENT, {
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

    // 強制的なセーブでない場合かつ記録中の場合は、保存しない
    if (!entries && this.isRecording) {
      this.logger.debug('現在記録中のため、明示的なエントリ指定なしではダウンロードしません');
      return false;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultFilename = `recording_${timestamp}.json`;
    const saveFilename = filename || defaultFilename;

    try {
      // データが空でないことを再確認
      if (!dataToSave.length) {
        this.logger.warn('保存するデータが空です');
        return false;
      }

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
        const RECORDING_SAVED_EVENT = 'event:recording:saved';
        this.eventBus.emit(RECORDING_SAVED_EVENT, {
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
        const RECORDING_SAVED_EVENT = 'event:recording:saved';
        this.eventBus.emit(RECORDING_SAVED_EVENT, {
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

    this.logger.debug(`デバイス値変更の購読を開始します（セッションID: ${this.currentSessionId}, 記録中: ${this.isRecording}）`);

    // ValueRepositoryの変更イベントを購読
    // バインドされた関数のリファレンスを保持
    this.boundHandleDeviceValueChanged = this._handleDeviceValueChanged.bind(this);

    // デバイス値変更イベントリスナー（旧イベント名）
    this.eventBus.on('deviceValueChanged', this.boundHandleDeviceValueChanged);
    this.logger.debug('deviceValueChanged イベントのリスナーを登録しました');

    // DeviceUpdatedイベントも監視（値の更新時に発火される場合があるため）
    this.boundHandleDeviceUpdated = (event) => {
      if (!event || !event.deviceId) return;

      this.logger.debug(`deviceUpdated/DEVICE_UPDATED イベント受信: ${event.deviceId}`);

      if (event.value) {
        this.recordDeviceData(event.deviceId, event.value);
      }
    };

    // イベントリスナーを登録
    this.eventBus.on(EventTypes.DEVICE_UPDATED, this.boundHandleDeviceUpdated);
    this.logger.debug('DEVICE_UPDATED イベントのリスナーを登録しました');

    // デバイスの変更をリアルタイムに監視する
    this.boundHandleDeviceValueUpdated = (event) => {
      if (!event || !event.deviceId) return;

      this.logger.debug(`deviceValueUpdated/DEVICE_VALUE_UPDATED イベント受信: ${event.deviceId}`);

      if (event.value) {
        this.recordDeviceData(event.deviceId, event.value);
      }
    };

    // イベントリスナーを登録
    // 注意: ここでは意図的にDEVICE_VALUE_REPLAYEDのイベントは監視しない
    // 記録は実際のデバイスからのイベント(DEVICE_VALUE_UPDATED)のみを対象とする
    this.eventBus.on(EventTypes.DEVICE_VALUE_UPDATED, this.boundHandleDeviceValueUpdated);
    this.logger.debug('DEVICE_VALUE_UPDATED イベントのリスナーを登録しました');

    this.logger.info('デバイス値変更の購読を開始しました');
  }

  /**
   * デバイス値の変更の購読を解除
   * @private
   */
  _unsubscribeFromDeviceValues() {
    this.logger.debug('デバイス値変更の購読解除を開始します');

    // バインドされた関数のリファレンスを使って解除
    if (this.boundHandleDeviceValueChanged) {
      this.eventBus.off('deviceValueChanged', this.boundHandleDeviceValueChanged);
      this.logger.debug('deviceValueChanged イベントのリスナーを解除しました');
      this.boundHandleDeviceValueChanged = null;
    }

    // deviceUpdatedイベントリスナーを解除
    if (this.boundHandleDeviceUpdated) {
      this.eventBus.off(EventTypes.DEVICE_UPDATED, this.boundHandleDeviceUpdated);
      this.logger.debug('DEVICE_UPDATED イベントのリスナーを解除しました');
      this.boundHandleDeviceUpdated = null;
    }

    // deviceValueUpdatedイベントリスナーを解除
    if (this.boundHandleDeviceValueUpdated) {
      this.eventBus.off(EventTypes.DEVICE_VALUE_UPDATED, this.boundHandleDeviceValueUpdated);
      this.logger.debug('DEVICE_VALUE_UPDATED イベントのリスナーを解除しました');
      this.boundHandleDeviceValueUpdated = null;
    }

    // 既存の購読も解除
    this.deviceValueSubscriptions.forEach(unsubscribe => {
      unsubscribe();
    });
    this.deviceValueSubscriptions.clear();

    this.logger.debug('デバイス値変更の購読を解除しました');
  }

  /**
   * デバイス値変更のハンドラ
   * @param {Object} event イベント
   * @private
   */
  _handleDeviceValueChanged(event) {
    if (!event || !event.deviceId) return;

    this.logger.debug(`デバイス値変更イベント受信: ${event.deviceId}, タイムスタンプ: ${event.timestamp || 'なし'}`);

    // 記録中でない場合は処理しない
    if (!this.isRecording) {
      this.logger.debug(`記録中でないため値を記録しません: ${event.deviceId}`);
      return;
    }

    // 再生モード関連のチェックを削除（イベントタイプで区別する方式に変更）

    try {
      // 値の有無を確認
      if (event.value) {
        this.logger.debug(`デバイス値変更を検出: ${event.deviceId}, 値: ${JSON.stringify(event.value)}`);
        this.recordDeviceData(event.deviceId, event.value);
      } else if (event.previousValue) {
        // 値がない場合は前回の値を使用
        this.logger.debug(`デバイス値変更を検出 (前回値を使用): ${event.deviceId}, 前回値: ${JSON.stringify(event.previousValue)}`);
        this.recordDeviceData(event.deviceId, event.previousValue);
      } else {
        // 何も値がない場合はデバイスIDのみで記録
        this.logger.debug(`デバイス値なしで変更を検出: ${event.deviceId}`);
        this.recordDeviceData(event.deviceId, { rawValue: null, normalizedValue: null });
      }

      this.logger.debug(`デバイス値変更イベント処理完了: ${event.deviceId}, 現在のエントリ数: ${this.entries.length}`);
    } catch (error) {
      this.logger.error(`デバイス値変更処理中にエラーが発生: ${event.deviceId}`, error);
    }
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
      const jsonValue = value.toJSON();
      // フォーマットを統一するために、必要なフィールドのみを抽出して返す
      return {
        rawValue: jsonValue.rawValue !== undefined ? jsonValue.rawValue : null,
        normalizedValue: jsonValue.normalizedValue !== undefined ? jsonValue.normalizedValue : jsonValue.rawValue
      };
    }

    // rawValueとnormalizedValueを持つオブジェクトの場合
    if (value.rawValue !== undefined || value.normalizedValue !== undefined) {
      // rawValue が設定されていて normalizedValue が未設定の場合、rawValue をコピーする
      const rawVal = value.rawValue !== undefined ? value.rawValue : null;
      const normalVal = (value.normalizedValue !== undefined && value.normalizedValue !== null) ?
        value.normalizedValue : rawVal;

      return {
        rawValue: rawVal,
        normalizedValue: normalVal
        // deviceIdとtimestampは不要（エントリ自体が持つ情報）
      };
    }

    // 数値の場合
    if (typeof value === 'number') {
      return {
        rawValue: value,
        normalizedValue: value // rawValueと同じ値を設定
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
        this.logger.warn(`最大記録時間 (${this.options.maxRecordingTime}ms) に達しました。記録を停止します。`);
        this.stopRecording().catch(error => {
          this.logger.error('自動停止中にエラーが発生しました:', error);
        });
      }
    }, this.options.maxRecordingTime);
  }

  /**
   * デバイス値のポーリングを開始
   * @private
   */
  startPolling() {
    this.logger.debug('デバイス値のポーリングを開始します');

    // 既存のポーリングを停止
    this.stopPolling();

    // 1秒間隔でデバイス値をポーリング
    this.pollingInterval = setInterval(async () => {
      if (!this.isRecording) {
        return;
      }

      try {
        // valueRepositoryが存在するか確認
        if (!this.valueRepository || typeof this.valueRepository.getAllCurrentValues !== 'function') {
          this.logger.warn('ValueRepositoryが利用できません。ポーリングをスキップします。');
          return;
        }

        this.logger.debug('デバイス値をポーリングします');
        const values = await this.valueRepository.getAllCurrentValues();

        if (!values || Object.keys(values).length === 0) {
          this.logger.debug('ポーリング: デバイス値がありません');
          return;
        }

        this.logger.debug(`ポーリング: ${Object.keys(values).length}個のデバイス値を取得しました`);

        // 各デバイスの値を記録
        for (const deviceId in values) {
          const value = values[deviceId];
          if (value) {
            // ポーリングで取得した値を記録
            this.recordDeviceData(deviceId, value);
          }
        }
      } catch (error) {
        this.logger.error('値のポーリング中にエラーが発生しました:', error);
      }
    }, 1000); // 1秒間隔
  }

  /**
   * デバイス値のポーリングを停止
   * @private
   */
  stopPolling() {
    if (this.pollingInterval) {
      this.logger.debug('デバイス値のポーリングを停止します');
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }
}