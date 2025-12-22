/**
 * ValueCalculator.test.js
 * ValueCalculatorクラスのユニットテスト
 */

import { describe, test, expect } from 'bun:test';
import { ValueCalculator } from '../../../src/domain/services/ValueCalculator.js';

describe('ValueCalculator', () => {
  test('normalize - 値を0-100の範囲に正規化する', () => {
    // 標準的な正規化
    expect(ValueCalculator.normalize(50, 0, 100)).toBe(50);
    expect(ValueCalculator.normalize(0, 0, 100)).toBe(0);
    expect(ValueCalculator.normalize(100, 0, 100)).toBe(100);

    // 範囲外の値は範囲内に制限される
    expect(ValueCalculator.normalize(-10, 0, 100)).toBe(0);
    expect(ValueCalculator.normalize(150, 0, 100)).toBe(100);

    // 異なる入力範囲の正規化
    expect(ValueCalculator.normalize(500, 0, 1000)).toBe(50);
    expect(ValueCalculator.normalize(750, 0, 1000)).toBe(75);

    // カスタム範囲
    expect(ValueCalculator.normalize(5, 0, 10)).toBe(50);

    // 最小値と最大値が同じ場合
    expect(ValueCalculator.normalize(50, 100, 100)).toBe(50);

    // nullとundefinedの処理
    expect(ValueCalculator.normalize(null)).toBeNull();
    expect(ValueCalculator.normalize(undefined)).toBeNull();
  });

  test('interpolate - 2つの値の間を補間する', () => {
    // 基本的な補間
    expect(ValueCalculator.interpolate(0, 100, 0)).toBe(0);
    expect(ValueCalculator.interpolate(0, 100, 1)).toBe(100);
    expect(ValueCalculator.interpolate(0, 100, 0.5)).toBeCloseTo(50, 0);

    // キュービックイージング（_easeInOutCubic）により、0.5の時点では線形補間とは少し異なる値になる
    const midpointValue = ValueCalculator.interpolate(0, 100, 0.5);
    expect(midpointValue).toBe(50);

    // 負の値の補間
    expect(ValueCalculator.interpolate(-100, 100, 0.5)).toBeCloseTo(0, 0);

    // nullの処理
    expect(ValueCalculator.interpolate(null, 100, 0.5)).toBe(100);
    expect(ValueCalculator.interpolate(0, null, 0.5)).toBe(0);
    expect(ValueCalculator.interpolate(0, 100, null)).toBe(100);
  });

  test('_easeInOutCubic - キュービックイージング関数が正しく動作する', () => {
    // 境界値
    expect(ValueCalculator._easeInOutCubic(0)).toBe(0);
    expect(ValueCalculator._easeInOutCubic(1)).toBe(1);

    // 中間値
    expect(ValueCalculator._easeInOutCubic(0.5)).toBe(0.5);

    // 0.5より小さい値
    const smallValue = ValueCalculator._easeInOutCubic(0.25);
    expect(smallValue).toBeLessThan(0.25);

    // 0.5より大きい値
    const largeValue = ValueCalculator._easeInOutCubic(0.75);
    expect(largeValue).toBeGreaterThan(0.75);
  });

  test('calculateMovingAverage - 移動平均を計算する', () => {
    // 基本的なケース
    const values = [10, 20, 30, 40, 50];
    const movingAvg = ValueCalculator.calculateMovingAverage(values, 3);

    // 結果の長さは入力と同じ
    expect(movingAvg.length).toBe(5);

    // 最初のポイントは自分自身のみ
    expect(movingAvg[0]).toBe(10);

    // 2番目は最初の2つの平均
    expect(movingAvg[1]).toBe(15);

    // 3番目以降は3つの平均
    expect(movingAvg[2]).toBeCloseTo(20, 0);
    expect(movingAvg[3]).toBeCloseTo(30, 0);
    expect(movingAvg[4]).toBeCloseTo(40, 0);

    // nullとundefinedを含むケース
    const valuesWithNull = [10, null, 30, undefined, 50];
    const movingAvgWithNull = ValueCalculator.calculateMovingAverage(valuesWithNull, 3);

    expect(movingAvgWithNull[0]).toBe(10);
    expect(movingAvgWithNull[1]).toBe(10); // nullは無視され、10のみの平均
    expect(movingAvgWithNull[2]).toBe(20); // 10と30の平均
    expect(movingAvgWithNull[3]).toBe(30); // 30のみの平均
    expect(movingAvgWithNull[4]).toBe(40); // 30と50の平均

    // 空の配列
    expect(ValueCalculator.calculateMovingAverage([])).toEqual([]);

    // windowSizeが1の場合、元の値と同じ
    expect(ValueCalculator.calculateMovingAverage(values, 1)).toEqual(values);

    // windowSizeが無効な場合、1として扱われる
    expect(ValueCalculator.calculateMovingAverage(values, 0)).toEqual(values);
    expect(ValueCalculator.calculateMovingAverage(values, -1)).toEqual(values);
  });

  test('smoothValue - 値を平滑化する', () => {
    // 基本的な平滑化（smoothingFactor = 0.2の場合）
    expect(ValueCalculator.smoothValue(0, 100, 0.2)).toBeCloseTo(20, 0);
    expect(ValueCalculator.smoothValue(50, 100, 0.2)).toBeCloseTo(60, 0);

    // smoothingFactorが0の場合、現在値をそのまま返す
    expect(ValueCalculator.smoothValue(50, 100, 0)).toBe(50);

    // smoothingFactorが1の場合、新しい値をそのまま返す
    expect(ValueCalculator.smoothValue(50, 100, 1)).toBe(100);

    // nullの処理
    expect(ValueCalculator.smoothValue(null, 100, 0.2)).toBe(100);
    expect(ValueCalculator.smoothValue(50, null, 0.2)).toBe(50);
  });

  test('calculateChangeRate - 値の変化率を計算する', () => {
    // 基本的な変化率計算
    expect(ValueCalculator.calculateChangeRate(0, 50)).toBe(0.5);
    expect(ValueCalculator.calculateChangeRate(0, 100)).toBe(1);
    expect(ValueCalculator.calculateChangeRate(100, 0)).toBe(1);
    expect(ValueCalculator.calculateChangeRate(50, 50)).toBe(0);

    // カスタム最大範囲
    expect(ValueCalculator.calculateChangeRate(0, 5, 10)).toBe(0.5);

    // nullの処理
    expect(ValueCalculator.calculateChangeRate(null, 50)).toBe(0);
    expect(ValueCalculator.calculateChangeRate(50, null)).toBe(0);
  });

  test('shouldTriggerEvent - 閾値を超えたかどうかを判断する', () => {
    // 基本的な閾値チェック（デフォルト閾値は5）
    expect(ValueCalculator.shouldTriggerEvent(0, 6)).toBe(true);
    expect(ValueCalculator.shouldTriggerEvent(0, 5)).toBe(true);
    expect(ValueCalculator.shouldTriggerEvent(0, 4)).toBe(false);

    // カスタム閾値
    expect(ValueCalculator.shouldTriggerEvent(0, 5, 10)).toBe(false);
    expect(ValueCalculator.shouldTriggerEvent(0, 10, 10)).toBe(true);

    // 負の方向への変化
    expect(ValueCalculator.shouldTriggerEvent(10, 4, 5)).toBe(true);

    // nullの処理
    expect(ValueCalculator.shouldTriggerEvent(null, 50)).toBe(true);
    expect(ValueCalculator.shouldTriggerEvent(50, null)).toBe(true);
  });

  test('calculateStatistics - 値の統計情報を計算する', () => {
    const values = [10, 20, 30, 40, 50];
    const stats = ValueCalculator.calculateStatistics(values);

    // 統計情報の検証
    expect(stats.min).toBe(10);
    expect(stats.max).toBe(50);
    expect(stats.average).toBe(30);
    expect(stats.median).toBe(30);

    // 偶数個の要素の中央値
    const evenValues = [10, 20, 30, 40];
    const evenStats = ValueCalculator.calculateStatistics(evenValues);
    expect(evenStats.median).toBe(25);

    // nullとundefinedを含むケース
    const valuesWithNull = [10, null, 30, undefined, 50];
    const statsWithNull = ValueCalculator.calculateStatistics(valuesWithNull);
    expect(statsWithNull.min).toBe(10);
    expect(statsWithNull.max).toBe(50);
    expect(statsWithNull.average).toBe(30);
    expect(statsWithNull.median).toBe(30);

    // 空の配列
    const emptyStats = ValueCalculator.calculateStatistics([]);
    expect(emptyStats.min).toBeNull();
    expect(emptyStats.max).toBeNull();
    expect(emptyStats.average).toBeNull();
    expect(emptyStats.median).toBeNull();

    // すべてnullの配列
    const allNullStats = ValueCalculator.calculateStatistics([null, null, null]);
    expect(allNullStats.min).toBeNull();
    expect(allNullStats.max).toBeNull();
    expect(allNullStats.average).toBeNull();
    expect(allNullStats.median).toBeNull();

    // nullではない配列
    const notArrayStats = ValueCalculator.calculateStatistics("not an array");
    expect(notArrayStats.min).toBeNull();
    expect(notArrayStats.max).toBeNull();
    expect(notArrayStats.average).toBeNull();
    expect(notArrayStats.median).toBeNull();
  });
});