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
    if (!this.sessionData || this.sessionData.entries.length === 0) {
      this.logger.warn('No session data loaded');
      return false;
    }

    // すでに再生中の場合は何もしない
    if (this.isPlaying && !this.isPaused) {
      return true;
    }

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
   * 再生停止
   * @returns {boolean} 成功したかどうか
   */
  stop() {
    if (!this.isPlaying) {
      return false;
    }

    // タイマーをクリア
    if (this.nextEntryTimeout) {
      clearTimeout(this.nextEntryTimeout);
      this.nextEntryTimeout = null;
    }

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
    if (!entry || !entry.deviceId) return;

    try {
      // ライブモードの場合は現在時刻を使用
      const timestamp = this.options.liveMode ? Date.now() : entry.timestamp;

      // デバイス値を送信
      this._sendValueToDevice(entry.deviceId, entry.value, timestamp);

      // イベント通知
      EventBus.emit('entryPlayed', {
        deviceId: entry.deviceId,
        value: entry.value,
        index: this.currentIndex,
        progress: this._calculateProgress(),
        timestamp
      });

      // 10エントリごとに進捗を通知
      if (this.currentIndex % 10 === 0 || this.currentIndex === this.sessionData.entries.length - 1) {
        EventBus.emit('playbackProgress', {
          sessionId: this.currentSessionId,
          currentIndex: this.currentIndex,
          totalEntries: this.sessionData.entries.length,
          progress: this._calculateProgress()
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
    // 値を正規化
    const normalizedValue = this._normalizeValue(value);

    // 値リポジトリに保存
    this.valueRepository.saveValue(deviceId, {
      ...normalizedValue,
      timestamp
    }).catch(error => {
      this.logger.error(`Error sending value to device ${deviceId}:`, error);
    });
  }

  /**
   * 値の正規化
   * @param {Object} value 値
   * @returns {Object} 正規化された値
   * @private
   */
  _normalizeValue(value) {
    if (!value) return { rawValue: null, normalizedValue: null };

    // すでに正規化された形式の場合
    if (value.rawValue !== undefined || value.normalizedValue !== undefined) {
      return {
        rawValue: value.rawValue !== undefined ? value.rawValue : null,
        normalizedValue: value.normalizedValue !== undefined ? value.normalizedValue : null
      };
    }

    // raw/normalizedキーを持つ場合
    if (value.raw !== undefined || value.normalized !== undefined) {
      return {
        rawValue: value.raw !== undefined ? value.raw : null,
        normalizedValue: value.normalized !== undefined ? value.normalized : null
      };
    }

    // 数値の場合
    if (typeof value === 'number') {
      return {
        rawValue: value,
        normalizedValue: value
      };
    }

    // その他の場合
    return {
      rawValue: null,
      normalizedValue: null,
      ...value
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
   * 再生完了時の処理
   * @private
   */
  _handlePlaybackComplete() {
    this.isPlaying = false;
    this.isPaused = false;

    this.logger.info('Playback completed');

    // イベント通知
    EventBus.emit('playbackCompleted', {
      sessionId: this.currentSessionId,
      entryCount: this.sessionData.entries.length
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