/**
 * ILogSessionRepository.js
 * ログセッションのリポジトリインターフェース
 * 依存性逆転の原則に基づき、ドメインレイヤーでインターフェースを定義
 */

/**
 * ログセッションリポジトリのインターフェース
 * @interface
 */
export class ILogSessionRepository {
  /**
   * セッションを保存
   * @param {string} id セッションID
   * @param {Object} session セッションデータ
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async saveSession(id, session) {
    throw new Error('Method not implemented');
  }

  /**
   * セッションを取得
   * @param {string} id セッションID
   * @returns {Promise<Object|null>} セッションデータまたはnull
   */
  async getSession(id) {
    throw new Error('Method not implemented');
  }

  /**
   * セッション一覧を取得
   * @returns {Promise<Array>} セッションIDの配列
   */
  async listSessions() {
    throw new Error('Method not implemented');
  }

  /**
   * セッションを削除
   * @param {string} id セッションID
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async deleteSession(id) {
    throw new Error('Method not implemented');
  }
}