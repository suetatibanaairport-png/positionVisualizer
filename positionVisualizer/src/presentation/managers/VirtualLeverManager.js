/**
 * VirtualLeverManager.js
 * プレゼンテーション層での仮想レバー操作の調整役
 * VirtualLeverServiceへの委譲とイベントリスナー設定を担当
 */

import { EventTypes } from '../../domain/events/EventTypes.js';

/**
 * 仮想レバーマネージャークラス
 */
export class VirtualLeverManager {
  /**
   * コンストラクタ
   * @param {Object} virtualLeverService - 仮想レバーサービス
   * @param {Object} meterViewModel - メータービューモデル
   * @param {Object} eventBus - イベントバス
   * @param {Object} logger - ロガー
   */
  constructor(virtualLeverService, meterViewModel, eventBus, logger) {
    this.virtualLeverService = virtualLeverService;
    this.meterViewModel = meterViewModel;
    this.eventBus = eventBus;
    this.logger = logger || { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

    this._setupEventListeners();
  }

  /**
   * イベントリスナーのセットアップ
   * @private
   */
  _setupEventListeners() {
    // モード変更イベント
    this.eventBus.on(EventTypes.VIRTUAL_LEVER_MODE_ENABLED, () => {
      this.logger.debug('Virtual lever mode enabled');
      // MeterViewModelに仮想モードを通知
      if (this.meterViewModel && this.meterViewModel.setVirtualMode) {
        this.meterViewModel.setVirtualMode(true);
      }
    });

    this.eventBus.on(EventTypes.VIRTUAL_LEVER_MODE_DISABLED, () => {
      this.logger.debug('Virtual lever mode disabled');
      // MeterViewModelに仮想モードを通知
      if (this.meterViewModel && this.meterViewModel.setVirtualMode) {
        this.meterViewModel.setVirtualMode(false);
      }
    });

    // アニメーション状態イベント
    this.eventBus.on(EventTypes.VIRTUAL_LEVER_ANIMATION_STARTED, (data) => {
      this.logger.info(`Virtual lever animation started (${data.leverCount} levers)`);
    });

    this.eventBus.on(EventTypes.VIRTUAL_LEVER_ANIMATION_STOPPED, () => {
      this.logger.info('Virtual lever animation stopped');
    });

    this.eventBus.on(EventTypes.VIRTUAL_LEVER_ANIMATION_COMPLETED, () => {
      this.logger.info('Virtual lever animation completed');
    });

    // レバー追加/削除イベント
    this.eventBus.on(EventTypes.VIRTUAL_LEVER_ADDED, (data) => {
      this.logger.debug(`Virtual lever added: ${data.lever.id}`);
    });

    this.eventBus.on(EventTypes.VIRTUAL_LEVER_REMOVED, (data) => {
      this.logger.debug(`Virtual lever removed: ${data.leverId}`);
    });

    this.eventBus.on(EventTypes.VIRTUAL_LEVER_UPDATED, (data) => {
      this.logger.debug(`Virtual lever updated: ${data.lever.id}`);
    });
  }

  /**
   * 仮想モードを有効化
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async enableVirtualMode() {
    this.logger.info('Enabling virtual mode via manager');
    return await this.virtualLeverService.enableVirtualMode();
  }

  /**
   * 仮想モードを無効化
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async disableVirtualMode() {
    this.logger.info('Disabling virtual mode via manager');
    return await this.virtualLeverService.disableVirtualMode();
  }

  /**
   * 仮想モード状態を取得
   * @returns {boolean} 仮想モードが有効かどうか
   */
  isVirtualModeEnabled() {
    return this.virtualLeverService.isVirtualModeEnabled();
  }

  /**
   * 仮想レバーを追加
   * @param {Object} config - 仮想レバー設定
   * @returns {Promise<Object|null>} 追加された仮想レバー
   */
  async addLever(config) {
    this.logger.debug('Adding virtual lever via manager:', config);
    return await this.virtualLeverService.addVirtualLever(config);
  }

  /**
   * 仮想レバーを削除
   * @param {string} leverId - レバーID
   * @returns {Promise<boolean>} 削除成功したかどうか
   */
  async removeLever(leverId) {
    this.logger.debug(`Removing virtual lever via manager: ${leverId}`);
    return await this.virtualLeverService.removeVirtualLever(leverId);
  }

  /**
   * 仮想レバーを更新
   * @param {string} leverId - レバーID
   * @param {Object} config - 更新設定
   * @returns {Promise<Object|null>} 更新された仮想レバー
   */
  async updateLever(leverId, config) {
    this.logger.debug(`Updating virtual lever via manager: ${leverId}`, config);
    return await this.virtualLeverService.updateVirtualLever(leverId, config);
  }

  /**
   * 全仮想レバーを取得
   * @returns {Array} 仮想レバーの配列
   */
  getAllLevers() {
    return this.virtualLeverService.getAllVirtualLevers();
  }

  /**
   * アニメーション開始
   * @returns {boolean} 開始成功したかどうか
   */
  startAnimation() {
    this.logger.info('Starting animation via manager');
    return this.virtualLeverService.startAnimation();
  }

  /**
   * アニメーション停止
   * @returns {boolean} 停止成功したかどうか
   */
  stopAnimation() {
    this.logger.info('Stopping animation via manager');
    return this.virtualLeverService.stopAnimation();
  }

  /**
   * アニメーションをリセット（全レバーを初期値に戻す）
   * @returns {boolean} リセット成功したかどうか
   */
  resetAnimation() {
    this.logger.info('Resetting animation via manager');
    return this.virtualLeverService.resetAnimation();
  }

  /**
   * アニメーション状態を取得
   * @returns {boolean} アニメーション実行中かどうか
   */
  isAnimating() {
    return this.virtualLeverService.session.isActive;
  }

  /**
   * マネージャーを破棄
   */
  dispose() {
    this.logger.info('VirtualLeverManager disposed');
    // イベントリスナーの解除は EventBus の実装に依存
  }
}
