/**
 * LogFileStorage - Infra Layer
 * ログファイルの保存・読み込みを管理するストレージ
 */
(function() {
  'use strict';

  function LogFileStorage(serverUrl) {
    this.serverUrl = serverUrl || 'http://127.0.0.1:8123';
  }

  /**
   * ログデータを保存
   */
  LogFileStorage.prototype.save = function(data) {
    return new Promise((resolve, reject) => {
      if (!data || data.length === 0) {
        reject(new Error('記録されたデータがありません'));
        return;
      }

      // Create JSON content
      const jsonContent = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      // Create download link
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `meter-log-${timestamp}.json`;
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Also save to server (backup)
      this._saveToServer(data, filename)
        .then(() => resolve({ filename, data }))
        .catch(err => {
          console.warn('Failed to save to server:', err);
          // Download already succeeded, so resolve anyway
          resolve({ filename, data });
        });
    });
  };

  /**
   * サーバーに保存
   */
  LogFileStorage.prototype._saveToServer = function(data, filename) {
    return fetch(`${this.serverUrl}/save-log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: data, filename: filename }),
      cache: 'no-store'
    }).then(response => {
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
    });
  };

  /**
   * ログファイルを読み込む
   */
  LogFileStorage.prototype.load = function(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          resolve(data);
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = LogFileStorage;
  } else {
    window.LogFileStorage = LogFileStorage;
  }
})();

