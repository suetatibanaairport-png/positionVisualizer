/**
 * VirtualLeverSession.js
 * 仮想レバーアニメーションセッションのエンティティ
 * 複数の仮想レバーの実行状態を管理
 */

/**
 * アニメーション状態クラス
 * 各仮想レバーのアニメーション実行状態を保持
 */
export class AnimationState {
  /**
   * コンストラクタ
   * @param {VirtualLever} lever - 仮想レバーオブジェクト
   */
  constructor(lever) {
    this.leverId = lever.id;
    this.currentValue = lever.segments?.[0]?.initialValue ?? lever.initialValue;
    this.isAnimating = false;
    this.animationStartTime = null;
    this.isComplete = false;

    // セグメント対応の追加プロパティ
    this.currentSegmentIndex = 0;      // 現在のセグメントインデックス
    this.segmentStartTime = null;      // 現在セグメントの開始時刻
  }

  /**
   * アニメーション開始
   * @param {number} timestamp - 開始時刻（performance.now()）
   */
  start(timestamp) {
    this.isAnimating = true;
    this.animationStartTime = timestamp;
    this.segmentStartTime = timestamp;
    this.isComplete = false;
  }

  /**
   * 次のセグメントへ遷移
   * @param {number} timestamp - 遷移時刻（performance.now()）
   */
  nextSegment(timestamp) {
    this.currentSegmentIndex++;
    this.segmentStartTime = timestamp;
  }

  /**
   * アニメーション完了
   * @param {number} finalValue - 最終値
   */
  complete(finalValue) {
    this.currentValue = finalValue;
    this.isAnimating = false;
    this.isComplete = true;
  }

  /**
   * アニメーションリセット
   * @param {VirtualLever} lever - 仮想レバーオブジェクト
   */
  reset(lever) {
    this.currentValue = lever.segments?.[0]?.initialValue ?? lever.initialValue;
    this.isAnimating = false;
    this.animationStartTime = null;
    this.isComplete = false;
    this.currentSegmentIndex = 0;
    this.segmentStartTime = null;
  }
}

/**
 * 仮想レバーセッションクラス
 * 複数の仮想レバーのアニメーションセッションを管理
 */
export class VirtualLeverSession {
  /**
   * コンストラクタ
   */
  constructor() {
    this.isActive = false;
    this.startTime = null;
    this.levers = new Map(); // leverId -> VirtualLever
    this.animationStates = new Map(); // leverId -> AnimationState
  }

  /**
   * 仮想レバーを追加
   * @param {VirtualLever} lever - 仮想レバーオブジェクト
   */
  addLever(lever) {
    this.levers.set(lever.id, lever);
    this.animationStates.set(lever.id, new AnimationState(lever));
  }

  /**
   * 仮想レバーを削除
   * @param {string} leverId - レバーID
   * @returns {boolean} 削除成功したかどうか
   */
  removeLever(leverId) {
    const hasLever = this.levers.has(leverId);
    this.levers.delete(leverId);
    this.animationStates.delete(leverId);
    return hasLever;
  }

  /**
   * 仮想レバーを更新
   * @param {VirtualLever} lever - 更新後の仮想レバーオブジェクト
   * @returns {boolean} 更新成功したかどうか
   */
  updateLever(lever) {
    if (!this.levers.has(lever.id)) {
      return false;
    }
    this.levers.set(lever.id, lever);
    // アニメーション状態は保持（実行中の場合は影響しないように）
    return true;
  }

  /**
   * 仮想レバーを取得
   * @param {string} leverId - レバーID
   * @returns {VirtualLever|undefined} 仮想レバーオブジェクト
   */
  getLever(leverId) {
    return this.levers.get(leverId);
  }

  /**
   * 全仮想レバーを取得
   * @returns {VirtualLever[]} 仮想レバーの配列
   */
  getAllLevers() {
    return Array.from(this.levers.values());
  }

  /**
   * アニメーション状態を取得
   * @param {string} leverId - レバーID
   * @returns {AnimationState|undefined} アニメーション状態オブジェクト
   */
  getAnimationState(leverId) {
    return this.animationStates.get(leverId);
  }

  /**
   * セッション開始
   * @param {number} timestamp - 開始時刻（performance.now()）
   */
  start(timestamp) {
    this.isActive = true;
    this.startTime = timestamp;

    // 全レバーのアニメーション状態をリセット
    for (const [leverId, lever] of this.levers) {
      const animState = this.animationStates.get(leverId);
      if (animState) {
        animState.reset(lever.initialValue);
      }
    }
  }

  /**
   * セッション停止
   */
  stop() {
    this.isActive = false;
    this.startTime = null;

    // 全レバーのアニメーション状態をリセット
    for (const [leverId, lever] of this.levers) {
      const animState = this.animationStates.get(leverId);
      if (animState) {
        animState.reset(lever.initialValue);
      }
    }
  }

  /**
   * 全てのアニメーションが完了したかチェック
   * @returns {boolean} 全て完了していればtrue
   */
  isAllAnimationsComplete() {
    if (this.animationStates.size === 0) {
      return false;
    }

    for (const animState of this.animationStates.values()) {
      if (!animState.isComplete) {
        return false;
      }
    }

    return true;
  }

  /**
   * レバー数を取得
   * @returns {number} レバー数
   */
  getLeverCount() {
    return this.levers.size;
  }

  /**
   * セッションをクリア
   */
  clear() {
    this.isActive = false;
    this.startTime = null;
    this.levers.clear();
    this.animationStates.clear();
  }
}
