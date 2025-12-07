/**
 * overlayApp.js - Application Entry Point
 * オーバーレイウィンドウのエントリーポイント
 * ARCHITECTURE.mdに従った依存性注入パターンで実装
 */
(function() {
  'use strict';

  /**
   * スクリプトを動的に読み込む
   */
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      if (src.includes('meterRenderer.js') && window.MeterRenderer) {
        resolve();
        return;
      }
      if (src.includes('iconRenderer.js') && window.IconRenderer) {
        resolve();
        return;
      }
      if (src.includes('event.js') && window.MVVM && window.MVVM.Emitter) {
        resolve();
        return;
      }
      if (src.includes('model.js') && window.MVVM && window.MVVM.MeterState) {
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      const cacheBuster = '?v=' + Date.now();
      script.src = src + cacheBuster;
      script.onload = resolve;
      script.onerror = () => {
        console.error('Failed to load script:', src);
        reject(new Error('Failed to load: ' + src));
      };
      document.head.appendChild(script);
    });
  }

  /**
   * Domain Layerを読み込む
   */
  async function loadDomainLayer() {
    const domainScripts = [
      'src/domain/ValueRange.js',
      'src/domain/DeviceConfig.js',
      'src/domain/DeviceState.js',
      'src/domain/SessionLog.js',
      'src/domain/LogEntry.js'
    ];

    for (const src of domainScripts) {
      await loadScript(src);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * Infra Layerを読み込む
   */
  async function loadInfraLayer() {
    const infraScripts = [
      'src/infra/repositories/DeviceStateRepository.js',
      'src/infra/repositories/ValueRangeRepository.js',
      'src/infra/bridge/WebSocketBridgeClient.js',
      'src/infra/bridge/HttpPollingClient.js',
      'src/infra/storage/LogFileStorage.js',
      'src/infra/sync/OverlayChannel.js'
    ];

    for (const src of infraScripts) {
      await loadScript(src);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * UseCase Layerを読み込む
   */
  async function loadUseCaseLayer() {
    const useCaseScripts = [
      'src/usecases/ReplayService.js',
      'src/usecases/SettingsService.js'
    ];

    for (const src of useCaseScripts) {
      await loadScript(src);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * Presentation Layerを読み込む
   */
  async function loadPresentationLayer() {
    // Legacy MVVM modules (for compatibility)
    const legacyScripts = [
      'js/core/event.js',
      'js/core/model.js',
      'js/core/viewModel.js',
      'js/views/meterRenderer.js',
      'js/views/iconRenderer.js'
    ];

    for (const src of legacyScripts) {
      await loadScript(src);
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // New Presentation Layer
    const presentationScripts = [
      'src/presentation/viewmodels/OverlayViewModel.js',
      'src/presentation/bindings/OverlayBindings.js'
    ];

    for (const src of presentationScripts) {
      await loadScript(src);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * アプリケーションを初期化
   */
  async function initOverlayApp() {
    try {
      // Wait for DOM
      if (document.readyState === 'loading') {
        await new Promise(resolve => window.addEventListener('DOMContentLoaded', resolve));
      }

      // Load all layers in order
      await loadDomainLayer();
      await loadInfraLayer();
      await loadUseCaseLayer();
      await loadPresentationLayer();

      // Verify required modules
      if (!window.ValueRange || !window.DeviceState) {
        throw new Error('Domain Layer modules failed to load');
      }

      if (!window.DeviceStateRepository || !window.ValueRangeRepository) {
        throw new Error('Infra Layer repositories failed to load');
      }

      if (!window.LogFileStorage) {
        throw new Error('Infra Layer storage failed to load');
      }

      if (!window.ReplayService || !window.SettingsService) {
        throw new Error('UseCase Layer services failed to load');
      }

      if (!window.OverlayViewModel || !window.OverlayBindings) {
        throw new Error('Presentation Layer modules failed to load');
      }

      // Initialize repositories (Infra Layer)
      const valueRangeRepository = new window.ValueRangeRepository(0, 100, '%');
      const deviceStateRepository = new window.DeviceStateRepository();

      // Initialize storage (Infra Layer)
      const logFileStorage = new window.LogFileStorage();

      // Initialize clients (Infra Layer)
      const webSocketClient = new window.WebSocketBridgeClient();
      const httpPollingClient = new window.HttpPollingClient();
      const overlayChannel = new window.OverlayChannel();

      // Initialize UseCase services
      const replayService = new window.ReplayService(logFileStorage, deviceStateRepository);
      const settingsService = new window.SettingsService(valueRangeRepository);

      // Create initial MeterState (legacy compatibility)
      const MeterState = window.MVVM && window.MVVM.MeterState;
      const initial = new MeterState([], ['','','','','',''], null);

      // Initialize ViewModel (Presentation Layer)
      const viewModel = new window.OverlayViewModel(
        initial,
        replayService,
        settingsService
      );

      // Initialize bindings (Presentation Layer)
      const overlayBindings = new window.OverlayBindings(
        viewModel,
        webSocketClient,
        httpPollingClient,
        overlayChannel
      );
      overlayBindings.attach();

      console.log('Overlay application initialized successfully');
    } catch (error) {
      console.error('Failed to initialize overlay application:', error);
      // Show error message
      const container = document.getElementById('meter-container');
      if (container) {
        container.innerHTML = '<div style="padding: 20px; color: #c62828;">初期化エラー: コンソールを確認してください</div>';
      }
    }
  }

  // Start initialization
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initOverlayApp);
  } else {
    initOverlayApp();
  }
})();

