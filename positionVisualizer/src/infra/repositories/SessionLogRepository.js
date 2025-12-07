/**
 * SessionLogRepository - Infra Layer
 * SessionLogの永続化を管理するRepository
 */
(function() {
  'use strict';

  const SessionLog = window.SessionLog || (typeof module !== 'undefined' && module.exports ? require('../../domain/SessionLog') : null);

  function SessionLogRepository() {
    this.sessions = [];
    this.currentSession = null;
  }

  /**
   * セッションを保存
   */
  SessionLogRepository.prototype.save = function(sessionLog) {
    if (!sessionLog || !(sessionLog instanceof SessionLog)) return;
    
    // 既存のセッションを更新
    const startedAtTime = sessionLog.startedAt instanceof Date ? sessionLog.startedAt.getTime() : sessionLog.startedAt;
    const index = this.sessions.findIndex(s => {
      const sTime = s.startedAt instanceof Date ? s.startedAt.getTime() : s.startedAt;
      return sTime === startedAtTime;
    });
    if (index >= 0) {
      this.sessions[index] = sessionLog;
    } else {
      this.sessions.push(sessionLog);
    }
    
    this.currentSession = sessionLog;
  };

  /**
   * 現在のセッションを取得
   */
  SessionLogRepository.prototype.getCurrent = function() {
    return this.currentSession;
  };

  /**
   * すべてのセッションを取得
   */
  SessionLogRepository.prototype.getAll = function() {
    return this.sessions.slice();
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SessionLogRepository;
  } else {
    window.SessionLogRepository = SessionLogRepository;
  }
})();

