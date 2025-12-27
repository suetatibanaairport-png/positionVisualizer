/**
 * LogSessionRepository.js
 * ログセッションリポジトリの実装
 * LocalStorageを使用してログセッションを保存・読み込み
 */

import { ILogSessionRepository } from '../../domain/repositories/ILogSessionRepository.js';
import { AppLogger } from '../services/Logger.js';

/**
 * ログセッションリポジトリ実装クラス
 * @implements {ILogSessionRepository}
 */
export class LogSessionRepository extends ILogSessionRepository {
  /**
   * LogSessionRepositoryコンストラクタ
   * @param {Object} storageAdapter ストレージアダプタ
   */
  constructor(storageAdapter) {
    super();
    this.storageAdapter = storageAdapter;
    this.sessionPrefix = 'log_session_';
    this.sessionListKey = 'log_sessions_list';
    this.logger = AppLogger.createLogger('LogSessionRepository');

    // 一時的なインメモリセッションストレージ
    this.temporarySessionStorage = {};
  }

  /**
   * セッションを保存
   * @param {string} id セッションID
   * @param {Object} session セッションデータ
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async saveSession(id, session) {
    try {
      const key = this._getSessionKey(id);
      const success = await this.storageAdapter.setItem(key, JSON.stringify(session));

      if (success) {
        // セッションリストにIDを追加
        await this._addToSessionList(id);
      }

      return success;
    } catch (error) {
      this.logger.error(`Error saving session ${id}:`, error);
      return false;
    }
  }

  /**
   * セッションを取得
   * @param {string} id セッションID
   * @returns {Promise<Object|null>} セッションデータまたはnull
   */
  async getSession(id) {
    try {
      // 一時的なセッションストレージをまず確認
      if (this.temporarySessionStorage[id]) {
        this.logger.debug(`Retrieved session ${id} from temporary storage`);
        return this.temporarySessionStorage[id];
      }

      // ストレージからセッションを取得
      const key = this._getSessionKey(id);
      const data = await this.storageAdapter.getItem(key);

      if (!data) {
        return null;
      }

      return JSON.parse(data);
    } catch (error) {
      this.logger.error(`Error getting session ${id}:`, error);
      return null;
    }
  }

  /**
   * 一時的なセッションを保存
   * @param {string} id セッションID
   * @param {Object} session セッションデータ
   */
  saveTemporarySession(id, session) {
    this.temporarySessionStorage[id] = session;
    this.logger.debug(`Saved temporary session ${id}`);
  }

  /**
   * 一時的なセッションを削除
   * @param {string} id セッションID
   */
  removeTemporarySession(id) {
    if (this.temporarySessionStorage[id]) {
      delete this.temporarySessionStorage[id];
      this.logger.debug(`Removed temporary session ${id}`);
    }
  }

  /**
   * 一時的なセッションをクリア
   */
  clearTemporaryStorage() {
    this.temporarySessionStorage = {};
    this.logger.debug('Cleared temporary session storage');
  }

  /**
   * セッション一覧を取得
   * @returns {Promise<Array>} セッションIDの配列
   */
  async listSessions() {
    try {
      const list = await this.storageAdapter.getItem(this.sessionListKey);

      // listが文字列でない場合や空の場合は空配列を返す
      if (!list || typeof list !== 'string' || list.trim() === '') {
        return [];
      }

      try {
        // JSONパースを試みる
        return JSON.parse(list);
      } catch (parseError) {
        // パースエラーの詳細をログ出力
        this.logger.error(`JSON parsing error in listSessions: ${parseError.message}`);
        this.logger.debug(`Invalid JSON content: ${list.substring(0, 100)}...`);

        // JSONとして無効だが、セッションIDの文字列のようなら、そのままIDとして扱う
        if (list.startsWith('session_') || list.includes('session_')) {
          // セッションIDのパターンに一致する文字列を抽出
          const sessionIds = list.match(/session_\d+/g);
          if (sessionIds && sessionIds.length > 0) {
            this.logger.info(`Recovered ${sessionIds.length} session IDs from invalid JSON`);

            // 復旧したセッションIDリストを保存し直す
            this.storageAdapter.setItem(this.sessionListKey, JSON.stringify(sessionIds));

            return sessionIds;
          }
        }

        return [];
      }
    } catch (error) {
      this.logger.error('Error listing sessions:', error);
      return [];
    }
  }

  /**
   * セッションを削除
   * @param {string} id セッションID
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async deleteSession(id) {
    try {
      const key = this._getSessionKey(id);
      const success = await this.storageAdapter.removeItem(key);

      if (success) {
        // セッションリストからIDを削除
        await this._removeFromSessionList(id);
      }

      return success;
    } catch (error) {
      this.logger.error(`Error deleting session ${id}:`, error);
      return false;
    }
  }

  /**
   * セッションキーを取得
   * @private
   * @param {string} id セッションID
   * @returns {string} セッションキー
   */
  _getSessionKey(id) {
    return `${this.sessionPrefix}${id}`;
  }

  /**
   * セッションリストにIDを追加
   * @private
   * @param {string} id セッションID
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async _addToSessionList(id) {
    try {
      let list = await this.listSessions();
      if (!list.includes(id)) {
        list.push(id);
        await this.storageAdapter.setItem(this.sessionListKey, JSON.stringify(list));
      }
      return true;
    } catch (error) {
      this.logger.error(`Error adding session ${id} to list:`, error);
      return false;
    }
  }

  /**
   * セッションリストからIDを削除
   * @private
   * @param {string} id セッションID
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async _removeFromSessionList(id) {
    try {
      let list = await this.listSessions();
      const index = list.indexOf(id);
      if (index !== -1) {
        list.splice(index, 1);
        await this.storageAdapter.setItem(this.sessionListKey, JSON.stringify(list));
      }
      return true;
    } catch (error) {
      this.logger.error(`Error removing session ${id} from list:`, error);
      return false;
    }
  }
}