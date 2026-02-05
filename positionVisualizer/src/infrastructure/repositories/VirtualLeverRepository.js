/**
 * VirtualLeverRepository.js
 * 仮想レバー設定の永続化を担当するリポジトリ
 * LocalStorageに保存することで、ページリロード後も設定を維持
 */

import { VirtualLever } from '../../domain/entities/VirtualLever.js';

/**
 * 仮想レバーリポジトリクラス
 */
export class VirtualLeverRepository {
  /**
   * コンストラクタ
   * @param {Object} storageAdapter - LocalStorageアダプター
   */
  constructor(storageAdapter) {
    this.storageAdapter = storageAdapter;
    this.storageKey = 'virtualLevers';
    this.modeKey = 'virtualLeverMode';
  }

  /**
   * 仮想レバーモード状態を保存
   * @param {boolean} enabled - モードが有効かどうか
   * @returns {Promise<void>}
   */
  async saveMode(enabled) {
    try {
      await this.storageAdapter.setItem(this.modeKey, enabled);
    } catch (error) {
      console.error('Failed to save virtual lever mode:', error);
      throw error;
    }
  }

  /**
   * 仮想レバーモード状態を取得
   * @returns {Promise<boolean>} モードが有効かどうか
   */
  async getMode() {
    try {
      const mode = await this.storageAdapter.getItem(this.modeKey);
      return mode === true || mode === 'true';
    } catch (error) {
      console.error('Failed to get virtual lever mode:', error);
      return false;
    }
  }

  /**
   * 仮想レバー設定を保存
   * @param {VirtualLever[]} levers - 仮想レバーの配列
   * @returns {Promise<void>}
   */
  async saveLevers(levers) {
    try {
      const data = levers.map(lever => lever.toJSON());
      await this.storageAdapter.setItem(this.storageKey, data);
    } catch (error) {
      console.error('Failed to save virtual levers:', error);
      throw error;
    }
  }

  /**
   * 仮想レバー設定を取得
   * @returns {Promise<VirtualLever[]>} 仮想レバーの配列
   */
  async getLevers() {
    try {
      const data = await this.storageAdapter.getItem(this.storageKey);

      if (!data || !Array.isArray(data)) {
        return [];
      }

      return data.map(item => VirtualLever.fromJSON(item));
    } catch (error) {
      console.error('Failed to get virtual levers:', error);
      return [];
    }
  }

  /**
   * 特定の仮想レバー設定を取得
   * @param {string} leverId - レバーID
   * @returns {Promise<VirtualLever|null>} 仮想レバーオブジェクト
   */
  async getLever(leverId) {
    try {
      const levers = await this.getLevers();
      return levers.find(lever => lever.id === leverId) || null;
    } catch (error) {
      console.error(`Failed to get virtual lever ${leverId}:`, error);
      return null;
    }
  }

  /**
   * 単一の仮想レバーを保存（既存の場合は更新）
   * @param {VirtualLever} lever - 仮想レバーオブジェクト
   * @returns {Promise<void>}
   */
  async saveLever(lever) {
    try {
      const levers = await this.getLevers();
      const index = levers.findIndex(l => l.id === lever.id);

      if (index >= 0) {
        levers[index] = lever;
      } else {
        levers.push(lever);
      }

      await this.saveLevers(levers);
    } catch (error) {
      console.error(`Failed to save virtual lever ${lever.id}:`, error);
      throw error;
    }
  }

  /**
   * 特定の仮想レバーを削除
   * @param {string} leverId - レバーID
   * @returns {Promise<boolean>} 削除成功したかどうか
   */
  async deleteLever(leverId) {
    try {
      const levers = await this.getLevers();
      const filteredLevers = levers.filter(lever => lever.id !== leverId);

      if (filteredLevers.length === levers.length) {
        return false; // 削除対象が見つからなかった
      }

      await this.saveLevers(filteredLevers);
      return true;
    } catch (error) {
      console.error(`Failed to delete virtual lever ${leverId}:`, error);
      throw error;
    }
  }

  /**
   * 全仮想レバー設定をクリア
   * @returns {Promise<void>}
   */
  async clearLevers() {
    try {
      await this.storageAdapter.removeItem(this.storageKey);
    } catch (error) {
      console.error('Failed to clear virtual levers:', error);
      throw error;
    }
  }

  /**
   * 仮想レバー数を取得
   * @returns {Promise<number>} レバー数
   */
  async count() {
    try {
      const levers = await this.getLevers();
      return levers.length;
    } catch (error) {
      console.error('Failed to count virtual levers:', error);
      return 0;
    }
  }

  /**
   * 仮想レバーが存在するかチェック
   * @param {string} leverId - レバーID
   * @returns {Promise<boolean>} 存在すればtrue
   */
  async exists(leverId) {
    try {
      const lever = await this.getLever(leverId);
      return lever !== null;
    } catch (error) {
      console.error(`Failed to check virtual lever existence ${leverId}:`, error);
      return false;
    }
  }
}
