/**
 * ReplayService - UseCase Layer
 * ログ再生を管理するUseCase
 * Domain Layerのみに依存し、外部実装には依存しない
 */
(function() {
  'use strict';

  const LogEntry = window.LogEntry || (typeof module !== 'undefined' && module.exports ? require('../domain/LogEntry') : null);

  function ReplayService(logFileStorage, deviceStateRepository) {
    this.logFileStorage = logFileStorage;
    this.deviceStateRepository = deviceStateRepository;
    this.frames = [];
    this.isPlaying = false;
    this.playbackStartTime = null;
    this.animationFrameId = null;
    this.subscribers = [];
    this.intervalMs = 200;
  }

  /**
   * ログデータを読み込む（JSONオブジェクトから）
   */
  ReplayService.prototype.loadLog = function(data) {
    try {
      const logArray = Array.isArray(data) ? data : (Array.isArray(data.records) ? data.records : null);
      
      if (!logArray) {
        throw new Error('Invalid log format');
      }

      this._parseLogArray(logArray);
      this._notifySubscribers({ type: 'logLoaded', framesCount: this.frames.length, intervalMs: this.intervalMs });
    } catch (e) {
      throw e;
    }
  };

  /**
   * ログファイルを読み込む
   */
  ReplayService.prototype.loadFile = function(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          const logArray = Array.isArray(data) ? data : (Array.isArray(data.records) ? data.records : null);
          
          if (!logArray) {
            reject(new Error('Invalid log format'));
            return;
          }

          this._parseLogArray(logArray);
          resolve({ framesCount: this.frames.length, intervalMs: this.intervalMs });
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  /**
   * ログ配列をパースしてフレームに変換
   */
  ReplayService.prototype._parseLogArray = function(arr) {
    const byTs = new Map(); // Map<timestamp, Map<deviceId, value>>
    const ids = new Set();

    // First pass: collect all device IDs and group by timestamp
    arr.forEach(r => {
      if (!r) return;
      const id = Number(r.id);
      const v = Number(r.value);
      const ts = Number(r.ts);
      if (!Number.isFinite(id) || !Number.isFinite(v) || !Number.isFinite(ts)) return;
      ids.add(id);
      if (!byTs.has(ts)) byTs.set(ts, new Map());
      byTs.get(ts).set(id, Math.max(0, Math.min(100, v)));
    });

    const sortedTs = Array.from(byTs.keys()).sort((a, b) => a - b);
    this.intervalMs = 200; // Fixed interval

    // Create sorted list of device IDs (up to 6 devices)
    const idList = Array.from(ids).sort((a, b) => a - b).slice(0, 6);

    // Normalize timestamps to start from 0 (relative time)
    const firstTs = sortedTs.length > 0 ? sortedTs[0] : 0;

    // Build frames with carry-forward values
    const lastVals = new Map();
    this.frames = sortedTs.map(ts => {
      const m = byTs.get(ts);
      idList.forEach(id => {
        if (m.has(id)) lastVals.set(id, m.get(id));
      });

      const values = [null, null, null, null, null, null];
      for (let i = 0; i < idList.length; i++) {
        const deviceId = idList[i];
        if (lastVals.has(deviceId)) {
          values[i] = lastVals.get(deviceId);
        }
      }

      return { ts: ts - firstTs, values, idList };
    });
  };

  /**
   * 再生を開始
   */
  ReplayService.prototype.play = function() {
    if (!this.frames.length) return;
    if (this.isPlaying) return;

    this.stop(); // Clear any existing playback
    this.isPlaying = true;
    this.playbackStartTime = Date.now();

    this._notifySubscribers({ type: 'playbackStarted' });

    // Use requestAnimationFrame for smooth playback
    const updateFrame = () => {
      if (!this.isPlaying || this.frames.length === 0) {
        this.animationFrameId = null;
        return;
      }

      const currentTime = Date.now() - this.playbackStartTime;

      // Find the frame that should be playing now
      let prevFrameIndex = -1;
      let nextFrameIndex = -1;

      for (let i = 0; i < this.frames.length; i++) {
        if (this.frames[i].ts <= currentTime) {
          prevFrameIndex = i;
        } else {
          nextFrameIndex = i;
          break;
        }
      }

      // Before first frame
      if (prevFrameIndex < 0) {
        if (this.frames.length > 0) {
          this._applyFrameValues(this.frames[0].values);
        }
        this.animationFrameId = requestAnimationFrame(updateFrame);
        return;
      }

      // Past last frame
      if (currentTime >= this.frames[this.frames.length - 1].ts) {
        this._resetAllValues();
        this.stop();
        return;
      }

      // Interpolate between frames
      const prevFrame = this.frames[prevFrameIndex];
      let interpolatedValues = prevFrame.values.slice();

      if (nextFrameIndex >= 0 && nextFrameIndex < this.frames.length) {
        const nextFrame = this.frames[nextFrameIndex];
        const prevTime = prevFrame.ts;
        const nextTime = nextFrame.ts;

        const t = nextTime > prevTime ? (currentTime - prevTime) / (nextTime - prevTime) : 0;
        const clampedT = Math.max(0, Math.min(1, t));

        for (let i = 0; i < 6; i++) {
          const prevVal = prevFrame.values[i];
          const nextVal = nextFrame.values[i];

          if (prevVal !== null && prevVal !== undefined && nextVal !== null && nextVal !== undefined) {
            interpolatedValues[i] = prevVal + (nextVal - prevVal) * clampedT;
          } else if (prevVal !== null && prevVal !== undefined) {
            interpolatedValues[i] = prevVal;
          } else if (nextVal !== null && nextVal !== undefined) {
            interpolatedValues[i] = nextVal;
          } else {
            interpolatedValues[i] = null;
          }
        }
      }

      this._applyFrameValues(interpolatedValues);
      this.animationFrameId = requestAnimationFrame(updateFrame);
    };

    this.animationFrameId = requestAnimationFrame(updateFrame);
  };

  /**
   * 再生を停止
   */
  ReplayService.prototype.stop = function() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.isPlaying = false;
    this.playbackStartTime = null;
    this._resetAllValues();
    this._notifySubscribers({ type: 'playbackStopped' });
  };

  /**
   * フレームの値を適用
   */
  ReplayService.prototype._applyFrameValues = function(values) {
    for (let i = 0; i < 6; i++) {
      const deviceState = this.deviceStateRepository.getByIndex(i);
      if (deviceState) {
        const value = values[i];
        if (value !== null && value !== undefined) {
          deviceState.normalizedValue = value;
          deviceState.connected = true;
        } else {
          deviceState.normalizedValue = null;
          deviceState.connected = false;
        }
      }
    }
    this._notifySubscribers({ type: 'frameUpdated', values });
  };

  /**
   * すべての値をリセット
   */
  ReplayService.prototype._resetAllValues = function() {
    for (let i = 0; i < 6; i++) {
      const deviceState = this.deviceStateRepository.getByIndex(i);
      if (deviceState) {
        deviceState.normalizedValue = null;
        deviceState.actualValue = null;
        deviceState.connected = false;
      }
    }
    this._notifySubscribers({ type: 'valuesReset' });
  };

  /**
   * 変更を購読
   */
  ReplayService.prototype.subscribe = function(callback) {
    if (typeof callback === 'function') {
      this.subscribers.push(callback);
    }
  };

  /**
   * 購読を解除
   */
  ReplayService.prototype.unsubscribe = function(callback) {
    const index = this.subscribers.indexOf(callback);
    if (index >= 0) {
      this.subscribers.splice(index, 1);
    }
  };

  /**
   * 購読者に通知
   */
  ReplayService.prototype._notifySubscribers = function(event) {
    this.subscribers.forEach(callback => {
      try {
        callback(event);
      } catch (e) {
        console.error('Error in subscriber callback:', e);
      }
    });
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReplayService;
  } else {
    window.ReplayService = ReplayService;
  }
})();

