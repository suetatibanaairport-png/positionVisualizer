/**
 * LogReplayUseCase.js
 * ログ再生に関するユースケース
 */

import { EventTypes } from '../../domain/events/EventTypes.js';
// 注: IEventBus, ILogger はドメイン層のインターフェース
// 実装はAppBootstrapで注入される

/**
 * ログ再生ユースケースクラス
 */
export class LogReplayUseCase {
  /**
   * LogReplayUseCaseコンストラクタ
   * @param {Object} logSessionRepository ログセッションリポジトリ
   * @param {Object} eventBus イベントバス（IEventBus実装）
   * @param {Object} logger ロガー（ILogger実装）
   * @param {Object} options オプション設定
   */
  constructor(logSessionRepository, eventBus, logger, options = {}) {
    this.logSessionRepository = logSessionRepository;
    this.eventBus = eventBus;
    this.logger = logger || { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };
    this.options = options;

    // 再生の状態
    this.currentSessionId = null;
    this.currentSession = null;
    this.isPlaying = false;
    this.isPaused = false;
    this.playbackSpeed = 1.0;
    this.currentPosition = 0;
    this.playbackTimer = null;
    this.entries = [];
    this.currentEntryIndex = 0;
    this.startTime = 0;
    this.pauseTime = 0;
    this.totalDuration = 0;
    this.isPlaybackMode = false; // 再生モードフラグを追加
  }

  /**
   * セッションをロード
   * @param {string} sessionId セッションID
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async loadSession(sessionId) {
    try {
      // 既に再生中の場合はまず停止
      if (this.isPlaying) {
        this.stop();
      }

      // セッションを取得
      const session = await this.logSessionRepository.getSession(sessionId);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      // セッションデータを保存
      this.currentSessionId = sessionId;
      this.currentSession = session;
      this.entries = [...session.entries].sort((a, b) => a.relativeTime - b.relativeTime);
      this.currentEntryIndex = 0;
      this.totalDuration = this._calculateTotalDuration();

      this.logger.info(`Loaded session ${sessionId} with ${this.entries.length} entries`);
      return true;
    } catch (error) {
      this.logger.error(`Error loading session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * 再生を開始
   */
  play() {
    if (!this.currentSession) {
      this.logger.warn('No session loaded');
      return false;
    }

    if (this.isPlaying && !this.isPaused) {
      this.logger.debug('Already playing');
      return true;
    }

    if (this.isPaused) {
      // 一時停止からの再開
      this.isPaused = false;
      this.startTime = Date.now() - (this.pauseTime - this.startTime);
      this.logger.debug('Resumed playback');
    } else {
      // 新規再生
      this.isPlaying = true;
      this.currentEntryIndex = 0;
      this.startTime = Date.now();
      this.logger.debug('Started playback');
    }

    // 再生モードをセット
    this.isPlaybackMode = true;
    this.eventBus.emit('playbackModeChanged', { isPlaybackMode: true });
    this.logger.debug('再生モード ON に設定しました');

    // 再生タイマーを設定
    this._startPlaybackTimer();

    // イベント通知
    this.eventBus.emit('playbackStarted', { sessionId: this.currentSessionId });

    return true;
  }

  /**
   * 一時停止
   */
  pause() {
    if (!this.isPlaying || this.isPaused) {
      return false;
    }

    this.isPaused = true;
    this.pauseTime = Date.now();

    // タイマーをクリア
    if (this.playbackTimer) {
      clearTimeout(this.playbackTimer);
      this.playbackTimer = null;
    }

    this.logger.debug('Paused playback');
    this.eventBus.emit('playbackPaused', {});
    return true;
  }

  /**
   * 停止
   */
  stop() {
    if (!this.isPlaying) {
      return false;
    }

    this.isPlaying = false;
    this.isPaused = false;

    // タイマーをクリア
    if (this.playbackTimer) {
      clearTimeout(this.playbackTimer);
      this.playbackTimer = null;
    }

    // 再生モードを解除
    this.isPlaybackMode = false;
    this.eventBus.emit('playbackModeChanged', { isPlaybackMode: false });
    this.logger.debug('再生モード OFF に設定しました');

    this.logger.info('Stopped playback');
    this.eventBus.emit('playbackStopped', {});
    this.eventBus.emit('playbackFullyStopped', {});
    return true;
  }

  /**
   * 巻き戻し
   */
  rewind() {
    this.currentEntryIndex = 0;
    this.currentPosition = 0;
    this.logger.debug('Rewound playback');
    this.eventBus.emit('playbackRewound', {});
    return true;
  }

  /**
   * 再生速度の設定
   * @param {number} speed 再生速度（0.1～10.0）
   */
  setPlaybackSpeed(speed) {
    if (speed < 0.1) speed = 0.1;
    if (speed > 10.0) speed = 10.0;
    this.playbackSpeed = speed;
    this.logger.debug(`Set playback speed to ${speed}x`);
    return true;
  }

  /**
   * 位置を指定して移動
   * @param {number} position 位置（0.0～1.0）
   */
  seekToPosition(position) {
    if (!this.currentSession || this.entries.length === 0) {
      return false;
    }

    if (position < 0) position = 0;
    if (position > 1) position = 1;

    this.currentPosition = position;

    // 位置に対応するエントリインデックスを計算
    const targetTime = this.totalDuration * position;
    let index = 0;

    for (let i = 0; i < this.entries.length; i++) {
      if (this.entries[i].relativeTime > targetTime) {
        break;
      }
      index = i;
    }

    this.currentEntryIndex = index;
    this.logger.debug(`Seeked to position ${position.toFixed(2)} (index ${index})`);
    this.eventBus.emit('playbackSeeked', { position, entryIndex: index });
    return true;
  }

  /**
   * 秒数を指定して移動
   * @param {number} seconds 秒数（正または負）
   */
  seekBySeconds(seconds) {
    if (!this.currentSession || this.entries.length === 0 || this.totalDuration === 0) {
      return false;
    }

    const currentTime = this.totalDuration * this.currentPosition;
    const targetTime = currentTime + seconds * 1000; // ミリ秒に変換

    const position = Math.max(0, Math.min(1, targetTime / this.totalDuration));
    return this.seekToPosition(position);
  }

  /**
   * 現在の再生状態を取得
   * @returns {Object} 再生状態
   */
  getPlaybackStatus() {
    let elapsedTime = 0;

    if (this.isPlaying) {
      if (this.isPaused) {
        elapsedTime = this.pauseTime - this.startTime;
      } else {
        elapsedTime = Date.now() - this.startTime;
      }
    }

    return {
      loaded: this.currentSession !== null,
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
      currentEntryIndex: this.currentEntryIndex,
      totalEntries: this.entries.length,
      progress: this.currentPosition,
      speed: this.playbackSpeed,
      elapsedTime,
      totalDuration: this.totalDuration
    };
  }

  /**
   * セッションデータを取得
   * @returns {Object|null} セッションデータまたはnull
   */
  getSessionData() {
    return this.currentSession;
  }

  /**
   * 再生タイマーを開始
   * @private
   */
  _startPlaybackTimer() {
    if (this.playbackTimer) {
      clearTimeout(this.playbackTimer);
    }

    // 次のエントリを処理
    this._processNextEntry();
  }

  /**
   * 次のエントリを処理
   * @private
   */
  _processNextEntry() {
    if (!this.isPlaying || this.isPaused || this.currentEntryIndex >= this.entries.length) {
      // 再生終了
      if (this.currentEntryIndex >= this.entries.length) {
        this.isPlaying = false;

        // 再生モードを解除
        this.isPlaybackMode = false;
        this.eventBus.emit('playbackModeChanged', { isPlaybackMode: false });
        this.logger.debug('再生終了により再生モードを OFF に設定しました');

        this.logger.info('Playback completed');
        this.eventBus.emit('playbackCompleted', {});
        this.eventBus.emit('playbackFullyStopped', {});
      }
      return;
    }

    const currentEntry = this.entries[this.currentEntryIndex];
    const nextEntry = this.entries[this.currentEntryIndex + 1];

    // 現在の位置を更新
    if (this.totalDuration > 0) {
      this.currentPosition = currentEntry.relativeTime / this.totalDuration;
    }

    // イベント発行（デバイス値の更新）- 再生元であることを明示

    // 後方互換性のための値の変換（一時的対処）
    let valueToSend = currentEntry.value;

    // 古い形式のログファイル（raw/normalized）の場合、新しい形式（rawValue/normalizedValue）に変換
    if (valueToSend && valueToSend.raw !== undefined && valueToSend.rawValue === undefined) {
      valueToSend = {
        rawValue: valueToSend.raw,
        normalizedValue: valueToSend.normalized !== undefined ? valueToSend.normalized : null,
        timestamp: valueToSend.timestamp || Date.now(),
        deviceId: currentEntry.deviceId
      };
    }

    // 値をそのまま使用する（sourceプロパティは不要に）
    // デバイス値の更新イベントを再生用の特別なイベントとして発行
    this.eventBus.emit(EventTypes.DEVICE_VALUE_REPLAYED, {
      deviceId: currentEntry.deviceId,
      value: valueToSend,
      metadata: {
        timestamp: Date.now(),
        entryIndex: this.currentEntryIndex,
        sessionId: this.currentSessionId
      }
    });

    // 次のエントリがある場合は、間隔を計算して次のタイマーを設定
    if (nextEntry) {
      const interval = (nextEntry.relativeTime - currentEntry.relativeTime) / this.playbackSpeed;
      this.currentEntryIndex++;

      this.playbackTimer = setTimeout(() => {
        this._processNextEntry();
      }, interval);
    } else {
      // 最後のエントリ
      this.currentEntryIndex++;
      this._processNextEntry(); // 終了処理のために再度呼び出し
    }
  }

  /**
   * 総再生時間を計算
   * @private
   * @returns {number} 総再生時間（ミリ秒）
   */
  _calculateTotalDuration() {
    if (this.entries.length === 0) {
      return 0;
    }

    // 最後のエントリと最初のエントリの時間差
    const firstEntryTime = this.entries[0].relativeTime;
    const lastEntryTime = this.entries[this.entries.length - 1].relativeTime;
    return lastEntryTime - firstEntryTime;
  }
}