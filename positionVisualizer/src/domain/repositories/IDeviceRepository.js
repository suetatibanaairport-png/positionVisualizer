/**
 * IDeviceRepository.js
 * デバイス情報を永続化・取得するためのリポジトリインターフェース
 * 具体的な実装はインフラストラクチャ層で行う
 */

/**
 * デバイスリポジトリのインターフェース
 * ストレージからデバイスの取得・保存・削除操作を定義
 */
export class IDeviceRepository {
  /**
   * すべてのデバイスを取得
   * @returns {Promise<Array>} デバイスの配列
   */
  async getAll() {
    throw new Error("Not implemented");
  }

  /**
   * 接続されているすべてのデバイスを取得
   * @returns {Promise<Array>} 接続されているデバイスの配列
   */
  async getAllConnected() {
    throw new Error("Not implemented");
  }

  /**
   * IDでデバイスを取得
   * @param {string} id デバイスID
   * @returns {Promise<Object|null>} デバイスまたはnull
   */
  async getById(id) {
    throw new Error("Not implemented");
  }

  /**
   * 条件に一致するデバイスを検索
   * @param {Function} predicate 検索条件（デバイス => boolean）
   * @returns {Promise<Array>} 条件に一致するデバイスの配列
   */
  async findByCondition(predicate) {
    throw new Error("Not implemented");
  }

  /**
   * デバイスを保存
   * @param {Object} device 保存するデバイス
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async save(device) {
    throw new Error("Not implemented");
  }

  /**
   * 複数のデバイスを一括保存
   * @param {Array} devices 保存するデバイスの配列
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async saveAll(devices) {
    throw new Error("Not implemented");
  }

  /**
   * デバイスを削除
   * @param {string} id 削除するデバイスのID
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async remove(id) {
    throw new Error("Not implemented");
  }

  /**
   * すべてのデバイスをリセット
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async reset() {
    throw new Error("Not implemented");
  }

  /**
   * デバイスの存在チェック
   * @param {string} id デバイスID
   * @returns {Promise<boolean>} 存在するかどうか
   */
  async exists(id) {
    throw new Error("Not implemented");
  }

  /**
   * 保存されているデバイスの総数を取得
   * @returns {Promise<number>} デバイスの総数
   */
  async count() {
    throw new Error("Not implemented");
  }

  /**
   * 変更を永続化
   * キャッシュを使用する実装の場合、このメソッドで確実に永続化する
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async persist() {
    throw new Error("Not implemented");
  }
}