/**
 * app.js
 * Position Visualizer アプリケーションのエントリーポイント
 */

import { AppController } from './presentation/controllers/AppController.js';
import { AppBootstrap } from './application/AppBootstrap.js';
import { EventBus } from './infrastructure/services/EventBus.js';
import { AppLogger } from './infrastructure/services/Logger.js';
import { appConfig } from './infrastructure/config/AppConfig.js';
import { EventTypes } from './domain/events/EventTypes.js';

// グローバルロガーの初期化
const logger = AppLogger.createLogger('App');
logger.level = localStorage.getItem('logLevel') || 'info';

/**
 * アプリケーションの初期化
 */
async function initApp() {
  try {
    // オーバーレイモードかどうかを判定（URLパラメータから取得）
    const urlParams = new URLSearchParams(window.location.search);
    const isOverlay = urlParams.has('overlay') || window.location.pathname.includes('overlay');

    logger.info(`Initializing Position Visualizer ${isOverlay ? 'Overlay' : 'Application'}...`);

    // アプリケーションブートストラップの初期化
    // appConfigから設定を取得（グローバル変数への依存なし）
    const bootstrap = new AppBootstrap({
      isOverlay,
      containerId: appConfig.get('containerId'),
      webSocketUrl: appConfig.get('webSocketUrl'),
      maxDevices: appConfig.get('maxDevices')
    });
    await bootstrap.initialize({ isOverlay });

    // コントローラーを取得
    const app = bootstrap.getController();

    // オーバーレイモードの場合、UIを適切に調整
    if (isOverlay) {
      logger.debug('オーバーレイモードで初期化');
      // 基本的なオーバーレイモード設定
      setupOverlayMode();
    }

    // UIイベントのセットアップ
    setupUIEvents(app);

    // デバイス一覧のUIを初期化
    await initializeDeviceUI(app);

    // アプリケーション起動
    await app.start();

    logger.info(`${isOverlay ? 'Overlay' : 'Application'} started successfully`);

    // オーバーレイ用の追加設定（アプリケーション起動後に適用）
    if (isOverlay) {
      // 詳細な外観の設定はすべてのDOMが完全に初期化された後に行う
      setTimeout(() => {
        // 視覚的な設定を適用
        setupOverlayAppearance();

        // コントローラーにもオーバーレイモード設定を伝える
        if (app && typeof app.setOverlayMode === 'function') {
          app.setOverlayMode(true);
          logger.debug('AppController にオーバーレイモード設定を伝達');
        }

        // MeterRendererにもオーバーレイモード設定
        if (app && app.meterRenderer && typeof app.meterRenderer.setOverlayMode === 'function') {
          app.meterRenderer.setOverlayMode(true);
          logger.debug('MeterRenderer にオーバーレイモード設定を伝達');
        }

        logger.info('オーバーレイモードの初期化が完了しました');
      }, 100); // 短い遅延で確実に全要素が初期化された後に実行
    }

  } catch (error) {
    logger.error('Application initialization failed:', error);
    console.error('アプリケーションの初期化に失敗しました', error);
  }
}

/**
 * オーバーレイモードのセットアップ
 * @param {boolean} forceSetup - 強制的にセットアップを実行するかどうか
 */
function setupOverlayMode(forceSetup = false) {
  // 現在の状態を確認
  const isAlreadySetup = document.body.classList.contains('chroma-key-mode');

  if (isAlreadySetup && !forceSetup) {
    logger.debug('オーバーレイモードは既にセットアップ済みです');
    return;
  }

  logger.debug('オーバーレイモードをセットアップしています');

  // コントロールやログなどの不要な要素を非表示
  const elementsToHide = document.querySelectorAll('.controls, .range-settings-section, .log-sections, .device-settings-section');
  for (const element of elementsToHide) {
    element.style.display = 'none';
  }

  // デバイス入力セクションもオーバーレイモード用に調整
  const deviceInputs = document.getElementById('device-inputs');
  if (deviceInputs) {
    deviceInputs.classList.add('overlay-mode');
  }

  document.body.classList.add('chroma-key-mode');

  // コントロールなしモードのヘッダーを非表示
  const headerElement = document.querySelector('header');
  if (headerElement) {
    headerElement.style.display = 'none';
  }

  // メーターコンテナのオーバーレイモード設定
  const meterContainer = document.getElementById('meter-container');
  if (meterContainer) {
    meterContainer.classList.add('overlay-mode');
    logger.debug('メーターコンテナにオーバーレイモードクラスを適用しました');
  }

  logger.debug('オーバーレイモードのセットアップが完了しました');
}

/**
 * UIイベントのセットアップ
 * @param {AppController} app アプリケーションコントローラー
 */
function setupUIEvents(app) {
  // オーバーレイを開くボタンのイベントリスナー
  const openOverlayButton = document.getElementById('open-overlay');
  if (openOverlayButton) {
    logger.debug('Setting up open-overlay button click event');
    openOverlayButton.addEventListener('click', () => {
      logger.info('Opening overlay.html in new window');
      window.open('overlay.html', 'overlay', 'width=800,height=600');
    });
  }

  // イベントハンドラー関数を定義（重複コードを防止するため）
  const handleDeviceConnected = () => {
    // デバイス接続時にUIを更新
    initializeDeviceUI(app).catch(error => {
      logger.error('Error updating UI after device connection:', error);
    });
    logger.debug('Device connected, updated device settings');
  };

  const handleDeviceDisconnected = () => {
    // デバイス切断時にUIを更新
    initializeDeviceUI(app).catch(error => {
      logger.error('Error updating UI after device disconnection:', error);
    });
    logger.debug('Device disconnected, updated device settings');
  };

  const handleDevicesReset = () => {
    // デバイスリセット時にUIを更新
    initializeDeviceUI(app).catch(error => {
      logger.error('Error updating UI after devices reset:', error);
    });
    logger.debug('Devices reset, updated device settings');
  };

  const handleDeviceVisibilityChanged = async (data) => {
    if (data && data.deviceId && app) {
      // AppControllerインスタンスを使用
      await app.setDeviceVisibility(data.deviceId, data.isVisible);
      logger.debug(`Device visibility event handled by AppController: ${data.deviceId} -> ${data.isVisible ? 'visible' : 'hidden'}`);
    }
  };

  const handleDeviceNameChanged = async (data) => {
    if (data && data.deviceId && data.newName && app) {
      // AppControllerインスタンスを使用
      await app.setDeviceName(data.deviceId, data.newName);
      logger.debug(`Device name event handled by AppController: ${data.deviceId} -> ${data.newName}`);
    }
  };

  const handleDeviceIconChanged = async (data) => {
    if (data && data.deviceId && data.iconUrl && app) {
      await app.setDeviceIcon(data.deviceId, data.iconUrl);
      logger.debug(`Device icon event handled by AppController: ${data.deviceId}`);
    }
  };

  // デバイスイベント - 新しい命名規則のイベント
  EventBus.on(EventTypes.DEVICE_CONNECTED, handleDeviceConnected);
  EventBus.on(EventTypes.DEVICE_DISCONNECTED, handleDeviceDisconnected);
  EventBus.on(EventTypes.DEVICES_RESET, handleDevicesReset);

  // DeviceListViewModelからのイベント処理 - 新しい命名規則のイベント
  EventBus.on(EventTypes.DEVICE_VISIBILITY_CHANGED, handleDeviceVisibilityChanged);
  EventBus.on(EventTypes.DEVICE_NAME_CHANGED, handleDeviceNameChanged);
  EventBus.on(EventTypes.DEVICE_ICON_CHANGED, handleDeviceIconChanged);

  // 後方互換性のためにレガシーイベント名もサポート
  EventBus.on('deviceConnected', handleDeviceConnected);
  EventBus.on('deviceDisconnected', handleDeviceDisconnected);
  EventBus.on('devicesReset', handleDevicesReset);
  EventBus.on('deviceVisibilityChange', handleDeviceVisibilityChanged);
  EventBus.on('deviceNameChange', handleDeviceNameChanged);
  EventBus.on('deviceIconChange', handleDeviceIconChanged);
}

/**
 * デバイスUIの初期化
 * @param {AppController} app アプリケーションコントローラー
 */
async function initializeDeviceUI(app) {
  try {
    logger.debug('デバイスUIの初期化を開始');
    // 接続済みデバイスを取得
    const connectedDevices = await app.getAllDevices(true);
    logger.debug(`接続済みデバイス数: ${connectedDevices.length}`);

    // DeviceListViewModelはAppControllerから取得
    const deviceListViewModel = app.deviceListViewModel;

    // DeviceListViewModelを使用してデバイス一覧を更新
    if (deviceListViewModel) {
      logger.debug('【リファクタリング成功】DeviceListViewModel経由でデバイス一覧を初期化');
      deviceListViewModel.updateDeviceList(connectedDevices);
    } else {
      // デバイスリストが初期化されていない場合はここで初期化を試みる
      logger.debug('DeviceListViewModel未初期化 - 初期化を試みます');

      try {
        // AppControllerのメソッドを使って初期化を試みる
        if (app && typeof app._initializeDeviceListViewModel === 'function') {
          app._initializeDeviceListViewModel();

          // 初期化後、再度DeviceListViewModelを取得して更新を試みる
          if (app.deviceListViewModel) {
            logger.debug('DeviceListViewModel初期化成功 - デバイス一覧を更新します');
            app.deviceListViewModel.updateDeviceList(connectedDevices);
          } else {
            logger.warn('DeviceListViewModel初期化失敗 - プレゼンテーション層の処理に依存します');
          }
        } else {
          logger.warn('_initializeDeviceListViewModel メソッドが利用できません');
        }
      } catch (initError) {
        logger.error('DeviceListViewModel初期化中にエラー発生:', initError);
      }
    }

    return true;
  } catch (error) {
    logger.error('Error initializing device UI:', error);
    return false;
  }
}

/**
 * オーバーレイの見た目をセットアップ
 */
function setupOverlayAppearance() {
  logger.debug('オーバーレイモードの見た目をセットアップ');

  // 基本的なオーバーレイモード設定は setupOverlayMode に任せる
  // 強制的に再設定を行う
  setupOverlayMode(true);

  // 透明背景を設定（chroma-keyモード）
  document.body.classList.add('transparent-background');

  // コンテンツの表示位置を調整
  const contentContainer = document.getElementById('content');
  if (contentContainer) {
    contentContainer.classList.add('overlay-content');
  }

  // メインコンテンツエリア全体にオーバーレイスタイルを適用
  const mainContent = document.getElementById('main');
  if (mainContent) {
    mainContent.classList.add('overlay-main');
  }

  // 追加のオーバーレイ固有の視覚設定
  const meterElements = document.querySelectorAll('.meter');
  meterElements.forEach(meter => {
    meter.classList.add('overlay-meter');
  });

  // ログセクションを完全に除去（非表示だけでなく）
  const logSections = document.querySelectorAll('.log-sections');
  logSections.forEach(section => {
    section.parentNode?.removeChild(section);
  });

  logger.debug('オーバーレイモードの見た目のセットアップが完了しました');
}

// アプリケーション初期化
document.addEventListener('DOMContentLoaded', initApp);

// イベントバスの状態を取得する関数を追加（デバッグ用）
window.getEventBusStatus = () => {
  return EventBus.getDetailedReport();
};

// イベントバスのデバッグモードを有効にする関数
window.enableEventBusDebug = (enable = true) => {
  EventBus.setDebug(enable);
  return `EventBusのデバッグモードを${enable ? '有効' : '無効'}にしました`;
};