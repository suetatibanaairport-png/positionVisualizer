/**
 * VirtualLeverService.js
 * 仮想レバー機能のコアサービス
 * 仮想レバーモードの管理、アニメーション制御、デバイス変換を担当
 */

import { VirtualLever } from '../../domain/entities/VirtualLever.js';
import { VirtualLeverSession } from '../../domain/entities/VirtualLeverSession.js';
import { EventTypes } from '../../domain/events/EventTypes.js';

/**
 * 仮想レバーサービスクラス
 */
export class VirtualLeverService {
  /**
   * コンストラクタ
   * @param {Object} deviceService - デバイスサービス
   * @param {Object} valueRepository - 値リポジトリ
   * @param {Object} virtualLeverRepository - 仮想レバーリポジトリ
   * @param {Object} eventBus - イベントバス
   * @param {Object} logger - ロガー
   */
  constructor(deviceService, valueRepository, virtualLeverRepository, eventBus, logger) {
    this.deviceService = deviceService;
    this.valueRepository = valueRepository;
    this.virtualLeverRepository = virtualLeverRepository;
    this.eventBus = eventBus;
    this.logger = logger || { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

    this.isVirtualMode = false;
    this.session = new VirtualLeverSession();
    this.animationFrameId = null;
    this.originalDeviceStates = new Map(); // 実デバイスの元の状態を保存
  }

  /**
   * サービス初期化
   */
  async initialize() {
    try {
      // 保存されたモード状態を復元
      this.isVirtualMode = await this.virtualLeverRepository.getMode();

      // 保存された仮想レバーを復元
      const savedLevers = await this.virtualLeverRepository.getLevers();
      savedLevers.forEach(lever => {
        this.session.addLever(lever);
      });

      // 復元した状態をイベントで通知（オーバーレイ等のリスナーに伝える）
      if (this.isVirtualMode) {
        this.eventBus.emit(EventTypes.VIRTUAL_LEVER_MODE_ENABLED, {
          leverCount: savedLevers.length,
          restored: true  // 復元による発行であることを示す
        });

        // 仮想レバーの初期値も発行
        savedLevers.forEach(lever => {
          this._emitValueUpdate(lever.id, lever.initialValue);

          // アイコンが設定されている場合、アイコン変更イベントを発行
          if (lever.iconUrl) {
            this.eventBus.emit(EventTypes.DEVICE_ICON_CHANGED, {
              deviceId: lever.id,
              iconUrl: lever.iconUrl
            });
          }

          // 名前が設定されている場合、名前変更イベントを発行
          if (lever.name) {
            this.eventBus.emit(EventTypes.DEVICE_NAME_CHANGED, {
              deviceId: lever.id,
              newName: lever.name
            });
          }
        });

        this.logger.debug(`Emitted VIRTUAL_LEVER_MODE_ENABLED (restored) with ${savedLevers.length} levers`);
      }

      this.logger.info(`VirtualLeverService initialized (mode: ${this.isVirtualMode ? 'ON' : 'OFF'}, levers: ${savedLevers.length})`);
    } catch (error) {
      this.logger.error('Failed to initialize VirtualLeverService:', error);
    }
  }

  /**
   * 仮想モードを有効化
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async enableVirtualMode() {
    if (this.isVirtualMode) {
      this.logger.warn('Virtual mode is already enabled');
      return false;
    }

    try {
      this.logger.info('Enabling virtual lever mode');

      // モードフラグ設定（先に設定）
      this.isVirtualMode = true;
      await this.virtualLeverRepository.saveMode(true);

      // イベント発行（初期値発行より先に発行してオーバーレイ側を準備）
      this.eventBus.emit(EventTypes.VIRTUAL_LEVER_MODE_ENABLED, {
        leverCount: 0  // まだレバーは変換されていない
      });

      this.logger.debug('Virtual mode enabled event emitted, now restoring or converting devices');

      // 保存された仮想レバーを復元
      const savedLevers = await this.virtualLeverRepository.getLevers();
      if (savedLevers.length > 0) {
        // 保存データがある場合は復元
        this.logger.info(`Restoring ${savedLevers.length} saved virtual levers`);
        savedLevers.forEach(lever => {
          this.session.addLever(lever);
          this._emitValueUpdate(lever.id, lever.initialValue);

          // 復元したレバーごとにイベントを発行してUIを更新
          this.eventBus.emit(EventTypes.VIRTUAL_LEVER_ADDED, { lever });
        });
      } else {
        // 保存データがない場合のみ、既存デバイスを変換（初期値発行含む）
        this.logger.debug('No saved levers found, converting existing devices');
        await this._convertExistingDevicesToVirtual();
      }

      this.logger.info(`Virtual mode enabled with ${this.session.getLeverCount()} levers`);
      return true;
    } catch (error) {
      this.logger.error('Failed to enable virtual mode:', error);
      return false;
    }
  }

  /**
   * 仮想モードを無効化
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async disableVirtualMode() {
    if (!this.isVirtualMode) {
      this.logger.warn('Virtual mode is already disabled');
      return false;
    }

    try {
      this.logger.info('Disabling virtual lever mode');

      // アニメーション停止
      if (this.session.isActive) {
        this.stopAnimation();
      }

      // モードフラグ解除
      this.isVirtualMode = false;
      await this.virtualLeverRepository.saveMode(false);

      // 仮想レバーをクリア（実デバイス由来のものは残す）
      this.session.clear();
      this.originalDeviceStates.clear();

      // イベント発行
      this.eventBus.emit(EventTypes.VIRTUAL_LEVER_MODE_DISABLED, {});

      this.logger.info('Virtual mode disabled');
      return true;
    } catch (error) {
      this.logger.error('Failed to disable virtual mode:', error);
      return false;
    }
  }

  /**
   * 仮想モード状態を取得
   * @returns {boolean} 仮想モードが有効かどうか
   */
  isVirtualModeEnabled() {
    return this.isVirtualMode;
  }

  /**
   * 仮想レバーを追加
   * @param {Object} config - 仮想レバー設定
   * @returns {Promise<VirtualLever|null>} 追加された仮想レバー
   */
  async addVirtualLever(config) {
    try {
      const leverId = config.id || `virtual_${Date.now()}`;
      const lever = new VirtualLever(leverId, config);

      // バリデーション
      const validation = lever.validate();
      if (!validation.valid) {
        this.logger.warn('Invalid virtual lever configuration:', validation.errors);
        return null;
      }

      // セッションに追加
      this.session.addLever(lever);

      // 初期値を即座にUIに反映（アニメーション開始前でも表示される）
      this._emitValueUpdate(leverId, lever.initialValue);

      // 永続化
      await this.virtualLeverRepository.saveLever(lever);

      // イベント発行
      this.eventBus.emit(EventTypes.VIRTUAL_LEVER_ADDED, {
        lever: lever.toJSON()
      });

      this.logger.info(`Virtual lever added: ${leverId}, initialValue: ${lever.initialValue}`);
      return lever;
    } catch (error) {
      this.logger.error('Failed to add virtual lever:', error);
      return null;
    }
  }

  /**
   * 仮想レバーを削除
   * @param {string} leverId - レバーID
   * @returns {Promise<boolean>} 削除成功したかどうか
   */
  async removeVirtualLever(leverId) {
    try {
      // セッションから削除
      const removed = this.session.removeLever(leverId);

      if (!removed) {
        this.logger.warn(`Virtual lever not found: ${leverId}`);
        return false;
      }

      // 永続化
      await this.virtualLeverRepository.deleteLever(leverId);

      // イベント発行
      this.eventBus.emit(EventTypes.VIRTUAL_LEVER_REMOVED, {
        leverId
      });

      this.logger.info(`Virtual lever removed: ${leverId}`);
      return true;
    } catch (error) {
      this.logger.error('Failed to remove virtual lever:', error);
      return false;
    }
  }

  /**
   * 仮想レバーを更新
   * @param {string} leverId - レバーID
   * @param {Object} config - 更新設定
   * @returns {Promise<VirtualLever|null>} 更新された仮想レバー
   */
  async updateVirtualLever(leverId, config) {
    try {
      const existingLever = this.session.getLever(leverId);
      if (!existingLever) {
        this.logger.warn(`Virtual lever not found: ${leverId}`);
        return null;
      }

      // 新しいレバーオブジェクトを作成
      const updatedLever = new VirtualLever(leverId, {
        ...existingLever.toJSON(),
        ...config
      });

      // バリデーション
      const validation = updatedLever.validate();
      if (!validation.valid) {
        this.logger.warn('Invalid virtual lever configuration:', validation.errors);
        return null;
      }

      // セッションを更新
      this.session.updateLever(updatedLever);

      // 初期値を即座にUIに反映（設定変更時にすぐ位置が反映される）
      this._emitValueUpdate(leverId, updatedLever.initialValue);

      // 永続化
      await this.virtualLeverRepository.saveLever(updatedLever);

      // イベント発行
      this.eventBus.emit(EventTypes.VIRTUAL_LEVER_UPDATED, {
        lever: updatedLever.toJSON()
      });

      this.logger.info(`Virtual lever updated: ${leverId}, initialValue: ${updatedLever.initialValue}`);
      return updatedLever;
    } catch (error) {
      this.logger.error('Failed to update virtual lever:', error);
      return null;
    }
  }

  /**
   * 全仮想レバーを取得
   * @returns {VirtualLever[]} 仮想レバーの配列
   */
  getAllVirtualLevers() {
    return this.session.getAllLevers();
  }

  /**
   * アニメーション開始
   * @returns {boolean} 開始成功したかどうか
   */
  startAnimation() {
    if (!this.isVirtualMode) {
      this.logger.warn('Cannot start animation: virtual mode is not enabled');
      return false;
    }

    if (this.session.isActive) {
      this.logger.warn('Animation is already running');
      return false;
    }

    if (this.session.getLeverCount() === 0) {
      this.logger.warn('Cannot start animation: no virtual levers');
      return false;
    }

    try {
      this.logger.info('Starting virtual lever animation');

      // セッション開始
      const now = performance.now();
      this.session.start(now);

      // アニメーションループ開始
      this._animationLoop(now);

      // イベント発行
      this.eventBus.emit(EventTypes.VIRTUAL_LEVER_ANIMATION_STARTED, {
        leverCount: this.session.getLeverCount()
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to start animation:', error);
      return false;
    }
  }

  /**
   * アニメーション停止
   * @returns {boolean} 停止成功したかどうか
   */
  stopAnimation() {
    if (!this.session.isActive) {
      this.logger.warn('Animation is not running');
      return false;
    }

    try {
      this.logger.info('Stopping virtual lever animation');

      // アニメーションフレームをキャンセル
      if (this.animationFrameId !== null) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }

      // セッション停止
      this.session.stop();

      // イベント発行
      this.eventBus.emit(EventTypes.VIRTUAL_LEVER_ANIMATION_STOPPED, {});

      return true;
    } catch (error) {
      this.logger.error('Failed to stop animation:', error);
      return false;
    }
  }

  /**
   * アニメーションをリセット（全レバーを初期値に戻す）
   * @returns {boolean} リセット成功したかどうか
   */
  resetAnimation() {
    if (!this.isVirtualMode) {
      this.logger.warn('Cannot reset animation: virtual mode is not enabled');
      return false;
    }

    try {
      this.logger.info('Resetting virtual lever animation');

      // アニメーションが実行中なら停止
      if (this.session.isActive) {
        this.stopAnimation();
      }

      // 全レバーを初期値に戻す
      const levers = this.session.getAllLevers();
      levers.forEach(lever => {
        this._emitValueUpdate(lever.id, lever.initialValue);
      });

      this.logger.info(`Reset ${levers.length} levers to initial values`);
      return true;
    } catch (error) {
      this.logger.error('Failed to reset animation:', error);
      return false;
    }
  }

  /**
   * アニメーションループ（requestAnimationFrame）- セグメント対応
   * @private
   * @param {number} timestamp - 現在時刻
   */
  _animationLoop(timestamp) {
    if (!this.session.isActive) {
      return;
    }

    // 各レバーの値を更新
    let allComplete = true;
    for (const lever of this.session.getAllLevers()) {
      const animState = this.session.getAnimationState(lever.id);
      if (!animState) continue;

      if (!animState.isComplete) {
        allComplete = false;

        const segments = lever.segments || [{
          initialValue: lever.initialValue,
          endValue: lever.endValue,
          speedPerSecond: lever.speedPerSecond,
          startDelay: lever.startDelay
        }];

        const segmentIndex = animState.currentSegmentIndex;

        // 全セグメント完了チェック
        if (segmentIndex >= segments.length) {
          animState.complete(segments[segments.length - 1].endValue);
          continue;
        }

        // アニメーション開始時刻設定
        if (!animState.isAnimating) {
          animState.start(timestamp);
        }

        // 現在値計算
        const currentValue = this._calculateCurrentValue(lever, animState, timestamp);
        const currentSegment = segments[segmentIndex];

        // セグメント完了チェック
        if (Math.abs(currentValue - currentSegment.endValue) < 0.01) {
          // 次のセグメントがあるか確認
          if (segmentIndex + 1 < segments.length) {
            // 次のセグメントへ遷移
            animState.nextSegment(timestamp);
            this._emitValueUpdate(lever.id, currentSegment.endValue);
            this.logger.debug(`Lever ${lever.id} completed segment ${segmentIndex + 1}/${segments.length}, moving to next segment`);
          } else {
            // 全セグメント完了
            animState.complete(currentSegment.endValue);
            this._emitValueUpdate(lever.id, currentSegment.endValue);
            this.logger.debug(`Lever ${lever.id} completed all ${segments.length} segments`);
          }
        } else {
          animState.currentValue = currentValue;
          this._emitValueUpdate(lever.id, currentValue);
        }
      }
    }

    // 全て完了した場合
    if (allComplete) {
      this.logger.info('All virtual lever animations completed');
      this.eventBus.emit(EventTypes.VIRTUAL_LEVER_ANIMATION_COMPLETED, {});
      this.session.isActive = false;
      this.animationFrameId = null;
      return;
    }

    // 次のフレーム
    this.animationFrameId = requestAnimationFrame((ts) => this._animationLoop(ts));
  }

  /**
   * 現在値を計算（セグメント対応）
   * @private
   * @param {VirtualLever} lever - 仮想レバー
   * @param {AnimationState} animState - アニメーション状態
   * @param {number} timestamp - 現在時刻（performance.now()）
   * @returns {number} 現在値
   */
  _calculateCurrentValue(lever, animState, timestamp) {
    const segments = lever.segments || [{
      initialValue: lever.initialValue,
      endValue: lever.endValue,
      speedPerSecond: lever.speedPerSecond,
      startDelay: lever.startDelay
    }];

    const segmentIndex = animState.currentSegmentIndex;

    // 全セグメント完了
    if (segmentIndex >= segments.length) {
      return segments[segments.length - 1].endValue;
    }

    const segment = segments[segmentIndex];
    const segmentElapsed = (timestamp - animState.segmentStartTime) / 1000; // 秒

    // ディレイチェック
    if (segmentElapsed < segment.startDelay) {
      return segment.initialValue;
    }

    // アニメーション経過時間
    const animationElapsed = segmentElapsed - segment.startDelay;

    // 移動距離計算
    const totalDistance = Math.abs(segment.endValue - segment.initialValue);
    const direction = segment.endValue > segment.initialValue ? 1 : -1;
    const distanceTraveled = segment.speedPerSecond * animationElapsed;

    // セグメント完了チェック
    if (distanceTraveled >= totalDistance) {
      return segment.endValue;
    }

    return segment.initialValue + (direction * distanceTraveled);
  }

  /**
   * 値更新イベントを発行
   * @private
   * @param {string} leverId - レバーID
   * @param {number} value - 値
   */
  _emitValueUpdate(leverId, value) {
    const lever = this.session.getLever(leverId);

    // DEVICE_VALUE_UPDATEDイベントを発行することで、既存のログ記録・オーバーレイ同期と互換
    this.eventBus.emit(EventTypes.DEVICE_VALUE_UPDATED, {
      deviceId: leverId,
      value: {
        rawValue: value,
        normalizedValue: value,
        timestamp: Date.now()
      },
      isVirtual: true,
      visible: lever ? lever.visible : true  // 表示状態を追加
    });
  }

  /**
   * 既存デバイスを仮想レバーに変換
   * @private
   */
  async _convertExistingDevicesToVirtual() {
    try {
      // 全デバイス取得
      const devices = await this.deviceService.getAllDevices(true);

      this.logger.debug(`Converting ${devices.length} devices to virtual levers`);

      for (const device of devices) {
        // 元の状態を保存
        this.originalDeviceStates.set(device.id, { ...device });

        // 現在値を取得
        const currentValue = await this.valueRepository.getCurrentValue(device.id);

        // 仮想レバー作成
        const lever = new VirtualLever(device.id, {
          name: device.name,
          iconUrl: device.iconUrl,
          sourceDeviceId: device.id,
          initialValue: currentValue?.normalizedValue ?? 50,
          endValue: currentValue?.normalizedValue ?? 50,
          speedPerSecond: 10,
          startDelay: 0
        });

        // セッションに追加
        this.session.addLever(lever);

        // 初期値を即座にUIに反映（アニメーション開始前でも表示される）
        this._emitValueUpdate(device.id, lever.initialValue);

        this.logger.debug(`Converted device to virtual lever: ${device.id}, initialValue: ${lever.initialValue}`);
      }

      // 永続化
      await this.virtualLeverRepository.saveLevers(this.session.getAllLevers());
    } catch (error) {
      this.logger.error('Failed to convert devices to virtual levers:', error);
      throw error;
    }
  }

  /**
   * サービス破棄
   */
  dispose() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.session.clear();
    this.originalDeviceStates.clear();
    this.logger.info('VirtualLeverService disposed');
  }
}
