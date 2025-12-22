/**
 * テスト環境のセットアップファイル
 * テスト実行時に最初に読み込まれる
 */

// DOMテスト用のセットアップ
import { Window } from 'happy-dom';

// グローバルなDOMオブジェクトの設定
global.window = new Window();
global.document = window.document;
global.navigator = window.navigator;
global.HTMLElement = window.HTMLElement;
global.SVGElement = window.SVGElement;
global.customElements = window.customElements;
global.Element = window.Element;
global.Node = window.Node;

// その他のブラウザAPI
global.requestAnimationFrame = (callback) => setTimeout(callback, 16);
global.cancelAnimationFrame = (id) => clearTimeout(id);

// DOMインターフェースのモックセットアップ
document.createElementNS = function(namespaceURI, qualifiedName) {
  // SVG関連のメソッドをモック
  const element = document.createElement(qualifiedName);
  element.setAttribute = function(name, value) {
    this.attributes = this.attributes || {};
    this.attributes[name] = value;
  };

  element.getAttribute = function(name) {
    return (this.attributes && this.attributes[name]) || null;
  };

  element.setAttributeNS = function(namespace, name, value) {
    const parts = name.split(':');
    const localName = parts.length > 1 ? parts[1] : parts[0];
    this.setAttribute(localName, value);
  };

  // SVG特有のメソッド
  if (namespaceURI === 'http://www.w3.org/2000/svg') {
    element.style = {};
    element.getBBox = () => ({ x: 0, y: 0, width: 100, height: 100 });
  }

  return element;
};

// コンソールのモック
global.console = {
  ...console,
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// APP_CONFIGのモック
global.APP_CONFIG = {
  webSocketUrl: 'ws://test-server:8123',
  maxDevices: 6,
  isOverlay: false,
  containerId: 'meter-container'
};

// テスト固有のユーティリティ関数
global.createTestContainer = () => {
  const container = document.createElement('div');
  container.id = 'meter-container';
  document.body.appendChild(container);
  return container;
};

// WebSocketのモック
class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = 1; // OPEN
    this.onopen = null;
    this.onclose = null;
    this.onmessage = null;
    this.onerror = null;

    // コンストラクタ完了後に自動的にonopenを呼び出す
    setTimeout(() => {
      if (this.onopen) this.onopen({ type: 'open' });
    }, 0);
  }

  send(data) {
    // メッセージ送信のモック実装
    // 必要に応じてここでメッセージのハンドリングをシミュレート
  }

  close() {
    this.readyState = 3; // CLOSED
    if (this.onclose) {
      this.onclose({ type: 'close', code: 1000, reason: 'Normal closure' });
    }
  }

  // テスト用のヘルパーメソッド
  mockReceiveMessage(data) {
    if (this.onmessage) {
      this.onmessage({ data });
    }
  }

  mockError(error) {
    if (this.onerror) {
      this.onerror({ error });
    }
  }

  mockClose(code = 1000, reason = 'Normal closure') {
    this.readyState = 3; // CLOSED
    if (this.onclose) {
      this.onclose({ type: 'close', code, reason });
    }
  }
}

// WebSocketクラスをグローバルに定義
global.WebSocket = MockWebSocket;