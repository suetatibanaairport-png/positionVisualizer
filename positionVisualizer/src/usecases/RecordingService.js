/**
 * RecordingService - UseCase Layer
 * ログ生成を管理するUseCase
 * Domain Layerのみに依存し、外部実装には依存しない
 */
(function () {
  'use strict';

  const SessionLog = window.SessionLog || (typeof module !== 'undefined' && module.exports ? require('../domain/SessionLog') : null);
  const LogEntry = window.LogEntry || (typeof module !== 'undefined' && module.exports ? require('../domain/LogEntry') : null);

  function RecordingService(sessionLogRepository, logFileStorage) {
    this.sessionLogRepository = sessionLogRepository;
    this.logFileStorage = logFileStorage;
    this.currentSession = null;
    this.subscribers = [];
    this.recordingStartTimeMs = null; // Track session start for relative timestamps
  }

  /**
   * 記録を開始
   */
  RecordingService.prototype.startRecording = function (initialValues) {
    if (this.currentSession && !this.currentSession.isEnded()) {
      return; // Already recording
    }

    const sessionLog = new SessionLog();
    this.currentSession = sessionLog;
    this.sessionLogRepository.save(sessionLog);
    this.recordingStartTimeMs = sessionLog.startedAt instanceof Date ? sessionLog.startedAt.getTime() : Date.now();

    this._notifySubscribers({ type: 'started', session: sessionLog });

    // Record initial values if provided
    if (Array.isArray(initialValues)) {
      initialValues.forEach((val, index) => {
        if (val !== null && val !== undefined) {
          // Device IDs are 1-based usually, or index based? 
          // LogEntry uses numeric ID. Main use `i+1`?
          // In recordDeviceData: `const match = deviceId.match(/(\d+)$/);`
          // Let's assume ID is index+1.
          this.recordDeviceData(`lever${index + 1}`, val);
        }
      });
    }
  };

  /**
   * 記録を停止
   */
  RecordingService.prototype.stopRecording = function () {
    if (!this.currentSession || this.currentSession.isEnded()) {
      return null;
    }

    this.currentSession.end();
    const entries = this.currentSession.entries.slice();

    this._notifySubscribers({ type: 'stopped', session: this.currentSession });

    const session = this.currentSession;
    this.currentSession = null;

    return entries;
  };

  /**
   * デバイスデータを記録
   */
  RecordingService.prototype.recordDeviceData = function (deviceId, normalizedValue) {
    if (!this.currentSession || this.currentSession.isEnded()) {
      return;
    }

    if (!deviceId || normalizedValue === null || normalizedValue === undefined) {
      return;
    }

    // Convert deviceId to numeric id if possible
    let id = deviceId;
    if (typeof deviceId === 'string') {
      const match = deviceId.match(/(\d+)$/);
      if (match) {
        id = parseInt(match[1], 10);
      } else {
        // Use hash of string as id
        let hash = 0;
        for (let i = 0; i < deviceId.length; i++) {
          hash = ((hash << 5) - hash) + deviceId.charCodeAt(i);
          hash = hash & hash;
        }
        id = Math.abs(hash);
      }
    }

    const numValue = Number(normalizedValue);
    if (!Number.isFinite(numValue)) {
      return;
    }

    // Unpack array if necessary (though it should be a single value now)
    const finalValue = Array.isArray(numValue) ? numValue[0] : numValue;

    const logEntry = new LogEntry(Date.now(), id, finalValue);

    this.currentSession.addEntry(logEntry);
    this._notifySubscribers({ type: 'recorded', entry: logEntry });
  };

  /**
   * 記録されたデータを保存
   */
  RecordingService.prototype.saveRecordedData = function (entries) {
    if (!entries || entries.length === 0) {
      throw new Error('記録されたデータがありません');
    }

    // Determine base timestamp (relative start). Prefer recorded start time; fallback to first entry timestamp.
    let baseTs = Number.isFinite(this.recordingStartTimeMs) ? this.recordingStartTimeMs : null;
    if (!Number.isFinite(baseTs)) {
      const firstEntryTs = entries[0] && entries[0].timestamp instanceof Date
        ? entries[0].timestamp.getTime()
        : Number(entries[0] && entries[0].timestamp);
      baseTs = Number.isFinite(firstEntryTs) ? firstEntryTs : Date.now();
    }

    // Convert LogEntry objects to serializable format { id, value, ts }
    const serializableData = entries.map(entry => {
      const entryTs = entry.timestamp instanceof Date ? entry.timestamp.getTime() : Number(entry.timestamp);
      const ts = Number.isFinite(entryTs) ? Math.max(0, Math.round(entryTs - baseTs)) : 0;

      return {
        id: entry.id,
        value: entry.value,
        ts: ts
      };
    }).filter(item => item !== null);

    // Clear stored start time after exporting to avoid reuse across sessions
    this.recordingStartTimeMs = null;

    // Save via storage
    return this.logFileStorage.save(serializableData);
  };

  /**
   * 記録ステータスを取得
   */
  RecordingService.prototype.getRecordingStatus = function () {
    if (!this.currentSession || this.currentSession.isEnded()) {
      return {
        isRecording: false,
        recordCount: 0,
        startTime: null
      };
    }

    return {
      isRecording: true,
      recordCount: this.currentSession.getEntryCount(),
      startTime: this.currentSession.startedAt
    };
  };

  /**
   * 変更を購読
   */
  RecordingService.prototype.subscribe = function (callback) {
    if (typeof callback === 'function') {
      this.subscribers.push(callback);
    }
  };

  /**
   * 購読を解除
   */
  RecordingService.prototype.unsubscribe = function (callback) {
    const index = this.subscribers.indexOf(callback);
    if (index >= 0) {
      this.subscribers.splice(index, 1);
    }
  };

  /**
   * 購読者に通知
   */
  RecordingService.prototype._notifySubscribers = function (event) {
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
    module.exports = RecordingService;
  } else {
    window.RecordingService = RecordingService;
  }
})();

