/**
 * DeviceListViewModel.js
 * デバイスリスト表示のためのビューモデルクラス
 * UIの状態を管理し、アプリケーション層とプレゼンテーション層の橋渡しをする
 */

import { IEventEmitter } from '../services/IEventEmitter.js';
import { ILogger } from '../services/ILogger.js';
import { EventTypes } from '../../domain/events/EventTypes.js';
import { EventBus } from '../../infrastructure/services/EventBus.js';

/**
 * デバイスリストのビューモデルクラス
 */
export class DeviceListViewModel {
  /**
   * デバイスリストのビューモデルを初期化
   * @param {Object} options オプション設定
   * @param {IEventEmitter} eventEmitter イベントエミッター
   * @param {ILogger} logger ロガー
   */
  constructor(options = {}, eventEmitter, logger) {
    this.options = {
      containerSelector: '#device-inputs',     // デバイスリストコンテナのセレクタ
      noDevicesSelector: '#no-devices-message', // デバイスなしメッセージのセレクタ
      ...options
    };

    // インターフェースを介した依存（依存性逆転の原則を適用）
    // EventBusをデフォルトとして使用（後方互換性のため）
    this.eventEmitter = eventEmitter || (typeof EventBus !== 'undefined' ? EventBus : null);
    this.logger = logger || {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {}
    };

    // EventBusが利用可能だが、eventEmitterがない場合
    if (!this.eventEmitter && typeof EventBus !== 'undefined') {
      this.logger.debug('EventEmitter not provided, using EventBus as fallback');
      this.eventEmitter = EventBus;
    }

    // コンテナ要素の参照
    this.containerElement = null;
    this.noDevicesElement = null;

    // 再生モードフラグ
    this.isPlaybackMode = false;

    // 初期状態
    this.state = {
      devices: [],           // デバイスの配列
      isReplayMode: false    // 再生モードかどうか
    };

    // 再生モードのイベントリスナーを設定
    EventBus.on('playbackModeChanged', (event) => {
      this.isPlaybackMode = event.isPlaybackMode;
      this.logger.debug(`再生モード変更: ${this.isPlaybackMode ? 'ON' : 'OFF'}`);

      // 再生モードの変更に合わせてデバイスリストを更新
      this.state.isReplayMode = this.isPlaybackMode;

      // デバイスの一時的無効化状態を更新
      this._updateDeviceTemporaryDisabled();

      // 表示を更新
      this.updateDeviceList(this.state.devices, this.isPlaybackMode);
    });

    this.logger.debug('DeviceListViewModel initialized');
  }

  /**
   * 初期化 - DOM要素の参照を取得
   */
  initialize() {
    this.containerElement = document.querySelector(this.options.containerSelector);
    this.noDevicesElement = document.querySelector(this.options.noDevicesSelector);

    if (!this.containerElement) {
      this.logger.warn('Device inputs container not found');
      return false;
    }

    return true;
  }

  /**
   * デバイスリストを更新
   * @param {Array} devices デバイス情報の配列
   * @param {boolean} isReplayMode 再生モードかどうか
   */
  updateDeviceList(devices, isReplayMode = false) {
    if (!this.containerElement) {
      if (!this.initialize()) {
        return;
      }
    }

    // 状態を更新
    this.state.devices = devices;
    this.state.isReplayMode = isReplayMode;
    this.isPlaybackMode = isReplayMode; // インスタンス変数も更新

    // 再生モード中ならデバイスの一時的無効化状態を更新
    if (isReplayMode) {
      this._updateDeviceTemporaryDisabled();
    }

    // 表示対象デバイスのフィルタリング
    const visibleDevices = devices.filter(device => device.visible !== false);

    if (visibleDevices.length === 0) {
      this.logger.debug('表示するデバイスがありません');
      // 空の場合でも一貫性のために表示する（必要なら非表示にしてもよい）
      this.containerElement.style.display = 'flex';
      this.containerElement.style.flexDirection = 'column';

      // 「デバイスが接続されていません」メッセージを表示
      if (this.noDevicesElement) {
        this.noDevicesElement.style.display = 'block';
      }
      return;
    }

    this.logger.debug(`デバイス一覧を更新: ${devices.length}件, 再生モード=${isReplayMode}`);

    // コンテナの表示を確保
    this.containerElement.style.display = 'flex';
    this.containerElement.style.flexDirection = 'column';

    // デバイスが存在する場合は「デバイスが接続されていません」メッセージを非表示にする
    if (this.noDevicesElement && visibleDevices.length > 0) {
      this.noDevicesElement.style.display = 'none';
    } else if (this.noDevicesElement && visibleDevices.length === 0) {
      this.noDevicesElement.style.display = 'block';
    }

    // 再生モードの場合はインジケーターを表示
    this._updateReplayModeIndicator(isReplayMode);

    // 各デバイスのUI要素を生成/更新
    visibleDevices.forEach(device => {
      // 再生モード中に一時的に無効化されたデバイスにはクラスを追加
      const isDisabled = device.tempDisabled === true;
      this._updateOrCreateDeviceElement(device, isReplayMode, isDisabled);
    });

    // リストにないデバイスの要素を削除
    this._removeUnusedDeviceElements(visibleDevices);
  }

  /**
   * 再生モードインジケーターの表示/非表示を切り替え
   * @param {boolean} isReplayMode 再生モードかどうか
   * @private
   */
  _updateReplayModeIndicator(isReplayMode) {
    if (isReplayMode && !document.getElementById('replay-mode-indicator')) {
      const replayModeIndicator = document.createElement('div');
      replayModeIndicator.id = 'replay-mode-indicator';
      replayModeIndicator.className = 'replay-mode-indicator';
      replayModeIndicator.textContent = '再生モード: ログファイルからのデバイス';
      replayModeIndicator.style.marginBottom = '10px';
      replayModeIndicator.style.padding = '6px 10px';
      replayModeIndicator.style.backgroundColor = 'rgba(95, 173, 207, 0.2)';
      replayModeIndicator.style.borderRadius = '4px';
      replayModeIndicator.style.fontSize = '12px';
      replayModeIndicator.style.fontWeight = '500';
      replayModeIndicator.style.color = '#5FADCF';
      replayModeIndicator.style.textAlign = 'center';
      this.containerElement.appendChild(replayModeIndicator);
    } else if (!isReplayMode && document.getElementById('replay-mode-indicator')) {
      // 再生モードでない場合はインジケーターを削除
      const indicator = document.getElementById('replay-mode-indicator');
      if (indicator && indicator.parentNode) {
        indicator.parentNode.removeChild(indicator);
      }
    }
  }

  /**
   * デバイス要素を作成または更新
   * @param {Object} device デバイス情報
   * @param {boolean} isReplayMode 再生モードかどうか
   * @param {boolean} isDisabled 無効化されているかどうか
   * @private
   */
  _updateOrCreateDeviceElement(device, isReplayMode, isDisabled = false) {
    const deviceId = device.id;
    let deviceGroup = document.getElementById(`device-group-${deviceId}`);

    // 既存のグループがなければ新規作成
    if (!deviceGroup) {
      deviceGroup = this._createDeviceElement(device, isReplayMode, isDisabled);
      this.containerElement.appendChild(deviceGroup);
    } else {
      // 既存のグループがあれば更新
      this._updateDeviceElement(deviceGroup, device, isReplayMode, isDisabled);
    }
  }

  /**
   * デバイス要素を新規作成
   * @param {Object} device デバイス情報
   * @param {boolean} isReplayMode 再生モードかどうか
   * @param {boolean} isDisabled 無効化されているかどうか
   * @returns {HTMLElement} 作成したデバイス要素
   * @private
   */
  _createDeviceElement(device, isReplayMode, isDisabled = false) {
    const deviceId = device.id;

    // デバイスグループ要素
    const deviceGroup = document.createElement('div');
    deviceGroup.id = `device-group-${deviceId}`;
    deviceGroup.className = 'device-group';

    // 再生モードの場合はクラスを追加
    if (isReplayMode) {
      deviceGroup.classList.add('replay-mode');
    }

    // 無効化されている場合はクラスを追加
    if (isDisabled) {
      deviceGroup.classList.add('disabled');

      // 無効化の理由表示を追加
      const disabledReason = document.createElement('div');
      disabledReason.className = 'disabled-reason';
      disabledReason.textContent = device.tempDisabledReason || '再生モード中は無効';
      deviceGroup.appendChild(disabledReason);
    }

    // デバイス名ラベル
    const nameLabel = document.createElement('div');
    nameLabel.className = 'device-name';
    nameLabel.textContent = device.name || deviceId;
    nameLabel.title = device.name || deviceId;
    deviceGroup.appendChild(nameLabel);

    // デバイスIDコンテナ
    const deviceIdContainer = document.createElement('div');
    deviceIdContainer.className = 'device-id-container';
    deviceIdContainer.textContent = `ID: ${deviceId}`;
    deviceIdContainer.title = deviceId;
    deviceGroup.appendChild(deviceIdContainer);

    // コントロール行
    const controlRow = document.createElement('div');
    controlRow.className = 'device-controls';

    // 表示/非表示トグル
    const visibilityToggle = document.createElement('label');
    visibilityToggle.className = 'toggle-switch';
    visibilityToggle.title = '表示/非表示';

    const toggleInput = document.createElement('input');
    toggleInput.type = 'checkbox';
    toggleInput.checked = device.visible !== false;
    toggleInput.addEventListener('change', () => {
      this._handleVisibilityChange(deviceId, toggleInput.checked);
    });

    const toggleSpan = document.createElement('span');
    toggleSpan.className = 'toggle-slider';

    visibilityToggle.appendChild(toggleInput);
    visibilityToggle.appendChild(toggleSpan);
    controlRow.appendChild(visibilityToggle);

    // デバイス名編集
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'device-name-input';
    nameInput.value = device.name || deviceId;
    nameInput.placeholder = 'デバイス名';
    nameInput.addEventListener('change', () => {
      this._handleNameChange(deviceId, nameInput.value);
    });
    controlRow.appendChild(nameInput);

    // アイコン選択ボタン
    const iconButtonContainer = document.createElement('div');
    iconButtonContainer.className = 'icon-button-container';

    const iconButton = document.createElement('button');
    iconButton.className = 'icon-button';
    iconButton.title = 'アイコンを選択';

    // アイコンまたはプレースホルダーを表示
    const iconImg = document.createElement('img');
    iconImg.className = 'device-icon-preview';
    iconImg.src = device.iconUrl || './assets/icon.svg';
    iconImg.onerror = () => {
      iconImg.src = './assets/icon.svg';
    };
    iconButton.appendChild(iconImg);

    // アイコンボタンのラベル
    const iconButtonLabel = document.createElement('span');
    iconButtonLabel.className = 'icon-button-label';
    iconButtonLabel.textContent = 'アイコン';

    // 再生モードの場合はクラスを追加
    if (isReplayMode) {
      iconButtonLabel.classList.add('replay-mode');
    }

    iconButton.appendChild(iconButtonLabel);

    // ファイル入力（隠す）
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.className = 'icon-file-input';
    fileInput.style.display = 'none';
    fileInput.setAttribute('data-device-id', deviceId);

    // アイコンボタンクリックでファイル選択ダイアログ
    iconButton.addEventListener('click', () => {
      if (!isReplayMode) { // 再生モードではアイコン変更不可
        fileInput.click();
      }
    });

    // ファイル選択時の処理
    fileInput.addEventListener('change', (event) => this._handleIconFileSelection(event));

    iconButtonContainer.appendChild(iconButton);
    iconButtonContainer.appendChild(fileInput);
    controlRow.appendChild(iconButtonContainer);

    // コントロール行をデバイスグループに追加
    deviceGroup.appendChild(controlRow);

    return deviceGroup;
  }

  /**
   * 既存のデバイス要素を更新
   * @param {HTMLElement} deviceGroup デバイス要素
   * @param {Object} device デバイス情報
   * @param {boolean} isReplayMode 再生モードかどうか
   * @param {boolean} isDisabled 無効化されているかどうか
   * @private
   */
  _updateDeviceElement(deviceGroup, device, isReplayMode, isDisabled = false) {
    const deviceId = device.id;

    // デバイス名を更新
    const nameLabel = deviceGroup.querySelector('.device-name');
    if (nameLabel) {
      nameLabel.textContent = device.name || deviceId;
      nameLabel.title = device.name || deviceId;
    }

    // 名前入力フィールドを更新
    const nameInput = deviceGroup.querySelector('.device-name-input');
    if (nameInput) {
      nameInput.value = device.name || deviceId;
    }

    // デバイスIDコンテナを更新
    const deviceIdContainer = deviceGroup.querySelector('.device-id-container');
    if (!deviceIdContainer) {
      // デバイスIDコンテナがなければ追加
      const newDeviceIdContainer = document.createElement('div');
      newDeviceIdContainer.className = 'device-id-container';
      newDeviceIdContainer.textContent = `ID: ${deviceId}`;
      newDeviceIdContainer.title = deviceId;
      // nameLabel の後に挿入
      const nameLabel = deviceGroup.querySelector('.device-name');
      if (nameLabel && nameLabel.nextSibling) {
        deviceGroup.insertBefore(newDeviceIdContainer, nameLabel.nextSibling);
      } else {
        deviceGroup.appendChild(newDeviceIdContainer);
      }
    }

    // 表示/非表示トグルを更新
    const toggleInput = deviceGroup.querySelector('.toggle-switch input');
    if (toggleInput) {
      toggleInput.checked = device.visible !== false;
    }

    // アイコンを更新（存在する場合）
    if (device.iconUrl) {
      const iconImg = deviceGroup.querySelector('.device-icon-preview');
      if (iconImg) {
        iconImg.src = device.iconUrl;
        this.logger.debug(`デバイス一覧にアイコン設定: ${deviceId}, URL=${device.iconUrl}`);
      }
    } else {
      this.logger.debug(`デバイス一覧のアイコンなし: ${deviceId}`);
    }

    // 再生モード関連のクラス設定
    if (isReplayMode) {
      deviceGroup.classList.add('replay-mode');
      const iconButtonLabel = deviceGroup.querySelector('.icon-button-label');
      if (iconButtonLabel) {
        iconButtonLabel.classList.add('replay-mode');
      }
    } else {
      deviceGroup.classList.remove('replay-mode');
      const iconButtonLabel = deviceGroup.querySelector('.icon-button-label');
      if (iconButtonLabel) {
        iconButtonLabel.classList.remove('replay-mode');
      }
    }

    // 無効化状態の更新
    if (isDisabled) {
      deviceGroup.classList.add('disabled');

      // 無効化の理由表示の追加/更新
      let disabledReason = deviceGroup.querySelector('.disabled-reason');
      if (!disabledReason) {
        disabledReason = document.createElement('div');
        disabledReason.className = 'disabled-reason';
        deviceGroup.appendChild(disabledReason);
      }
      disabledReason.textContent = device.tempDisabledReason || '再生モード中は無効';
    } else {
      deviceGroup.classList.remove('disabled');
      // 無効化の理由表示を削除
      const disabledReason = deviceGroup.querySelector('.disabled-reason');
      if (disabledReason) {
        disabledReason.parentNode.removeChild(disabledReason);
      }
    }
  }

  /**
   * 使われていないデバイス要素を削除
   * @param {Array} visibleDevices 表示対象のデバイス配列
   * @private
   */
  _removeUnusedDeviceElements(visibleDevices) {
    const deviceGroups = this.containerElement.querySelectorAll('.device-group');
    deviceGroups.forEach(group => {
      const groupId = group.id;
      if (groupId) {
        const deviceId = groupId.replace('device-group-', '');
        const deviceExists = visibleDevices.some(d => d.id === deviceId);
        if (!deviceExists) {
          this.containerElement.removeChild(group);
        }
      }
    });
  }

  /**
   * デバイスの一時的な無効化状態を更新
   * 再生モード中は接続中のデバイスを一時的に無効化
   * @private
   */
  _updateDeviceTemporaryDisabled() {
    if (!this.state.devices || this.state.devices.length === 0) {
      return;
    }

    // デバイスの一時的な無効化状態を更新
    this.state.devices.forEach(device => {
      // 実デバイスかつ接続中の場合、再生モード中は一時的に無効化
      if (device.connected && !device.isReplayDevice) {
        device.tempDisabled = this.isPlaybackMode;
        device.tempDisabledReason = this.isPlaybackMode ? '再生モード中' : null;
        this.logger.debug(
          `デバイス ${device.id} の一時無効化状態を更新: ${this.isPlaybackMode ? '無効化' : '有効化'}`
        );
      }
    });
  }

  /**
   * 表示/非表示の変更をハンドリング
   * @param {string} deviceId デバイスID
   * @param {boolean} isVisible 表示するかどうか
   * @private
   */
  _handleVisibilityChange(deviceId, isVisible) {
    this.logger.debug(`[DEBUG TOGGLE] Toggle device visibility: ${deviceId} -> ${isVisible ? 'visible' : 'hidden'}`);

    // deviceIdの型をチェック
    this.logger.debug(`[DEBUG TOGGLE] deviceId type: ${typeof deviceId}, value: ${deviceId}`);
    // isVisibleの型をチェック
    this.logger.debug(`[DEBUG TOGGLE] isVisible type: ${typeof isVisible}, value: ${isVisible}`);

    try {
      // トグル要素のUIを即時更新
      const deviceGroup = document.getElementById(`device-group-${deviceId}`);
      if (deviceGroup) {
        const toggleInput = deviceGroup.querySelector('.toggle-switch input');
        if (toggleInput) {
          this.logger.debug(`[DEBUG TOGGLE] Updating toggle input checked to: ${isVisible}`);
          toggleInput.checked = isVisible;
        } else {
          this.logger.warn(`[DEBUG TOGGLE] Toggle input element not found for device ${deviceId}`);
        }
      } else {
        this.logger.warn(`[DEBUG TOGGLE] Device group element not found for device ${deviceId}`);
      }

      // インターフェースを介してイベントを発火（新しい命名規則を使用）
      if (this.eventEmitter) {
        this.logger.debug(`[DEBUG TOGGLE] Emitting DEVICE_VISIBILITY_CHANGED event with deviceId: ${deviceId}, isVisible: ${isVisible}`);
        this.eventEmitter.emit(EventTypes.DEVICE_VISIBILITY_CHANGED, { deviceId, isVisible });

        // 後方互換性のために古いイベント名でも発行
        this.eventEmitter.emit('deviceVisibilityChange', { deviceId, isVisible });

        this.logger.debug(`[DEBUG TOGGLE] Visibility change events emitted for device ${deviceId}: ${isVisible ? 'visible' : 'hidden'}`);
      } else {
        this.logger.warn(`[DEBUG TOGGLE] eventEmitter not available for device ${deviceId}`);
      }
    } catch (error) {
      this.logger.error(`[DEBUG TOGGLE] Error in visibility toggle handler for device ${deviceId}:`, error);
    }
  }

  /**
   * デバイス名変更をハンドリング
   * @param {string} deviceId デバイスID
   * @param {string} newName 新しい名前
   * @private
   */
  _handleNameChange(deviceId, newName) {
    this.logger.debug(`Change device name: ${deviceId} -> ${newName}`);

    // インターフェースを介してイベントを発火（新しい命名規則を使用）
    if (this.eventEmitter) {
      this.eventEmitter.emit(EventTypes.DEVICE_NAME_CHANGED, { deviceId, newName });

      // 後方互換性のために古いイベント名でも発行
      this.eventEmitter.emit('deviceNameChange', { deviceId, newName });
    }
  }

  /**
   * アイコンファイル選択をハンドリング
   * @param {Event} event ファイル入力イベント
   * @private
   */
  _handleIconFileSelection(event) {
    if (!event.target.files || !event.target.files[0]) return;

    const fileInput = event.target;
    const deviceId = fileInput.getAttribute('data-device-id');

    if (!deviceId) return;

    this.logger.debug(`File input change event for device ${deviceId}`);

    const file = fileInput.files[0];

    // FileReader APIを使用してファイルを読み込み
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const dataUrl = e.target.result;

        // 画像のサイズを確認（大きすぎる場合は警告）
        const size = dataUrl.length;
        this.logger.debug(`File loaded for device ${deviceId}, size: ${(size/1024).toFixed(2)} KB`);

        if (size > 1024 * 1024) { // 1MB以上
          // イベントを発火して大きすぎることを通知（新しい命名規則を使用）
          if (this.eventEmitter) {
            this.eventEmitter.emit(EventTypes.DEVICE_ICON_ERROR, { deviceId, error: 'File size too large (over 1MB)' });

            // 後方互換性のために古いイベント名でも発行
            this.eventEmitter.emit('deviceIconError', { deviceId, error: 'File size too large (over 1MB)' });
          }
          return;
        }

        // アイコン設定イベントを発火（新しい命名規則を使用）
        if (this.eventEmitter) {
          this.eventEmitter.emit(EventTypes.DEVICE_ICON_CHANGED, { deviceId, iconUrl: dataUrl });

          // 後方互換性のために古いイベント名でも発行
          this.eventEmitter.emit('deviceIconChange', { deviceId, iconUrl: dataUrl });
        }
      } catch (error) {
        this.logger.error(`Error processing icon file for device ${deviceId}:`, error);
        if (this.eventEmitter) {
          this.eventEmitter.emit(EventTypes.DEVICE_ICON_ERROR, { deviceId, error: error.message });

          // 後方互換性のために古いイベント名でも発行
          this.eventEmitter.emit('deviceIconError', { deviceId, error: error.message });
        }
      }
    };

    reader.onerror = () => {
      this.logger.error(`Error reading icon file for device ${deviceId}`);
      if (this.eventEmitter) {
        this.eventEmitter.emit(EventTypes.DEVICE_ICON_ERROR, { deviceId, error: 'File read error' });

        // 後方互換性のために古いイベント名でも発行
        this.eventEmitter.emit('deviceIconError', { deviceId, error: 'File read error' });
      }
    };

    // ファイルをデータURLとして読み込み
    reader.readAsDataURL(file);
  }
}