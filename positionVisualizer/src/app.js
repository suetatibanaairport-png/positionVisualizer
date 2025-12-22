/**
 * app.js
 * 統合されたアプリケーションのエントリーポイント
 * パラメータによって通常表示またはオーバーレイ表示を切り替える
 */

import { AppBootstrap } from './application/AppBootstrap.js';

// DOM読み込み完了時に実行
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // オーバーレイモード判定
    const isOverlay = window.location.search.includes('overlay');

    console.log(`Initializing Position Visualizer ${isOverlay ? 'Overlay' : 'Application'}...`);

    // グローバル設定を取得
    const webSocketUrl = window.APP_CONFIG?.webSocketUrl || 'ws://localhost:8123';
    const containerId = isOverlay ? 'meter-container' : window.APP_CONFIG?.containerId || 'meter-container';

    // アプリケーションの起動
    const bootstrap = new AppBootstrap({
      webSocketUrl,
      containerId,
      maxDevices: window.APP_CONFIG?.maxDevices || 6,
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
      document.body.classList.add('overlay-mode');
      setupOverlayMode();
      setupOverlayEventHandlers(app);

      // デバイス更新の開始（高頻度更新）
      startDeviceUpdates(app);
    } else {
      // 通常モード
      setupUIEventHandlers(app);

      // デバイスリスト更新の開始（低頻度更新）
      startDeviceListUpdates(app);
    }

    // アプリ起動
    await app.start();

    console.log(`${isOverlay ? 'Overlay' : 'Application'} started successfully`);

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
    }
  }

  // ボタン以外のヘッダー要素を非表示
  const headerElements = document.querySelectorAll('.visualizer-header *:not(.overlay-button)');
  headerElements.forEach(el => {
    if (el && !el.classList.contains('overlay-button')) {
      el.style.display = 'none';
    }
  });

  // クロマキーモードボタンを追加（存在しない場合）
  const headerButtons = document.querySelector('.header-buttons');
  if (headerButtons && !document.getElementById('chroma-key-btn')) {
    const chromaKeyBtn = document.createElement('button');
    chromaKeyBtn.id = 'chroma-key-btn';
    chromaKeyBtn.className = 'overlay-button';
    chromaKeyBtn.textContent = 'クロマキーオン';
    chromaKeyBtn.title = 'クロマキー背景を切り替え';
    headerButtons.appendChild(chromaKeyBtn);
  }
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
    recordBtn.addEventListener('click', async () => {
      const success = await app.startRecording();
      if (success) {
        document.getElementById('log-record-status').textContent = '記録中...';
        showNotification('記録を開始しました');
      }
    });

    stopRecordBtn.addEventListener('click', async () => {
      const result = await app.stopRecording();
      if (result) {
        document.getElementById('log-record-status').textContent = '停止中';
        showNotification('記録を停止しました');
      }
    });
  }

  // 再生ボタン
  const playLogBtn = document.getElementById('play-log');
  const stopLogBtn = document.getElementById('stop-log');
  if (playLogBtn && stopLogBtn) {
    playLogBtn.addEventListener('click', () => {
      // ログファイル入力から取得
      const logFileInput = document.getElementById('log-file');
      if (logFileInput && logFileInput.files.length > 0) {
        const file = logFileInput.files[0];
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const logData = JSON.parse(e.target.result);
            await app.playLog(logData);
            showNotification('ログ再生を開始しました');
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

    stopLogBtn.addEventListener('click', async () => {
      await app.stopPlayback();
      showNotification('ログ再生を停止しました');
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
}

/**
 * オーバーレイ固有のイベントハンドラを設定
 * @param {Object} app アプリケーションコントローラー
 */
function setupOverlayEventHandlers(app) {
  // クロマキー切り替えボタン
  const chromaKeyBtn = document.getElementById('chroma-key-btn');
  if (chromaKeyBtn) {
    chromaKeyBtn.addEventListener('click', () => {
      const body = document.body;
      body.classList.toggle('chroma-key');

      // 背景色の切り替え
      if (body.classList.contains('chroma-key')) {
        chromaKeyBtn.textContent = 'クロマキーオフ';
        showNotification('クロマキーモードをオンにしました', true);
      } else {
        chromaKeyBtn.textContent = 'クロマキーオン';
        showNotification('クロマキーモードをオフにしました', true);
      }
    });
  }
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
      await app.getAllDevices(true);

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