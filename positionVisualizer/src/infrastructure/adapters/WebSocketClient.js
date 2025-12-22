/**
 * WebSocketClient.js
 * WebSocketサーバーとの通信を行うためのクライアントクラス
 * 再接続やイベント管理の機能を提供
 */

export class WebSocketClient {
  /**
   * WebSocketClientのコンストラクタ
   * @param {string} url WebSocketサーバーのURL
   * @param {Object} options オプション設定
   */
  constructor(url, options = {}) {
    this.url = url;
    this.options = {
      reconnectInterval: 1000,     // 再接続の間隔（ミリ秒）
      maxReconnectAttempts: 5,     // 最大再接続試行回数
      debug: false,                // デバッグモード
      autoConnect: false,          // 自動接続するかどうか
      connectTimeout: 5000,        // 接続タイムアウト（ミリ秒）
      ...options
    };

    // WebSocketインスタンス
    this.socket = null;

    // 状態管理
    this.connected = false;
    this.connecting = false;
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.connectTimeoutTimer = null;

    // イベントリスナー管理
    this.listeners = new Map();

    // 自動接続が有効な場合は接続
    if (this.options.autoConnect) {
      this.connect();
    }
  }

  /**
   * WebSocketサーバーに接続
   * @returns {Promise<boolean>} 接続の成否
   */
  connect() {
    return new Promise((resolve, reject) => {
      // 既に接続中または接続済みの場合
      if (this.connecting || this.connected) {
        resolve(this.connected);
        return;
      }

      this.connecting = true;

      // 接続タイムアウトを設定
      this.connectTimeoutTimer = setTimeout(() => {
        if (!this.connected && this.connecting) {
          this.connecting = false;
          this._log('Connection timeout');

          if (this.socket) {
            this.socket.close();
          }

          reject(new Error('Connection timeout'));
        }
      }, this.options.connectTimeout);

      try {
        // WebSocketの作成
        this.socket = new WebSocket(this.url);

        // 接続イベントのハンドラー
        this.socket.onopen = () => {
          clearTimeout(this.connectTimeoutTimer);
          this.connected = true;
          this.connecting = false;
          this.reconnectAttempts = 0;
          this._log(`Connected to ${this.url}`);
          this._emitEvent('connect', {});
          resolve(true);
        };

        // メッセージイベントのハンドラー
        this.socket.onmessage = (event) => {
          this._handleMessage(event);
        };

        // エラーイベントのハンドラー
        this.socket.onerror = (error) => {
          this._log('WebSocket error:', error);
          this._emitEvent('error', { error });

          if (this.connecting) {
            clearTimeout(this.connectTimeoutTimer);
            this.connecting = false;
            reject(error);
          }
        };

        // 切断イベントのハンドラー
        this.socket.onclose = (event) => {
          clearTimeout(this.connectTimeoutTimer);
          const wasConnected = this.connected;
          this.connected = false;
          this.connecting = false;

          this._log(`Disconnected: ${event.code} - ${event.reason}`);

          if (wasConnected) {
            this._emitEvent('disconnect', {
              code: event.code,
              reason: event.reason,
              wasClean: event.wasClean
            });
          }

          // 再接続
          this._attemptReconnect();
        };
      } catch (error) {
        clearTimeout(this.connectTimeoutTimer);
        this.connecting = false;
        this._log('Connection error:', error);
        reject(error);
      }
    });
  }

  /**
   * WebSocketサーバーとの接続を切断
   * @param {number} code 切断コード
   * @param {string} reason 切断理由
   */
  disconnect(code = 1000, reason = 'Normal closure') {
    if (!this.socket) return;

    // 再接続タイマーをクリア
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    try {
      this.socket.close(code, reason);
      this._log(`Manually disconnected: ${code} - ${reason}`);
    } catch (error) {
      this._log('Error during disconnect:', error);
    }

    this.connected = false;
    this.connecting = false;
    this.socket = null;
  }

  /**
   * イベントリスナーを登録
   * @param {string} eventType イベントタイプ
   * @param {Function} callback コールバック関数
   * @returns {Function} リスナー削除関数
   */
  on(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }

    this.listeners.get(eventType).add(callback);

    // リスナー削除用の関数を返す
    return () => this.off(eventType, callback);
  }

  /**
   * 一度だけ実行されるイベントリスナーを登録
   * @param {string} eventType イベントタイプ
   * @param {Function} callback コールバック関数
   * @returns {Function} リスナー削除関数
   */
  once(eventType, callback) {
    const onceWrapper = (data) => {
      this.off(eventType, onceWrapper);
      callback(data);
    };

    return this.on(eventType, onceWrapper);
  }

  /**
   * イベントリスナーを削除
   * @param {string} eventType イベントタイプ
   * @param {Function} callback コールバック関数（省略時は全リスナー削除）
   */
  off(eventType, callback) {
    if (!this.listeners.has(eventType)) return;

    if (callback) {
      this.listeners.get(eventType).delete(callback);

      // リスナーが0になったら削除
      if (this.listeners.get(eventType).size === 0) {
        this.listeners.delete(eventType);
      }
    } else {
      // 全リスナー削除
      this.listeners.delete(eventType);
    }
  }

  /**
   * WebSocketサーバーにデータを送信
   * @param {string|Object} data 送信するデータ
   * @returns {boolean} 送信成功したかどうか
   */
  send(data) {
    if (!this.connected || !this.socket) return false;

    try {
      const messageToSend = typeof data === 'string'
        ? data
        : JSON.stringify(data);

      this.socket.send(messageToSend);
      return true;
    } catch (error) {
      this._log('Send error:', error);
      this._emitEvent('error', { error, context: 'send' });
      return false;
    }
  }

  /**
   * メッセージイベントを処理
   * @param {MessageEvent} event メッセージイベント
   * @private
   */
  _handleMessage(event) {
    let messageData = event.data;

    // JSONデータの場合はパース
    if (typeof messageData === 'string') {
      try {
        messageData = JSON.parse(messageData);

        // イベントタイプがある場合は特定のイベントとして発行
        if (messageData.type || messageData.event) {
          const eventType = messageData.type || messageData.event;
          this._emitEvent(eventType, messageData);

          // state型メッセージの特別処理 - ペイロードからデバイスデータを抽出
          if (eventType === 'state' && messageData.payload) {
            const payload = messageData.payload;

            // デバイスメッセージを生成
            if (payload.values && Array.isArray(payload.values)) {
              payload.values.forEach((value, index) => {
                if (value !== null && value !== undefined) {
                  const deviceId = `lever${index + 1}`;
                  const deviceName = payload.names && payload.names[index] ? payload.names[index] : null;

                  // deviceメッセージを生成
                  const deviceMessage = {
                    device_id: deviceId,
                    name: deviceName,
                    data: { value },
                    type: 'device' // 元のメッセージに含める
                  };
                  this._emitEvent('device', deviceMessage);
                }
              });
            }
          }
        }
      } catch (error) {
        if (this.options.debug) {
          console.error('[WebSocketClient] Error parsing message:', error);
        }
        // JSONでない場合はそのまま
      }
    }

    // 常に'message'イベントとして発行
    this._emitEvent('message', messageData);
  }

  /**
   * 再接続を試みる
   * @private
   */
  _attemptReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    // 最大再接続試行回数に達した場合
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      this._log('Max reconnect attempts reached');
      this._emitEvent('reconnect_failed', {
        attempts: this.reconnectAttempts
      });
      return;
    }

    // 再接続タイマーをセット
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this._log(`Reconnect attempt ${this.reconnectAttempts}...`);

      this._emitEvent('reconnecting', {
        attempt: this.reconnectAttempts
      });

      this.connect().catch(error => {
        this._log('Reconnect failed:', error);
      });
    }, this.options.reconnectInterval);
  }

  /**
   * イベントを発行
   * @param {string} eventType イベントタイプ
   * @param {Object} data イベントデータ
   * @private
   */
  _emitEvent(eventType, data) {
    if (this.listeners.has(eventType)) {
      this.listeners.get(eventType).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${eventType} event handler:`, error);
        }
      });
    }
  }

  /**
   * ログ出力
   * @param {...any} args ログ引数
   * @private
   */
  _log(...args) {
    if (this.options.debug) {
      console.log(`[WebSocketClient]`, ...args);
    }
  }

  /**
   * 現在の接続状態を取得
   * @returns {Object} 接続状態
   */
  getStatus() {
    return {
      connected: this.connected,
      connecting: this.connecting,
      url: this.url,
      reconnectAttempts: this.reconnectAttempts
    };
  }
}