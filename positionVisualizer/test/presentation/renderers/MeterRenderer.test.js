/**
 * MeterRenderer.test.js
 * MeterRendererクラスのユニットテスト
 */

import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { MeterRenderer } from '../../../src/presentation/renderers/MeterRenderer.js';

describe('MeterRenderer', () => {
  let container;
  let renderer;
  const mockOptions = {
    iconSize: 50
  };

  // 各テストの前に実行
  beforeEach(() => {
    // DOM要素のモック
    container = document.createElement('div');
    container.id = 'meter-container';
    document.body.appendChild(container);

    // ログ出力を抑制
    global.console.debug = () => {};
    global.console.info = () => {};
    global.console.warn = () => {};
    global.console.error = () => {};

    // MeterRendererのインスタンス作成
    renderer = new MeterRenderer(container, mockOptions);
  });

  // 各テストの後に実行
  afterEach(() => {
    if (renderer) {
      renderer.dispose();
    }
    if (container && container.parentNode) {
      document.body.removeChild(container);
    }
    container = null;
  });

  test('コンストラクタでSVG要素が正しく作成される', () => {
    const svg = container.querySelector('svg[data-meter]');
    expect(svg).not.toBeNull();

    // SVGの基本属性が設定されている
    expect(svg.getAttribute('width')).toBe('100%');
    expect(svg.getAttribute('height')).toBe('100%');
    expect(svg.getAttribute('viewBox')).not.toBeNull();

    // デフォルトの要素が含まれている
    const defs = svg.querySelector('defs');
    expect(defs).not.toBeNull();

    const gradient = defs.querySelector('linearGradient');
    expect(gradient).not.toBeNull();
    expect(gradient.getAttribute('id')).toBe('meterGradient');

    // 円弧パスが存在する
    const path = svg.querySelector('path[data-arc]');
    expect(path).not.toBeNull();
  });

  test('update - デバイス値に応じてグラフィック要素が更新される', () => {
    const mockViewModelState = {
      values: [25, 75, null, 50],
      connected: [true, true, false, true],
      iconVisible: [true, true, false, true],
      icons: ['icon1.svg', 'icon2.svg', null, 'icon3.svg']
    };

    // 更新を実行
    renderer.update(mockViewModelState);

    // 接続されているデバイス（3つ）のグラフィック要素が作成される
    const deviceElements = container.querySelectorAll('g[data-perf]');
    expect(deviceElements.length).toBe(3);

    // 各要素の位置と属性を検証
    const element0 = container.querySelector('g[data-perf="0"]');
    expect(element0).not.toBeNull();
    expect(element0.getAttribute('data-percentage')).toBe('25');
    expect(element0.getAttribute('data-actual')).toBe('25');

    const element1 = container.querySelector('g[data-perf="1"]');
    expect(element1).not.toBeNull();
    expect(element1.getAttribute('data-percentage')).toBe('75');
    expect(element1.getAttribute('data-actual')).toBe('75');

    // 非接続のデバイスは表示されない
    const element2 = container.querySelector('g[data-perf="2"]');
    expect(element2).toBeNull();

    const element3 = container.querySelector('g[data-perf="3"]');
    expect(element3).not.toBeNull();
    expect(element3.getAttribute('data-percentage')).toBe('50');
    expect(element3.getAttribute('data-actual')).toBe('50');
  });

  test('update - 接続状態が変わると要素が追加/削除される', () => {
    // 最初の状態
    const initialState = {
      values: [25, 75, null],
      connected: [true, true, false],
      iconVisible: [true, true, false],
      icons: ['icon1.svg', 'icon2.svg', null]
    };

    renderer.update(initialState);
    let deviceElements = container.querySelectorAll('g[data-perf]');
    expect(deviceElements.length).toBe(2);

    // デバイス1が切断され、デバイス3が接続された状態
    const updatedState = {
      values: [null, null, 50],
      connected: [false, false, true],
      iconVisible: [false, false, true],
      icons: ['icon1.svg', 'icon2.svg', 'icon3.svg']
    };

    renderer.update(updatedState);
    deviceElements = container.querySelectorAll('g[data-perf]');
    expect(deviceElements.length).toBe(1);

    // デバイス3のみ存在する
    const element2 = container.querySelector('g[data-perf="2"]');
    expect(element2).not.toBeNull();
    expect(element2.getAttribute('data-percentage')).toBe('50');
  });

  test('_calculateIconPosition - 値に応じて正しい位置が計算される', () => {
    // private メソッドへのアクセス
    const calculatePosition = (percentage, laneIndex = 0, deviceCount = 1) => {
      return renderer._calculateIconPosition(percentage, laneIndex, deviceCount);
    };

    // 0%の位置
    const pos0 = calculatePosition(0);
    expect(pos0.x).toBeGreaterThan(0);
    expect(pos0.y).toBeGreaterThan(0);

    // 50%の位置
    const pos50 = calculatePosition(50);
    expect(pos50.x).toBeGreaterThan(0);
    expect(pos50.y).toBeGreaterThan(0);

    // 100%の位置
    const pos100 = calculatePosition(100);
    expect(pos100.x).toBeGreaterThan(0);
    expect(pos100.y).toBeGreaterThan(0);

    // 0%と100%の位置が異なる
    expect(pos0).not.toEqual(pos100);
  });

  test('resize - サイズ変更が正しく適用される', () => {
    // リサイズ前のSVG
    const svg = renderer.getSVGElement();
    svg.setAttribute('width', '300');
    svg.setAttribute('height', '200');

    // サイズ変更
    renderer.resize(400, 300);

    // 新しいサイズが適用されている
    expect(svg.getAttribute('width')).toBe('400');
    expect(svg.getAttribute('height')).toBe('300');
  });

  test('dispose - リソースが適切に解放される', () => {
    const svg = renderer.getSVGElement();
    expect(svg.parentNode).toBe(container);

    // disposeを実行
    renderer.dispose();

    // SVGがDOMから削除されている
    expect(svg.parentNode).toBeNull();
    expect(renderer.svg).toBeNull();
  });

  test('getSVGElement - SVG要素が取得できる', () => {
    const svg = renderer.getSVGElement();
    expect(svg).not.toBeNull();
    expect(svg.tagName).toBe('svg');
    expect(svg.hasAttribute('data-meter')).toBe(true);
  });
});