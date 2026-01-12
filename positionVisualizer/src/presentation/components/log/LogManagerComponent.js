/**
 * LogManagerComponent.js
 * ログ管理のUIコンポーネント
 */

import { EventBus } from '../../../infrastructure/services/EventBus.js';
import { AppLogger } from '../../../infrastructure/services/Logger.js';

/**
 * ログ管理コンポーネントクラス
 */
export class LogManagerComponent {
  /**
   * LogManagerComponentコンストラクタ
   * @param {string} containerId コンテナ要素のID
   * @param {Object} appController アプリケーションコントローラー
   * @param {Object} logService ログサービス
   */
  constructor(containerId, appController, logService) {
    this.container = document.getElementById(containerId);
    this.appController = appController;
    this.logService = logService;
    this.logger = AppLogger.createLogger('LogManagerComponent');

    // 処理状態フラグ
    this.isProcessingClick = false;
    this._updatingUIState = false;

    // 再生モード用のデバイス設定保存（グローバル変数からクラスプロパティに移動）
    this.originalDeviceSettings = null;
    this.replayDevices = null;

    this.elements = {
      logManager: null,
      showLogReplayBtn: null,
      startRecordBtn: null,
      stopRecordBtn: null,
      recordStatusText: null,
      logReplayComponent: null,
      closeLogReplayBtn: null,
      logFileInput: null,
      logFileInfo: null,
      playbackControlsContainer: null
    };

    // イベントハンドラ
    this._onShowLogReplayClick = this._onShowLogReplayClick.bind(this);
    this._onCloseLogReplayClick = this._onCloseLogReplayClick.bind(this);
    this._onStartRecordClick = this._onStartRecordClick.bind(this);
    this._onStopRecordClick = this._onStopRecordClick.bind(this);
    this._onFileSelected = this._onFileSelected.bind(this);

    // コンポーネントの初期化
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

    // 既存のHTML構造がある場合は要素を取得
    this.elements.logManager = document.querySelector('.log-manager');
    this.elements.showLogReplayBtn = document.getElementById('show-log-replay');
    this.elements.recordStatusText = document.getElementById('log-record-status');

    // IDまたはクラス名で取得（動的に生成されるコンポーネント）
    this.elements.logReplayComponent = document.querySelector('#log-replay-component-dynamic') || document.querySelector('.log-replay-component');

    this.elements.closeLogReplayBtn = document.getElementById('close-log-replay');
    this.elements.logFileInput = document.getElementById('log-file');
    this.elements.logFileInfo = document.getElementById('log-file-info');
    this.elements.playbackControlsContainer = document.getElementById('playback-controls-container');

    // HTML構造がない場合は作成
    if (!this.elements.logManager) {
      this._createLogManagerUI();
    }

    // イベントリスナーの設定
    this._setupEventListeners();

    // 初期状態の設定
    this._updateRecordingButtonsState();
  }

  /**
   * ログ管理UIの作成
   * @private
   */
  _createLogManagerUI() {
    // ログ管理セクション
    this.elements.logManager = document.createElement('div');
    this.elements.logManager.className = 'log-manager';

    // ヘッダー
    const header = document.createElement('h3');
    header.textContent = 'ログ管理';
    this.elements.logManager.appendChild(header);

    // ボタンコンテナ
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'log-manager-buttons';

    // ログ再生ボタン
    this.elements.showLogReplayBtn = document.createElement('button');
    this.elements.showLogReplayBtn.id = 'show-log-replay';
    this.elements.showLogReplayBtn.className = 'log-manager-button';
    this.elements.showLogReplayBtn.textContent = 'ログ再生';
    buttonContainer.appendChild(this.elements.showLogReplayBtn);

    // ログ記録開始ボタン
    this.elements.startRecordBtn = document.createElement('button');
    this.elements.startRecordBtn.id = 'start-record';
    this.elements.startRecordBtn.className = 'log-manager-button start-record-button';
    this.elements.startRecordBtn.textContent = '記録開始';
    buttonContainer.appendChild(this.elements.startRecordBtn);

    // ログ記録停止ボタン
    this.elements.stopRecordBtn = document.createElement('button');
    this.elements.stopRecordBtn.id = 'stop-record';
    this.elements.stopRecordBtn.className = 'log-manager-button stop-record-button';
    this.elements.stopRecordBtn.textContent = '記録停止';
    this.elements.stopRecordBtn.style.display = 'none'; // 初期状態では非表示
    buttonContainer.appendChild(this.elements.stopRecordBtn);

    this.elements.logManager.appendChild(buttonContainer);

    // 記録状態テキスト
    this.elements.recordStatusText = document.createElement('div');
    this.elements.recordStatusText.id = 'log-record-status';
    this.elements.recordStatusText.className = 'log-record-status';
    this.elements.recordStatusText.textContent = '停止中';
    this.elements.logManager.appendChild(this.elements.recordStatusText);

    // ログ再生コンポーネント
    this.elements.logReplayComponent = document.createElement('div');
    this.elements.logReplayComponent.id = 'log-replay-component-dynamic';
    this.elements.logReplayComponent.className = 'log-replay-component';
    this.elements.logReplayComponent.style.display = 'none';

    // ログ再生ヘッダー
    const logReplayHeader = document.createElement('div');
    logReplayHeader.className = 'log-replay-header';

    const logReplayTitle = document.createElement('h3');
    logReplayTitle.textContent = 'ログ再生';
    logReplayHeader.appendChild(logReplayTitle);

    this.elements.closeLogReplayBtn = document.createElement('button');
    this.elements.closeLogReplayBtn.id = 'close-log-replay';
    this.elements.closeLogReplayBtn.className = 'close-button';
    this.elements.closeLogReplayBtn.textContent = '×';
    logReplayHeader.appendChild(this.elements.closeLogReplayBtn);

    this.elements.logReplayComponent.appendChild(logReplayHeader);

    // ファイル選択部分
    const fileSelection = document.createElement('div');
    fileSelection.className = 'log-file-selection';

    const fileLabel = document.createElement('label');
    fileLabel.htmlFor = 'log-file';
    fileLabel.textContent = 'ログファイルを選択:';
    fileSelection.appendChild(fileLabel);

    // カスタムファイル選択コンテナ
    const customFileInput = document.createElement('div');
    customFileInput.className = 'custom-file-input';

    // 実際のファイル入力
    this.elements.logFileInput = document.createElement('input');
    this.elements.logFileInput.type = 'file';
    this.elements.logFileInput.id = 'log-file';
    this.elements.logFileInput.accept = 'application/json,.json';
    customFileInput.appendChild(this.elements.logFileInput);

    // カスタムボタン
    const customButton = document.createElement('div');
    customButton.className = 'custom-file-button';
    customButton.innerHTML = '<span class="icon">📁</span> ログファイルを選択';
    customFileInput.appendChild(customButton);

    fileSelection.appendChild(customFileInput);

    this.elements.logFileInfo = document.createElement('div');
    this.elements.logFileInfo.id = 'log-file-info';
    this.elements.logFileInfo.className = 'log-file-info';
    fileSelection.appendChild(this.elements.logFileInfo);

    this.elements.logReplayComponent.appendChild(fileSelection);

    // 再生コントロールコンテナ
    this.elements.playbackControlsContainer = document.createElement('div');
    this.elements.playbackControlsContainer.id = 'playback-controls-container';
    this.elements.logReplayComponent.appendChild(this.elements.playbackControlsContainer);

    // コンテナに追加
    this.container.appendChild(this.elements.logManager);
    this.container.appendChild(this.elements.logReplayComponent);
  }

  /**
   * イベントリスナーの設定
   * @private
   */
  _setupEventListeners() {
    // ログ再生ボタンクリック
    if (this.elements.showLogReplayBtn) {
      this.elements.showLogReplayBtn.addEventListener('click', this._onShowLogReplayClick);
    }

    // ログ再生クローズボタンクリック
    if (this.elements.closeLogReplayBtn) {
      this.elements.closeLogReplayBtn.addEventListener('click', this._onCloseLogReplayClick);
    }

    // ログ記録開始ボタンクリック
    if (this.elements.startRecordBtn) {
      this.elements.startRecordBtn.addEventListener('click', this._onStartRecordClick);
    }

    // ログ記録停止ボタンクリック
    if (this.elements.stopRecordBtn) {
      this.elements.stopRecordBtn.addEventListener('click', this._onStopRecordClick);
    }

    // ファイル選択イベント
    if (this.elements.logFileInput) {
      this.elements.logFileInput.addEventListener('change', this._onFileSelected);
    }

    // アプリケーションイベント（新しいイベント名を使用）
    EventBus.on('event:recording:started', () => this._updateRecordingUI(true));
    EventBus.on('event:recording:stopped', () => this._updateRecordingUI(false));
    EventBus.on('playbackCompleted', this._onPlaybackCompleted.bind(this));
    EventBus.on('playbackStopped', this._onPlaybackStopped.bind(this));
  }

  /**
   * ログ再生ボタンクリックイベントハンドラ
   * @private
   */
  _onShowLogReplayClick() {
    this.logger.debug('ログ再生ボタンがクリックされました');

    // 処理中なら早期リターン（イベント重複実行防止）
    if (this.isProcessingClick) {
      this.logger.debug('すでに処理中のため、ログ再生イベントをスキップします');
      return;
    }

    // 処理中フラグを設定
    this.isProcessingClick = true;

    try {
      if (!this.appController.isReplaying()) {
        this.logger.debug('ログ再生モードを開始します');

        // 1. ログ再生コンポーネントを表示（強制的に表示）
        if (this.elements.logReplayComponent) {
          this.elements.logReplayComponent.style.display = 'block';
          this.elements.logReplayComponent.style.visibility = 'visible';
          this.elements.logReplayComponent.style.opacity = '1';

          // Z-indexを設定して前面に表示
          this.elements.logReplayComponent.style.position = 'relative';
          this.elements.logReplayComponent.style.zIndex = '100';
        }

        // 2. 再生コントロールコンテナを明示的に表示
        if (this.elements.playbackControlsContainer) {
          this.elements.playbackControlsContainer.style.display = 'block';
          this.elements.playbackControlsContainer.style.visibility = 'visible';
          this.elements.playbackControlsContainer.style.opacity = '1';

          // Z-indexを設定して前面に表示
          this.elements.playbackControlsContainer.style.position = 'relative';
          this.elements.playbackControlsContainer.style.zIndex = '100';
        }

        // 3. ボタンのテキストを変更
        if (this.elements.showLogReplayBtn) {
          this.elements.showLogReplayBtn.textContent = '再生中...';
          this.elements.showLogReplayBtn.disabled = true; // 連続クリック防止
        }

        // 4. ログ記録ボタンを非表示
        if (this.elements.startRecordBtn) {
          this.elements.startRecordBtn.style.display = 'none';
        }
        if (this.elements.stopRecordBtn) {
          this.elements.stopRecordBtn.style.display = 'none';
        }

        // 5. ボタンのスタイルを変更してアクティブ状態を示す
        if (this.elements.logManager) {
          this.elements.logManager.classList.add('replaying-active');
        }

        // 6. デバイス一覧を表示状態にし、ログ再生モードであることを表示
        const deviceInputsContainer = document.getElementById('device-inputs');
        if (deviceInputsContainer) {
          deviceInputsContainer.style.display = 'flex';
          deviceInputsContainer.style.flexDirection = 'column';

          // ログ再生モードであることを示すラベルを追加（存在しなければ）
          if (!document.getElementById('log-replay-mode-label')) {
            const modeLabel = document.createElement('div');
            modeLabel.id = 'log-replay-mode-label';
            modeLabel.className = 'log-replay-mode-label';
            modeLabel.textContent = 'ログ再生モード';
            deviceInputsContainer.insertBefore(modeLabel, deviceInputsContainer.firstChild);
          }
        }

        // 7. コントロールコンポーネントの初期化を確認
        this._initializePlaybackControlsIfNeeded();

        // 8. ログ再生コンポーネントを前面に表示させるためのスタイル調整
        document.querySelectorAll('.log-replay-component, #log-replay-component-dynamic, #playback-controls-container, #playback-controls').forEach(el => {
          if (el) {
            el.style.display = 'block';
            el.style.visibility = 'visible';
            el.style.opacity = '1';
            el.style.position = 'relative';
            el.style.zIndex = '100';
          }
        });

        this.logger.debug('ログ再生コンポーネントの表示を設定しました');

        // 9. MutationObserverを設定して表示状態を監視
        this._setupVisibilityObserver();
      } else {
        // すでに再生中の場合は通知
        this._showNotification('すでにログ再生中です');

        // 再生中なので、コンポーネントの表示を確実に
        this._ensureReplayComponentsVisible();
      }
    } catch (error) {
      this.logger.error('ログ再生モード開始中にエラーが発生しました:', error);
    } finally {
      // 処理完了後、ボタンを有効化
      setTimeout(() => {
        if (this.elements.showLogReplayBtn) {
          this.elements.showLogReplayBtn.disabled = false;
        }
        // 処理中フラグをリセット
        this.isProcessingClick = false;
        this.logger.debug('ログ再生ボタン処理が完了しました');
      }, 1000);
    }
  }

  /**
   * 表示状態を監視するMutationObserverを設定
   * @private
   */
  _setupVisibilityObserver() {
    // 既存のObserverを切断
    if (this.visibilityObserver) {
      this.visibilityObserver.disconnect();
    }

    // 新しいObserverを作成
    this.visibilityObserver = new MutationObserver((mutations) => {
      if (this.appController.isReplaying()) {
        this._ensureReplayComponentsVisible();
      }
    });

    // 監視対象と設定
    const config = { attributes: true, attributeFilter: ['style'] };

    if (this.elements.logReplayComponent) {
      this.visibilityObserver.observe(this.elements.logReplayComponent, config);
    }

    // 静的なログ再生コンポーネントは削除されたため、監視コードは不要

    if (this.elements.playbackControlsContainer) {
      this.visibilityObserver.observe(this.elements.playbackControlsContainer, config);
    }

    const playbackControls = document.getElementById('playback-controls');
    if (playbackControls) {
      this.visibilityObserver.observe(playbackControls, config);
    }

    this.logger.debug('表示状態監視のObserverを設定しました');
  }

  /**
   * 再生コンポーネントの表示状態を確保
   * @private
   */
  _ensureReplayComponentsVisible() {
    if (!this.appController.isReplaying()) return;

    this.logger.debug('再生コンポーネントの表示状態を確保します');

    // ログ再生コンポーネント
    if (this.elements.logReplayComponent) {
      this.elements.logReplayComponent.style.display = 'block';
      this.elements.logReplayComponent.style.visibility = 'visible';
      this.elements.logReplayComponent.style.opacity = '1';
    }

    // 静的なログ再生コンポーネントは削除されたため、表示設定コードは不要

    // 再生コントロールコンテナ
    if (this.elements.playbackControlsContainer) {
      this.elements.playbackControlsContainer.style.display = 'block';
      this.elements.playbackControlsContainer.style.visibility = 'visible';
      this.elements.playbackControlsContainer.style.opacity = '1';
    }

    // 再生コントロール
    const playbackControls = document.getElementById('playback-controls');
    if (playbackControls) {
      playbackControls.style.display = 'block';
      playbackControls.style.visibility = 'visible';
      playbackControls.style.opacity = '1';
    }
  }

  /**
   * 必要に応じて再生コントロールを初期化
   * @private
   */
  _initializePlaybackControlsIfNeeded() {
    // 再生コントロールコンテナを明示的に表示
    if (this.elements.playbackControlsContainer) {
      this.elements.playbackControlsContainer.style.display = 'block';
      this.elements.playbackControlsContainer.style.visibility = 'visible';

      // playback-controlsが存在しなければUIComponentManager経由で初期化
      if (!document.getElementById('playback-controls')) {
        this.logger.debug('再生コントロールの初期化を試みます');
        if (this.appController?.uiComponentManager?.initializePlaybackControls) {
          const controls = this.appController.uiComponentManager.initializePlaybackControls('playback-controls-container');

          // コントロールが初期化されたら明示的に表示
          if (controls && typeof controls.show === 'function') {
            controls.show();
            this.logger.debug('再生コントロールを初期化して表示しました');
          }
        } else {
          this.logger.debug('UIComponentManager.initializePlaybackControlsが利用できません');
        }
      } else {
        this.logger.debug('既存の再生コントロールを使用します');
      }
    }
  }

  /**
   * ログ再生クローズボタンクリックイベントハンドラ
   * @private
   */
  async _onCloseLogReplayClick() {
    this.logger.debug('ログ再生コンポーネントを閉じます');

    // 再生中なら停止
    if (this.appController.isReplaying()) {
      await this.appController.stopReplay();
      this._showNotification('ログ再生を停止しました');
    }

    // UIの状態を元に戻す
    this._resetReplayUI();
  }

  /**
   * 再生UI状態のリセット
   * @private
   */
  _resetReplayUI() {
    this.logger.debug('再生UI状態をリセットします');

    // コンポーネントとボタンの状態を戻す
    if (this.elements.logReplayComponent) {
      this.elements.logReplayComponent.style.display = 'none';
    }

    if (this.elements.showLogReplayBtn) {
      this.elements.showLogReplayBtn.textContent = 'ログ再生';
      this.elements.showLogReplayBtn.disabled = false; // ボタンを有効化
    }

    if (this.elements.logManager) {
      this.elements.logManager.classList.remove('replaying-active');
    }

    // ログ記録ボタンを再表示
    if (this.elements.startRecordBtn) {
      this.elements.startRecordBtn.style.display = 'block';
    }
    if (this.elements.stopRecordBtn && this.appController && this.appController.isRecording()) {
      this.elements.stopRecordBtn.style.display = 'block';
    }

    // コントロール表示をクリア
    const controlsContainer = document.getElementById('playback-controls');
    if (controlsContainer) {
      controlsContainer.remove();
      this.logger.debug('再生コントロールを削除しました');
    }

    // ログ再生モードラベルを削除
    const modeLabel = document.getElementById('log-replay-mode-label');
    if (modeLabel) {
      modeLabel.remove();
      this.logger.debug('ログ再生モードラベルを削除しました');
    }

    // ファイル情報をクリア
    if (this.elements.logFileInfo) {
      this.elements.logFileInfo.textContent = '';
    }

    if (this.elements.logFileInput) {
      this.elements.logFileInput.value = '';
    }

    this.logger.debug('再生UI状態のリセットが完了しました');
  }

  /**
   * ログ記録開始ボタンクリックイベントハンドラ
   * @private
   */
  async _onStartRecordClick() {
    // 既に記録中なら何もしない（冪等性）
    if (this.appController.isRecording()) {
      this.logger.debug('既に記録中のため、記録開始処理をスキップします');
      return;
    }

    // 処理中なら早期リターン（イベント重複実行防止）
    if (this.isProcessingClick) {
      this.logger.debug('すでに処理中のため、記録開始イベントをスキップします');
      return;
    }

    // 処理中フラグを設定
    this.isProcessingClick = true;

    // ボタンを一時的に無効化して連続クリックを防止
    if (this.elements.startRecordBtn) {
      this.elements.startRecordBtn.disabled = true;
    }

    try {
      this.logger.debug('記録開始処理を実行します');
      const success = await this.appController.startRecording();

      if (success && this.appController.isRecording()) {
        // 記録開始ボタンを非表示、記録停止ボタンを表示
        this._showRecordingUI(true);
        this._showNotification('記録を開始しました');
        this.logger.debug('記録開始が成功し、UI状態を更新しました');
      } else {
        this.logger.warn('記録開始に失敗しました');
      }
    } catch (error) {
      this.logger.error('記録開始処理中にエラーが発生しました:', error);
    } finally {
      // 処理完了後、ボタンを有効化
      setTimeout(() => {
        if (this.elements.startRecordBtn) {
          this.elements.startRecordBtn.disabled = false;
        }
        // 処理中フラグをリセット
        this.isProcessingClick = false;
        this.logger.debug('記録開始処理が完了しました');
      }, 1000);
    }
  }

  /**
   * ログ記録停止ボタンクリックイベントハンドラ
   * @private
   */
  async _onStopRecordClick() {
    // 記録中でなければ何もしない（冪等性）
    if (!this.appController.isRecording()) {
      this.logger.debug('記録中でないため、記録停止処理をスキップします');
      return;
    }

    // 処理中なら早期リターン（イベント重複実行防止）
    if (this.isProcessingClick) {
      this.logger.debug('すでに処理中のため、記録停止イベントをスキップします');
      return;
    }

    // 処理中フラグを設定
    this.isProcessingClick = true;

    // ボタンを一時的に無効化して連続クリックを防止
    if (this.elements.stopRecordBtn) {
      this.elements.stopRecordBtn.disabled = true;
    }

    try {
      this.logger.debug('記録停止処理を実行します');
      const result = await this.appController.stopRecording();

      if (result && !this.appController.isRecording()) {
        // 記録停止ボタンを非表示、記録開始ボタンを表示
        this._showRecordingUI(false);
        this._showNotification('記録を停止しました');
        this.logger.debug('記録停止が成功し、UI状態を更新しました');
      } else {
        this.logger.warn('記録停止に失敗しました');
      }
    } catch (error) {
      this.logger.error('記録停止処理中にエラーが発生しました:', error);
    } finally {
      // 処理完了後、ボタンを有効化
      setTimeout(() => {
        if (this.elements.stopRecordBtn) {
          this.elements.stopRecordBtn.disabled = false;
        }
        // 処理中フラグをリセット
        this.isProcessingClick = false;
        this.logger.debug('記録停止処理が完了しました');
      }, 1000);
    }
  }

  /**
   * 記録UI状態の更新（イベントバス経由で呼び出される）
   * @private
   * @param {boolean} isRecording 記録中かどうか
   */
  _updateRecordingUI(isRecording) {
    // 既にUI更新中ならスキップ（循環呼び出し防止）
    if (this._updatingUIState) {
      this.logger.debug('UI更新中のため、重複呼び出しをスキップします');
      return;
    }

    // 安全にUIを更新
    this._updateRecordingUIWithoutStateChange(isRecording);

    // 分離したボタンのUIも更新
    this._showRecordingUI(isRecording);
  }

  /**
   * 状態変化を起こさないUI更新処理
   * @private
   * @param {boolean} isRecording 記録中かどうか
   */
  _updateRecordingUIWithoutStateChange(isRecording) {
    // 処理中フラグを設定
    this._updatingUIState = true;
    this.logger.debug(`UI状態を更新しています (記録状態: ${isRecording ? '記録中' : '停止中'})`);

    try {
      if (isRecording) {
        if (this.elements.recordStatusText) {
          this.elements.recordStatusText.textContent = '記録中...';
        }
        this.elements.logManager.classList.add('recording-active');
      } else {
        if (this.elements.recordStatusText) {
          this.elements.recordStatusText.textContent = '停止中';
        }
        this.elements.logManager.classList.remove('recording-active');
      }
    } finally {
      // 処理中フラグをリセット
      this._updatingUIState = false;
    }
  }

  /**
   * 記録/停止ボタンの表示・非表示を切り替える
   * @private
   * @param {boolean} isRecording 記録中かどうか
   */
  _showRecordingUI(isRecording) {
    // 処理中フラグを確認（二重処理防止）
    if (this._updatingUIState) {
      return;
    }

    this._updatingUIState = true;
    this.logger.debug(`記録ボタンの表示状態を更新します: ${isRecording ? '記録中' : '停止中'}`);

    try {
      if (isRecording) {
        // 記録中の場合：開始ボタンを非表示、停止ボタンを表示
        if (this.elements.startRecordBtn) {
          this.elements.startRecordBtn.style.display = 'none';
        }
        if (this.elements.stopRecordBtn) {
          this.elements.stopRecordBtn.style.display = 'block';
        }
      } else {
        // 停止中の場合：開始ボタンを表示、停止ボタンを非表示
        if (this.elements.startRecordBtn) {
          this.elements.startRecordBtn.style.display = 'block';
        }
        if (this.elements.stopRecordBtn) {
          this.elements.stopRecordBtn.style.display = 'none';
        }
      }
    } finally {
      this._updatingUIState = false;
    }
  }

  /**
   * ファイル選択イベントハンドラ
   * @private
   */
  async _onFileSelected() {
    this.logger.debug('ログファイルが選択されました');

    const file = this.elements.logFileInput.files && this.elements.logFileInput.files[0];
    if (!file) return;

    // 処理中フラグを設定して重複処理を防止
    if (this.isProcessingClick) {
      this.logger.debug('すでに処理中のため、ファイル選択処理をスキップします');
      return;
    }

    this.isProcessingClick = true;

    try {
      // ファイル情報を表示
      if (this.elements.logFileInfo) {
        this.elements.logFileInfo.textContent = `選択ファイル: ${file.name} (${(file.size / 1024).toFixed(1)} KB) - 読み込み中...`;
        this.elements.logFileInfo.style.color = '#5FADCF';
      }

      // コンポーネントの表示状態を確保
      this._ensureReplayComponentsVisible();

      // ログサービスを使用してファイルをロード
      const sessionId = await this.logService.loadLogFile(file);

      // デバイス情報を取得
      const devices = await this.logService.getDevicesFromSession(sessionId);

      // デバイス一覧を更新
      if (devices.length > 0) {
        // 元のデバイス設定を保存
        this.originalDeviceSettings = await this.appController.getAllDevices(true);
        this.replayDevices = devices;

        // デバイス設定UIを更新
        this._updateDeviceSettings(devices, true);

        // 再生を開始
        const replayStarted = await this.appController.startReplay(sessionId);
        if (replayStarted) {
          this._showNotification('ログ再生を開始しました');
          this.elements.showLogReplayBtn.textContent = '再生中...';
          this.elements.logManager.classList.add('replaying-active');

          // 再生コントロールを追加
          this._addPlaybackControls();

          // 少し遅延して再度表示状態を確保
          setTimeout(() => {
            this._ensureReplayComponentsVisible();
          }, 500);

          // MutationObserverを設定して表示状態を監視
          this._setupVisibilityObserver();
        } else {
          this._showErrorMessage('ログ再生の開始に失敗しました');
        }
      } else {
        this._showErrorMessage('ログファイルにデバイスデータが見つかりません');
      }
    } catch (error) {
      this.logger.error('ログ再生処理中にエラーが発生:', error);
      this._showErrorMessage(`ログの読み込みに失敗しました: ${error.message || '不明なエラー'}`);

      // エラー時でもログ再生UIは表示したままにする（別のファイルを選択できるように）
      if (this.elements.showLogReplayBtn) {
        this.elements.showLogReplayBtn.textContent = 'ログ再生';
      }

      if (this.elements.logManager) {
        this.elements.logManager.classList.remove('replaying-active');
      }
    } finally {
      // 処理中フラグをリセット
      setTimeout(() => {
        this.isProcessingClick = false;
        this.logger.debug('ファイル選択処理が完了しました');
      }, 1000);
    }
  }

  /**
   * 再生完了イベントハンドラ
   * @private
   */
  _onPlaybackCompleted() {
    this._handlePlaybackEnd('再生完了');
  }

  /**
   * 再生停止イベントハンドラ
   * @private
   */
  _onPlaybackStopped() {
    this._handlePlaybackEnd('再生停止');
  }

  /**
   * 再生終了共通処理
   * @private
   * @param {string} eventType イベントタイプ
   */
  async _handlePlaybackEnd(eventType) {
    this.logger.debug(`${eventType}イベントを受信、クリーンアップを開始`);

    // 処理中なら早期リターン（イベント重複実行防止）
    if (this.isProcessingClick) {
      this.logger.debug('すでに処理中のため、プレイバック終了処理をスキップします');
      return;
    }

    // 処理中フラグを設定
    this.isProcessingClick = true;

    try {
      // AppControllerの再生フラグが立っているか確認
      if (this.appController && this.appController.isReplaying()) {
        // 明示的に再生停止
        await this.appController.stopReplay();
        this.logger.debug('AppControllerの再生を停止しました');
      }

      // 再生デバイスデータ参照のクリア
      const wasReplayMode = this.replayDevices !== undefined;
      this.logger.debug(`再生モード状態: ${wasReplayMode}`);
      this.replayDevices = null;

      // デバイス一覧の表示を維持（フレックス表示を明示的に設定）
      const deviceInputsContainer = document.getElementById('device-inputs');
      if (deviceInputsContainer) {
        deviceInputsContainer.style.display = 'flex';
        deviceInputsContainer.style.flexDirection = 'column';
        deviceInputsContainer.style.visibility = 'visible';
        deviceInputsContainer.style.opacity = '1';
        this.logger.debug('デバイス一覧の表示設定を確認しました');
      }

      // 元のデバイス設定に戻す
      this.logger.debug('デバイス設定を元に戻します');
      try {
        if (this.originalDeviceSettings) {
          this.logger.debug('保存されていた元のデバイス設定を使用します');
          await this._updateDeviceSettings(this.originalDeviceSettings, false);
          this.originalDeviceSettings = null;
        } else {
          this.logger.debug('現在の接続デバイス情報を取得して設定します');
          const currentDevices = await this.appController.getAllDevices(true);
          await this._updateDeviceSettings(currentDevices, false);
        }
      } catch (deviceError) {
        this.logger.error('デバイス設定の復元中にエラー:', deviceError);
      }

      // モニタリングが停止していれば再開
      if (this.appController && !this.appController.isMonitoring?.()) {
        this.logger.debug('モニタリングを再開します');
        this.appController.startMonitoring();
      }

      // すべてのデバイスで接続状態を再確認
      await this._refreshDeviceConnectionStates();

      // UIの状態を元に戻す
      this._resetReplayUI();

      // 再生終了通知
      this._showNotification(`ログ再生を${eventType === 'playbackCompleted' ? '完了' : '停止'}しました`);

      this.logger.debug(`${eventType}のクリーンアップ処理が完了しました`);
    } catch (error) {
      this.logger.error(`${eventType}のクリーンアップ中にエラーが発生:`, error);
    } finally {
      // 処理中フラグをリセット
      setTimeout(() => {
        this.isProcessingClick = false;
      }, 1000);
    }
  }

  /**
   * すべてのデバイスの接続状態を更新
   * @private
   */
  async _refreshDeviceConnectionStates() {
    try {
      if (!this.appController) return;

      // 接続済みデバイス一覧を取得
      const connectedDevices = await this.appController.getAllDevices(true);

      this.logger.debug(`接続済みデバイス: ${connectedDevices.length}台`);

      if (connectedDevices.length > 0) {
        // MeterViewModelでデバイス状態を更新
        for (const device of connectedDevices) {
          if (!device || !device.id) continue;

          // デバイスインデックスを取得
          const deviceIndex = this.appController.meterViewModel.getDeviceIndex(device.id);
          if (deviceIndex >= 0) {
            // 接続状態を明示的に設定
            this.appController.meterViewModel.state.connected[deviceIndex] = true;

            // デバイス情報を設定
            if (device.name) {
              this.appController.meterViewModel.setName(deviceIndex, device.name);
            }
            if (device.iconUrl) {
              this.appController.meterViewModel.setIcon(deviceIndex, device.iconUrl);
            }

            // 表示状態を設定
            this.appController.meterViewModel.setVisible(deviceIndex, true);

            this.logger.debug(`デバイス ${device.id} の接続状態を更新しました`);
          }
        }

        // 状態変更を通知
        this.appController.meterViewModel._notifyChange();
      }
    } catch (error) {
      this.logger.error('デバイス接続状態更新中にエラー:', error);
    }
  }

  /**
   * デバイス設定の更新
   * @private
   * @param {Array} devices デバイスの配列
   * @param {boolean} isReplayMode ログ再生モードかどうか
   */
  _updateDeviceSettings(devices, isReplayMode = false) {
    // deviceListViewModelを使用して更新
    if (window.deviceListViewModel && typeof window.deviceListViewModel.updateDeviceList === 'function') {
      this.logger.debug('DeviceListViewModelを使用してデバイスリストを更新');
      window.deviceListViewModel.updateDeviceList(devices, isReplayMode);
    } else {
      this.logger.warn('DeviceListViewModel not available, cannot update device settings');

      // フォールバック: UIComponentManager経由でDeviceListViewModelを取得
      const deviceListVM = this.appController?.uiComponentManager?.getDeviceListViewModel();
      if (deviceListVM) {
        this.logger.debug('UIComponentManager経由でDeviceListViewModelを使用');
        try {
          deviceListVM.updateDeviceList(devices, isReplayMode);
        } catch (error) {
          this.logger.error('UIComponentManager経由のDeviceListViewModel更新に失敗:', error);
        }
      } else if (isReplayMode) {
        // 再生モードの場合は、MeterViewModelを直接更新
        this.logger.debug('フォールバック: MeterViewModelを直接更新');
        try {
          // デバイスごとに処理
          devices.forEach(device => {
            if (!device || !device.id) return;

            // MeterViewModelにデバイスを登録
            const deviceIndex = this.appController.meterViewModel.getOrAssignDeviceIndex(device.id);
            if (deviceIndex >= 0) {
              // デバイス情報を設定
              if (device.name) {
                this.appController.meterViewModel.setName(deviceIndex, device.name);
              }
              if (device.iconUrl) {
                this.appController.meterViewModel.setIcon(deviceIndex, device.iconUrl);
              }

              // 接続状態を設定
              this.appController.meterViewModel.state.connected[deviceIndex] = true;
              this.appController.meterViewModel.setVisible(deviceIndex, true);
            }
          });

          // 状態変更を通知
          this.appController.meterViewModel._notifyChange();
        } catch (fallbackError) {
          this.logger.error('フォールバック処理中のエラー:', fallbackError);
        }
      }
    }
  }

  /**
   * 再生コントロールを追加
   * @private
   */
  _addPlaybackControls() {
    // PlaybackControlsComponentの存在をチェック
    if (this.appController && this.appController.replaySessionUseCase) {
      this.logger.debug('再生コントロールを追加します');

      // 1. まずplayback-controls-containerが存在するかを確認し、表示状態に設定
      const container = document.getElementById('playback-controls-container');
      if (container) {
        // 明示的に表示設定（すべてのスタイル設定を強制的に行う）
        container.style.display = 'block';
        container.style.visibility = 'visible';
        container.style.opacity = '1';
        container.style.position = 'relative';
        container.style.zIndex = '10'; // 他の要素より前面に表示

        this.logger.debug('再生コントロールコンテナを表示状態に設定しました');
      } else {
        this.logger.warn('再生コントロールコンテナが見つかりません');
        return; // コンテナがなければ終了
      }

      // 2. 'playback-controls-container'にPlaybackControlsComponentが存在するかチェック
      const existingControls = document.getElementById('playback-controls');
      if (!existingControls) {
        this.logger.debug('PlaybackControlsComponentを新規初期化します');

        // UIComponentManager経由でPlaybackControlsComponentを初期化
        if (this.appController?.uiComponentManager?.initializePlaybackControls) {
          // 初期化して結果を保存
          const controls = this.appController.uiComponentManager.initializePlaybackControls('playback-controls-container');

          if (controls) {
            // コントロールが初期化されたら明示的に表示
            if (typeof controls.show === 'function') {
              controls.show();
              this.logger.debug('再生コントロールを表示設定しました');
            }

            // 追加の表示設定（念のため）
            const playbackControls = document.getElementById('playback-controls');
            if (playbackControls) {
              playbackControls.style.display = 'block';
              playbackControls.style.visibility = 'visible';
              playbackControls.style.opacity = '1';
              this.logger.debug('再生コントロールのDOM要素に直接表示スタイルを設定しました');
            } else {
              this.logger.warn('再生コントロールが正しく作成されませんでした');
            }
          } else {
            this.logger.warn('再生コントロールの初期化に失敗しました');
          }
        } else {
          this.logger.warn('UIComponentManager.initializePlaybackControls メソッドが利用できません');
        }
      } else {
        // 既存のコントロールがある場合は表示状態を確認して設定
        this.logger.debug('既存の再生コントロールを表示状態に設定します');
        existingControls.style.display = 'block';
        existingControls.style.visibility = 'visible';
        existingControls.style.opacity = '1';
      }
    } else {
      this.logger.warn('Replay session use case が利用できないため、再生コントロールを追加できません');
    }
  }

  /**
   * 記録ボタンの状態を初期化
   * @private
   */
  _updateRecordingButtonsState() {
    try {
      const isRecording = this.appController.isRecording();
      this._updateRecordingUI(isRecording);
    } catch (error) {
      this.logger.error('記録状態の確認中にエラーが発生しました:', error);
    }
  }

  /**
   * 通知メッセージの表示
   * @private
   * @param {string} message メッセージ
   */
  _showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        notification.remove();
      }, 500);
    }, 3000);
  }

  /**
   * エラーメッセージの表示
   * @private
   * @param {string} message エラーメッセージ
   */
  _showErrorMessage(message) {
    const errorContainer = document.createElement('div');
    errorContainer.className = 'error-message';
    errorContainer.textContent = message;
    document.body.appendChild(errorContainer);

    setTimeout(() => {
      errorContainer.remove();
    }, 5000);
  }
}