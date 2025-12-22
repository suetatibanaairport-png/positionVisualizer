/**
 * AppBootstrap.js
 * アプリケーションの初期化と依存関係の注入を担当する
 * クリーンアーキテクチャの各レイヤーを接続し、アプリケーションを起動する
 */

// インフラ層
import { LocalStorageAdapter } from '../infrastructure/adapters/LocalStorageAdapter.js';
import { WebSocketClient } from '../infrastructure/adapters/WebSocketClient.js';
import { DeviceRepository } from '../infrastructure/repositories/DeviceRepository.js';
import { ValueRepository } from '../infrastructure/repositories/ValueRepository.js';
import { SettingsRepository } from '../infrastructure/repositories/SettingsRepository.js';
import { EventBus } from '../infrastructure/services/EventBus.js';
import { AppLogger } from '../infrastructure/services/Logger.js';

// アプリケーション層
import { DeviceService } from './services/DeviceService.js';
import { MonitorValuesUseCase } from './usecases/MonitorValuesUseCase.js';
import { RecordSessionUseCase } from './usecases/RecordSessionUseCase.js';
import { ReplaySessionUseCase } from './usecases/ReplaySessionUseCase.js';

// プレゼンテーション層
import { MeterViewModel } from '../presentation/viewmodels/MeterViewModel.js';
import { MeterRenderer } from '../presentation/renderers/MeterRenderer.js';
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
      ...options
    };

    // アプリケーションインスタンス
    this.app = null;

    // ロガー
    this.logger = AppLogger.createLogger('AppBootstrap');
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

    return {
      storageAdapter,
      webSocketClient,
      deviceRepository,
      valueRepository,
      settingsRepository,
      eventBus: EventBus
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

    // サービス
    const deviceService = new DeviceService(
      infraComponents.deviceRepository,
      infraComponents.valueRepository,
      {
        maxDevices: this.options.maxDevices,
        deviceTimeoutMs: 10000,
        autoConnect: true
      }
    );

    // ユースケース
    const monitorUseCase = new MonitorValuesUseCase(
      infraComponents.deviceRepository,
      infraComponents.valueRepository,
      {
        monitoringInterval: this.options.monitorInterval
      }
    );

    const recordSessionUseCase = new RecordSessionUseCase(
      infraComponents.sessionRepository || { // セッションリポジトリがない場合はダミー
        saveSession: async () => true,
        getSessions: async () => [],
        getSession: async () => null,
        exportSession: async () => true
      },
      infraComponents.valueRepository
    );

    const replaySessionUseCase = new ReplaySessionUseCase(
      infraComponents.sessionRepository || { // セッションリポジトリがない場合はダミー
        getSession: async () => null
      },
      infraComponents.valueRepository,
      {
        autoRewind: true,
        replaySpeedMultiplier: 1.0
      }
    );

    return {
      deviceService,
      monitorUseCase,
      recordSessionUseCase,
      replaySessionUseCase
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

    // ViewModel
    const meterViewModel = new MeterViewModel({
      maxDevices: this.options.maxDevices,
      interpolationTime: 200
    });

    // レンダラー
    const meterRenderer = containerElement ? new MeterRenderer(containerElement, {
      size: Math.min(containerElement.clientWidth || 500, containerElement.clientHeight || 500)
    }) : null;

    return {
      meterViewModel,
      meterRenderer
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

      // アプリケーション層
      deviceService: applicationComponents.deviceService,
      monitorUseCase: applicationComponents.monitorUseCase,
      recordSessionUseCase: applicationComponents.recordSessionUseCase,
      replaySessionUseCase: applicationComponents.replaySessionUseCase,

      // プレゼンテーション層
      meterViewModel: presentationComponents.meterViewModel,
      meterRenderer: presentationComponents.meterRenderer,

      // 設定
      webSocketUrl: this.options.webSocketUrl,
      options: {
        monitorInterval: this.options.monitorInterval,
        autoConnect: true
      }
    });
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