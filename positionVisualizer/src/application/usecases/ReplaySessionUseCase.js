/**
 * ReplaySessionUseCase.js
 * 記録されたセッションを再生するユースケース
 * セッションデータの再生と制御を担当
 */

import { AppLogger } from '../../infrastructure/services/Logger.js';
import { EventBus } from '../../infrastructure/services/EventBus.js';

/**
 * セッション再生のユースケースクラス
 */
export class ReplaySessionUseCase {
  /**
   * セッション再生ユースケースのコンストラクタ
   * @param {Object} sessionRepository セッションリポジトリ
   * @param {Object} valueRepository 値リポジトリ
   * @param {Object} options オプション設定
   */
  constructor(sessionRepository, valueRepository, options = {}) {
    this.sessionRepository = sessionRepository;
    this.valueRepository = valueRepository;
    this.options = {
      autoRewind: true,              // 再生完了後に自動的に巻き戻すか
      replaySpeedMultiplier: 1.0,    // 再生速度倍率（1.0 = 等速）
      liveMode: false,               // ライブモード（相対時間ではなく現在時間で再生）
      ...options
    };

    // 再生状態
    this.isPlaying = false;
    this.isPaused = false;
    this.currentSessionId = null;
    this.sessionData = null;
    this.currentIndex = 0;
    this.startTime = null;
    this.playbackTimer = null;
    this.nextEntryTimeout = null;

    // ロガー
    this.logger = AppLogger.createLogger('ReplaySessionUseCase');
  }

  /**
   * セッションをロード
   * @param {string} sessionId セッションID
   * @param {boolean} autoPlay 自動再生するかどうか
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async loadSession(sessionId) {
    try {
      // 現在再生中の場合は停止
      if (this.isPlaying) {
        this.stop();
      }

      this.logger.info(`Loading session: ${sessionId}`);

      // セッションデータをロード
      const sessionData = await this.sessionRepository.getSession(sessionId);

      if (!sessionData || !sessionData.entries || !sessionData.entries.length) {
        this.logger.warn(`No valid data in session: ${sessionId}`);
        return false;
      }

      // セッションデータをソート（相対時間順）
      const sortedEntries = [...sessionData.entries].sort((a, b) => {
        return a.relativeTime - b.relativeTime;
      });

      // セッション情報を設定
      this.currentSessionId = sessionId;
      this.sessionData = {
        ...sessionData,
        entries: sortedEntries
      };
      this.currentIndex = 0;
      this.startTime = null;

      // デバッグ: セッションの内容を確認
      this.logger.debug('Session metadata:', {
        deviceCount: sessionData.metadata?.deviceCount || 0,
        entriesCount: sortedEntries.length,
        deviceInfo: sessionData.metadata?.deviceInfo || {},
        devices: new Set(sortedEntries.map(entry => entry.deviceId))
      });

      // 最初と最後のエントリをログに出力
      if (sortedEntries.length > 0) {
        this.logger.debug('First entry:', sortedEntries[0]);
        this.logger.debug('Last entry:', sortedEntries[sortedEntries.length - 1]);
      }

      this.logger.info(`Loaded session with ${sortedEntries.length} entries`);

      // イベント通知
      EventBus.emit('sessionLoaded', {
        sessionId,
        entryCount: sortedEntries.length,
        duration: this.getSessionDuration()
      });

      return true;
    } catch (error) {
      this.logger.error(`Error loading session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * 再生開始
   * @returns {boolean} 成功したかどうか
   */
  play() {
    if (!this.sessionData || !this.sessionData.entries || this.sessionData.entries.length === 0) {
      this.logger.warn('No session data loaded or entries is empty');
      return false;
    }

    // すでに再生中の場合は現在の状態を返す
    if (this.isPlaying && !this.isPaused) {
      this.logger.debug('Already playing, returning current state');
      return true;
    }

    // 安全のために既存のタイマーをクリア
    if (this.nextEntryTimeout) {
      this.logger.debug('Clearing existing entry timeout');
      clearTimeout(this.nextEntryTimeout);
      this.nextEntryTimeout = null;
    }

    // 統計情報の定期更新を開始
    this._startStatsUpdateInterval();

    // 一時停止中の場合は再開
    if (this.isPlaying && this.isPaused) {
      this.isPaused = false;
      this.startTime = Date.now() - this._getAdjustedTimeForCurrentIndex();

      this.logger.info(`Resuming playback at index ${this.currentIndex}`);
      this._scheduleNextEntry();

      // イベント通知
      EventBus.emit('playbackResumed', {
        sessionId: this.currentSessionId,
        currentIndex: this.currentIndex,
        progress: this._calculateProgress()
      });

      return true;
    }

    // 最後まで再生していた場合は巻き戻す
    if (this.currentIndex >= this.sessionData.entries.length) {
      this.rewind();
    }

    // 再生開始
    this.isPlaying = true;
    this.isPaused = false;
    this.startTime = Date.now();

    this.logger.info(`Starting playback from index ${this.currentIndex}`);

    // 最初のエントリを再生
    this._scheduleNextEntry();

    // イベント通知
    EventBus.emit('playbackStarted', {
      sessionId: this.currentSessionId,
      entryCount: this.sessionData.entries.length
    });

    return true;
  }

  /**
   * 一時停止
   * @returns {boolean} 成功したかどうか
   */
  pause() {
    if (!this.isPlaying || this.isPaused) {
      return false;
    }

    this.isPaused = true;

    // 次のエントリのタイマーをクリア
    if (this.nextEntryTimeout) {
      clearTimeout(this.nextEntryTimeout);
      this.nextEntryTimeout = null;
    }

    this.logger.info(`Paused playback at index ${this.currentIndex}`);

    // イベント通知
    EventBus.emit('playbackPaused', {
      sessionId: this.currentSessionId,
      currentIndex: this.currentIndex,
      progress: this._calculateProgress()
    });

    return true;
  }

  /**
   * 統計情報の定期更新を開始
   * @private
   */
  _startStatsUpdateInterval() {
    // 既存のインターバルを停止
    this._stopStatsUpdateInterval();

    // 統計情報の更新インターバル（500ms）
    this.statsUpdateInterval = setInterval(() => {
      if (this.isPlaying) {
        this._updateStatsDisplay();
      }
    }, 500);

    // 初回の統計情報を表示
    this._updateStatsDisplay();
  }

  /**
   * 統計情報の定期更新を停止
   * @private
   */
  _stopStatsUpdateInterval() {
    if (this.statsUpdateInterval) {
      clearInterval(this.statsUpdateInterval);
      this.statsUpdateInterval = null;
    }
  }

  stop() {
    if (!this.isPlaying) {
      return false;
    }

    // タイマーをクリア
    if (this.nextEntryTimeout) {
      clearTimeout(this.nextEntryTimeout);
      this.nextEntryTimeout = null;
    }

    // 統計情報の更新を停止
    this._stopStatsUpdateInterval();

    const wasPlaying = this.isPlaying;
    this.isPlaying = false;
    this.isPaused = false;

    if (wasPlaying) {
      this.logger.info('Stopped playback');

      // イベント通知
      EventBus.emit('playbackStopped', {
        sessionId: this.currentSessionId,
        currentIndex: this.currentIndex,
        progress: this._calculateProgress()
      });
    }

    return true;
  }

  /**
   * 巻き戻し
   * @returns {boolean} 成功したかどうか
   */
  rewind() {
    if (!this.sessionData) {
      return false;
    }

    const wasPlaying = this.isPlaying && !this.isPaused;

    // 再生中なら一度停止
    if (wasPlaying) {
      this.stop();
    }

    // インデックスをリセット
    this.currentIndex = 0;
    this.startTime = null;

    this.logger.info('Rewound playback to beginning');

    // イベント通知
    EventBus.emit('playbackRewound', {
      sessionId: this.currentSessionId
    });

    // 再生中だった場合は再開
    if (wasPlaying) {
      return this.play();
    }

    return true;
  }

  /**
   * 指定秒数だけ進む/戻る
   * @param {number} secondsOffset 秒数（正=進む、負=戻る）
   * @returns {boolean} 成功したかどうか
   */
  seekBySeconds(secondsOffset) {
    if (!this.sessionData || !this.sessionData.entries.length) {
      return false;
    }

    // 現在の時間（ms）
    const currentTime = this._getAdjustedTimeForCurrentIndex();

    // 目標時間（ms）- 秒をミリ秒に変換して加算
    const targetTime = currentTime + (secondsOffset * 1000);

    // セッション総時間
    const totalDuration = this.getSessionDuration();

    // 残り時間（ms）を計算
    const remainingTime = totalDuration - currentTime;
    const adjustedRemainingTime = remainingTime / this.options.replaySpeedMultiplier;

    // 前進方向で残り時間が要求された秒数より少ない場合、完了処理を行う
    if (secondsOffset > 0 && adjustedRemainingTime <= (secondsOffset * 1000)) {
      this.logger.info(`Seeking beyond end of playback (${secondsOffset}s requested, only ${adjustedRemainingTime / 1000}s remaining)`);

      // 最後のエントリにジャンプし、再生を停止
      this.currentIndex = this.sessionData.entries.length - 1;
      const finalEntry = this.sessionData.entries[this.currentIndex];

      // 最後のエントリを再生
      if (finalEntry) {
        this._playEntry(finalEntry);
      }

      // 再生完了の処理を実行
      this._handlePlaybackComplete();
      return true;
    }

    // 0-1の範囲に収める（通常のケース）
    const newPosition = Math.max(0, Math.min(1, targetTime / (totalDuration / this.options.replaySpeedMultiplier)));

    this.logger.debug(`Seeking by ${secondsOffset} seconds, from position ${currentTime}ms to ${targetTime}ms (${newPosition.toFixed(2)} of playback)`);

    // 位置へシーク
    return this.seekToPosition(newPosition);
  }

  /**
   * 特定の時間位置にシーク
   * @param {number} position 0-1の間の相対位置
   * @returns {boolean} 成功したかどうか
   */
  seekToPosition(position) {
    if (!this.sessionData || !this.sessionData.entries.length) {
      return false;
    }

    // 0-1の範囲に制限
    position = Math.max(0, Math.min(1, position));

    const wasPlaying = this.isPlaying && !this.isPaused;

    // 再生中なら一度停止
    if (wasPlaying) {
      this.stop();
    }

    // セッションの総時間を計算
    const sessionDuration = this.getSessionDuration();
    const targetTime = sessionDuration * position;

    // 目標時間に最も近いエントリを探す
    let newIndex = 0;
    for (let i = 0; i < this.sessionData.entries.length; i++) {
      if (this.sessionData.entries[i].relativeTime <= targetTime) {
        newIndex = i;
      } else {
        break;
      }
    }

    this.currentIndex = newIndex;

    this.logger.info(`Seeked to position ${position.toFixed(2)} (index: ${newIndex})`);

    // イベント通知
    EventBus.emit('playbackSeeked', {
      sessionId: this.currentSessionId,
      currentIndex: this.currentIndex,
      position,
      time: targetTime
    });

    // 再生中だった場合は再開
    if (wasPlaying) {
      return this.play();
    }

    return true;
  }

  /**
   * 再生速度の設定
   * @param {number} speed 再生速度（1.0 = 等速）
   * @returns {boolean} 成功したかどうか
   */
  setPlaybackSpeed(speed) {
    if (speed <= 0) {
      return false;
    }

    const oldSpeed = this.options.replaySpeedMultiplier;
    this.options.replaySpeedMultiplier = speed;

    const wasPlaying = this.isPlaying && !this.isPaused;

    // 再生中の場合は一度停止して再開
    if (wasPlaying) {
      // 現在の相対時間を保存
      const currentTime = this._getAdjustedTimeForCurrentIndex();

      // 再生を停止
      this.stop();

      // 新しい開始時間を計算
      this.startTime = Date.now() - currentTime;

      // 再生を再開
      this.play();
    }

    this.logger.info(`Playback speed changed from ${oldSpeed}x to ${speed}x`);

    // イベント通知
    EventBus.emit('playbackSpeedChanged', {
      sessionId: this.currentSessionId,
      oldSpeed,
      newSpeed: speed
    });

    return true;
  }

  /**
   * ライブモードの設定
   * @param {boolean} enabled ライブモードを有効にするか
   * @returns {boolean} 成功したかどうか
   */
  setLiveMode(enabled) {
    const wasPreviouslyEnabled = this.options.liveMode;
    this.options.liveMode = Boolean(enabled);

    this.logger.info(`Live mode ${enabled ? 'enabled' : 'disabled'}`);

    // イベント通知
    EventBus.emit('liveModeChanged', {
      sessionId: this.currentSessionId,
      enabled: this.options.liveMode
    });

    return wasPreviouslyEnabled !== this.options.liveMode;
  }

  /**
   * 再生状態の取得
   * @returns {Object} 再生状態
   */
  getPlaybackStatus() {
    if (!this.sessionData) {
      return {
        loaded: false,
        isPlaying: false,
        isPaused: false,
        sessionId: null,
        entryCount: 0,
        currentIndex: 0,
        progress: 0,
        speed: this.options.replaySpeedMultiplier,
        liveMode: this.options.liveMode
      };
    }

    return {
      loaded: true,
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
      sessionId: this.currentSessionId,
      entryCount: this.sessionData.entries.length,
      currentIndex: this.currentIndex,
      progress: this._calculateProgress(),
      currentTime: this._getAdjustedTimeForCurrentIndex(),
      totalDuration: this.getSessionDuration(),
      speed: this.options.replaySpeedMultiplier,
      liveMode: this.options.liveMode
    };
  }

  /**
   * セッションの総時間を取得（ミリ秒）
   * @returns {number} 総時間（ミリ秒）
   */
  getSessionDuration() {
    if (!this.sessionData || !this.sessionData.entries.length) {
      return 0;
    }

    const lastEntry = this.sessionData.entries[this.sessionData.entries.length - 1];
    return lastEntry.relativeTime || 0;
  }

  /**
   * 次のエントリをスケジュール
   * @private
   */
  _scheduleNextEntry() {
    if (!this.isPlaying || this.isPaused || !this.sessionData) {
      return;
    }

    // タイマーをクリア
    if (this.nextEntryTimeout) {
      clearTimeout(this.nextEntryTimeout);
      this.nextEntryTimeout = null;
    }

    // 最後まで再生した場合
    if (this.currentIndex >= this.sessionData.entries.length) {
      this._handlePlaybackComplete();
      return;
    }

    // 現在のエントリを取得
    const currentEntry = this.sessionData.entries[this.currentIndex];

    // 現在の経過時間を計算
    const elapsedTime = Date.now() - this.startTime;

    // 調整された相対時間を計算
    const adjustedRelativeTime = currentEntry.relativeTime / this.options.replaySpeedMultiplier;

    // 次のエントリを再生するタイミングを計算
    const delay = Math.max(0, adjustedRelativeTime - elapsedTime);

    // タイマーをセット
    this.nextEntryTimeout = setTimeout(() => {
      this._playEntry(currentEntry);
      this.currentIndex++;
      this._scheduleNextEntry();
    }, delay);
  }

  /**
   * エントリの再生
   * @param {Object} entry エントリ
   * @private
   */
  _playEntry(entry) {
    if (!entry || !entry.deviceId) {
      this.logger.warn('Invalid entry for playback:', entry);
      return;
    }

    try {
      // より詳細なデバッグ情報
      this.logger.debug(`Playing entry for device ${entry.deviceId}:`, {
        value: entry.value,
        timestamp: entry.timestamp,
        relativeTime: entry.relativeTime,
        index: this.currentIndex,
        isValueDefined: entry.value !== undefined && entry.value !== null
      });

      if (!entry.value) {
        this.logger.warn(`Entry for device ${entry.deviceId} has no value`);
      }

      // ライブモードの場合は現在時刻を使用
      const timestamp = this.options.liveMode ? Date.now() : entry.timestamp;

      // デバイス値を送信
      this._sendValueToDevice(entry.deviceId, entry.value, timestamp);

      // deviceValueUpdatedイベントも発行してUIを強制的に更新（値の変更を反映させるため）
      EventBus.emit('deviceValueUpdated', {
        deviceId: entry.deviceId,
        value: this._normalizeValue(entry.value)
      });

      // イベント通知
      const entryInfo = {
        deviceId: entry.deviceId,
        value: entry.value,
        index: this.currentIndex,
        progress: this._calculateProgress(),
        timestamp
      };
      EventBus.emit('entryPlayed', entryInfo);

      // デバッグ表示用: 再生中の値を小さく表示
      this._showDebugValues(entry.deviceId, this._normalizeValue(entry.value), this.currentIndex);

      // 進捗通知（頻度を上げる）
      if (this.currentIndex % 5 === 0 || this.currentIndex === this.sessionData.entries.length - 1) {
        const progress = this._calculateProgress();
        this.logger.debug(`Replay progress: ${(progress * 100).toFixed(1)}%, entry ${this.currentIndex}/${this.sessionData.entries.length}`);

        EventBus.emit('playbackProgress', {
          sessionId: this.currentSessionId,
          currentIndex: this.currentIndex,
          totalEntries: this.sessionData.entries.length,
          progress: progress
        });
      }
    } catch (error) {
      this.logger.error(`Error playing entry at index ${this.currentIndex}:`, error);
    }
  }

  /**
   * デバイスに値を送信
   * @param {string} deviceId デバイスID
   * @param {Object} value 値
   * @param {number} timestamp タイムスタンプ
   * @private
   */
  _sendValueToDevice(deviceId, value, timestamp) {
    if (!deviceId) {
      this.logger.error('Cannot send value: deviceId is undefined');
      return;
    }

    // デバッグ: 入力値の確認
    this.logger.debug(`Raw input value for device ${deviceId}:`, {
      value,
      valueType: typeof value,
      isNull: value === null,
      isUndefined: value === undefined,
      hasProperties: value && typeof value === 'object' ? Object.keys(value) : 'N/A'
    });

    try {
      // 値を正規化
      const normalizedValue = this._normalizeValue(value);

      this.logger.debug(`Sending normalized value to device ${deviceId}:`, {
        ...normalizedValue,
        timestamp
      });

      // 値リポジトリに保存
      if (this.valueRepository && typeof this.valueRepository.saveValue === 'function') {
        this.valueRepository.saveValue(deviceId, {
          ...normalizedValue,
          timestamp
        }).then(() => {
          this.logger.debug(`Successfully saved value for device ${deviceId}`);
        }).catch(error => {
          this.logger.error(`Error sending value to device ${deviceId}:`, error);
        });
      } else {
        this.logger.error(`ValueRepository is not available or saveValue is not a function`);
      }
    } catch (error) {
      this.logger.error(`Error processing value for device ${deviceId}:`, error);
    }

    // デバッグ: ValueRepositoryに現在の値が保存されているかを確認
    setTimeout(async () => {
      try {
        const currentValue = await this.valueRepository.getCurrentValue(deviceId);
        this.logger.debug(`Current value for device ${deviceId} after save:`, currentValue);
      } catch (error) {
        this.logger.error(`Error checking current value for device ${deviceId}:`, error);
      }
    }, 100);
  }

  /**
   * 値の正規化
   * @param {Object} value 値
   * @returns {Object} 正規化された値
   * @private
   */
  _normalizeValue(value) {
    if (!value) {
      this.logger.warn('Normalizing null/undefined value');
      return { rawValue: null, normalizedValue: null };
    }

    this.logger.debug('Normalizing value:', value);

    let rawValue = null;
    let normalizedValue = null;

    // すでに正規化された形式の場合
    if (value.rawValue !== undefined || value.normalizedValue !== undefined) {
      rawValue = value.rawValue !== undefined ? value.rawValue : null;
      normalizedValue = value.normalizedValue !== undefined ? value.normalizedValue : null;
    }
    // raw/normalizedキーを持つ場合
    else if (value.raw !== undefined || value.normalized !== undefined) {
      rawValue = value.raw !== undefined ? value.raw : null;
      normalizedValue = value.normalized !== undefined ? value.normalized : null;
    }
    // 数値の場合
    else if (typeof value === 'number') {
      rawValue = value;
      normalizedValue = value;
    }
    // その他のケース（オブジェクトの場合はプロパティを展開）
    else if (typeof value === 'object') {
      rawValue = null;
      normalizedValue = null;
      // 他のプロパティがあれば保持
      Object.keys(value).forEach(key => {
        if (key !== 'rawValue' && key !== 'normalizedValue' && key !== 'raw' && key !== 'normalized') {
          this[key] = value[key];
        }
      });
    }

    // 値が整数/数値に変換可能かチェック
    if (rawValue !== null && typeof rawValue === 'string') {
      const numValue = Number(rawValue);
      if (!isNaN(numValue)) {
        rawValue = numValue;
      }
    }

    if (normalizedValue !== null && typeof normalizedValue === 'string') {
      const numValue = Number(normalizedValue);
      if (!isNaN(numValue)) {
        normalizedValue = numValue;
      }
    }

    // 正規化された値がなくても生値があれば正規化
    if (normalizedValue === null && rawValue !== null) {
      try {
        normalizedValue = Number(rawValue);
      } catch (e) {
        this.logger.warn('Failed to convert raw value to number:', e);
      }
    }

    // どちらの値も取得できなかった場合（0も有効な値として扱う）
    if (normalizedValue === null && rawValue === null && typeof value === 'object') {
      // オブジェクト内の他のプロパティを探す
      if (value.value !== undefined) {
        normalizedValue = Number(value.value);
        rawValue = Number(value.value);
      } else if (value.calibrated_value !== undefined) {
        normalizedValue = Number(value.calibrated_value);
        rawValue = Number(value.calibrated_value);
      } else if (value.smoothed !== undefined) {
        normalizedValue = Number(value.smoothed);
        rawValue = Number(value.smoothed);
      }
    }

    // それでも取得できなかった場合は0を使用（動きを見せるため）
    if (normalizedValue === null && rawValue === null) {
      this.logger.warn('Could not extract any value from:', value);
      // 最低でもログに何かを表示するために0を使用
      normalizedValue = 0;
      rawValue = 0;
    }

    this.logger.debug('Normalized to:', { rawValue, normalizedValue });

    return {
      rawValue,
      normalizedValue
    };
  }

  /**
   * 進捗率の計算（0-1）
   * @returns {number} 進捗率
   * @private
   */
  _calculateProgress() {
    if (!this.sessionData || !this.sessionData.entries.length) {
      return 0;
    }

    if (this.currentIndex >= this.sessionData.entries.length) {
      return 1;
    }

    return this.currentIndex / this.sessionData.entries.length;
  }

  /**
   * 現在のインデックスに対する調整済み時間を取得
   * @returns {number} 調整済み時間（ミリ秒）
   * @private
   */
  _getAdjustedTimeForCurrentIndex() {
    if (!this.sessionData || !this.sessionData.entries.length || this.currentIndex === 0) {
      return 0;
    }

    if (this.currentIndex >= this.sessionData.entries.length) {
      return this.getSessionDuration() / this.options.replaySpeedMultiplier;
    }

    const currentEntry = this.sessionData.entries[this.currentIndex];
    return currentEntry.relativeTime / this.options.replaySpeedMultiplier;
  }

  /**
   * 現在ロードされているセッションデータを取得
   * @returns {Object|null} セッションデータまたはnull
   */
  getSessionData() {
    return this.sessionData;
  }

  /**
   * 再生統計情報を表示するためのUIを更新
   * @param {Object} stats 統計情報
   * @private
   */
  _updateStatsDisplay(stats = null) {
    // 強制的にステータスを取得
    if (!stats) {
      stats = this.getPlaybackStatus();
    }

    // 既存のステータス表示を取得または作成
    let statsDisplay = document.getElementById('replay-stats-display');
    if (!statsDisplay) {
      statsDisplay = document.createElement('div');
      statsDisplay.id = 'replay-stats-display';
      statsDisplay.style.position = 'fixed';
      statsDisplay.style.top = '10px';
      statsDisplay.style.right = '10px';
      statsDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
      statsDisplay.style.color = 'white';
      statsDisplay.style.padding = '8px';
      statsDisplay.style.borderRadius = '5px';
      statsDisplay.style.fontSize = '12px';
      statsDisplay.style.fontFamily = 'monospace';
      statsDisplay.style.zIndex = '9999';
      document.body.appendChild(statsDisplay);

      // ヘッダーを追加
      const header = document.createElement('div');
      header.style.fontWeight = 'bold';
      header.style.marginBottom = '5px';
      header.textContent = 'ログ再生統計';
      statsDisplay.appendChild(header);

      // 閉じるボタン
      const closeButton = document.createElement('button');
      closeButton.textContent = '×';
      closeButton.style.position = 'absolute';
      closeButton.style.top = '2px';
      closeButton.style.right = '5px';
      closeButton.style.backgroundColor = 'transparent';
      closeButton.style.border = 'none';
      closeButton.style.color = 'white';
      closeButton.style.fontSize = '14px';
      closeButton.style.cursor = 'pointer';
      closeButton.onclick = () => {
        statsDisplay.style.display = 'none';
      };
      statsDisplay.appendChild(closeButton);
    }

    // 再生中でなければ表示しない
    if (!this.isPlaying && !this.isPaused) {
      statsDisplay.style.display = 'none';
      return;
    } else {
      statsDisplay.style.display = 'block';
    }

    // 統計情報の内容を更新
    let content = '';

    // セッション情報
    if (stats.sessionId) {
      content += `<div><strong>セッションID:</strong> ${stats.sessionId}</div>`;
    }

    // 進捗情報
    const progressPercent = (stats.progress * 100).toFixed(1);
    const currentEntry = stats.currentIndex + 1;
    const totalEntries = stats.entryCount;
    content += `<div><strong>進捗:</strong> ${progressPercent}% (${currentEntry}/${totalEntries})</div>`;

    // 時間情報
    const currentTime = (stats.currentTime / 1000).toFixed(1);
    const totalDuration = (stats.totalDuration / 1000).toFixed(1);
    content += `<div><strong>時間:</strong> ${currentTime}s / ${totalDuration}s</div>`;

    // 再生速度
    content += `<div><strong>再生速度:</strong> ${stats.speed}x</div>`;

    // 再生状態
    const stateText = stats.isPaused ? '一時停止中' : '再生中';
    content += `<div><strong>状態:</strong> ${stateText}</div>`;

    // デバイス情報（もし利用可能なら）
    if (this.sessionData && this.sessionData.metadata && this.sessionData.metadata.deviceCount) {
      content += `<div><strong>デバイス数:</strong> ${this.sessionData.metadata.deviceCount}</div>`;
    }

    // 内容を更新
    statsDisplay.innerHTML = statsDisplay.innerHTML.split('<div><strong>').shift() + content;
  }

  /**
   * デバッグ用の値表示
   * @param {string} deviceId デバイスID
   * @param {Object} value 値
   * @param {number} index 現在のインデックス
   * @private
   */
  _showDebugValues(deviceId, value, index) {
    // デバッグ表示が既に存在する場合は更新、なければ作成
    let debugContainer = document.getElementById('replay-debug-values');

    if (!debugContainer) {
      debugContainer = document.createElement('div');
      debugContainer.id = 'replay-debug-values';
      debugContainer.style.position = 'fixed';
      debugContainer.style.bottom = '10px';
      debugContainer.style.left = '10px';
      debugContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
      debugContainer.style.color = 'white';
      debugContainer.style.padding = '5px';
      debugContainer.style.borderRadius = '5px';
      debugContainer.style.fontSize = '12px';
      debugContainer.style.fontFamily = 'monospace';
      debugContainer.style.maxWidth = '300px';
      debugContainer.style.maxHeight = '200px';
      debugContainer.style.overflow = 'auto';
      debugContainer.style.zIndex = '9999';
      document.body.appendChild(debugContainer);
    }

    // デバイスごとの値表示要素を取得または作成
    let deviceValueElement = document.getElementById(`replay-debug-${deviceId}`);

    if (!deviceValueElement) {
      deviceValueElement = document.createElement('div');
      deviceValueElement.id = `replay-debug-${deviceId}`;
      deviceValueElement.style.margin = '2px 0';
      debugContainer.appendChild(deviceValueElement);
    }

    // 値を抽出
    let displayValue = 'N/A';
    if (value) {
      if (value.normalizedValue !== null && value.normalizedValue !== undefined) {
        displayValue = value.normalizedValue.toFixed(2);
      } else if (value.rawValue !== null && value.rawValue !== undefined) {
        displayValue = value.rawValue.toFixed(2);
      }
    }

    // 表示を更新
    deviceValueElement.innerHTML = `<strong>${deviceId}</strong>: ${displayValue} (エントリー: ${index + 1}/${this.sessionData?.entries?.length || 0})`;

    // 進行状況バーを更新/作成
    let progressBar = document.getElementById('replay-debug-progress');
    if (!progressBar) {
      progressBar = document.createElement('div');
      progressBar.id = 'replay-debug-progress';
      progressBar.style.width = '100%';
      progressBar.style.height = '5px';
      progressBar.style.backgroundColor = '#333';
      progressBar.style.marginTop = '5px';
      progressBar.style.position = 'relative';
      debugContainer.appendChild(progressBar);

      const progressIndicator = document.createElement('div');
      progressIndicator.id = 'replay-debug-progress-indicator';
      progressIndicator.style.height = '100%';
      progressIndicator.style.backgroundColor = '#4CAF50';
      progressIndicator.style.width = '0%';
      progressBar.appendChild(progressIndicator);
    }

    // 進捗インジケータを更新
    const progress = this._calculateProgress();
    const progressIndicator = document.getElementById('replay-debug-progress-indicator');
    if (progressIndicator) {
      progressIndicator.style.width = `${Math.round(progress * 100)}%`;
    }
  }

  /**
   * 再生完了時の処理
   * @private
   */
  _handlePlaybackComplete() {
    this.isPlaying = false;
    this.isPaused = false;

    this.logger.info('Playback completed');

    // デバッグ表示をクリーンアップ
    const debugContainer = document.getElementById('replay-debug-values');
    if (debugContainer) {
      setTimeout(() => {
        debugContainer.style.transition = 'opacity 1s';
        debugContainer.style.opacity = '0';
        setTimeout(() => {
          if (debugContainer.parentNode) {
            debugContainer.parentNode.removeChild(debugContainer);
          }
        }, 1000);
      }, 3000);
    }

    // 統計情報の更新を停止
    this._stopStatsUpdateInterval();

    // イベント通知
    EventBus.emit('playbackCompleted', {
      sessionId: this.currentSessionId,
      entryCount: this.sessionData.entries.length,
      autoStopped: true
    });

    // UIに再生が完全に終了したことを通知
    EventBus.emit('playbackFullyStopped', {
      sessionId: this.currentSessionId
    });

    // 自動巻き戻し
    if (this.options.autoRewind) {
      this.logger.info('Auto-rewinding playback');
      setTimeout(() => {
        this.rewind();
      }, 500);
    }
  }
}