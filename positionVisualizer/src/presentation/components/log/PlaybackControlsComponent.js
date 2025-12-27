/**
 * PlaybackControlsComponent.js
 * ログ再生のコントロールUIコンポーネント
 */

import { EventBus } from '../../../infrastructure/services/EventBus.js';
import { AppLogger } from '../../../infrastructure/services/Logger.js';

/**
 * 再生コントロールコンポーネントクラス
 */
export class PlaybackControlsComponent {
  /**
   * PlaybackControlsComponentコンストラクタ
   * @param {string} containerId コンテナ要素のID
   * @param {Object} appController アプリケーションコントローラー
   * @param {Object} logReplayUseCase ログ再生ユースケース
   */
  constructor(containerId, appController, logReplayUseCase) {
    this.container = document.getElementById(containerId);
    this.appController = appController;
    this.logReplayUseCase = logReplayUseCase;
    this.logger = AppLogger.createLogger('PlaybackControlsComponent');

    this.elements = {
      controlsContainer: null,
      playbackControls: null,
      playPauseBtn: null,
      stopBtn: null,
      rewindBtn: null,
      skipBackBtn: null,
      skipForwardBtn: null,
      speedSelect: null,
      speedValue: null,
      progressContainer: null,
      progressBar: null,
      progressBarInner: null,
      progressTime: null,
      totalTime: null
    };

    // タイマー
    this.statusUpdateTimer = null;
    this.playbackStatus = null;
    this.isInitialized = false;

    // イベントハンドラ
    this._onPlayPauseClick = this._onPlayPauseClick.bind(this);
    this._onStopClick = this._onStopClick.bind(this);
    this._onRewindClick = this._onRewindClick.bind(this);
    this._onSkipBackClick = this._onSkipBackClick.bind(this);
    this._onSkipForwardClick = this._onSkipForwardClick.bind(this);
    this._onSpeedChange = this._onSpeedChange.bind(this);
    this._onProgressBarClick = this._onProgressBarClick.bind(this);

    // 初期化
    this._initialize();
  }

  /**
   * コンポーネントの初期化
   * @private
   */
  _initialize() {
    if (!this.container) {
      this.logger.error('Container element not found');
      return;
    }

    // すでに存在するコントロールを確認
    this.elements.playbackControls = document.getElementById('playback-controls');

    if (!this.elements.playbackControls) {
      // 存在しない場合は作成
      this._createPlaybackControlsUI();
    } else {
      // 既存のコントロールを使用する場合は要素を取得
      this._captureExistingElements();
    }

    // イベントリスナーの設定
    this._setupEventListeners();

    this.isInitialized = true;
  }

  /**
   * 再生コントロールUIの作成
   * @private
   */
  _createPlaybackControlsUI() {
    // メインコンテナ
    this.elements.playbackControls = document.createElement('div');
    this.elements.playbackControls.id = 'playback-controls';
    this.elements.playbackControls.className = 'playback-controls';

    // 上部コントロール（ボタンなど）
    const topControls = document.createElement('div');
    topControls.className = 'playback-top-controls';

    // 再生/一時停止ボタン
    this.elements.playPauseBtn = document.createElement('button');
    this.elements.playPauseBtn.id = 'play-pause';
    this.elements.playPauseBtn.className = 'control-button play-button';
    this.elements.playPauseBtn.innerHTML = '<span class="play-icon">▶</span>';
    this.elements.playPauseBtn.title = '再生/一時停止';
    topControls.appendChild(this.elements.playPauseBtn);

    // 停止ボタン
    this.elements.stopBtn = document.createElement('button');
    this.elements.stopBtn.id = 'stop';
    this.elements.stopBtn.className = 'control-button';
    this.elements.stopBtn.innerHTML = '<span class="stop-icon">■</span>';
    this.elements.stopBtn.title = '停止';
    topControls.appendChild(this.elements.stopBtn);

    // 5秒戻しボタン
    this.elements.skipBackBtn = document.createElement('button');
    this.elements.skipBackBtn.id = 'skip-back';
    this.elements.skipBackBtn.className = 'control-button skip-back-button';
    this.elements.skipBackBtn.innerHTML = '<span>⟪</span>';
    this.elements.skipBackBtn.title = '5秒戻る';
    topControls.appendChild(this.elements.skipBackBtn);

    // 5秒進みボタン
    this.elements.skipForwardBtn = document.createElement('button');
    this.elements.skipForwardBtn.id = 'skip-forward';
    this.elements.skipForwardBtn.className = 'control-button skip-forward-button';
    this.elements.skipForwardBtn.innerHTML = '<span>⟫</span>';
    this.elements.skipForwardBtn.title = '5秒進む';
    topControls.appendChild(this.elements.skipForwardBtn);

    // 巻き戻しボタン
    this.elements.rewindBtn = document.createElement('button');
    this.elements.rewindBtn.id = 'rewind';
    this.elements.rewindBtn.className = 'control-button';
    this.elements.rewindBtn.innerHTML = '<span class="rewind-icon">⟲</span>';
    this.elements.rewindBtn.title = '最初に戻る';
    topControls.appendChild(this.elements.rewindBtn);

    // 再生速度コントロール
    const speedControlContainer = document.createElement('div');
    speedControlContainer.className = 'speed-control-container';

    const speedLabel = document.createElement('span');
    speedLabel.textContent = '速度:';
    speedControlContainer.appendChild(speedLabel);

    // 再生速度セレクト
    this.elements.speedSelect = document.createElement('select');
    this.elements.speedSelect.id = 'speed-select';
    this.elements.speedSelect.className = 'speed-preset-select';

    // 再生速度オプション
    const speeds = [0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 5.0];
    speeds.forEach(speed => {
      const option = document.createElement('option');
      option.value = speed;
      option.text = `${speed.toFixed(1)}x`;
      if (speed === 1.0) option.selected = true;
      this.elements.speedSelect.appendChild(option);
    });

    speedControlContainer.appendChild(this.elements.speedSelect);

    this.elements.speedValue = document.createElement('span');
    this.elements.speedValue.id = 'speed-value';
    this.elements.speedValue.textContent = '1.0x';
    speedControlContainer.appendChild(this.elements.speedValue);

    topControls.appendChild(speedControlContainer);

    // 上部コントロールをメインコンテナに追加
    this.elements.playbackControls.appendChild(topControls);

    // 進行状況表示
    this.elements.progressContainer = document.createElement('div');
    this.elements.progressContainer.className = 'progress-container';

    // 時間表示（経過時間）
    this.elements.progressTime = document.createElement('span');
    this.elements.progressTime.id = 'progress-time';
    this.elements.progressTime.className = 'time-display';
    this.elements.progressTime.textContent = '00:00';
    this.elements.progressContainer.appendChild(this.elements.progressTime);

    // プログレスバー
    this.elements.progressBar = document.createElement('div');
    this.elements.progressBar.id = 'progress-bar';
    this.elements.progressBar.className = 'progress-bar';

    this.elements.progressBarInner = document.createElement('div');
    this.elements.progressBarInner.className = 'progress-bar-inner';
    this.elements.progressBar.appendChild(this.elements.progressBarInner);

    this.elements.progressContainer.appendChild(this.elements.progressBar);

    // 時間表示（合計時間）
    this.elements.totalTime = document.createElement('span');
    this.elements.totalTime.id = 'total-time';
    this.elements.totalTime.className = 'time-display';
    this.elements.totalTime.textContent = '00:00';
    this.elements.progressContainer.appendChild(this.elements.totalTime);

    // 進行状況表示をメインコンテナに追加
    this.elements.playbackControls.appendChild(this.elements.progressContainer);

    // メインコンテナを親要素に追加
    this.container.appendChild(this.elements.playbackControls);
  }

  /**
   * 既存の要素を取得
   * @private
   */
  _captureExistingElements() {
    this.elements.playPauseBtn = document.getElementById('play-pause');
    this.elements.stopBtn = document.getElementById('stop');
    this.elements.rewindBtn = document.getElementById('rewind');
    this.elements.skipBackBtn = document.getElementById('skip-back');
    this.elements.skipForwardBtn = document.getElementById('skip-forward');
    this.elements.speedSelect = document.getElementById('speed-select');
    this.elements.speedValue = document.getElementById('speed-value');
    this.elements.progressContainer = document.querySelector('.progress-container');
    this.elements.progressBar = document.getElementById('progress-bar');
    this.elements.progressBarInner = this.elements.progressBar ? this.elements.progressBar.querySelector('.progress-bar-inner') : null;
    this.elements.progressTime = document.getElementById('progress-time');
    this.elements.totalTime = document.getElementById('total-time');
  }

  /**
   * イベントリスナーの設定
   * @private
   */
  _setupEventListeners() {
    // ボタンのイベント
    if (this.elements.playPauseBtn) {
      this.elements.playPauseBtn.addEventListener('click', this._onPlayPauseClick);
    }

    if (this.elements.stopBtn) {
      this.elements.stopBtn.addEventListener('click', this._onStopClick);
    }

    if (this.elements.rewindBtn) {
      this.elements.rewindBtn.addEventListener('click', this._onRewindClick);
    }

    if (this.elements.skipBackBtn) {
      this.elements.skipBackBtn.addEventListener('click', this._onSkipBackClick);
    }

    if (this.elements.skipForwardBtn) {
      this.elements.skipForwardBtn.addEventListener('click', this._onSkipForwardClick);
    }

    // 再生速度のイベント
    if (this.elements.speedSelect) {
      this.elements.speedSelect.addEventListener('change', this._onSpeedChange);
    }

    // プログレスバーのイベント
    if (this.elements.progressBar) {
      this.elements.progressBar.addEventListener('click', this._onProgressBarClick);
    }

    // アプリケーションイベント
    EventBus.on('playbackStarted', this._onPlaybackStarted.bind(this));
    EventBus.on('playbackPaused', this._onPlaybackPaused.bind(this));
    EventBus.on('playbackStopped', this._onPlaybackStopped.bind(this));
    EventBus.on('playbackCompleted', this._onPlaybackCompleted.bind(this));
    EventBus.on('playbackSeeked', this._updateProgressBar.bind(this));
  }

  /**
   * 再生/一時停止ボタンクリックイベントハンドラ
   * @private
   */
  async _onPlayPauseClick() {
    this.logger.debug('Play/Pause clicked');

    try {
      const status = this.logReplayUseCase.getPlaybackStatus();

      if (!status.isPlaying) {
        // 再生開始
        await this.logReplayUseCase.play();
        this._setPlaybackStatus(true);
        this._startStatusUpdateTimer();
      } else if (status.isPaused) {
        // 一時停止から再開
        await this.logReplayUseCase.play();
        this._setPlaybackStatus(true);
        this._startStatusUpdateTimer();
      } else {
        // 一時停止
        await this.logReplayUseCase.pause();
        this._setPlaybackStatus(false, true);
        this._stopStatusUpdateTimer();
      }
    } catch (error) {
      this.logger.error('Error handling play/pause:', error);
    }
  }

  /**
   * 停止ボタンクリックイベントハンドラ
   * @private
   */
  async _onStopClick() {
    this.logger.debug('Stop clicked');

    try {
      await this.logReplayUseCase.stop();
      this._setPlaybackStatus(false);
      this._stopStatusUpdateTimer();
      this._resetProgressBar();
    } catch (error) {
      this.logger.error('Error handling stop:', error);
    }
  }

  /**
   * 巻き戻しボタンクリックイベントハンドラ
   * @private
   */
  async _onRewindClick() {
    this.logger.debug('Rewind clicked');

    try {
      await this.logReplayUseCase.rewind();
      this._updateProgressBar({ position: 0 });
    } catch (error) {
      this.logger.error('Error handling rewind:', error);
    }
  }

  /**
   * 5秒戻しボタンクリックイベントハンドラ
   * @private
   */
  async _onSkipBackClick() {
    this.logger.debug('Skip back clicked');

    try {
      await this.logReplayUseCase.seekBySeconds(-5);
    } catch (error) {
      this.logger.error('Error handling skip back:', error);
    }
  }

  /**
   * 5秒進みボタンクリックイベントハンドラ
   * @private
   */
  async _onSkipForwardClick() {
    this.logger.debug('Skip forward clicked');

    try {
      await this.logReplayUseCase.seekBySeconds(5);
    } catch (error) {
      this.logger.error('Error handling skip forward:', error);
    }
  }

  /**
   * 再生速度変更イベントハンドラ
   * @private
   */
  async _onSpeedChange() {
    const speed = parseFloat(this.elements.speedSelect.value);
    this.logger.debug(`Speed changed to ${speed}x`);

    try {
      await this.logReplayUseCase.setPlaybackSpeed(speed);

      if (this.elements.speedValue) {
        this.elements.speedValue.textContent = `${speed.toFixed(1)}x`;
      }
    } catch (error) {
      this.logger.error('Error changing playback speed:', error);
    }
  }

  /**
   * プログレスバークリックイベントハンドラ
   * @private
   * @param {Event} event クリックイベント
   */
  async _onProgressBarClick(event) {
    if (!this.elements.progressBar) return;

    const rect = this.elements.progressBar.getBoundingClientRect();
    const position = (event.clientX - rect.left) / rect.width;

    this.logger.debug(`Seek to position: ${position.toFixed(2)}`);

    try {
      await this.logReplayUseCase.seekToPosition(position);
    } catch (error) {
      this.logger.error('Error seeking to position:', error);
    }
  }

  /**
   * 再生開始イベントハンドラ
   * @private
   */
  _onPlaybackStarted() {
    this.logger.debug('Playback started event received');
    this._setPlaybackStatus(true);
    this._startStatusUpdateTimer();
    this._updateTotalDuration();
  }

  /**
   * 再生一時停止イベントハンドラ
   * @private
   */
  _onPlaybackPaused() {
    this.logger.debug('Playback paused event received');
    this._setPlaybackStatus(false, true);
    this._stopStatusUpdateTimer();
  }

  /**
   * 再生停止イベントハンドラ
   * @private
   */
  _onPlaybackStopped() {
    this.logger.debug('Playback stopped event received');
    this._setPlaybackStatus(false);
    this._stopStatusUpdateTimer();
    this._resetProgressBar();
  }

  /**
   * 再生完了イベントハンドラ
   * @private
   */
  _onPlaybackCompleted() {
    this.logger.debug('Playback completed event received');
    this._setPlaybackStatus(false);
    this._stopStatusUpdateTimer();
    this._updateProgressBar({ position: 1.0 });
  }

  /**
   * 再生状態の設定
   * @private
   * @param {boolean} isPlaying 再生中かどうか
   * @param {boolean} isPaused 一時停止中かどうか
   */
  _setPlaybackStatus(isPlaying, isPaused = false) {
    if (!this.elements.playPauseBtn) return;

    if (isPlaying && !isPaused) {
      this.elements.playPauseBtn.innerHTML = '<span class="pause-icon">⏸</span>';
      this.elements.playPauseBtn.title = '一時停止';
      this.elements.playPauseBtn.classList.remove('play-button');
      this.elements.playPauseBtn.classList.add('pause-button');
      this.elements.playbackControls.classList.add('is-playing');
    } else if (isPaused) {
      this.elements.playPauseBtn.innerHTML = '<span class="play-icon">▶</span>';
      this.elements.playPauseBtn.title = '再生再開';
      this.elements.playPauseBtn.classList.add('play-button');
      this.elements.playPauseBtn.classList.remove('pause-button');
      this.elements.playbackControls.classList.remove('is-playing');
    } else {
      this.elements.playPauseBtn.innerHTML = '<span class="play-icon">▶</span>';
      this.elements.playPauseBtn.title = '再生';
      this.elements.playPauseBtn.classList.add('play-button');
      this.elements.playPauseBtn.classList.remove('pause-button');
      this.elements.playbackControls.classList.remove('is-playing');
    }
  }

  /**
   * 状態更新タイマーの開始
   * @private
   */
  _startStatusUpdateTimer() {
    if (this.statusUpdateTimer) {
      clearInterval(this.statusUpdateTimer);
    }

    this.statusUpdateTimer = setInterval(() => {
      this._updatePlaybackStatus();
    }, 100); // 100msごとに更新
  }

  /**
   * 状態更新タイマーの停止
   * @private
   */
  _stopStatusUpdateTimer() {
    if (this.statusUpdateTimer) {
      clearInterval(this.statusUpdateTimer);
      this.statusUpdateTimer = null;
    }
  }

  /**
   * 再生状態の更新
   * @private
   */
  _updatePlaybackStatus() {
    try {
      const status = this.logReplayUseCase.getPlaybackStatus();
      this.playbackStatus = status;

      // プログレスバー更新
      this._updateProgressBar({ position: status.progress });

      // 経過時間表示
      if (this.elements.progressTime && status.elapsedTime !== undefined) {
        const elapsedTime = this._formatTime(status.elapsedTime);
        this.elements.progressTime.textContent = elapsedTime;
      }
    } catch (error) {
      this.logger.error('Error updating playback status:', error);
    }
  }

  /**
   * 総再生時間の更新
   * @private
   */
  _updateTotalDuration() {
    try {
      const status = this.logReplayUseCase.getPlaybackStatus();
      if (this.elements.totalTime && status.totalDuration) {
        const totalTime = this._formatTime(status.totalDuration);
        this.elements.totalTime.textContent = totalTime;
      }
    } catch (error) {
      this.logger.error('Error updating total duration:', error);
    }
  }

  /**
   * プログレスバーの更新
   * @private
   * @param {Object} data イベントデータ
   */
  _updateProgressBar(data) {
    if (!this.elements.progressBarInner) return;

    const position = data.position || 0;
    this.elements.progressBarInner.style.width = `${position * 100}%`;
  }

  /**
   * プログレスバーのリセット
   * @private
   */
  _resetProgressBar() {
    this._updateProgressBar({ position: 0 });

    if (this.elements.progressTime) {
      this.elements.progressTime.textContent = this._formatTime(0);
    }
  }

  /**
   * 時間のフォーマット（ミリ秒→MM:SS形式）
   * @private
   * @param {number} timeMs ミリ秒
   * @returns {string} フォーマットされた時間
   */
  _formatTime(timeMs) {
    const totalSeconds = Math.floor(timeMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  /**
   * コンポーネントの表示
   */
  show() {
    if (this.elements.playbackControls) {
      this.elements.playbackControls.style.display = 'block';
      this.logger.debug('PlaybackControls表示状態を設定しました');
    } else {
      this.logger.warn('playbackControls要素が見つからないため表示できません');
    }
  }

  /**
   * コンポーネントの非表示
   */
  hide() {
    if (this.elements.playbackControls) {
      this.elements.playbackControls.style.display = 'none';
      this.logger.debug('PlaybackControlsを非表示にしました');
    }
  }

  /**
   * コンポーネントの破棄
   */
  destroy() {
    // タイマーの停止
    this._stopStatusUpdateTimer();

    // イベントリスナーの削除
    if (this.elements.playPauseBtn) {
      this.elements.playPauseBtn.removeEventListener('click', this._onPlayPauseClick);
    }

    if (this.elements.stopBtn) {
      this.elements.stopBtn.removeEventListener('click', this._onStopClick);
    }

    if (this.elements.rewindBtn) {
      this.elements.rewindBtn.removeEventListener('click', this._onRewindClick);
    }

    if (this.elements.skipBackBtn) {
      this.elements.skipBackBtn.removeEventListener('click', this._onSkipBackClick);
    }

    if (this.elements.skipForwardBtn) {
      this.elements.skipForwardBtn.removeEventListener('click', this._onSkipForwardClick);
    }

    if (this.elements.speedSelect) {
      this.elements.speedSelect.removeEventListener('change', this._onSpeedChange);
    }

    if (this.elements.progressBar) {
      this.elements.progressBar.removeEventListener('click', this._onProgressBarClick);
    }

    // EventBusのイベントリスナーも解除すべきだがこのサンプルでは省略
  }
}