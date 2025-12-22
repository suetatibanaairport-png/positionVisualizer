/**
 * Icon.js
 * デバイスのアイコンを表すエンティティ
 * アイコンのメタデータと動作を管理
 */

export class Icon {
  /**
   * アイコンコンストラクタ
   * @param {string} id アイコンのID
   * @param {string} url アイコンのURL
   * @param {Object} options アイコンのオプション
   */
  constructor(id, url, options = {}) {
    this.id = id;
    this.url = url;
    this.name = options.name || `アイコン ${id}`;
    this.category = options.category || 'default';
    this.tags = options.tags || [];
    this.metadata = options.metadata || {};
    this.preloaded = false;
  }

  /**
   * アイコンを事前読み込み
   * @returns {Promise<boolean>} 読み込み成功したかどうか
   */
  async preload() {
    if (this.preloaded) return true;

    return new Promise((resolve) => {
      if (!this.url) {
        this.preloaded = false;
        resolve(false);
        return;
      }

      const img = new Image();

      img.onload = () => {
        this.preloaded = true;
        // 画像のサイズ情報をメタデータに追加
        this.metadata.width = img.naturalWidth;
        this.metadata.height = img.naturalHeight;
        this.metadata.aspectRatio = img.naturalWidth / img.naturalHeight;
        resolve(true);
      };

      img.onerror = () => {
        this.preloaded = false;
        resolve(false);
      };

      img.src = this.url;
    });
  }

  /**
   * アイコン名を設定
   * @param {string} name 設定する名前
   */
  setName(name) {
    if (name && typeof name === 'string') {
      this.name = name;
    }
  }

  /**
   * タグを追加
   * @param {string} tag 追加するタグ
   */
  addTag(tag) {
    if (tag && !this.tags.includes(tag)) {
      this.tags.push(tag);
    }
  }

  /**
   * タグを削除
   * @param {string} tag 削除するタグ
   */
  removeTag(tag) {
    const index = this.tags.indexOf(tag);
    if (index !== -1) {
      this.tags.splice(index, 1);
    }
  }

  /**
   * 指定したタグを持っているか確認
   * @param {string} tag 検索するタグ
   * @returns {boolean} タグを持っているかどうか
   */
  hasTag(tag) {
    return this.tags.includes(tag);
  }

  /**
   * カテゴリを設定
   * @param {string} category 設定するカテゴリ
   */
  setCategory(category) {
    if (category && typeof category === 'string') {
      this.category = category;
    }
  }

  /**
   * アイコンをシリアライズ可能な形式に変換
   * @returns {Object} シリアライズ用オブジェクト
   */
  toJSON() {
    return {
      id: this.id,
      url: this.url,
      name: this.name,
      category: this.category,
      tags: [...this.tags],
      metadata: {...this.metadata}
    };
  }

  /**
   * シリアライズされたオブジェクトからアイコンインスタンスを作成
   * @param {Object} data シリアライズされたアイコンデータ
   * @returns {Icon} 新しいIconインスタンス
   */
  static fromJSON(data) {
    return new Icon(data.id, data.url, {
      name: data.name,
      category: data.category,
      tags: data.tags || [],
      metadata: data.metadata || {}
    });
  }
}