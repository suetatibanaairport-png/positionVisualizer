/**
 * app.js
 * 統合されたアプリケーションのエントリーポイント
 * パラメータによって通常表示またはオーバーレイ表示を切り替える
 */

import { AppBootstrap } from './application/AppBootstrap.js';
import { EventBus } from './infrastructure/services/EventBus.js';

// DOM読み込み完了時に実行
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // オーバーレイモード判定
    const isOverlay = window.location.search.includes('overlay') || (window.APP_CONFIG?.isOverlay === true);

    console.log(`Initializing Position Visualizer ${isOverlay ? 'Overlay' : 'Application'}...`);

    // グローバル設定を取得
    const webSocketUrl = window.APP_CONFIG?.webSocketUrl || 'ws://localhost:8123';
    const containerId = isOverlay ? 'meter-container' : window.APP_CONFIG?.containerId || 'meter-container';

    // アプリケーションの起動
    const bootstrap = new AppBootstrap({
      webSocketUrl,
      containerId,
      maxDevices: window.APP_CONFIG?.maxDevices || 6,
      deviceTimeoutMs: window.APP_CONFIG?.deviceTimeoutMs || 60000, // 設定値を使用またはデフォルト60秒
      autoStart: true,
      isOverlay // オーバーレイモードフラグを渡す
    });

    // アプリケーション初期化
    const app = await bootstrap.initialize();

    // グローバルに公開（開発デバッグ用）
    window.appController = app;

    // オーバーレイモードによって表示を切り替える
    if (isOverlay) {
      // オーバーレイモード
      console.log('オーバーレイモードで初期化');
      document.body.classList.add('overlay-mode');
      setupOverlayMode(); // ヘッダーを非表示にしてクロマキー背景を設定

      // デバイス更新の開始（高頻度更新）
      try {
        startDeviceUpdates(app);
      } catch (updateError) {
        console.error('Failed to start device updates:', updateError);
        // エラーが発生してもオーバーレイモードを継続（UIが表示されるように）
      }
    } else {
      // 通常モード
      setupUIEventHandlers(app);

      // デバイスリスト更新の開始（低頻度更新）
      startDeviceListUpdates(app);
    }

    // アプリ起動
    await app.start();

    console.log(`${isOverlay ? 'Overlay' : 'Application'} started successfully`);

    // アプリケーション起動後、記録状態に応じてボタン表示を設定
    initializeRecordingButtonsState(app);

    // 接続ステータスの更新
    updateConnectionStatus('接続済み', isOverlay);

  } catch (error) {
    console.error(`Failed to start ${window.APP_CONFIG?.isOverlay ? 'overlay' : 'application'}:`, error);
    updateConnectionStatus('接続エラー', window.APP_CONFIG?.isOverlay);
    showErrorMessage('アプリケーションの起動に失敗しました', window.APP_CONFIG?.isOverlay);
  }
});

/**
 * オーバーレイモードのセットアップ
 */
function setupOverlayMode() {
  // クロマキーの背景色を強制的に適用
  document.body.classList.add('chroma-key');
  document.documentElement.style.backgroundColor = '#00ff00';
  document.body.style.backgroundColor = '#00ff00';

  // 必要のない要素を非表示にする
  const elementsToHide = document.querySelectorAll('.controls, .range-settings-section, .log-sections');
  elementsToHide.forEach(el => {
    if (el) el.style.display = 'none';
  });

  // メーターコンテナをフル画面に
  const meterContainer = document.getElementById('meter-container');
  if (meterContainer) {
    meterContainer.classList.add('fullscreen');
    // コンテナの親要素も調整
    const parent = meterContainer.parentElement;
    if (parent) {
      parent.style.width = '100vw';
      parent.style.height = '100vh';
      parent.style.padding = '0';
      parent.style.margin = '0';
      parent.style.overflow = 'hidden';
      parent.style.backgroundColor = '#00ff00';
    }
  }

  // ヘッダー全体を非表示にする
  const headerElements = document.querySelectorAll('.visualizer-header');
  headerElements.forEach(el => {
    if (el) {
      el.style.display = 'none';
    }
  });

  // オーバーレイモードでは常にクロマキーがオンなので、クロマキーボタンは追加しない
}

/**
 * UI要素のイベントハンドラを設定（通常モード用）
 * @param {Object} app アプリケーションコントローラー
 */
function setupUIEventHandlers(app) {
  // リセットボタン
  const resetBtn = document.getElementById('reset-devices');
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      const result = await app.resetDevices();
      if (result) {
        showNotification('デバイスをリセットしました');
      }
    });
  }

  // 記録ボタン
  const recordBtn = document.getElementById('start-record');
  const stopRecordBtn = document.getElementById('stop-record');
  if (recordBtn && stopRecordBtn) {
    // 初期状態では記録開始ボタンのみ表示
    recordBtn.style.display = 'inline-block';
    stopRecordBtn.style.display = 'none';

    // 停止ボタンのスタイル設定
    stopRecordBtn.style.backgroundColor = '#dc2626'; // 赤色系
    stopRecordBtn.style.borderColor = '#b91c1c';
    stopRecordBtn.style.color = 'white';
    stopRecordBtn.style.fontWeight = '600';

    recordBtn.addEventListener('click', async () => {
      const success = await app.startRecording();
      if (success) {
        document.getElementById('log-record-status').textContent = '記録中...';
        // ボタンの表示切り替え
        recordBtn.style.display = 'none';
        stopRecordBtn.style.display = 'inline-block';
        showNotification('記録を開始しました');
      }
    });

    stopRecordBtn.addEventListener('click', async () => {
      const result = await app.stopRecording();
      if (result) {
        document.getElementById('log-record-status').textContent = '停止中';
        // ボタンの表示切り替え
        stopRecordBtn.style.display = 'none';
        recordBtn.style.display = 'inline-block';
        showNotification('記録を停止しました');
      }
    });
  }

  // 再生ボタン
  const playLogBtn = document.getElementById('play-log');
  const stopLogBtn = document.getElementById('stop-log');
  if (playLogBtn && stopLogBtn) {
    console.log('再生ボタンにイベントリスナーを追加します');
    playLogBtn.addEventListener('click', () => {
      console.log('再生ボタンがクリックされました');

      // ログファイル入力から取得
      const logFileInput = document.getElementById('log-file');
      if (logFileInput && logFileInput.files.length > 0) {
        const file = logFileInput.files[0];

        // ファイル名を表示するための要素を取得または作成
        let fileNameDisplay = document.getElementById('log-file-name');
        if (!fileNameDisplay) {
          fileNameDisplay = document.createElement('div');
          fileNameDisplay.id = 'log-file-name';
          fileNameDisplay.style.marginTop = '5px';
          fileNameDisplay.style.fontSize = '12px';
          fileNameDisplay.style.color = '#666';

          // ログファイル入力の後に挿入
          logFileInput.parentNode.insertBefore(fileNameDisplay, logFileInput.nextSibling);
        }

        // ファイル名を表示
        fileNameDisplay.textContent = `選択ファイル: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;

        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            // JSONデータをパースする
            const parsedData = JSON.parse(e.target.result);

            // 新形式の場合 (metadata/entriesを含むオブジェクト)
            // 旧形式の場合 ([{id, value, ts}] の配列または {records: [{id, value, ts}]} のオブジェクト)

            // 形式を識別し、必要に応じて変換する
            let logData;
            // すべてのコードパスで使用できるように、deviceIds変数をここで宣言
            let deviceIds;

            // 新形式かどうかをチェック
            if (parsedData && parsedData.metadata && Array.isArray(parsedData.entries)) {
              // 既に新形式なので変換不要
              logData = parsedData;

              // 新形式でもdeviceIdsを作成（必要な場合）
              deviceIds = new Set(parsedData.entries.map(entry => entry.deviceId));
            } else {
              // 旧形式の場合は変換する
              const entries = Array.isArray(parsedData)
                ? parsedData
                : (parsedData.records && Array.isArray(parsedData.records) ? parsedData.records : []);

              if (entries.length === 0) {
                throw new Error('Invalid log format: No entries found');
              }

              // 新しい形式に変換
              // デバイスIDをマッピング
              deviceIds = new Set();
              entries.forEach(entry => {
                if (entry.id) {
                  deviceIds.add(`lever${entry.id}`);
                }
              });

              // 相対時間の開始点を計算
              let baseTimestamp = Math.min(...entries.map(e => Number(e.ts) || 0));

              // 新形式のエントリーに変換
              const convertedEntries = entries.map(entry => {
                const deviceId = `lever${entry.id}`;
                return {
                  deviceId: deviceId,
                  value: {
                    raw: Number(entry.value),
                    normalized: Number(entry.value),
                  },
                  timestamp: Date.now() - baseTimestamp + (Number(entry.ts) || 0),
                  relativeTime: Number(entry.ts) || 0
                };
              });

              // デバイス情報を収集
              const deviceInfo = {};

              // deviceIdsがきちんと定義されているか確認
              if (!deviceIds || !(deviceIds instanceof Set)) {
                console.warn('deviceIds is not defined or not a Set. Creating empty Set.');
                deviceIds = new Set();
              }

              console.log('Collecting device info for devices:', Array.from(deviceIds));

              // 既存のデバイス情報を取得
              try {
                for (const deviceId of deviceIds) {
                  if (!deviceId) continue;

                  const deviceIndex = app.meterViewModel?.getDeviceIndex(deviceId);
                  console.log(`DeviceId: ${deviceId}, DeviceIndex: ${deviceIndex}`);

                  if (deviceIndex >= 0) {
                    deviceInfo[deviceId] = {};

                    // デバイス名の取得
                    if (app.meterViewModel?.state?.names && app.meterViewModel.state.names[deviceIndex]) {
                      deviceInfo[deviceId].name = app.meterViewModel.state.names[deviceIndex];
                      console.log(`Set name for ${deviceId}: ${deviceInfo[deviceId].name}`);
                    }

                    // アイコンURLの取得
                    if (app.meterViewModel?.state?.icons && app.meterViewModel.state.icons[deviceIndex]) {
                      deviceInfo[deviceId].iconUrl = app.meterViewModel.state.icons[deviceIndex];
                      console.log(`Set icon for ${deviceId}: ${deviceInfo[deviceId].iconUrl ? 'found' : 'not found'}`);
                    }
                  }
                }
              } catch (error) {
                console.error('Error collecting device info:', error);
              }

              // 新形式のオブジェクトを作成
              logData = {
                metadata: {
                  version: "1.0",
                  createdAt: new Date().toISOString(),
                  deviceCount: deviceIds.size,
                  entriesCount: convertedEntries.length,
                  startTime: Date.now() - baseTimestamp,
                  endTime: Date.now(),
                  deviceInfo: deviceInfo // デバイス情報を追加
                },
                entries: convertedEntries
              };
            }

            // 一時的なセッションストレージを管理
            if (!window.tempSessionStorage) {
              window.tempSessionStorage = {};
            }

            // 前回のモンキーパッチを元に戻す（複数回の再生時にメソッドが重複して上書きされるのを防ぐ）
            if (window.originalGetSession && app.replaySessionUseCase?.sessionRepository) {
              app.replaySessionUseCase.sessionRepository.getSession = window.originalGetSession;
            }

            // セッションIDを生成（一時的なID）
            const tempSessionId = `temp_${Date.now()}`;

            // 古いセッションデータをクリーンアップ
            const now = Date.now();
            Object.keys(window.tempSessionStorage).forEach(key => {
              // 30秒以上経過した一時セッションは削除
              if (key.startsWith('temp_') && now - Number(key.replace('temp_', '')) > 30000) {
                console.log(`Cleaning up old temporary session: ${key}`);
                delete window.tempSessionStorage[key];
              }
            });

            // 新しいセッションデータを保存
            window.tempSessionStorage[tempSessionId] = logData;

            // ReplaySessionUseCase.loadSession が使用する
            // SessionRepositoryのgetSessionメソッドを一時的にモンキーパッチ
            const originalGetSession = app.replaySessionUseCase?.sessionRepository?.getSession;

            // オリジナルのメソッドを保存（後で元に戻すため）
            window.originalGetSession = originalGetSession;

            if (app.replaySessionUseCase?.sessionRepository) {
              app.replaySessionUseCase.sessionRepository.getSession = async (id) => {
                if (id === tempSessionId && window.tempSessionStorage[id]) {
                  return window.tempSessionStorage[id];
                }
                // 元のメソッドがあれば呼び出す
                if (typeof originalGetSession === 'function') {
                  return originalGetSession.call(app.replaySessionUseCase.sessionRepository, id);
                }
                return null;
              };
            }

            // デバッグ: ログデータの概要を表示
            console.log('Log data to replay:', {
              sessionId: tempSessionId,
              deviceCount: logData.metadata?.deviceCount || 0,
              entryCount: logData.metadata?.entriesCount || (logData.entries?.length || 0),
              deviceIds: deviceIds ? Array.from(deviceIds) : [],
              deviceInfo: logData.metadata?.deviceInfo || {},
              firstEntry: logData.entries?.[0] || null,
              lastEntry: logData.entries?.length ? logData.entries[logData.entries.length - 1] : null
            });

            // エントリが空でないか確認
            if (!logData.entries || logData.entries.length === 0) {
              console.warn('Warning: No entries found in log data');
            }

            // 再生を開始
            const replayStarted = await app.startReplay(tempSessionId);
            if (replayStarted) {
              showNotification('ログ再生を開始しました');
              console.log('Replay started successfully');

              // 再生開始成功後にコントロールを追加
              try {
                addPlaybackControls();
              } catch (e) {
                console.error("Error adding playback controls:", e);
                // エラーが発生した場合は少し遅延して再試行
                setTimeout(addPlaybackControls, 200);
              }
            } else {
              showErrorMessage('ログ再生の開始に失敗しました');
              console.error('Failed to start replay');
            }

            // クリーンアップ処理
            // 再生が完了または失敗した後に元のメソッドを復元
            const cleanupSession = () => {
              console.log('Cleaning up temporary session:', tempSessionId);

              // 一時セッションデータを削除
              if (window.tempSessionStorage && window.tempSessionStorage[tempSessionId]) {
                delete window.tempSessionStorage[tempSessionId];
              }

              // 元のメソッドを復元
              if (app.replaySessionUseCase?.sessionRepository && window.originalGetSession) {
                app.replaySessionUseCase.sessionRepository.getSession = window.originalGetSession;
              }
            };

            // 再生完了イベントをリッスン
            const cleanupOnComplete = () => {
              console.log('EventBusが有効かチェックします');
              try {
                EventBus.once('playbackCompleted', () => {
                  console.log('Playback completed, triggering cleanup');
                  cleanupSession();
                });

                EventBus.once('playbackStopped', () => {
                  console.log('Playback stopped, triggering cleanup');
                  cleanupSession();
                });
                console.log('再生完了イベントリスナーが正常に登録されました');
              } catch (e) {
                console.error('EventBus.onceでエラーが発生しました:', e);
              }
            };

            // イベントリスナーを設定
            if (typeof EventBus !== 'undefined' && EventBus.once) {
              console.log('EventBusが利用可能です');
              cleanupOnComplete();
            } else {
              console.error('EventBusが未定義またはonce()メソッドがありません');
            }

            // バックアップとして5分後にクリーンアップ
            setTimeout(cleanupSession, 300000);
          } catch (error) {
            console.error('Error playing log:', error);
            showErrorMessage('ログの読み込みに失敗しました');
          }
        };
        reader.readAsText(file);
      } else {
        showErrorMessage('ログファイルを選択してください');
      }
    });

    // 再生コントロールUI追加
    const addPlaybackControls = () => {

      console.log("Adding playback controls");
      // 既存のコントロールがあれば更新、なければ新規作成
      let existingControls = document.getElementById('playback-controls');
      if (existingControls) {
        console.log("Found existing controls, updating");
        // 既存のコントロールがある場合は削除せず、内容を更新する
        return;
      }

      // 再生コントロールコンテナを作成
      // このコードは下部で重複しているため削除

      // 専用のコントロールコンテナを使用
      const controlsContainer = document.createElement('div');
      controlsContainer.id = 'playback-controls';
      controlsContainer.style.marginTop = '10px';
      controlsContainer.style.padding = '10px';
      controlsContainer.style.border = '1px solid #334155';
      controlsContainer.style.borderRadius = '8px';
      controlsContainer.style.background = 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)';
      controlsContainer.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05)';

      // コントロールタイトル
      const controlsTitle = document.createElement('div');
      controlsTitle.textContent = '再生コントロール';
      controlsTitle.style.fontWeight = '600';
      controlsTitle.style.fontSize = '16px';
      controlsTitle.style.color = '#cbd5e1';
      controlsTitle.style.marginBottom = '8px';
      controlsTitle.style.paddingBottom = '8px';
      controlsTitle.style.borderBottom = '1px solid #334155';
      controlsContainer.appendChild(controlsTitle);

      // 再生速度コントロール（数値入力方式）
      const speedControl = document.createElement('div');
      speedControl.style.display = 'flex';
      speedControl.style.alignItems = 'center';
      speedControl.style.marginBottom = '5px';

      const speedLabel = document.createElement('span');
      speedLabel.textContent = '再生速度: ';
      speedControl.appendChild(speedLabel);

      // 数値入力フィールドの作成
      const speedInput = document.createElement('input');
      speedInput.type = 'number';
      speedInput.min = '0.1';
      speedInput.max = '10';
      speedInput.step = '0.1';
      speedInput.value = '1.0';

      // スタイル設定
      speedInput.style.backgroundColor = '#1e293b';
      speedInput.style.color = '#fff';
      speedInput.style.border = '1px solid #334155';
      speedInput.style.borderRadius = '4px';
      speedInput.style.padding = '4px 8px';
      speedInput.style.margin = '0 5px';
      speedInput.style.width = '80px';
      speedInput.style.textAlign = 'center';

      // 数値の後に「x」を表示する要素
      const speedUnit = document.createElement('span');
      speedUnit.textContent = 'x';
      speedUnit.style.marginLeft = '3px';
      speedUnit.style.color = '#cbd5e1';

      // 数値入力のイベントハンドラ
      speedInput.addEventListener('change', function() {
        // 入力値が範囲外の場合は調整
        let speed = parseFloat(this.value);
        if (isNaN(speed) || speed < 0.1) speed = 0.1;
        if (speed > 10) speed = 10;
        this.value = speed.toFixed(1);

        // 再生速度を変更
        if (app.replaySessionUseCase) {
          app.replaySessionUseCase.setPlaybackSpeed(speed);
          showNotification(`再生速度を ${speed}x に変更しました`);
        }
      });

      // コンテナに追加
      speedControl.appendChild(speedInput);
      speedControl.appendChild(speedUnit);

      controlsContainer.appendChild(speedControl);

      // プログレスバーとタイムラベル
      const progressContainer = document.createElement('div');
      progressContainer.style.marginBottom = '10px';

      // タイムラベル
      const timeLabel = document.createElement('div');
      timeLabel.id = 'replay-time-label';
      timeLabel.style.textAlign = 'center';
      timeLabel.style.fontSize = '12px';
      timeLabel.style.marginBottom = '4px';
      timeLabel.style.color = '#cbd5e1';
      timeLabel.textContent = '0:00 / 0:00';
      progressContainer.appendChild(timeLabel);

      // プログレスバー
      const progressBar = document.createElement('input');
      progressBar.type = 'range';
      progressBar.min = '0';
      progressBar.max = '100';
      progressBar.value = '0';
      progressBar.style.width = '100%';
      progressBar.style.height = '8px';
      progressBar.style.margin = '5px 0';
      progressBar.style.borderRadius = '4px';
      progressBar.style.appearance = 'none';
      progressBar.style.webkitAppearance = 'none';
      progressBar.style.background = '#1e293b';
      // スムーズな動きのためのトランジション効果
      progressBar.style.transition = 'all 0.05s ease-out';

      // プログレスバーのイベント処理
      progressBar.addEventListener('input', function() {
        const position = this.value / 100; // 0-1に変換
        if (app.replaySessionUseCase) {
          // ドラッグ中はラベルを更新
          const status = app.replaySessionUseCase.getPlaybackStatus();
          const totalDuration = status.totalDuration || 0;

          // 進捗に基づいた時間表示の更新（再生速度に依存しない）
          const calculatedTime = totalDuration * position;

          // タイムラベルの更新
          updateTimeLabel(calculatedTime, totalDuration);
        }
      });

      // ドラッグ終了時に実際にシーク
      progressBar.addEventListener('change', function() {
        const position = this.value / 100; // 0-1に変換
        if (app.replaySessionUseCase) {
          const status = app.replaySessionUseCase.getPlaybackStatus();

          // 停止状態の場合は先に再生を開始
          if (!status.isPlaying) {
            app.replaySessionUseCase.play();
            pauseResumeBtn.textContent = '一時停止';
          }

          // 位置を設定
          app.replaySessionUseCase.seekToPosition(position);
          showNotification(`${Math.round(position * 100)}%の位置に移動しました`);

          // 停止状態だった場合は一時停止
          if (!status.isPlaying) {
            setTimeout(() => {
              app.replaySessionUseCase.pause();
              pauseResumeBtn.textContent = '再開';
            }, 100);
          }
        }
      });

      progressContainer.appendChild(progressBar);
      controlsContainer.appendChild(progressContainer);

      // 操作ボタンコンテナ
      const buttonContainer = document.createElement('div');
      buttonContainer.style.display = 'flex';
      buttonContainer.style.justifyContent = 'space-between';
      buttonContainer.style.marginBottom = '10px';

      // 5秒戻るボタン
      const backButton = document.createElement('button');
      backButton.textContent = '◀ 5秒';
      backButton.style.flex = '1';
      backButton.style.marginRight = '5px';
      backButton.style.padding = '5px 0';
      backButton.onclick = () => {
        if (app.replaySessionUseCase) {
          const status = app.replaySessionUseCase.getPlaybackStatus();

          // 停止状態の場合は先に再生を開始
          const wasPlaying = status.isPlaying;
          if (!wasPlaying) {
            app.replaySessionUseCase.play();
            pauseResumeBtn.textContent = '一時停止';
          }

          // 5秒戻る
          app.replaySessionUseCase.seekBySeconds(-5);
          showNotification('5秒戻りました');

          // 停止状態だった場合は一時停止
          if (!wasPlaying) {
            setTimeout(() => {
              app.replaySessionUseCase.pause();
              pauseResumeBtn.textContent = '再開';
            }, 100);
          }
        }
      };
      buttonContainer.appendChild(backButton);

      // 一時停止/再開ボタン
      const pauseResumeBtn = document.createElement('button');
      pauseResumeBtn.textContent = '一時停止';
      pauseResumeBtn.style.flex = '2';
      pauseResumeBtn.style.margin = '0 5px';
      pauseResumeBtn.style.padding = '5px 0';

      pauseResumeBtn.onclick = () => {
        if (!app.replaySessionUseCase) return;

        const status = app.replaySessionUseCase.getPlaybackStatus();
        if (status.isPlaying) {
          if (status.isPaused) {
            app.replaySessionUseCase.play();
            pauseResumeBtn.textContent = '一時停止';
            showNotification('再生を再開しました');
          } else {
            app.replaySessionUseCase.pause();
            pauseResumeBtn.textContent = '再開';
            showNotification('再生を一時停止しました');
          }
        } else {
          // 停止状態の場合は最初から再生
          app.replaySessionUseCase.rewind();
          app.replaySessionUseCase.play();
          pauseResumeBtn.textContent = '一時停止';
          showNotification('再生を開始しました');
        }
      };

      // 再生完了時の処理を追加
      const updateUIOnPlaybackEnd = () => {
        console.log("Playback fully stopped event received");

        // playback-controlsコンテナを探す
        const controlsContainer = document.getElementById('playback-controls');
        console.log("Controls container on playback end:", controlsContainer);

        if (controlsContainer) {
          // 1. ボタンコンテナを探す
          const buttonContainer = controlsContainer.querySelector('div:nth-child(3)');

          if (buttonContainer) {
            // 2. 中央のボタン（一時停止/再生ボタン）を探す - より具体的なセレクタ
            const pauseBtn = buttonContainer.querySelector('button:nth-child(2)');

            if (pauseBtn) {
              console.log("Found pause button, updating text from:", pauseBtn.textContent);
              pauseBtn.textContent = '再生';
              console.log("Updated button text to: 再生");
            } else {
              console.log("Pause button not found in button container");
            }
          } else {
            console.log("Button container not found in controls");
          }
        } else {
          console.log("Controls container not found on playback end");
        }

        showNotification('再生が終了しました');
      };

      // イベントリスナーを登録
      // 既存のリスナーを削除してから追加（多重登録防止）
      console.log('EventBusを使用してイベントリスナーを登録します');
      try {
        EventBus.off('playbackFullyStopped', updateUIOnPlaybackEnd);
        EventBus.on('playbackFullyStopped', updateUIOnPlaybackEnd);
        console.log('イベントリスナーが正常に登録されました');
      } catch (e) {
        console.error('EventBusの操作でエラーが発生しました:', e);
      }
      buttonContainer.appendChild(pauseResumeBtn);

      // 5秒進むボタン
      const forwardButton = document.createElement('button');
      forwardButton.textContent = '5秒 ▶';
      forwardButton.style.flex = '1';
      forwardButton.style.marginLeft = '5px';
      forwardButton.style.padding = '5px 0';
      forwardButton.onclick = () => {
        if (app.replaySessionUseCase) {
          const status = app.replaySessionUseCase.getPlaybackStatus();

          // 停止状態の場合は先に再生を開始
          const wasPlaying = status.isPlaying;
          if (!wasPlaying) {
            app.replaySessionUseCase.play();
            pauseResumeBtn.textContent = '一時停止';
          }

          // 5秒進む
          app.replaySessionUseCase.seekBySeconds(5);
          showNotification('5秒進みました');

          // 停止状態だった場合は一時停止
          if (!wasPlaying) {
            setTimeout(() => {
              app.replaySessionUseCase.pause();
              pauseResumeBtn.textContent = '再開';
            }, 100);
          }
        }
      };
      buttonContainer.appendChild(forwardButton);

      controlsContainer.appendChild(buttonContainer);

      // タイムラベルを更新する関数
      const updateTimeLabel = (currentTime, totalDuration) => {
        const formatTime = (ms) => {
          const totalSeconds = Math.floor(ms / 1000);
          const minutes = Math.floor(totalSeconds / 60);
          const seconds = totalSeconds % 60;
          return `${minutes}:${seconds.toString().padStart(2, '0')}`;
        };

        timeLabel.textContent = `${formatTime(currentTime)} / ${formatTime(totalDuration)}`;
      };

      // プログレスバーとタイムラベルの更新にrequestAnimationFrameを使用
      let animationFrameId = null;
      let lastProgress = 0;
      let lastUpdateTime = 0;

      // スムーズな更新のためのアニメーション関数
      const updateProgressBar = () => {
        if (app.replaySessionUseCase) {
          const status = app.replaySessionUseCase.getPlaybackStatus();
          if (status.isPlaying && !document.activeElement.isSameNode(progressBar)) {
            const now = performance.now();
            const progress = status.progress; // 0-1の進捗値

            // 更新頻度制限（16.7msごと = 約60fps）
            if (now - lastUpdateTime > 16.7 || Math.abs(progress - lastProgress) > 0.01) {
              // 値の補間処理（急な変化を滑らかにする）
              let targetValue = Math.round(progress * 100);
              let currentValue = parseInt(progressBar.value);

              // 大きな変化がある場合は直接更新、そうでなければ徐々に変化
              if (Math.abs(targetValue - currentValue) > 5) {
                progressBar.value = targetValue;
              } else {
                // より細かい値で設定することでアニメーションがスムーズになる
                progressBar.value = (targetValue * 10) / 10;
              }

              // 進捗に基づいた時間表示の更新（再生速度の影響を受けない）
              const totalDuration = status.totalDuration || 0;
              const calculatedTime = totalDuration * progress;
              updateTimeLabel(calculatedTime, totalDuration);

              lastProgress = progress;
              lastUpdateTime = now;
            }
          }
        }

        // 次のフレームを予約
        animationFrameId = requestAnimationFrame(updateProgressBar);
      };

      // アニメーションの開始
      animationFrameId = requestAnimationFrame(updateProgressBar);

      // 再生停止時にアニメーションをクリア
      let clearProgressInterval = () => {
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
          animationFrameId = null;
        }
      };

      // キーボード操作のサポート
      const addKeyboardControls = () => {
        // 既存のキーハンドラを削除
        if (window._replayKeyHandler) {
          document.removeEventListener('keydown', window._replayKeyHandler);
        }

        // キーボードイベントハンドラー
        const keyHandler = (e) => {
          if (!app.replaySessionUseCase) return;

          // フォームにフォーカスがある場合は無視
          const activeElement = document.activeElement;
          if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
            return;
          }

          const status = app.replaySessionUseCase.getPlaybackStatus();
          // 再生中・一時停止中・停止中のいずれの場合も処理する
          if (!status.loaded) return;

          switch (e.code) {
            case 'ArrowLeft': // 左矢印キー：5秒戻る
              // 停止状態の場合は先に再生を開始
              const wasPlayingLeft = status.isPlaying;
              if (!wasPlayingLeft) {
                app.replaySessionUseCase.play();
                pauseResumeBtn.textContent = '一時停止';
              }

              app.replaySessionUseCase.seekBySeconds(-5);
              e.preventDefault();

              // 停止状態だった場合は一時停止に戻す
              if (!wasPlayingLeft) {
                setTimeout(() => {
                  app.replaySessionUseCase.pause();
                  pauseResumeBtn.textContent = '再開';
                }, 100);
              }
              break;
            case 'ArrowRight': // 右矢印キー：5秒進む
              // 停止状態の場合は先に再生を開始
              const wasPlayingRight = status.isPlaying;
              if (!wasPlayingRight) {
                app.replaySessionUseCase.play();
                pauseResumeBtn.textContent = '一時停止';
              }

              app.replaySessionUseCase.seekBySeconds(5);
              e.preventDefault();

              // 停止状態だった場合は一時停止に戻す
              if (!wasPlayingRight) {
                setTimeout(() => {
                  app.replaySessionUseCase.pause();
                  pauseResumeBtn.textContent = '再開';
                }, 100);
              }
              break;
            case 'Space': // スペースキー：一時停止/再開/再生
              if (status.isPlaying) {
                if (status.isPaused) {
                  app.replaySessionUseCase.play();
                  pauseResumeBtn.textContent = '一時停止';
                } else {
                  app.replaySessionUseCase.pause();
                  pauseResumeBtn.textContent = '再開';
                }
              } else {
                // 停止状態の場合は最初から再生
                app.replaySessionUseCase.rewind();
                app.replaySessionUseCase.play();
                pauseResumeBtn.textContent = '一時停止';
              }
              e.preventDefault();
              break;
          }
        };

        // キーボードイベントリスナーを設定
        document.addEventListener('keydown', keyHandler);
        window._replayKeyHandler = keyHandler;

        // キーボード操作ガイドを表示
        const keyboardGuide = document.createElement('div');
        keyboardGuide.style.marginTop = '8px';
        keyboardGuide.style.fontSize = '11px';
        keyboardGuide.style.color = '#94a3b8';
        keyboardGuide.style.textAlign = 'center';
        keyboardGuide.innerHTML = 'キーボード操作: ←→ 5秒移動 / スペース 一時停止・再開';
        controlsContainer.appendChild(keyboardGuide);

        // 停止時にイベントリスナーを削除
        return () => {
          if (window._replayKeyHandler) {
            document.removeEventListener('keydown', window._replayKeyHandler);
            delete window._replayKeyHandler;
          }
        };
      };

      // キーボード操作を追加
      const removeKeyboardControls = addKeyboardControls();

      // インターバルと各種リスナーのクリーンアップを行う完全版の関数
      clearProgressInterval = function() {
        // プログレスバーのアニメーションフレームをキャンセル
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
          animationFrameId = null;
        }

        // キーボード操作のクリーンアップ
        if (typeof removeKeyboardControls === 'function') {
          removeKeyboardControls();
        }

        // イベントリスナーを削除
        try {
          console.log('EventBusからイベントリスナーを削除します');
          EventBus.off('playbackFullyStopped', updateUIOnPlaybackEnd);
          console.log('イベントリスナーが正常に削除されました');
        } catch (e) {
          console.error('EventBus.offでエラーが発生しました:', e);
        }
      };

      // 専用のコンテナ要素を探す
      const playbackControlsContainer = document.getElementById('playback-controls-container');

      // コントロールを表示するための場所を決定
      let targetContainer = playbackControlsContainer;

      if (!targetContainer) {
        console.warn('Could not find dedicated playback controls container');

        // フォールバック: ログ再生セクションに追加
        const logReplaySection = document.querySelector('.log-replay-section');
        if (logReplaySection) {
          console.log('Fallback: Using log replay section');
          targetContainer = logReplaySection;
        } else {
          console.warn('Could not find log replay section');
          // 最終フォールバック: bodyを使用
          targetContainer = document.body;
        }
      }

      // 選択されたコンテナに追加
      if (targetContainer) {
        // 既存のコントロールを削除
        const existingControls = document.getElementById('playback-controls');
        if (existingControls) {
          existingControls.remove();
        }

        // コントロールを追加
        targetContainer.appendChild(controlsContainer);
      }
    };

    // 再生ボタンクリック時には何もしない
    // コントロールは再生開始成功後に追加する

    stopLogBtn.addEventListener('click', async () => {
      console.log("Stop button clicked");
      await app.stopReplay();
      showNotification('ログ再生を停止しました');

      // インターバルをクリア
      if (typeof clearProgressInterval === 'function') {
        console.log("Clearing progress interval");
        clearProgressInterval();
      } else {
        console.log("clearProgressInterval not defined or not a function");
      }

      // 再生コントロールを削除
      const controls = document.getElementById('playback-controls');
      console.log("Controls to remove:", controls);
      if (controls) {
        console.log("Removing controls");
        controls.remove();
      } else {
        console.log("No controls found to remove");
      }
    });
  }

  // オーバーレイを開くボタン
  const openOverlayButton = document.getElementById('open-overlay');
  if (openOverlayButton) {
    openOverlayButton.addEventListener('click', function() {
      // ?overlayパラメータ付きで現在のページを新しいウィンドウで開く
      window.open('?overlay', 'overlay_window', 'width=800,height=600,menubar=no,toolbar=no,location=no,status=no');
    });
  }

  // アイコンアップロード処理のセットアップ
  setupIconUploadHandlers(app);
}

/**
 * オーバーレイ固有のイベントハンドラを設定
 * @param {Object} app アプリケーションコントローラー
 */
function setupOverlayEventHandlers(app) {
  // オーバーレイモードではイベントハンドラ不要（常にクロマキーモード）
  console.log('オーバーレイモード：常にクロマキーモードで表示');
}

/**
 * デバイス一覧の定期更新を開始（通常モード用）
 * @param {Object} app アプリケーションコントローラー
 */
function startDeviceListUpdates(app) {
  const deviceList = document.getElementById('device-list');
  const deviceCount = document.getElementById('device-count');

  if (!deviceList) return;

  // 1秒ごとにデバイス一覧を更新
  setInterval(async () => {
    try {
      // 接続中のデバイスを取得
      const devices = await app.getAllDevices(true);

      // デバイス数の表示を更新
      if (deviceCount) {
        deviceCount.textContent = `${devices.length} デバイス`;
      }

      // デバイス一覧を更新
      updateDeviceListUI(deviceList, devices);
    } catch (error) {
      console.error('Failed to update device list:', error);
    }
  }, 1000);
}

/**
 * デバイスデータの定期更新を開始（オーバーレイ用、高頻度更新）
 * @param {Object} app アプリケーションコントローラー
 */
function startDeviceUpdates(app) {
  // オーバーレイ用のシンプルなデバイス表示を更新
  setInterval(async () => {
    try {
      // 接続中のデバイスを取得
      // getAllDevicesメソッドがない場合はスキップ（deviceServiceから直接取得を試みる）
      if (typeof app.getAllDevices === 'function') {
        await app.getAllDevices(true);
      } else if (app.deviceService && typeof app.deviceService.getAllDevices === 'function') {
        await app.deviceService.getAllDevices(true);
      } else {
        console.warn('Device access methods not available in overlay mode');
      }

      // 注: メーターの更新は内部で自動的に行われる
    } catch (error) {
      console.error('Failed to update overlay display:', error);
    }
  }, 100); // 高頻度更新（100ms）
}

/**
 * デバイス一覧UIの更新
 * @param {HTMLElement} listElement リスト要素
 * @param {Array} devices デバイスの配列
 */
function updateDeviceListUI(listElement, devices) {
  // リストをクリア
  listElement.innerHTML = '';

  // デバイスがない場合
  if (!devices || devices.length === 0) {
    const emptyItem = document.createElement('li');
    emptyItem.className = 'device-item empty';
    emptyItem.textContent = 'デバイスが見つかりません';
    listElement.appendChild(emptyItem);
    return;
  }

  // 各デバイスのリストアイテムを作成
  devices.forEach(device => {
    const deviceItem = document.createElement('li');
    deviceItem.className = 'device-item';

    // デバイスの値を取得
    const valueObj = device.value || {};
    const value = valueObj.normalizedValue !== undefined ? valueObj.normalizedValue :
                (valueObj.rawValue !== undefined ? valueObj.rawValue : null);

    // HTMLを構築
    deviceItem.innerHTML = `
      <div class="device-icon" style="background-image: url(${device.iconUrl || 'assets/icon.svg'})"></div>
      <div class="device-info">
        <div class="device-name">${device.name || 'デバイス ' + device.id}</div>
        <div class="device-value">${value !== null ? value.toFixed(1) : '-'}</div>
      </div>
      <div class="device-status ${device.connected ? 'status-connected' : 'status-disconnected'}"></div>
    `;

    // リストに追加
    listElement.appendChild(deviceItem);
  });
}

/**
 * 接続ステータスの更新
 * @param {string} status ステータスメッセージ
 * @param {boolean} isOverlay オーバーレイモードかどうか
 */
function updateConnectionStatus(status, isOverlay = false) {
  const statusElement = document.getElementById(isOverlay ? 'overlay-status' : 'connection-status');
  if (statusElement) {
    statusElement.textContent = status;
  }
}

/**
 * エラーメッセージの表示
 * @param {string} message エラーメッセージ
 * @param {boolean} isOverlay オーバーレイモードかどうか
 */
function showErrorMessage(message, isOverlay = false) {
  const errorContainer = document.createElement('div');
  errorContainer.className = isOverlay ? 'overlay-error' : 'error-message';
  errorContainer.textContent = message;
  document.body.appendChild(errorContainer);

  // 5秒後に非表示
  setTimeout(() => {
    errorContainer.remove();
  }, 5000);
}

/**
 * 通知メッセージの表示
 * @param {string} message 通知メッセージ
 * @param {boolean} isOverlay オーバーレイモードかどうか
 */
function showNotification(message, isOverlay = false) {
  const notification = document.createElement('div');
  notification.className = isOverlay ? 'overlay-notification' : 'notification';
  notification.textContent = message;
  document.body.appendChild(notification);

  // 3秒後に非表示
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => {
      notification.remove();
    }, 500);
  }, 3000);
}

/**
 * 起動時の記録状態に応じたボタン表示の初期化
 * @param {Object} app アプリケーションコントローラー
 */
function initializeRecordingButtonsState(app) {
  // 記録ボタンの取得
  const recordBtn = document.getElementById('start-record');
  const stopRecordBtn = document.getElementById('stop-record');
  const statusText = document.getElementById('log-record-status');

  if (!recordBtn || !stopRecordBtn || !statusText) {
    return;
  }

  try {
    // アプリケーションから記録状態を確認
    // recordSessionUseCaseが直接アクセスできない場合の対策として階層的に確認
    const isRecording =
      app.recordSessionUseCase?.isRecording ||
      app.recordingEnabled === true;

    if (isRecording) {
      // 記録中の場合
      recordBtn.style.display = 'none';
      stopRecordBtn.style.display = 'inline-block';
      statusText.textContent = '記録中...';
      console.log('現在記録中のため、停止ボタンを表示します');
    } else {
      // 停止中の場合
      recordBtn.style.display = 'inline-block';
      stopRecordBtn.style.display = 'none';
      statusText.textContent = '停止中';
      console.log('記録停止中のため、開始ボタンを表示します');
    }
  } catch (error) {
    console.error('記録状態の確認中にエラーが発生しました:', error);
    // エラー時はデフォルト状態（停止中）を表示
    recordBtn.style.display = 'inline-block';
    stopRecordBtn.style.display = 'none';
  }
}

/**
 * アイコンアップロードのイベントハンドラをセットアップ
 * @param {Object} app アプリケーションコントローラー
 */
function setupIconUploadHandlers(app) {
  // アイコンアップロードの処理を実装
  // すべてのアイコンファイル入力要素に対してイベントハンドラを設定
  setTimeout(() => {
    try {
      const fileInputs = document.querySelectorAll('.icon-file-input');
      console.log(`Found ${fileInputs.length} icon file inputs`);

      fileInputs.forEach((input, index) => {
        const deviceIndex = index + 1;
        const deviceId = `lever${deviceIndex}`;
        const iconButton = input.closest('.icon-file-button');
        const buttonText = iconButton ? iconButton.querySelector('.icon-button-text') : null;

        input.addEventListener('change', () => {
          console.log(`File input change event for device ${deviceIndex}`);

          const file = input.files && input.files[0];
          if (!file) return;

          // 画像ファイルかチェック
          if (!file.type.startsWith('image/')) {
            showErrorMessage('画像ファイルのみアップロード可能です');
            return;
          }

          const reader = new FileReader();
          reader.onload = async (event) => {
            try {
              const dataUrl = event.target.result;
              if (!dataUrl) return;

              // ファイルサイズをチェック
              const size = dataUrl.length;
              console.log(`File loaded for device ${deviceIndex}, size: ${(size/1024).toFixed(2)} KB`);

              // 大きすぎるファイルをチェック (10MB以上)
              if (size > 10 * 1024 * 1024) {
                console.warn(`Very large image detected (${(size/1024/1024).toFixed(2)} MB). This may cause performance issues.`);
                showErrorMessage('画像サイズが大きすぎます（10MB以上）。小さい画像を選択してください。');
                return;
              }

              if (app) {
                if (typeof app.setDeviceIcon === 'function') {
                  // アイコンを設定
                  await app.setDeviceIcon(deviceId, dataUrl);
                  console.log(`Icon set successfully for device ${deviceId}`);

                  // UIを更新
                  if (iconButton) {
                    iconButton.classList.add('has-icon');
                  }

                  if (buttonText) {
                    buttonText.textContent = '✓ 登録済み';
                  }

                  showNotification(`デバイス${deviceIndex}のアイコンを設定しました`);
                } else {
                  console.error('setDeviceIcon method not found on app controller');
                  showErrorMessage('アイコン設定機能が利用できません');
                }
              } else {
                console.error('App controller not available');
                showErrorMessage('アプリコントローラーが利用できません');
              }
            } catch (error) {
              console.error(`Error uploading icon for device ${deviceId}:`, error);
              showErrorMessage(`アイコンの設定中にエラーが発生しました: ${error.message || '不明なエラー'}`);
            }
          };

          reader.onerror = () => {
            showErrorMessage('ファイルの読み込み中にエラーが発生しました');
          };

          try {
            reader.readAsDataURL(file);
          } catch (error) {
            console.error('Error reading file as data URL:', error);
            showErrorMessage('ファイルの読み込みに失敗しました');
          }
        });

        console.log(`Event listener attached to file input for device ${deviceIndex}`);
      });
    } catch (error) {
      console.error('Error setting up icon upload handlers:', error);
    }
  }, 500); // DOM要素が完全に読み込まれるのを確実にするために少し遅延させる
}