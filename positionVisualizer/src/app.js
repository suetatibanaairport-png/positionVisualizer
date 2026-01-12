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

  // 全デバイス削除ボタンのイベントリスナー
  const clearAllDevicesButton = document.getElementById('clear-all-devices');
  if (clearAllDevicesButton) {
    logger.debug('Setting up clear-all-devices button click event');
    clearAllDevicesButton.addEventListener('click', async () => {
      if (confirm('全デバイスを削除しますか？この操作は取り消せません。')) {
        logger.info('Clearing all devices');
        await app.resetDevices();
      }
    });
  }

  // デバイス再スキャンボタンのイベントリスナー
  const rescanDevicesButton = document.getElementById('rescan-devices');
  if (rescanDevicesButton) {
    logger.debug('Setting up rescan-devices button click event');
    rescanDevicesButton.addEventListener('click', async () => {
      logger.info('Triggering device rescan');

      // ボタンを無効化してスキャン中であることを表示
      rescanDevicesButton.disabled = true;
      rescanDevicesButton.textContent = '🔍 スキャン中...';

      try {
        // AppControllerのscanDevicesメソッドを呼び出し
        if (app && typeof app.scanDevices === 'function') {
          await app.scanDevices();
          logger.info('Device rescan completed successfully');
        } else {
          logger.warn('scanDevices method not available on AppController');
        }
      } catch (error) {
        logger.error('Error during device rescan:', error);
      } finally {
        // ボタンを再度有効化
        setTimeout(() => {
          rescanDevicesButton.disabled = false;
          rescanDevicesButton.textContent = '🔍 デバイスを再スキャン';
        }, 2000); // 2秒後に元に戻す（ユーザーフィードバック）
      }
    });
  }

  // 応答性設定のイベントリスナー
  // トランジション時間
  const transitionTimeInput = document.getElementById('transition-time');
  const transitionTimeValue = document.getElementById('transition-time-value');
  if (transitionTimeInput && transitionTimeValue) {
    transitionTimeInput.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      transitionTimeValue.textContent = `${value.toFixed(2)}秒`;
      // 設定を更新（MeterRendererに反映）
      if (app && app.meterViewModel) {
        app.meterViewModel.options.transitionTime = value;
        // MeterRendererを再初期化して設定を反映
        if (app.meterRenderer) {
          app.meterRenderer.config.transitionTime = value;
        }
      }
      logger.debug(`トランジション時間を ${value}秒 に変更`);
    });
  }

  // 平滑化係数
  const smoothingFactorInput = document.getElementById('smoothing-factor');
  const smoothingFactorValue = document.getElementById('smoothing-factor-value');
  if (smoothingFactorInput && smoothingFactorValue) {
    smoothingFactorInput.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      smoothingFactorValue.textContent = value.toFixed(2);
      // 設定を更新（MeterViewModelに反映）
      if (app && app.meterViewModel) {
        app.meterViewModel.options.smoothingFactor = value;
      }
      logger.debug(`平滑化係数を ${value} に変更`);
    });
  }

  // 補間時間
  const interpolationTimeInput = document.getElementById('interpolation-time');
  const interpolationTimeValue = document.getElementById('interpolation-time-value');
  if (interpolationTimeInput && interpolationTimeValue) {
    interpolationTimeInput.addEventListener('input', (e) => {
      const value = parseInt(e.target.value, 10);
      interpolationTimeValue.textContent = `${value}ms`;
      // 設定を更新（MeterViewModelに反映）
      if (app && app.meterViewModel) {
        app.meterViewModel.options.interpolationTime = value;
      }
      logger.debug(`補間時間を ${value}ms に変更`);
    });
  }

  // 注意: デバイスイベント（接続/切断/リセット/表示変更/名前変更/アイコン変更）は
  // AppControllerが処理するため、ここでの登録は不要
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

    // DeviceListViewModelはUIComponentManager経由で取得
    const deviceListViewModel = app.uiComponentManager?.getDeviceListViewModel();

    // DeviceListViewModelを使用してデバイス一覧を更新
    if (deviceListViewModel) {
      logger.debug('DeviceListViewModel経由でデバイス一覧を初期化');
      deviceListViewModel.updateDeviceList(connectedDevices);
    } else {
      // AppController.start()がDeviceListViewModelを初期化するため、
      // ここでの初期化は不要。デバッグログのみ出力
      logger.debug('DeviceListViewModelはAppController.start()で初期化されます');
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