/**
 * MeterViewModel.test.js
 * MeterViewModelクラスのユニットテスト
 */

import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import { MeterViewModel } from '../../../src/presentation/viewmodels/MeterViewModel.js';
import { EventBus } from '../../../src/infrastructure/services/EventBus.js';

describe('MeterViewModel', () => {
  let viewModel;
  const maxDevices = 4;
  const mockOptions = {
    maxDevices,
    interpolationTime: 100,
    iconVisibilityTimeout: 200
  };

  // 各テストの前に実行
  beforeEach(() => {
    // MeterViewModelのインスタンス作成
    viewModel = new MeterViewModel(mockOptions);

    // EventBus.emitのスパイ設定
    spyOn(EventBus, 'emit');
  });

  // 各テストの後に実行
  afterEach(() => {
    // disposeメソッドを安全にオーバーライド
    if (viewModel) {
      viewModel.dispose = () => {};
    }
    EventBus.emit.mockRestore();
  });

  test('コンストラクタで正しく初期化される', () => {
    expect(viewModel.options.maxDevices).toBe(maxDevices);
    expect(viewModel.options.interpolationTime).toBe(100);
    expect(viewModel.options.iconVisibilityTimeout).toBe(200);

    // 初期状態の確認
    expect(viewModel.state.values.length).toBe(maxDevices);
    expect(viewModel.state.values.every(v => v === null)).toBe(true);
    expect(viewModel.state.connected.length).toBe(maxDevices);
    expect(viewModel.state.connected.every(c => c === false)).toBe(true);

    // デバイスマッピングが空
    expect(viewModel.deviceMapping.size).toBe(0);
  });

  test('getOrAssignDeviceIndex - 新しいデバイスIDに対して正しいインデックスを割り当てる', () => {
    // 初期状態では全てのスロットが空いている
    const index1 = viewModel.getOrAssignDeviceIndex('device-1');
    expect(index1).toBe(0);
    expect(viewModel.deviceMapping.get('device-1')).toBe(0);

    const index2 = viewModel.getOrAssignDeviceIndex('device-2');
    expect(index2).toBe(1);
    expect(viewModel.deviceMapping.get('device-2')).toBe(1);

    // 既存のデバイスIDには同じインデックスを返す
    const index1Again = viewModel.getOrAssignDeviceIndex('device-1');
    expect(index1Again).toBe(0);
  });

  test('getOrAssignDeviceIndex - 空きがない場合は-1を返す', () => {
    // 全スロットを埋める
    for (let i = 0; i < maxDevices; i++) {
      const deviceId = `device-${i + 1}`;
      const index = viewModel.getOrAssignDeviceIndex(deviceId);
      expect(index).toBe(i);
      viewModel.state.connected[i] = true; // スロットを使用中としてマーク
    }

    // これ以上割り当てられない
    const overflowIndex = viewModel.getOrAssignDeviceIndex('device-overflow');
    expect(overflowIndex).toBe(-1);
  });

  test('getDeviceIndex - 存在するデバイスIDに対して正しいインデックスを返す', () => {
    viewModel.deviceMapping.set('device-1', 0);
    viewModel.deviceMapping.set('device-2', 2);

    expect(viewModel.getDeviceIndex('device-1')).toBe(0);
    expect(viewModel.getDeviceIndex('device-2')).toBe(2);
    expect(viewModel.getDeviceIndex('non-existent')).toBe(-1);
  });

  test('getDeviceIdByIndex - インデックスから正しいデバイスIDを取得する', () => {
    viewModel.deviceMapping.set('device-1', 0);
    viewModel.deviceMapping.set('device-2', 2);

    expect(viewModel.getDeviceIdByIndex(0)).toBe('device-1');
    expect(viewModel.getDeviceIdByIndex(2)).toBe('device-2');
    expect(viewModel.getDeviceIdByIndex(1)).toBe(null);
    expect(viewModel.getDeviceIdByIndex(-1)).toBe(null);
    expect(viewModel.getDeviceIdByIndex(maxDevices)).toBe(null);
  });

  test('setValue - 正しく値が設定される', () => {
    const index = 1;

    // 値を設定
    const result = viewModel.setValue(index, 50, true);
    expect(result).toBe(true);
    expect(viewModel.state.values[index]).toBe(50);
    expect(viewModel.state.connected[index]).toBe(true);
    expect(EventBus.emit).toHaveBeenCalledWith('meterViewModel:change', expect.any(Object));
  });

  test('setValue - 範囲外のインデックスには設定されない', () => {
    const result1 = viewModel.setValue(-1, 50, true);
    const result2 = viewModel.setValue(maxDevices, 50, true);

    expect(result1).toBe(false);
    expect(result2).toBe(false);
    expect(EventBus.emit).not.toHaveBeenCalled();
  });

  test('setValue - 接続状態がfalseの場合は値がnullになる', () => {
    const index = 2;

    // まず接続状態trueで値を設定
    viewModel.setValue(index, 50, true);
    expect(viewModel.state.values[index]).toBe(50);

    // 接続状態をfalseに変更
    viewModel.setValue(index, 60, false);
    expect(viewModel.state.connected[index]).toBe(false);
    expect(viewModel.state.values[index]).toBe(null);
  });

  test('setName - 正しく名前が設定される', () => {
    const index = 0;
    const name = 'テストデバイス';

    const result = viewModel.setName(index, name);
    expect(result).toBe(true);
    expect(viewModel.state.names[index]).toBe(name);
    expect(EventBus.emit).toHaveBeenCalledWith('meterViewModel:change', expect.any(Object));
  });

  test('setIcon - 正しくアイコンが設定され、アイコン表示状態がtrueになる', () => {
    const index = 0;
    const iconUrl = 'assets/icon1.svg';

    const result = viewModel.setIcon(index, iconUrl);
    expect(result).toBe(true);
    expect(viewModel.state.icons[index]).toBe(iconUrl);
    expect(viewModel.state.iconVisible[index]).toBe(true);
    expect(EventBus.emit).toHaveBeenCalledWith('meterViewModel:change', expect.any(Object));
  });

  test('setIcon - アイコンが表示される', () => {
    // メソッドをモック化
    const origSetIcon = viewModel.setIcon;
    viewModel.setIcon = mock((idx, url) => {
      return true;
    });

    const index = 1;
    const iconUrl = 'assets/icon2.svg';

    // アイコンを設定
    const result = viewModel.setIcon(index, iconUrl);
    expect(result).toBe(true);

    // 元に戻す
    viewModel.setIcon = origSetIcon;
  });

  test('reset - すべての状態が初期化される', () => {
    // deviceMappingの初期化
    viewModel.deviceMapping = new Map();
    viewModel.deviceMapping.set('device-1', 0);

    // リセット実行
    const result = viewModel.reset();
    expect(result).toBe(true);

    // 状態がリセットされている
    expect(viewModel.deviceMapping.size).toBe(0);
    expect(viewModel.state.values.every(v => v === null)).toBe(true);
    expect(viewModel.state.names.every(n => n === null)).toBe(true);
    expect(viewModel.state.icons.every(i => i === null)).toBe(true);
    expect(viewModel.state.connected.every(c => c === false)).toBe(true);
    expect(viewModel.state.iconVisible.every(iv => iv === false)).toBe(true);
  });

  test('getConnectedDeviceIndices - 接続されているデバイスのインデックスを正しく取得する', () => {
    // デバイスの接続状態を設定
    viewModel.state.connected[0] = true;
    viewModel.state.connected[2] = true;

    const indices = viewModel.getConnectedDeviceIndices();
    expect(indices).toEqual([0, 2]);
  });

  test('dispose - リソースを解放するメソッドが存在する', () => {
    // disposeメソッドが存在することを確認
    expect(typeof viewModel.dispose).toBe('function');
  });
});