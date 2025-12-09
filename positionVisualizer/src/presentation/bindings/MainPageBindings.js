/**
 * MainPageBindings - Presentation Layer
 * メインページのDOMバインディング
 */
(function () {
  'use strict';

  const MeterRenderer = window.MeterRenderer;
  const IconRenderer = window.IconRenderer;

  function MainPageBindings(viewModel, liveMonitorService, recordingService, replayService, settingsService, iconService, webSocketClient, overlayChannel) {
    this.viewModel = viewModel;
    this.liveMonitorService = liveMonitorService;
    this.recordingService = recordingService;
    this.replayService = replayService;
    this.settingsService = settingsService;
    this.iconService = iconService;
    this.webSocketClient = webSocketClient;
    this.overlayChannel = overlayChannel;

    this.deviceIdMap = new Map();
  }

  /**
   * デバイスIDをインデックスにマッピング
   */
  MainPageBindings.prototype._getDeviceIndex = function (deviceId) {
    if (!deviceId) return -1;

    if (this.deviceIdMap.has(deviceId)) {
      return this.deviceIdMap.get(deviceId);
    }

    const match = deviceId.match(/(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num >= 1 && num <= 6) {
        const index = num - 1;
        this.deviceIdMap.set(deviceId, index);
        return index;
      }
    }

    // Try to find by IP address or name
    for (let i = 0; i < 6; i++) {
      const ipEl = document.getElementById(`device${i + 1}-ip`);
      const nameEl = document.getElementById(`device${i + 1}-name`);
      const ip = ipEl ? ipEl.value.trim() : '';
      const name = nameEl ? nameEl.value.trim() : '';
      if (name && name.toLowerCase().includes(deviceId.toLowerCase())) {
        this.deviceIdMap.set(deviceId, i);
        return i;
      }
    }

    return -1;
  };

  /**
   * WebSocketメッセージを処理
   */
  MainPageBindings.prototype._handleWebSocketMessage = function (event) {
    if (event.type !== 'message') return;

    const data = event.data;

    // Handle state messages
    if (data.type === 'state' && data.payload) {
      const payload = data.payload;
      if (payload.values && Array.isArray(payload.values)) {
        for (let i = 0; i < 6; i++) {
          const value = payload.values[i];
          const prevValue = this.viewModel.state.values[i];

          if (value !== null && value !== undefined) {
            this.viewModel.setValue(i, value, true, true);

            // Record data if recording is active
            if (this.recordingService && prevValue !== value) {
              const deviceId = `lever${i + 1}`;
              this.recordingService.recordDeviceData(deviceId, value);
            }
          } else {
            this.viewModel.setValue(i, null, false);
          }
        }
      }
      return;
    }

    // Handle device data JSON (legacy format)
    if (data.device_id && data.data) {
      this._processDeviceData(data);
    } else if (data.type === 'device' && data.payload) {
      this._processDeviceData(data.payload);
    } else if (Array.isArray(data)) {
      data.forEach(item => this._processDeviceData(item));
    }
  };

  /**
   * デバイスデータを処理
   */
  MainPageBindings.prototype._processDeviceData = function (jsonData) {
    try {
      if (!jsonData || typeof jsonData !== 'object') return;

      const deviceId = jsonData.device_id;
      if (!deviceId) return;

      const index = this._getDeviceIndex(deviceId);
      if (index < 0 || index > 5) return;

      const data = jsonData.data;
      if (!data) return;

      let value = null;
      if (typeof data.value === 'number') {
        value = data.value;
      } else if (typeof data.smoothed === 'number') {
        value = data.smoothed;
      } else if (typeof data.raw === 'number') {
        value = data.raw;
      }

      if (value !== null && !isNaN(value)) {
        this.viewModel.setValue(index, value);

        // Record data if recording is active
        if (this.recordingService) {
          const normalizedValue = this.viewModel.state.values[index];
          this.recordingService.recordDeviceData(deviceId, normalizedValue);
        }
      }
    } catch (error) {
      console.error('Error processing device data:', error);
    }
  };

  /**
   * 状態をブロードキャスト
   */
  MainPageBindings.prototype.broadcast = function () {
    const state = this.viewModel.toJSON();
    const svgEl = document.querySelector('#meter-container svg[data-meter]');
    const svgMarkup = svgEl ? svgEl.outerHTML : '';

    // BroadcastChannel
    if (this.overlayChannel) {
      this.overlayChannel.postMessage({ ...state, svg: svgMarkup });
    }

    // localStorage
    try {
      localStorage.setItem('meter-state', JSON.stringify({ ...state, ts: Date.now() }));
      if (svgMarkup) localStorage.setItem('meter-svg', svgMarkup);
    } catch (e) { }

    // WebSocket
    if (this.webSocketClient) {
      this.webSocketClient.send({ type: 'state', payload: { ...state, svg: svgMarkup } });
    }
  };

  /**
   * バインディングをアタッチ
   */
  MainPageBindings.prototype.attach = function () {
    const vm = this.viewModel;
    const self = this;

    // Initialize meter renderer
    MeterRenderer.initMeter(document.getElementById('meter-container'));

    // Connect WebSocket
    if (this.webSocketClient) {
      this.webSocketClient.subscribe((event) => {
        self._handleWebSocketMessage(event);
      });
      this.webSocketClient.connect();
    }

    // Subscribe to ViewModel changes
    vm.onChange((state) => {
      const connectedDeviceIndices = vm.getConnectedDeviceIndices();
      const actualValues = vm.getActualValues();

      MeterRenderer.updateMeter(state.values, {
        names: state.names,
        icon: state.icon,
        numbersOnly: true,
        textYOffset: 15,
        connectedDeviceIndices: connectedDeviceIndices,
        actualValues: actualValues,
        unit: vm.unit,
        minValue: vm.minValue,
        maxValue: vm.maxValue,
        icons: state.icons
      });

      self.broadcast();
    });

    // Initial paint
    const initialConnectedDeviceIndices = vm.getConnectedDeviceIndices();
    const initialActualValues = vm.getActualValues();
    MeterRenderer.updateMeter(vm.state.values, {
      names: vm.state.names,
      icon: vm.state.icon,
      numbersOnly: true,
      textYOffset: 15,
      connectedDeviceIndices: initialConnectedDeviceIndices,
      actualValues: initialActualValues,
      unit: vm.unit,
      minValue: vm.minValue,
      maxValue: vm.maxValue,
      icons: vm.state.icons
    });
    this.broadcast();

    // Bind UI controls
    this._bindUIControls();
  };

  /**
   * UIコントロールをバインディング
   */
  MainPageBindings.prototype._bindUIControls = function () {
    const vm = this.viewModel;
    const self = this;

    // Bind device name inputs
    for (let i = 1; i <= 6; i++) {
      const el = document.getElementById(`device${i}-name`);
      if (el) {
        const handler = () => vm.setName(i - 1, el.value);
        el.addEventListener('input', handler);
        el.addEventListener('change', handler);
      }
    }

    // Bind range settings
    const minValueInput = document.getElementById('min-value');
    const maxValueInput = document.getElementById('max-value');
    const unitInput = document.getElementById('value-unit');

    if (minValueInput) {
      minValueInput.addEventListener('change', () => vm.setMinValue(minValueInput.value));
      minValueInput.addEventListener('input', () => vm.setMinValue(minValueInput.value));
    }

    if (maxValueInput) {
      maxValueInput.addEventListener('change', () => vm.setMaxValue(maxValueInput.value));
      maxValueInput.addEventListener('input', () => vm.setMaxValue(maxValueInput.value));
    }

    if (unitInput) {
      unitInput.addEventListener('change', () => vm.setUnit(unitInput.value));
      unitInput.addEventListener('input', () => vm.setUnit(unitInput.value));
    }

    // Bind icon uploads
    for (let i = 1; i <= 6; i++) {
      const input = document.getElementById(`device${i}-icon`);
      if (input) {
        const button = input.closest('.icon-file-button');
        const buttonText = button ? button.querySelector('.icon-button-text') : null;

        const updateIconState = () => {
          const hasIcon = vm.state.icons && vm.state.icons[i - 1];
          if (button) {
            if (hasIcon) {
              button.classList.add('has-icon');
              if (buttonText) buttonText.textContent = '✓ 登録済み';
            } else {
              button.classList.remove('has-icon');
              if (buttonText) buttonText.textContent = '画像を選択';
            }
          }
        };

        updateIconState();

        input.addEventListener('change', () => {
          const file = input.files && input.files[0];
          if (!file) {
            if (button) button.classList.remove('has-icon');
            if (buttonText) buttonText.textContent = '画像を選択';
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = String(reader.result || '');
            if (dataUrl) {
              vm.setIconAt(i - 1, dataUrl);
              if (button) button.classList.add('has-icon');
              if (buttonText) buttonText.textContent = '✓ 登録済み';
            }
          };
          reader.readAsDataURL(file);
        });

        vm.onChange(() => {
          updateIconState();
        });
      }
    }

    // Bind recording controls
    const startRecordBtn = document.getElementById('start-record');
    const stopRecordBtn = document.getElementById('stop-record');
    const recordStatusEl = document.getElementById('log-record-status');

    const updateRecordStatus = () => {
      if (!recordStatusEl || !this.recordingService) return;
      const status = this.recordingService.getRecordingStatus();
      if (status.isRecording) {
        recordStatusEl.textContent = `記録中... (${status.recordCount}件)`;
        recordStatusEl.style.color = '#d32f2f';
      } else {
        recordStatusEl.textContent = '停止中';
        recordStatusEl.style.color = '#666';
      }
    };

    if (startRecordBtn && this.recordingService) {
      startRecordBtn.addEventListener('click', () => {
        this.recordingService.startRecording();
        updateRecordStatus();
      });
    }

    if (stopRecordBtn && this.recordingService) {
      stopRecordBtn.addEventListener('click', () => {
        const entries = this.recordingService.stopRecording();
        if (entries && entries.length > 0) {
          try {
            // Use RecordingService to save data (it handles formatting and download)
            this.recordingService.saveRecordedData(entries);
          } catch (e) {
            console.error('Failed to save log:', e);
            alert('ログの保存に失敗しました: ' + e.message);
          }
        }
        updateRecordStatus();
      });
    }

    // Subscribe to recording status changes
    if (this.recordingService) {
      this.recordingService.subscribe(() => {
        updateRecordStatus();
      });
    }

    updateRecordStatus();

    // Bind replay controls
    const logFile = document.getElementById('log-file');
    const playBtn = document.getElementById('play-log');
    const stopBtn = document.getElementById('stop-log');

    if (playBtn && logFile && this.replayService) {
      playBtn.addEventListener('click', () => {
        const f = logFile.files && logFile.files[0];
        if (!f) {
          alert('ログファイル（JSON）を選択してください');
          return;
        }
        this.replayService.loadFile(f).then(() => {
          this.replayService.play();
        }).catch((err) => {
          alert('読み込み失敗: ' + err.message);
        });
      });
    }

    if (stopBtn && this.replayService) {
      stopBtn.addEventListener('click', () => {
        this.replayService.stop();
      });
    }
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MainPageBindings;
  } else {
    window.MainPageBindings = MainPageBindings;
  }
})();

