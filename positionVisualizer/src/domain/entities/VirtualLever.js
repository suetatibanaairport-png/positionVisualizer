/**
 * VirtualLever.js
 * 仮想レバーのエンティティ
 * 動画撮影後の編集用に、レバーの動きを再現するための設定を保持
 */

/**
 * 仮想レバークラス
 * 動画編集用にレバーの動きを設定・再現するためのエンティティ
 */
export class VirtualLever {
  /**
   * コンストラクタ
   * @param {string} id - 仮想レバーID
   * @param {Object} config - 設定オブジェクト
   * @param {string} [config.name] - レバー名
   * @param {string} [config.iconUrl] - アイコンURL
   * @param {number} [config.initialValue] - 初期値 (0-100%)
   * @param {number} [config.endValue] - 終了値 (0-100%)
   * @param {number} [config.speedPerSecond] - 移動速度 (%/秒)
   * @param {number} [config.startDelay] - 開始ディレイ (秒)
   * @param {string} [config.sourceDeviceId] - 変換元の実デバイスID
   * @param {boolean} [config.visible] - 表示状態（デフォルト: true）
   * @param {Array} [config.segments] - セグメント配列（複数の動きを定義）
   */
  constructor(id, config = {}) {
    this.id = id;
    this.name = config.name || `仮想レバー ${id}`;
    this.iconUrl = config.iconUrl || null;
    this.initialValue = config.initialValue ?? 50;     // 0-100% (後方互換のため維持)
    this.endValue = config.endValue ?? 100;            // 0-100% (後方互換のため維持)
    this.speedPerSecond = config.speedPerSecond ?? 10; // %/秒 (後方互換のため維持)
    this.startDelay = config.startDelay ?? 0;          // 秒 (後方互換のため維持)
    this.isVirtual = true;                             // 仮想レバーフラグ
    this.sourceDeviceId = config.sourceDeviceId || null; // 変換元デバイスID
    this.visible = config.visible !== false;           // 表示状態（デフォルト: true）

    // セグメント配列（複数の動きを定義）
    if (config.segments && config.segments.length > 0) {
      this.segments = config.segments;
    } else {
      // 既存のプロパティからセグメントを生成（後方互換）
      this.segments = [{
        initialValue: this.initialValue,
        endValue: this.endValue,
        speedPerSecond: this.speedPerSecond,
        startDelay: this.startDelay
      }];
    }
  }

  /**
   * JSON形式に変換
   * @returns {Object} JSON形式のデータ
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      iconUrl: this.iconUrl,
      initialValue: this.initialValue,
      endValue: this.endValue,
      speedPerSecond: this.speedPerSecond,
      startDelay: this.startDelay,
      isVirtual: this.isVirtual,
      sourceDeviceId: this.sourceDeviceId,
      visible: this.visible,
      segments: this.segments
    };
  }

  /**
   * JSONから仮想レバーオブジェクトを生成
   * @param {Object} data - JSON形式のデータ
   * @returns {VirtualLever} 仮想レバーオブジェクト
   */
  static fromJSON(data) {
    return new VirtualLever(data.id, {
      name: data.name,
      iconUrl: data.iconUrl,
      initialValue: data.initialValue,
      endValue: data.endValue,
      speedPerSecond: data.speedPerSecond,
      startDelay: data.startDelay,
      sourceDeviceId: data.sourceDeviceId,
      visible: data.visible,
      segments: data.segments
    });
  }

  /**
   * 設定の検証
   * @returns {Object} { valid: boolean, errors: string[] }
   */
  validate() {
    const errors = [];

    // 各セグメントを検証
    for (let i = 0; i < this.segments.length; i++) {
      const segment = this.segments[i];

      if (segment.initialValue < 0 || segment.initialValue > 100) {
        errors.push(`セグメント${i + 1}: 初期値は0-100%の範囲で設定してください`);
      }

      if (segment.endValue < 0 || segment.endValue > 100) {
        errors.push(`セグメント${i + 1}: 終了値は0-100%の範囲で設定してください`);
      }

      if (segment.speedPerSecond <= 0) {
        errors.push(`セグメント${i + 1}: 移動速度は0より大きい値を設定してください`);
      }

      if (segment.startDelay < 0) {
        errors.push(`セグメント${i + 1}: 開始ディレイは0以上の値を設定してください`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * アニメーションの総時間を計算
   * @returns {number} 総時間（秒）
   */
  getTotalDuration() {
    let totalTime = 0;
    for (const segment of this.segments) {
      const distance = Math.abs(segment.endValue - segment.initialValue);
      const animationTime = distance / segment.speedPerSecond;
      totalTime += segment.startDelay + animationTime;
    }
    return totalTime;
  }

  /**
   * 設定をコピー
   * @returns {VirtualLever} 新しい仮想レバーオブジェクト
   */
  clone() {
    return new VirtualLever(this.id, this.toJSON());
  }
}
