/**
 * ValueCalculator.js
 * デバイス値の計算と処理を行うドメインサービス
 * 値の補間、統計計算などを提供
 */

/**
 * 値計算サービスクラス
 */
export class ValueCalculator {
  /**
   * 値を正規化する
   * @param {number} rawValue 生の値
   * @param {number} minValue 最小値
   * @param {number} maxValue 最大値
   * @returns {number} 0-100の範囲に正規化された値
   */
  static normalize(rawValue, minValue = 0, maxValue = 100) {
    if (rawValue === null || rawValue === undefined) return null;

    // 最小値と最大値が同じ場合（ゼロ除算防止）
    if (minValue === maxValue) return 50;

    // 0-100の範囲に正規化
    const normalized = ((rawValue - minValue) / (maxValue - minValue)) * 100;
    return Math.max(0, Math.min(100, normalized));
  }

  /**
   * 値を補間する
   * @param {number} startValue 開始値
   * @param {number} targetValue 目標値
   * @param {number} progress 進行度 (0-1)
   * @returns {number} 補間された値
   */
  static interpolate(startValue, targetValue, progress) {
    if (startValue === null || targetValue === null || progress === null) {
      return targetValue !== null ? targetValue : startValue;
    }

    return startValue + (targetValue - startValue) * this._easeInOutCubic(progress);
  }

  /**
   * キュービックイージング関数 (滑らかな補間用)
   * @param {number} x 0-1の値
   * @returns {number} イージングされた値
   * @private
   */
  static _easeInOutCubic(x) {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  }

  /**
   * 移動平均を計算
   * @param {Array<number>} values 値の配列
   * @param {number} windowSize 窓サイズ
   * @returns {Array<number>} 移動平均値の配列
   */
  static calculateMovingAverage(values, windowSize = 5) {
    if (!Array.isArray(values) || values.length === 0) return [];
    if (windowSize < 1) windowSize = 1;

    const result = [];
    for (let i = 0; i < values.length; i++) {
      let sum = 0;
      let count = 0;

      // 窓内の値を集計
      for (let j = Math.max(0, i - windowSize + 1); j <= i; j++) {
        if (values[j] !== null && values[j] !== undefined) {
          sum += values[j];
          count++;
        }
      }

      result.push(count > 0 ? sum / count : null);
    }

    return result;
  }

  /**
   * 急激な変化を平滑化する
   * @param {number} currentValue 現在の値
   * @param {number} newValue 新しい値
   * @param {number} smoothingFactor 平滑化係数 (0-1)
   * @returns {number} 平滑化された値
   */
  static smoothValue(currentValue, newValue, smoothingFactor = 0.2) {
    if (currentValue === null || newValue === null) {
      return newValue !== null ? newValue : currentValue;
    }

    // smoothingFactor = 0: 完全に現在値を維持
    // smoothingFactor = 1: 完全に新しい値を採用
    return currentValue + smoothingFactor * (newValue - currentValue);
  }

  /**
   * 値の変化率を計算
   * @param {number} oldValue 古い値
   * @param {number} newValue 新しい値
   * @param {number} maxRange 最大範囲（デフォルト100）
   * @returns {number} 変化率 (0-1)
   */
  static calculateChangeRate(oldValue, newValue, maxRange = 100) {
    if (oldValue === null || newValue === null) return 0;

    return Math.abs(newValue - oldValue) / maxRange;
  }

  /**
   * しきい値に基づいてイベントが発生すべきか判断
   * @param {number} oldValue 古い値
   * @param {number} newValue 新しい値
   * @param {number} threshold 閾値
   * @returns {boolean} しきい値を超えたかどうか
   */
  static shouldTriggerEvent(oldValue, newValue, threshold = 5) {
    if (oldValue === null || newValue === null) return true;

    return Math.abs(newValue - oldValue) >= threshold;
  }

  /**
   * 値の統計情報を計算
   * @param {Array<number>} values 値の配列
   * @returns {Object} 統計情報（最小値、最大値、平均値、中央値）
   */
  static calculateStatistics(values) {
    if (!Array.isArray(values) || values.length === 0) {
      return {
        min: null,
        max: null,
        average: null,
        median: null
      };
    }

    // null値を除外
    const filteredValues = values.filter(val => val !== null && val !== undefined);

    if (filteredValues.length === 0) {
      return {
        min: null,
        max: null,
        average: null,
        median: null
      };
    }

    // 昇順にソート（中央値計算用）
    const sortedValues = [...filteredValues].sort((a, b) => a - b);

    // 統計情報を計算
    const min = sortedValues[0];
    const max = sortedValues[sortedValues.length - 1];
    const sum = sortedValues.reduce((acc, val) => acc + val, 0);
    const average = sum / sortedValues.length;

    // 中央値
    const midPoint = Math.floor(sortedValues.length / 2);
    const median = sortedValues.length % 2 === 0
      ? (sortedValues[midPoint - 1] + sortedValues[midPoint]) / 2
      : sortedValues[midPoint];

    return {
      min,
      max,
      average,
      median
    };
  }
}