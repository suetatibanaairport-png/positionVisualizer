/**
 * テスト環境のセットアップファイル
 * テスト実行時に最初に読み込まれる
 */

// その他のブラウザAPI
global.requestAnimationFrame = (callback) => setTimeout(callback, 16);
global.cancelAnimationFrame = (id) => clearTimeout(id);

// DOMのモックを最小限に抑える
global.document = {
  createElement: () => ({
    style: {},
    setAttribute: () => {},
    getAttribute: () => null,
    appendChild: () => {}
  }),
  createElementNS: (ns, name) => ({
    style: {},
    setAttribute: () => {},
    getAttribute: () => null,
    setAttributeNS: () => {},
    appendChild: () => {}
  }),
  getElementById: () => ({
    style: {},
    appendChild: () => {},
    querySelectorAll: () => []
  }),
  body: {
    appendChild: () => {},
    classList: {
      add: () => {}
    }
  }
};

// ウィンドウのモック
global.window = {
  addEventListener: () => {},
  removeEventListener: () => {},
  location: {
    search: ''
  }
};

// Jestのモック関数の代わりとなる関数
const createMockFn = () => {
  const fn = (...args) => {
    fn.mock.calls.push(args);
    return fn.mock.returnValue;
  };
  fn.mock = {
    calls: [],
    instances: [],
    returnValue: undefined,
    implementation: null
  };
  fn.mockReturnValue = function(value) {
    this.mock.returnValue = value;
    return this;
  };
  fn.mockImplementation = function(implementation) {
    this.mock.implementation = implementation;
    return this;
  };
  fn.mockClear = function() {
    this.mock.calls = [];
    return this;
  };
  fn.mockReset = function() {
    this.mockClear();
    this.mock.returnValue = undefined;
    this.mock.implementation = null;
    return this;
  };
  fn.mockRestore = function() {
    this.mockReset();
    return this;
  };
  return fn;
};

// グローバルなjestオブジェクト
global.jest = {
  fn: createMockFn,
  useFakeTimers: () => {},
  useRealTimers: () => {},
  advanceTimersByTime: () => {}
};

// コンソールのモック
global.console = {
  ...console,
  debug: createMockFn(),
  info: createMockFn(),
  warn: createMockFn(),
  error: createMockFn(),
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

// パフォーマンス関連のモック
global.performance = {
  ...performance,
  now: () => Date.now()
};

// Bunテスト用のモック
global.mock = (implementation) => {
  const mockFn = (...args) => {
    mockFn.mock.calls.push(args);
    if (typeof implementation === 'function') {
      return implementation(...args);
    }
    return mockFn.mock.returnValue;
  };
  mockFn.mock = {
    calls: []
  };
  mockFn.mockReturnValue = (value) => {
    mockFn.mock.returnValue = value;
    return mockFn;
  };
  return mockFn;
};

global.spyOn = (object, method) => {
  const originalMethod = object[method];
  const mockFn = jest.fn();
  object[method] = mockFn;
  mockFn.mockRestore = () => {
    object[method] = originalMethod;
  };
  return mockFn;
};