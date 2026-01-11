/**
 * AppBootstrap.js
 * アプリケーションの初期化と依存関係の注入を担当する
 * クリーンアーキテクチャの各レイヤーを接続し、アプリケーションを起動する
 */

// インフラ層
import { LocalStorageAdapter } from '../infrastructure/adapters/LocalStorageAdapter.js';
import { WebSocketClient } from '../infrastructure/adapters/WebSocketClient.js';
import { EventBusAdapter } from '../infrastructure/adapters/EventBusAdapter.js';
import { LoggerAdapter } from '../infrastructure/adapters/LoggerAdapter.js';
import { DeviceRepository } from '../infrastructure/repositories/DeviceRepository.js';
import { ValueRepository } from '../infrastructure/repositories/ValueRepository.js';
import { SettingsRepository } from '../infrastructure/repositories/SettingsRepository.js';
import { LogSessionRepository } from '../infrastructure/repositories/LogSessionRepository.js';
import { OverlaySyncService } from '../infrastructure/services/OverlaySyncService.js';

// アプリケーション層
import { DeviceService } from './services/DeviceService.js';
import { LogService } from './services/log/LogService.js';
import { MonitorValuesUseCase } from './usecases/MonitorValuesUseCase.js';
import { RecordSessionUseCase } from './usecases/RecordSessionUseCase.js';
import { LogReplayUseCase } from './usecases/LogReplayUseCase.js';

// プレゼンテーション層
import { MeterViewModel } from '../presentation/viewmodels/MeterViewModel.js';
import { MeterRenderer } from '../presentation/renderers/MeterRenderer.js';
import { DeviceListViewModel } from '../presentation/viewmodels/DeviceListViewModel.js';
import { AppController } from '../presentation/controllers/AppController.js';

/**
 * アプリケーションブートストラップクラス
 */
class AppBootstrap {
  /**
   * ブートストラップのコンストラクタ
   * @param {Object} options オプション設定
   */
  constructor(options = {}) {
    this.options = {
      webSocketUrl: options.webSocketUrl || 'ws://localhost:8123',
      appNamespace: options.appNamespace || 'positionVisualizer',
      maxDevices: options.maxDevices || 6,
      monitorInterval: options.monitorInterval || 100,
      containerId: options.containerId || 'app-container',
      autoStart: options.autoStart || true,
      deviceTimeoutMs: options.deviceTimeoutMs || 0, // 0を設定してタイムアウト機能を完全に無効化
      ...options
    };

    // アプリケーションインスタンス
    this.app = null;

    // ロガー（アダプターを使用）
    this.logger = new LoggerAdapter('AppBootstrap');
  }

  /**
   * アプリケーション初期化
   * @returns {Promise<AppController>} アプリケーションコントローラー
   */
  async initialize() {
    this.logger.info('Initializing application...');

    try {
      // 1. インフラ層のインスタンス作成
      const infraComponents = this._initializeInfrastructureLayer();

      // 2. アプリケーション層のインスタンス作成
      const applicationComponents = this._initializeApplicationLayer(infraComponents);

      // 3. プレゼンテーション層のインスタンス作成
      const presentationComponents = this._initializePresentationLayer(
        infraComponents,
        applicationComponents
      );

      // 4. アプリケーションコントローラー作成と依存関係の注入
      this.app = this._createAppController(
        infraComponents,
        applicationComponents,
        presentationComponents
      );

      // 5. 自動起動オプションが有効なら、アプリケーション起動
      if (this.options.autoStart) {
        await this.app.start();
      }

      this.logger.info('Application initialization complete');
      return this.app;
    } catch (error) {
      this.logger.error('Error initializing application:', error);
      throw error;
    }
  }

  /**
   * インフラ層の初期化
   * @private
   * @returns {Object} インフラ層のコンポーネント
   */
  _initializeInfrastructureLayer() {
    this.logger.debug('Initializing infrastructure layer');

    // ストレージアダプター
    const storageAdapter = new LocalStorageAdapter(this.options.appNamespace);

    // WebSocketクライアント
    const webSocketClient = new WebSocketClient(this.options.webSocketUrl, {
      reconnectInterval: 2000,
      maxReconnectAttempts: 5
    });

    // リポジトリ
    const deviceRepository = new DeviceRepository(storageAdapter);
    const valueRepository = new ValueRepository(storageAdapter);
    const settingsRepository = new SettingsRepository(storageAdapter);
    const logSessionRepository = new LogSessionRepository(storageAdapter);

    // イベントバスとロガーのアダプターを作成
    const eventBusAdapter = new EventBusAdapter();
    const loggerAdapter = new LoggerAdapter('System');

    // オーバーレイ同期サービス（BroadcastChannelでウィンドウ間同期）
    const overlaySyncLogger = new LoggerAdapter('OverlaySyncService');
    const isOverlay = this.options.isOverlay || false;
    const overlaySyncService = new OverlaySyncService(
      eventBusAdapter,
      overlaySyncLogger,
      isOverlay
    );

    return {
      storageAdapter,
      webSocketClient,
      deviceRepository,
      valueRepository,
      settingsRepository,
      logSessionRepository,
      eventBus: eventBusAdapter,
      logger: loggerAdapter,
      overlaySyncService
    };
  }

  /**
   * アプリケーション層の初期化
   * @private
   * @param {Object} infraComponents インフラ層のコンポーネント
   * @returns {Object} アプリケーション層のコンポーネント
   */
  _initializeApplicationLayer(infraComponents) {
    this.logger.debug('Initializing application layer');

    // 各サービス/ユースケース用のロガーを作成
    const deviceServiceLogger = new LoggerAdapter('DeviceService');
    const monitorUseCaseLogger = new LoggerAdapter('MonitorValuesUseCase');
    const recordSessionLogger = new LoggerAdapter('RecordSessionUseCase');
    const replaySessionLogger = new LoggerAdapter('LogReplayUseCase');
    const logServiceLogger = new LoggerAdapter('LogService');

    // サービス（依存性注入）
    const deviceService = new DeviceService(
      infraComponents.deviceRepository,
      infraComponents.valueRepository,
      infraComponents.eventBus,
      deviceServiceLogger,
      {
        maxDevices: this.options.maxDevices,
        deviceTimeoutMs: 0, // 0を設定してタイムアウト機能を完全に無効化
        autoConnect: true
      }
    );

    // ユースケース（依存性注入）
    const monitorUseCase = new MonitorValuesUseCase(
      infraComponents.deviceRepository,
      infraComponents.valueRepository,
      infraComponents.eventBus,
      monitorUseCaseLogger,
      {
        monitoringInterval: this.options.monitorInterval
      }
    );

    const recordSessionUseCase = new RecordSessionUseCase(
      infraComponents.logSessionRepository,
      infraComponents.valueRepository,
      infraComponents.eventBus,
      recordSessionLogger
    );

    const replaySessionUseCase = new LogReplayUseCase(
      infraComponents.logSessionRepository,
      infraComponents.eventBus,
      replaySessionLogger,
      {
        autoRewind: true,
        replaySpeedMultiplier: 1.0
      }
    );

    // ログサービス（依存性注入）
    const logService = new LogService(
      infraComponents.logSessionRepository,
      infraComponents.deviceRepository,
      infraComponents.eventBus,
      logServiceLogger
    );

    return {
      deviceService,
      monitorUseCase,
      recordSessionUseCase,
      replaySessionUseCase,
      logService
    };
  }

  /**
   * プレゼンテーション層の初期化
   * @private
   * @param {Object} infraComponents インフラ層のコンポーネント
   * @param {Object} applicationComponents アプリケーション層のコンポーネント
   * @returns {Object} プレゼンテーション層のコンポーネント
   */
  _initializePresentationLayer(infraComponents, applicationComponents) {
    this.logger.debug('Initializing presentation layer');

    // コンテナ要素の取得
    let containerElement = null;
    if (typeof document !== 'undefined') {
      containerElement = document.getElementById(this.options.containerId);

      // コンテナがなければ作成
      if (!containerElement) {
        this.logger.debug(`Container element "${this.options.containerId}" not found, creating it`);
        containerElement = document.createElement('div');
        containerElement.id = this.options.containerId;
        document.body.appendChild(containerElement);
      }
    }

    // ViewModel（インターフェースを注入）
    const meterViewModel = new MeterViewModel(
      {
        maxDevices: this.options.maxDevices,
        interpolationTime: 200
      },
      infraComponents.eventBus,
      infraComponents.logger
    );

    // レンダラー
    const meterRenderer = containerElement ? new MeterRenderer(containerElement, {
      size: Math.min(containerElement.clientWidth || 500, containerElement.clientHeight || 500)
    }) : null;

    // デバイスリストViewModel（インターフェースを注入）
    const deviceListViewModel = new DeviceListViewModel(
      {
        containerSelector: '#device-inputs',
        noDevicesSelector: '#no-devices-message'
      },
      infraComponents.eventBus,
      infraComponents.logger
    );

    return {
      meterViewModel,
      meterRenderer,
      deviceListViewModel
    };
  }

  /**
   * アプリケーションコントローラーの作成
   * @private
   * @param {Object} infraComponents インフラ層のコンポーネント
   * @param {Object} applicationComponents アプリケーション層のコンポーネント
   * @param {Object} presentationComponents プレゼンテーション層のコンポーネント
   * @returns {AppController} アプリケーションコントローラー
   */
  _createAppController(infraComponents, applicationComponents, presentationComponents) {
    this.logger.debug('Creating application controller');

    // コントローラー作成
    return new AppController({
      // インフラ層
      webSocketClient: infraComponents.webSocketClient,
      storageAdapter: infraComponents.storageAdapter,
      settingsRepository: infraComponents.settingsRepository,
      eventEmitter: infraComponents.eventBus, // インターフェースに基づく注入
      logger: infraComponents.logger,         // インターフェースに基づく注入

      // アプリケーション層
      deviceService: applicationComponents.deviceService,
      monitorUseCase: applicationComponents.monitorUseCase,
      recordSessionUseCase: applicationComponents.recordSessionUseCase,
      replaySessionUseCase: applicationComponents.replaySessionUseCase,
      logService: applicationComponents.logService,

      // プレゼンテーション層
      meterViewModel: presentationComponents.meterViewModel,
      meterRenderer: presentationComponents.meterRenderer,
      deviceListViewModel: presentationComponents.deviceListViewModel,

      // 設定
      webSocketUrl: this.options.webSocketUrl,
      options: {
        monitorInterval: this.options.monitorInterval,
        autoConnect: true
      }
    });
  }

  /**
   * アプリケーションコントローラーの取得
   * @returns {AppController} アプリケーションコントローラー
   */
  getController() {
    return this.app;
  }

  /**
   * アプリケーションの起動
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async start() {
    if (!this.app) {
      await this.initialize();
    }

    return await this.app.start();
  }

  /**
   * アプリケーションの停止
   */
  stop() {
    if (this.app) {
      this.app.dispose();
      this.app = null;
    }
  }
}

export { AppBootstrap };