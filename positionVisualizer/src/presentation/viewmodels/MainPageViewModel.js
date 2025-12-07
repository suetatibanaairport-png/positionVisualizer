/**
 * MainPageViewModel - Presentation Layer
 * メインページのUI状態とUseCase呼び出しを管理するViewModel
 */
(function() {
  'use strict';

  const Emitter = window.MVVM && window.MVVM.Emitter;
  const MeterState = window.MVVM && window.MVVM.MeterState;

  function MainPageViewModel(initialState, liveMonitorService, recordingService, replayService, settingsService, iconService) {
    this.emitter = new Emitter();
    this.state = initialState instanceof MeterState ? initialState : new MeterState();
    
    // UseCase services
    this.liveMonitorService = liveMonitorService;
    this.recordingService = recordingService;
    this.replayService = replayService;
    this.settingsService = settingsService;
    this.iconService = iconService;
    
    // UI state
    this.running = false;
    this.minValue = 0;
    this.maxValue = 100;
    this.unit = '%';
    
    // Interpolation state
    this._interpolationDuration = 200;
    this._interpolations = [];
    this._animationFrameId = null;
    
    // Subscribe to UseCase events
    this._setupUseCaseSubscriptions();
  }

  /**
   * UseCaseのイベントを購読
   */
  MainPageViewModel.prototype._setupUseCaseSubscriptions = function() {
    const self = this;
    
    // LiveMonitorServiceの購読
    if (this.liveMonitorService) {
      this.liveMonitorService.subscribe((deviceState) => {
        const index = deviceState.index;
        if (index >= 0 && index < 6) {
          if (deviceState.isConnected()) {
            self.setValue(index, deviceState.normalizedValue, true, true);
          } else {
            self.setValue(index, null, false);
          }
        }
      });
    }
    
    // RecordingServiceの購読
    if (this.recordingService) {
      this.recordingService.subscribe((event) => {
        self._notify();
      });
    }
    
    // ReplayServiceの購読
    if (this.replayService) {
      this.replayService.subscribe((event) => {
        if (event.type === 'frameUpdated') {
          // Update state values from replay
          if (event.values) {
            for (let i = 0; i < 6; i++) {
              const value = event.values[i];
              if (value !== null && value !== undefined) {
                self.setValue(i, value, true, true);
              } else {
                self.setValue(i, null, false);
              }
            }
          }
        } else if (event.type === 'valuesReset') {
          for (let i = 0; i < 6; i++) {
            self.setValue(i, null, false);
          }
        }
      });
    }
    
    // SettingsServiceの購読
    if (this.settingsService) {
      this.settingsService.subscribe((valueRange) => {
        self.minValue = valueRange.min;
        self.maxValue = valueRange.max;
        self.unit = valueRange.unit;
        self._notify();
      });
    }
  };

  /**
   * 変更イベントを購読
   */
  MainPageViewModel.prototype.onChange = function(fn) {
    return this.emitter.on('change', fn);
  };

  /**
   * 変更を通知
   */
  MainPageViewModel.prototype._notify = function() {
    this.emitter.emit('change', this.state.clone());
  };

  /**
   * 値の範囲を設定
   */
  MainPageViewModel.prototype.setMinValue = function(v) {
    if (this.settingsService) {
      const currentRange = this.settingsService.getRange();
      this.settingsService.updateRange(v, currentRange.max, currentRange.unit);
    } else {
      let min = Number(v);
      if (!isNaN(min)) {
        if (min >= this.maxValue) {
          this.maxValue = min + 1;
        }
        this.minValue = min;
        this._notify();
      }
    }
  };

  MainPageViewModel.prototype.setMaxValue = function(v) {
    if (this.settingsService) {
      const currentRange = this.settingsService.getRange();
      this.settingsService.updateRange(currentRange.min, v, currentRange.unit);
    } else {
      let max = Number(v);
      if (!isNaN(max)) {
        if (max <= this.minValue) {
          this.minValue = max - 1;
        }
        this.maxValue = max;
        this._notify();
      }
    }
  };

  MainPageViewModel.prototype.setUnit = function(v) {
    if (this.settingsService) {
      const currentRange = this.settingsService.getRange();
      this.settingsService.updateRange(currentRange.min, currentRange.max, v);
    } else {
      this.unit = String(v || '%').trim() || '%';
      this._notify();
    }
  };

  /**
   * 値を正規化
   */
  MainPageViewModel.prototype.normalizeValue = function(actualValue) {
    const range = this.maxValue - this.minValue;
    if (range === 0) return 50;
    const normalized = ((actualValue - this.minValue) / range) * 100;
    return Math.max(0, Math.min(100, normalized));
  };

  /**
   * 正規化値を実際の値に変換
   */
  MainPageViewModel.prototype.denormalizeValue = function(percentage) {
    const range = this.maxValue - this.minValue;
    return this.minValue + (percentage / 100) * range;
  };

  /**
   * デバイス名を設定
   */
  MainPageViewModel.prototype.setName = function(index, name) {
    if (index < 0 || index > 5) return;
    this.state.names[index] = String(name || '').trim() || this.state.names[index];
    this._notify();
  };

  /**
   * 値を設定
   */
  MainPageViewModel.prototype.setValue = function(index, value, smooth, isNormalized) {
    if (index < 0 || index > 5) return;
    
    if (value === null || value === undefined) {
      this._interpolations = this._interpolations.filter(interp => interp.index !== index);
      this.state.values[index] = null;
      this._notify();
      return;
    }
    
    let normalized;
    if (isNormalized === true) {
      normalized = Math.max(0, Math.min(100, Number(value) || 0));
    } else {
      const actualValue = Number(value) || 0;
      const clamped = Math.max(this.minValue, Math.min(this.maxValue, actualValue));
      normalized = this.normalizeValue(clamped);
    }
    
    const useSmooth = smooth !== false;
    const currentNormalized = this.state.values[index];
    
    if (useSmooth && currentNormalized !== null && currentNormalized !== undefined && !isNaN(currentNormalized)) {
      const targetNormalized = normalized;
      const diff = Math.abs(currentNormalized - targetNormalized);
      if (diff > 0.01) {
        this._interpolations = this._interpolations.filter(interp => interp.index !== index);
        const now = performance.now();
        this._interpolations.push({
          index: index,
          startValue: currentNormalized,
          targetValue: targetNormalized,
          startTime: now,
          endTime: now + this._interpolationDuration
        });
        this._startInterpolation();
        return;
      }
    }
    
    this.state.values[index] = normalized;
    this._notify();
  };

  /**
   * 補間アニメーションを開始
   */
  MainPageViewModel.prototype._startInterpolation = function() {
    if (this._animationFrameId !== null) return;
    
    const self = this;
    const animate = function() {
      const now = performance.now();
      let needsUpdate = false;
      
      self._interpolations.forEach(interp => {
        if (now >= interp.endTime) {
          if (self.state.values[interp.index] !== interp.targetValue) {
            self.state.values[interp.index] = interp.targetValue;
            needsUpdate = true;
          }
        } else {
          const progress = (now - interp.startTime) / (interp.endTime - interp.startTime);
          const clampedProgress = Math.max(0, Math.min(1, progress));
          const currentValue = interp.startValue + (interp.targetValue - interp.startValue) * clampedProgress;
          self.state.values[interp.index] = currentValue;
          needsUpdate = true;
        }
      });
      
      self._interpolations = self._interpolations.filter(interp => now < interp.endTime);
      
      if (needsUpdate) {
        self._notify();
      }
      
      if (self._interpolations.length > 0) {
        self._animationFrameId = requestAnimationFrame(animate);
      } else {
        self._animationFrameId = null;
      }
    };
    
    this._animationFrameId = requestAnimationFrame(animate);
  };

  /**
   * 実際の値を取得
   */
  MainPageViewModel.prototype.getActualValue = function(index) {
    if (index < 0 || index > 5) return null;
    const value = this.state.values[index];
    if (value === null || value === undefined) return null;
    return this.denormalizeValue(value);
  };

  MainPageViewModel.prototype.getActualValues = function() {
    return this.state.values.map((v, i) => {
      if (v === null || v === undefined) return null;
      return this.denormalizeValue(v);
    });
  };

  /**
   * 接続されているデバイスのインデックスを取得
   */
  MainPageViewModel.prototype.getConnectedDeviceIndices = function() {
    const indices = [];
    for (let i = 0; i < 6; i++) {
      const value = this.state.values[i];
      if (value !== null && value !== undefined && !isNaN(value)) {
        indices.push(i);
      }
    }
    return indices.length > 0 ? indices : null;
  };

  /**
   * アイコンを設定
   */
  MainPageViewModel.prototype.setIcon = function(path) {
    if (path) {
      this.state.icon = path;
      this._notify();
    }
  };

  MainPageViewModel.prototype.setIconAt = function(index, path) {
    if (index < 0 || index > 5) return;
    if (this.iconService) {
      this.iconService.setIcon(index, path);
    } else {
      this.state.icons[index] = String(path || '');
      this._notify();
    }
  };

  /**
   * 状態を設定
   */
  MainPageViewModel.prototype.setState = function(next) {
    if (!next) return;
    if (!(next instanceof MeterState)) {
      next = new MeterState(next.values, next.names, next.icon, next.icons);
    }
    this.state = next;
    this._notify();
  };

  /**
   * JSONに変換
   */
  MainPageViewModel.prototype.toJSON = function() {
    return {
      values: this.state.values.slice(0, 6),
      names: this.state.names.slice(0, 6),
      icon: this.state.icon,
      icons: this.state.icons.slice(0, 6)
    };
  };

  /**
   * 監視を開始
   */
  MainPageViewModel.prototype.start = function() {
    if (this.running) return;
    this.running = true;
    if (this.liveMonitorService) {
      this.liveMonitorService.start();
    }
    this._notify();
  };

  /**
   * 監視を停止
   */
  MainPageViewModel.prototype.stop = function() {
    if (!this.running) return;
    this.running = false;
    if (this.liveMonitorService) {
      this.liveMonitorService.stop();
    }
    if (this._animationFrameId !== null) {
      cancelAnimationFrame(this._animationFrameId);
      this._animationFrameId = null;
    }
    this._interpolations.forEach(interp => {
      this.state.values[interp.index] = interp.targetValue;
    });
    this._interpolations = [];
    this._notify();
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MainPageViewModel;
  } else {
    window.MainPageViewModel = MainPageViewModel;
  }
})();

