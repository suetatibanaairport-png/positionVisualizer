/**
 * OverlayChannel - Infra Layer
 * BroadcastChannelを使用してオーバーレイウィンドウと同期するチャネル
 */
(function() {
  'use strict';

  function OverlayChannel(channelName) {
    this.channelName = channelName || 'meter-overlay';
    this.bc = null;
    this.subscribers = [];
    
    try {
      this.bc = new BroadcastChannel(this.channelName);
      this.bc.onmessage = (event) => {
        this._notifySubscribers({ type: 'message', data: event.data });
      };
    } catch (e) {
      console.warn('BroadcastChannel not supported:', e);
    }
  }

  /**
   * メッセージを送信
   */
  OverlayChannel.prototype.postMessage = function(data) {
    if (this.bc) {
      try {
        this.bc.postMessage(data);
        return true;
      } catch (e) {
        console.error('Failed to post message:', e);
        return false;
      }
    }
    return false;
  };

  /**
   * イベントを購読
   */
  OverlayChannel.prototype.subscribe = function(callback) {
    if (typeof callback === 'function') {
      this.subscribers.push(callback);
    }
  };

  /**
   * 購読を解除
   */
  OverlayChannel.prototype.unsubscribe = function(callback) {
    const index = this.subscribers.indexOf(callback);
    if (index >= 0) {
      this.subscribers.splice(index, 1);
    }
  };

  /**
   * 購読者に通知
   */
  OverlayChannel.prototype._notifySubscribers = function(event) {
    this.subscribers.forEach(callback => {
      try {
        callback(event);
      } catch (e) {
        console.error('Error in subscriber callback:', e);
      }
    });
  };

  /**
   * チャネルを閉じる
   */
  OverlayChannel.prototype.close = function() {
    if (this.bc) {
      try {
        this.bc.close();
      } catch (e) {}
      this.bc = null;
    }
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = OverlayChannel;
  } else {
    window.OverlayChannel = OverlayChannel;
  }
})();

