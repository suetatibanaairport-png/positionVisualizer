/**
 * WebSocketBridgeClient - Infra Layer
 * WebSocket経由でブリッジサーバーと通信するクライアント
 */
(function() {
  'use strict';

  function WebSocketBridgeClient(url) {
    this.url = url || 'ws://127.0.0.1:8123';
    this.ws = null;
    this.reconnectTimer = null;
    this.reconnectDelay = 1500;
    this.subscribers = [];
    this.isConnected = false;
  }

  /**
   * 接続を確立
   */
  WebSocketBridgeClient.prototype.connect = function() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      try {
        if (this.ws) {
          try {
            this.ws.close();
          } catch (e) {}
          this.ws = null;
        }

        const ws = new WebSocket(this.url);
        this.ws = ws;

        ws.onopen = () => {
          this.isConnected = true;
          if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
          }
          this._notifySubscribers({ type: 'connected' });
          resolve();
        };

        ws.onclose = () => {
          this.isConnected = false;
          this._notifySubscribers({ type: 'disconnected' });
          // Auto-reconnect
          if (!this.reconnectTimer) {
            this.reconnectTimer = setTimeout(() => {
              this.reconnectTimer = null;
              this.connect().catch(() => {}); // Ignore errors during reconnect
            }, this.reconnectDelay);
          }
        };

        ws.onerror = (error) => {
          this._notifySubscribers({ type: 'error', error });
          try {
            ws.close();
          } catch (e) {}
          reject(error);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this._notifySubscribers({ type: 'message', data });
          } catch (e) {
            // Not JSON or invalid format, ignore
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  };

  /**
   * メッセージを送信
   */
  WebSocketBridgeClient.prototype.send = function(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        const message = typeof data === 'string' ? data : JSON.stringify(data);
        this.ws.send(message);
        return true;
      } catch (e) {
        console.error('Failed to send message:', e);
        return false;
      }
    }
    return false;
  };

  /**
   * 接続を切断
   */
  WebSocketBridgeClient.prototype.disconnect = function() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }
    this.isConnected = false;
  };

  /**
   * イベントを購読
   */
  WebSocketBridgeClient.prototype.subscribe = function(callback) {
    if (typeof callback === 'function') {
      this.subscribers.push(callback);
    }
  };

  /**
   * 購読を解除
   */
  WebSocketBridgeClient.prototype.unsubscribe = function(callback) {
    const index = this.subscribers.indexOf(callback);
    if (index >= 0) {
      this.subscribers.splice(index, 1);
    }
  };

  /**
   * 購読者に通知
   */
  WebSocketBridgeClient.prototype._notifySubscribers = function(event) {
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
    module.exports = WebSocketBridgeClient;
  } else {
    window.WebSocketBridgeClient = WebSocketBridgeClient;
  }
})();

