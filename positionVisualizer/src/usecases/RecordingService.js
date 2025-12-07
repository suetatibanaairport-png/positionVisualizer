/**
 * RecordingService - UseCase Layer
 * ログ生成を管理するUseCase
 * Domain Layerのみに依存し、外部実装には依存しない
 */
(function() {
  'use strict';

  const SessionLog = window.SessionLog || (typeof module !== 'undefined' && module.exports ? require('../domain/SessionLog') : null);
  const LogEntry = window.LogEntry || (typeof module !== 'undefined' && module.exports ? require('../domain/LogEntry') : null);

  function RecordingService(sessionLogRepository, logFileStorage) {
    this.sessionLogRepository = sessionLogRepository;
    this.logFileStorage = logFileStorage;
    this.currentSession = null;
    this.subscribers = [];
  }

  /**
   * 記録を開始
   */
  RecordingService.prototype.startRecording = function() {
    if (this.currentSession && !this.currentSession.isEnded()) {
      return; // Already recording
    }

    const sessionLog = new SessionLog();
    this.currentSession = sessionLog;
    this.sessionLogRepository.save(sessionLog);
    
    this._notifySubscribers({ type: 'started', session: sessionLog });
  };

  /**
   * 記録を停止
   */
  RecordingService.prototype.stopRecording = function() {
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
  RecordingService.prototype.recordDeviceData = function(deviceId, normalizedValue) {
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

    // Create log entry
    const values = [null, null, null, null, null, null];
    // Extract index from deviceId (lever1 -> 0, lever2 -> 1, etc.)
    const indexMatch = String(deviceId).match(/(\d+)$/);
    if (indexMatch) {
      const index = parseInt(indexMatch[1], 10) - 1;
      if (index >= 0 && index < 6) {
        values[index] = Math.max(0, Math.min(100, numValue));
      }
    }

    const logEntry = new LogEntry(Date.now(), JSON.stringify(values));
    
    this.currentSession.addEntry(logEntry);
    this._notifySubscribers({ type: 'recorded', entry: logEntry });
  };

  /**
   * 記録されたデータを保存
   */
  RecordingService.prototype.saveRecordedData = function(entries) {
    if (!entries || entries.length === 0) {
      throw new Error('記録されたデータがありません');
    }

    // Convert LogEntry objects to serializable format
    const serializableData = entries.map(entry => {
      const values = entry.getNormalizedValues();
      // Find non-null value and its index
      for (let i = 0; i < values.length; i++) {
        if (values[i] !== null && values[i] !== undefined) {
          return {
            id: i + 1, // device index + 1
            value: values[i],
            ts: entry.timestamp instanceof Date ? entry.timestamp.getTime() : entry.timestamp
          };
        }
      }
      return null;
    }).filter(item => item !== null);

    // Save via storage
    return this.logFileStorage.save(serializableData);
  };

  /**
   * 記録ステータスを取得
   */
  RecordingService.prototype.getRecordingStatus = function() {
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
  RecordingService.prototype.subscribe = function(callback) {
    if (typeof callback === 'function') {
      this.subscribers.push(callback);
    }
  };

  /**
   * 購読を解除
   */
  RecordingService.prototype.unsubscribe = function(callback) {
    const index = this.subscribers.indexOf(callback);
    if (index >= 0) {
      this.subscribers.splice(index, 1);
    }
  };

  /**
   * 購読者に通知
   */
  RecordingService.prototype._notifySubscribers = function(event) {
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

