/**
 * HttpPollingClient - Infra Layer
 * HTTPポーリングでブリッジサーバーから状態を取得するクライアント
 */
(function() {
  'use strict';

  function HttpPollingClient(url, interval) {
    this.url = url || 'http://127.0.0.1:8123/state';
    this.interval = interval || 1500; // Default 1.5 seconds
    this.pollTimer = null;
    this.subscribers = [];
    this.isPolling = false;
  }

  /**
   * ポーリングを開始
   */
  HttpPollingClient.prototype.start = function() {
    if (this.isPolling) return;
    this.isPolling = true;
    this._poll();
  };

  /**
   * ポーリングを停止
   */
  HttpPollingClient.prototype.stop = function() {
    this.isPolling = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  };

  /**
   * ポーリング実行
   */
  HttpPollingClient.prototype._poll = function() {
    if (!this.isPolling) return;

    fetch(this.url, { cache: 'no-store' })
      .then(response => {
        if (!response || !response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        this._notifySubscribers({ type: 'data', data });
      })
      .catch(error => {
        this._notifySubscribers({ type: 'error', error });
      })
      .finally(() => {
        if (this.isPolling) {
          this.pollTimer = setTimeout(() => {
            this.pollTimer = null;
            this._poll();
          }, this.interval);
        }
      });
  };

  /**
   * イベントを購読
   */
  HttpPollingClient.prototype.subscribe = function(callback) {
    if (typeof callback === 'function') {
      this.subscribers.push(callback);
    }
  };

  /**
   * 購読を解除
   */
  HttpPollingClient.prototype.unsubscribe = function(callback) {
    const index = this.subscribers.indexOf(callback);
    if (index >= 0) {
      this.subscribers.splice(index, 1);
    }
  };

  /**
   * 購読者に通知
   */
  HttpPollingClient.prototype._notifySubscribers = function(event) {
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
    module.exports = HttpPollingClient;
  } else {
    window.HttpPollingClient = HttpPollingClient;
  }
})();

