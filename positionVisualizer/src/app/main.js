/**
 * main.js - Application Entry Point
 * メインページのエントリーポイント
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
      'src/infra/repositories/DeviceConfigRepository.js',
      'src/infra/repositories/SessionLogRepository.js',
      'src/infra/bridge/WebSocketBridgeClient.js',
      'src/infra/bridge/HttpPollingClient.js',
      'src/infra/storage/LogFileStorage.js',
      'src/infra/storage/SettingsStorage.js',
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
      'src/usecases/LiveMonitorService.js',
      'src/usecases/RecordingService.js',
      'src/usecases/ReplayService.js',
      'src/usecases/SettingsService.js',
      'src/usecases/IconService.js'
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
      'src/presentation/viewmodels/MainPageViewModel.js',
      'src/presentation/bindings/MainPageBindings.js'
    ];

    for (const src of presentationScripts) {
      await loadScript(src);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * アプリケーションを初期化
   */
  async function initApp() {
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
      if (!window.ValueRange || !window.DeviceConfig || !window.DeviceState || 
          !window.SessionLog || !window.LogEntry) {
        throw new Error('Domain Layer modules failed to load');
      }

      if (!window.DeviceStateRepository || !window.ValueRangeRepository || 
          !window.DeviceConfigRepository || !window.SessionLogRepository) {
        throw new Error('Infra Layer repositories failed to load');
      }

      if (!window.LogFileStorage || !window.SettingsStorage) {
        throw new Error('Infra Layer storage failed to load');
      }

      if (!window.LiveMonitorService || !window.RecordingService || 
          !window.ReplayService || !window.SettingsService || !window.IconService) {
        throw new Error('UseCase Layer services failed to load');
      }

      if (!window.MainPageViewModel || !window.MainPageBindings) {
        throw new Error('Presentation Layer modules failed to load');
      }

      // Initialize repositories (Infra Layer)
      const deviceStateRepository = new window.DeviceStateRepository();
      const valueRangeRepository = new window.ValueRangeRepository(0, 100, '%');
      const deviceConfigRepository = new window.DeviceConfigRepository();
      const sessionLogRepository = new window.SessionLogRepository();

      // Initialize storage (Infra Layer)
      const logFileStorage = new window.LogFileStorage();
      const settingsStorage = new window.SettingsStorage();

      // Initialize clients (Infra Layer)
      const webSocketClient = new window.WebSocketBridgeClient();
      const overlayChannel = new window.OverlayChannel();

      // Initialize UseCase services
      const liveMonitorService = new window.LiveMonitorService(deviceStateRepository, valueRangeRepository);
      const recordingService = new window.RecordingService(sessionLogRepository, logFileStorage);
      const replayService = new window.ReplayService(logFileStorage, deviceStateRepository);
      const settingsService = new window.SettingsService(valueRangeRepository);
      const iconService = new window.IconService(deviceConfigRepository);

      // Initialize initial state from DOM
      const initialNames = [];
      for (let i = 1; i <= 6; i++) {
        const el = document.getElementById(`device${i}-name`);
        initialNames.push(el ? (el.value || '') : '');
      }

      // Create initial MeterState (legacy compatibility)
      const MeterState = window.MVVM && window.MVVM.MeterState;
      const initial = new MeterState(
        [],
        initialNames,
        null
      );

      // Initialize ViewModel (Presentation Layer)
      const viewModel = new window.MainPageViewModel(
        initial,
        liveMonitorService,
        recordingService,
        replayService,
        settingsService,
        iconService
      );

      // Initialize bindings (Presentation Layer)
      const mainPageBindings = new window.MainPageBindings(
        viewModel,
        liveMonitorService,
        recordingService,
        replayService,
        settingsService,
        iconService,
        webSocketClient,
        overlayChannel
      );
      mainPageBindings.attach();

      // Initialize UI bindings (legacy compatibility)
      if (window.MVVM && window.MVVM.Bindings) {
        const uiBinding = new window.MVVM.Bindings.UIBinding(viewModel);
        uiBinding.monitorBinding = mainPageBindings; // For recording compatibility
        uiBinding.attach();
      }

      // Start monitoring
      viewModel.start();

      console.log('Application initialized successfully');
    } catch (error) {
      console.error('Failed to initialize application:', error);
      // Show error message to user
      const container = document.querySelector('.container');
      if (container) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = 'padding: 20px; background: #ffebee; color: #c62828; border-radius: 8px; margin: 20px;';
        errorDiv.innerHTML = '<h3>初期化エラー</h3><p>アプリケーションの初期化に失敗しました。コンソールを確認してください。</p>';
        container.insertBefore(errorDiv, container.firstChild);
      }
    }
  }

  // Start initialization
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();

