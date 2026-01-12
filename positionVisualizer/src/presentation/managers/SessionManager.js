/**
 * SessionManager.js
 * 録画・再生セッションの管理を担当
 */

/**
 * セッション管理クラス
 */
export class SessionManager {
  /**
   * SessionManagerのコンストラクタ
   * @param {Object} recordSessionUseCase 記録セッションユースケース
   * @param {Object} replaySessionUseCase 再生セッションユースケース
   * @param {Object} deviceService デバイスサービス
   * @param {Object} meterViewModel メータービューモデル
   * @param {Object} eventBus イベントバス
   * @param {Object} logger ロガー
   */
  constructor(recordSessionUseCase, replaySessionUseCase, deviceService, meterViewModel, eventBus, logger) {
    this.recordSessionUseCase = recordSessionUseCase;
    this.replaySessionUseCase = replaySessionUseCase;
    this.deviceService = deviceService;
    this.meterViewModel = meterViewModel;
    this.eventBus = eventBus;
    this.logger = logger || { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

    // セッション状態
    this.recordingEnabled = false;
    this.replayingEnabled = false;

    // 外部コールバック
    this.onMonitoringStop = null;
    this.onMonitoringStart = null;
    this.onDeviceNameSet = null;
    this.onDeviceIconSet = null;
    this.onPlaybackControlsInit = null;

    // 再生完了イベントをリッスン
    this._setupPlaybackCompletedHandler();
  }

  /**
   * 記録の開始
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async startRecording() {
    if (this.recordingEnabled || !this.recordSessionUseCase) {
      return false;
    }

    this.logger.info('Starting recording session');

    // 初期値を取得
    const initialValues = {};
    const connectedDevices = await this.deviceService.getAllDevices(true);

    for (const device of connectedDevices) {
      const deviceInfo = await this.deviceService.getDeviceInfo(device.id);
      if (deviceInfo && deviceInfo.value) {
        initialValues[device.id] = deviceInfo.value;
      }
    }

    // デバイスマッピングを取得（EventBus経由でリクエスト）
    let deviceMapping = {};
    const mappingPromise = new Promise((resolve) => {
      const handler = (event) => {
        resolve(event.mapping);
        this.eventBus.off('deviceMappingResponse', handler);
      };
      this.eventBus.on('deviceMappingResponse', handler);
      this.eventBus.emit('deviceMappingRequest', {});
      // タイムアウト（100ms）
      setTimeout(() => resolve({}), 100);
    });
    deviceMapping = await mappingPromise;

    // 記録開始（deviceMappingを追加）
    const success = await this.recordSessionUseCase.startRecording(initialValues, deviceMapping);

    if (success) {
      this.recordingEnabled = true;
      this.logger.info('Recording started successfully');
      return true;
    } else {
      this.logger.warn('Failed to start recording');
      return false;
    }
  }

  /**
   * 記録の停止
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async stopRecording() {
    if (!this.recordingEnabled || !this.recordSessionUseCase) {
      return false;
    }

    this.logger.info('Stopping recording session');

    // 記録停止
    const entries = await this.recordSessionUseCase.stopRecording();
    this.recordingEnabled = false;

    if (entries.length > 0) {
      this.logger.info(`Recording stopped with ${entries.length} entries`);
      return true;
    } else {
      this.logger.warn('Recording stopped with no entries');
      return false;
    }
  }

  /**
   * 記録中にデバイスデータを記録
   * @param {string} deviceId デバイスID
   * @param {Object} value 値
   */
  recordDeviceData(deviceId, value) {
    if (this.recordingEnabled && this.recordSessionUseCase) {
      this.recordSessionUseCase.recordDeviceData(deviceId, value);
    }
  }

  /**
   * 記録が有効かどうか
   * @returns {boolean}
   */
  isRecording() {
    return this.recordingEnabled;
  }

  /**
   * 再生の開始
   * @param {string} sessionId セッションID
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async startReplay(sessionId) {
    // すでに再生中の場合は一度停止してから再開
    if (this.replayingEnabled && this.replaySessionUseCase) {
      this.logger.info('Stopping current replay before starting new one');
      this.stopReplay();

      // 少し待機して状態が完全に切り替わるようにする
      await new Promise(resolve => setTimeout(resolve, 500));
    } else if (!this.replaySessionUseCase) {
      this.logger.error('ReplaySessionUseCase not available');
      return false;
    }

    this.logger.info(`Starting replay for session: ${sessionId}`);

    // モニタリングを一時停止
    if (this.onMonitoringStop) {
      this.onMonitoringStop();
    }

    // セッションをロード
    const success = await this.replaySessionUseCase.loadSession(sessionId);

    if (success) {
      // セッションデータを取得
      const sessionData = this.replaySessionUseCase.getSessionData();
      if (!sessionData) {
        this.logger.error('Failed to get session data');
        return false;
      }

      if (!sessionData.entries || !Array.isArray(sessionData.entries)) {
        this.logger.error('Session data has no entries or entries is not an array');
        return false;
      }

      this.logger.info('Session data loaded:', {
        entryCount: sessionData.entries.length,
        deviceCount: sessionData.metadata?.deviceCount || 'unknown',
        metadata: sessionData.metadata || 'no metadata'
      });

      // デバイスの準備
      await this._prepareDevicesForReplay(sessionData);

      // 再生コントロールの初期化
      if (this.onPlaybackControlsInit) {
        this.onPlaybackControlsInit();
      }

      // 再生開始
      this.replaySessionUseCase.play();
      this.replayingEnabled = true;
      this.logger.info('Replay started successfully');
      return true;
    } else {
      // モニタリングを再開
      if (this.onMonitoringStart) {
        this.onMonitoringStart();
      }
      this.logger.warn(`Failed to load session: ${sessionId}`);
      return false;
    }
  }

  /**
   * 再生用にデバイスを準備
   * @private
   * @param {Object} sessionData セッションデータ
   */
  async _prepareDevicesForReplay(sessionData) {
    // エントリに含まれるすべてのデバイスを特定
    const deviceIdsInEntries = new Set(sessionData.entries.map(entry => entry.deviceId));
    this.logger.info(`Devices in entries: ${Array.from(deviceIdsInEntries).join(', ')}`);

    // デバイス情報のログ出力
    if (sessionData.metadata && sessionData.metadata.deviceInfo) {
      this.logger.info('Device info from metadata:');
      Object.entries(sessionData.metadata.deviceInfo).forEach(([id, info]) => {
        this.logger.info(`  ${id}: name=${info.name || 'none'}, icon=${info.iconUrl ? 'present' : 'none'}`);
      });
    } else {
      this.logger.warn('No device info in metadata');
    }

    // すべてのデバイスを初期状態で登録
    for (const deviceId of deviceIdsInEntries) {
      this.logger.info(`Pre-registering device: ${deviceId}`);
      await this.deviceService.registerDevice(deviceId, { name: deviceId });

      const deviceIndex = this.meterViewModel.getOrAssignDeviceIndex(deviceId);
      this.logger.info(`Assigned device ${deviceId} to index ${deviceIndex}`);

      if (deviceIndex >= 0) {
        this.meterViewModel.state.connected[deviceIndex] = true;
        this.meterViewModel.setVisible(deviceIndex, true);
        this.meterViewModel.setValue(deviceIndex, 50, true);
      }
    }

    // デバイス情報の設定（アイコンや名前）
    if (sessionData.metadata && sessionData.metadata.deviceInfo) {
      const deviceInfo = sessionData.metadata.deviceInfo;

      for (const [deviceId, info] of Object.entries(deviceInfo)) {
        await this.deviceService.registerDevice(deviceId, info);

        if (info.iconUrl && this.onDeviceIconSet) {
          await this.onDeviceIconSet(deviceId, info.iconUrl);
        }

        if (info.name && this.onDeviceNameSet) {
          await this.onDeviceNameSet(deviceId, info.name);
        }

        const deviceIndex = this.meterViewModel.getDeviceIndex(deviceId);
        if (deviceIndex >= 0) {
          this.meterViewModel.state.connected[deviceIndex] = true;
          this.meterViewModel._notifyChange();
        }
      }
    }

    // 最終確認
    for (const deviceId of deviceIdsInEntries) {
      const deviceIndex = this.meterViewModel.getDeviceIndex(deviceId);
      if (deviceIndex >= 0) {
        this.meterViewModel.state.connected[deviceIndex] = true;
        this.meterViewModel.setVisible(deviceIndex, true);
      }
    }

    this.meterViewModel._notifyChange();
    setTimeout(() => this.meterViewModel._notifyChange(), 0);
  }

  /**
   * 再生の停止
   * @returns {boolean} 成功したかどうか
   */
  stopReplay() {
    if (!this.replayingEnabled || !this.replaySessionUseCase) {
      return false;
    }

    this.logger.info('Stopping replay');

    this.replaySessionUseCase.stop();
    this.replayingEnabled = false;

    // モニタリングを再開
    if (this.onMonitoringStart) {
      this.onMonitoringStart();
    }

    return true;
  }

  /**
   * 再生の一時停止
   * @returns {boolean} 成功したかどうか
   */
  pauseReplay() {
    if (!this.replayingEnabled || !this.replaySessionUseCase) {
      return false;
    }

    this.logger.info('Pausing replay');
    return this.replaySessionUseCase.pause();
  }

  /**
   * 再生の再開
   * @returns {boolean} 成功したかどうか
   */
  resumeReplay() {
    if (!this.replayingEnabled || !this.replaySessionUseCase) {
      return false;
    }

    this.logger.info('Resuming replay');
    return this.replaySessionUseCase.play();
  }

  /**
   * 再生中かどうか
   * @returns {boolean}
   */
  isReplaying() {
    return this.replayingEnabled;
  }

  /**
   * 再生状態の詳細を取得
   * @returns {Object|null} 再生状態オブジェクト
   */
  getPlaybackStatus() {
    if (!this.replaySessionUseCase) {
      return null;
    }
    return this.replaySessionUseCase.getPlaybackStatus();
  }

  /**
   * 再生完了イベントハンドラーのセットアップ
   * @private
   */
  _setupPlaybackCompletedHandler() {
    if (!this.eventBus) {
      this.logger.warn('EventBus not available for playback completed handler');
      return;
    }

    // 再生完了イベントをリッスン
    this.eventBus.on('playbackCompleted', () => {
      this.logger.info('Playback completed event received');

      // 状態を更新
      this.replayingEnabled = false;

      // モニタリングを再開
      if (this.onMonitoringStart) {
        this.logger.info('Resuming monitoring after playback completed');
        this.onMonitoringStart();
      }
    });
  }
}
