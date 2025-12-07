/**
 * OverlayViewModel - Presentation Layer
 * オーバーレイウィンドウのUI状態とUseCase呼び出しを管理するViewModel
 */
(function() {
  'use strict';

  const Emitter = window.MVVM && window.MVVM.Emitter;
  const MeterState = window.MVVM && window.MVVM.MeterState;

  function OverlayViewModel(initialState, replayService, settingsService) {
    this.emitter = new Emitter();
    this.state = initialState instanceof MeterState ? initialState : new MeterState();
    
    // UseCase services
    this.replayService = replayService;
    this.settingsService = settingsService;
    
    // UI state
    this.minValue = 0;
    this.maxValue = 100;
    this.unit = '%';
    
    // Subscribe to UseCase events
    this._setupUseCaseSubscriptions();
  }

  /**
   * UseCaseのイベントを購読
   */
  OverlayViewModel.prototype._setupUseCaseSubscriptions = function() {
    const self = this;
    
    // ReplayServiceの購読
    if (this.replayService) {
      this.replayService.subscribe((event) => {
        if (event.type === 'frameUpdated') {
          // Update state values from replay
          if (event.values) {
            for (let i = 0; i < 6; i++) {
              self.state.values[i] = event.values[i] !== undefined ? event.values[i] : null;
            }
            self._notify();
          }
        } else if (event.type === 'valuesReset') {
          for (let i = 0; i < 6; i++) {
            self.state.values[i] = null;
          }
          self._notify();
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
  OverlayViewModel.prototype.onChange = function(fn) {
    return this.emitter.on('change', fn);
  };

  /**
   * 変更を通知
   */
  OverlayViewModel.prototype._notify = function() {
    this.emitter.emit('change', this.state.clone());
  };

  /**
   * 値を正規化
   */
  OverlayViewModel.prototype.normalizeValue = function(actualValue) {
    const range = this.maxValue - this.minValue;
    if (range === 0) return 50;
    const normalized = ((actualValue - this.minValue) / range) * 100;
    return Math.max(0, Math.min(100, normalized));
  };

  /**
   * 正規化値を実際の値に変換
   */
  OverlayViewModel.prototype.denormalizeValue = function(percentage) {
    const range = this.maxValue - this.minValue;
    return this.minValue + (percentage / 100) * range;
  };

  /**
   * 値を設定
   */
  OverlayViewModel.prototype.setValue = function(index, value, smooth, isNormalized) {
    if (index < 0 || index > 5) return;
    
    if (value === null || value === undefined) {
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
    
    this.state.values[index] = normalized;
    this._notify();
  };

  /**
   * 実際の値を取得
   */
  OverlayViewModel.prototype.getActualValue = function(index) {
    if (index < 0 || index > 5) return null;
    const value = this.state.values[index];
    if (value === null || value === undefined) return null;
    return this.denormalizeValue(value);
  };

  OverlayViewModel.prototype.getActualValues = function() {
    return this.state.values.map((v, i) => {
      if (v === null || v === undefined) return null;
      return this.denormalizeValue(v);
    });
  };

  /**
   * 接続されているデバイスのインデックスを取得
   */
  OverlayViewModel.prototype.getConnectedDeviceIndices = function() {
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
  OverlayViewModel.prototype.setIcon = function(path) {
    if (path) {
      this.state.icon = path;
      this._notify();
    }
  };

  /**
   * 単位を設定
   */
  OverlayViewModel.prototype.setUnit = function(v) {
    this.unit = String(v || '%').trim() || '%';
    this._notify();
  };

  /**
   * 最小値を設定
   */
  OverlayViewModel.prototype.setMinValue = function(v) {
    let min = Number(v);
    if (!isNaN(min)) {
      if (min >= this.maxValue) {
        this.maxValue = min + 1;
      }
      this.minValue = min;
      this._notify();
    }
  };

  /**
   * 最大値を設定
   */
  OverlayViewModel.prototype.setMaxValue = function(v) {
    let max = Number(v);
    if (!isNaN(max)) {
      if (max <= this.minValue) {
        this.minValue = max - 1;
      }
      this.maxValue = max;
      this._notify();
    }
  };

  /**
   * 状態を設定
   */
  OverlayViewModel.prototype.setState = function(next) {
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
  OverlayViewModel.prototype.toJSON = function() {
    return {
      values: this.state.values.slice(0, 6),
      names: this.state.names.slice(0, 6),
      icon: this.state.icon,
      icons: this.state.icons.slice(0, 6)
    };
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = OverlayViewModel;
  } else {
    window.OverlayViewModel = OverlayViewModel;
  }
})();

