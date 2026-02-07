/**
 * VirtualLeverManagerComponent.js
 * 仮想レバー管理UIコンポーネント
 * 仮想レバーの追加・削除・設定、アニメーション制御を担当
 */

import { EventTypes } from '../../../domain/events/EventTypes.js';

/**
 * 仮想レバーマネージャーコンポーネントクラス
 */
export class VirtualLeverManagerComponent {
  /**
   * コンストラクタ
   * @param {string} containerId - コンテナ要素のID
   * @param {Object} virtualLeverManager - 仮想レバーマネージャー
   * @param {Object} eventBus - イベントバス
   */
  constructor(containerId, virtualLeverManager, eventBus) {
    this.containerId = containerId;
    this.virtualLeverManager = virtualLeverManager;
    this.eventBus = eventBus;

    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error(`Container element not found: ${containerId}`);
      return;
    }

    this.elements = {
      modeToggle: null,
      leverList: null,
      addButton: null,
      startAnimationButton: null,
      stopAnimationButton: null,
      resetAnimationButton: null,
      animationStatus: null,
      expandAllButton: null,
      collapseAllButton: null
    };

    this._initialize();
  }

  /**
   * 初期化
   * @private
   */
  _initialize() {
    this._createUI();
    this._setupEventListeners();
    this._subscribeToEvents();
    this._render();
  }

  /**
   * 文字列をHTMLエスケープ
   * @private
   * @param {string} text - エスケープする文字列
   * @returns {string} エスケープされた文字列
   */
  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * UIを作成
   * @private
   */
  _createUI() {
    // 安全な静的HTMLテンプレート（ヘッダーとトグル削除）
    const template = `
      <div class="virtual-lever-manager">
        <p class="virtual-lever-description">
          動画編集用にレバーの動きを再現します。実デバイスの値は無視され、設定に従ってアニメーションが実行されます。
        </p>

        <div class="segment-bulk-controls">
          <button class="expand-all-btn" id="expand-all-segments">▼ すべて開く</button>
          <button class="collapse-all-btn" id="collapse-all-segments">▲ すべて閉じる</button>
        </div>

        <div class="virtual-lever-list" id="virtual-lever-list">
          <!-- 仮想レバーアイテムが動的に生成されます -->
        </div>

        <button class="add-lever-button" id="add-virtual-lever">
          ➕ 仮想レバーを追加
        </button>

        <div class="animation-controls">
          <button class="start-animation-button" id="start-animation">
            ▶ アニメーション開始
          </button>
          <button class="stop-animation-button" id="stop-animation" style="display: none;">
            ⏹ アニメーション停止
          </button>
          <button class="reset-animation-button" id="reset-animation">
            ↺ 初期値にリセット
          </button>
          <div class="animation-status" id="animation-status"></div>
        </div>
      </div>
    `;

    // 静的テンプレートのみinnerHTMLで設定
    this.container.innerHTML = template;

    // 要素への参照を保存
    this.elements.leverList = document.getElementById('virtual-lever-list');
    this.elements.addButton = document.getElementById('add-virtual-lever');
    this.elements.startAnimationButton = document.getElementById('start-animation');
    this.elements.stopAnimationButton = document.getElementById('stop-animation');
    this.elements.resetAnimationButton = document.getElementById('reset-animation');
    this.elements.animationStatus = document.getElementById('animation-status');
    this.elements.expandAllButton = document.getElementById('expand-all-segments');
    this.elements.collapseAllButton = document.getElementById('collapse-all-segments');
  }

  /**
   * イベントリスナーをセットアップ
   * @private
   */
  _setupEventListeners() {
    // レバー追加
    this.elements.addButton.addEventListener('click', () => {
      this._onAddLever();
    });

    // アニメーション開始
    this.elements.startAnimationButton.addEventListener('click', () => {
      this._onStartAnimation();
    });

    // アニメーション停止
    this.elements.stopAnimationButton.addEventListener('click', () => {
      this._onStopAnimation();
    });

    // アニメーションリセット
    this.elements.resetAnimationButton.addEventListener('click', () => {
      this._onResetAnimation();
    });

    // セグメント一括展開
    this.elements.expandAllButton.addEventListener('click', () => {
      this._expandAllSegments();
    });

    // セグメント一括折り畳み
    this.elements.collapseAllButton.addEventListener('click', () => {
      this._collapseAllSegments();
    });
  }

  /**
   * イベントバスのイベントを購読
   * @private
   */
  _subscribeToEvents() {
    this.eventBus.on(EventTypes.VIRTUAL_LEVER_MODE_ENABLED, () => {
      this._render();
    });

    this.eventBus.on(EventTypes.VIRTUAL_LEVER_MODE_DISABLED, () => {
      this._render();
    });

    this.eventBus.on(EventTypes.VIRTUAL_LEVER_ADDED, () => {
      this._render();
    });

    this.eventBus.on(EventTypes.VIRTUAL_LEVER_REMOVED, () => {
      this._render();
    });

    this.eventBus.on(EventTypes.VIRTUAL_LEVER_UPDATED, () => {
      this._render();
    });

    this.eventBus.on(EventTypes.VIRTUAL_LEVER_ANIMATION_STARTED, () => {
      this._updateAnimationControls(true);
    });

    this.eventBus.on(EventTypes.VIRTUAL_LEVER_ANIMATION_STOPPED, () => {
      this._updateAnimationControls(false);
    });

    this.eventBus.on(EventTypes.VIRTUAL_LEVER_ANIMATION_COMPLETED, () => {
      this._updateAnimationControls(false);
      this.elements.animationStatus.textContent = '✅ アニメーション完了';
    });
  }

  /**
   * レンダリング
   * @private
   */
  _render() {
    // レバーリストをレンダリング
    this._renderLeverList();
  }

  /**
   * レバーリストをレンダリング（安全なDOM操作）
   * @private
   */
  _renderLeverList() {
    const levers = this.virtualLeverManager.getAllLevers();

    // リストをクリア
    this.elements.leverList.innerHTML = '';

    if (levers.length === 0) {
      const message = document.createElement('p');
      message.className = 'no-levers-message';
      message.textContent = '仮想レバーがありません';
      this.elements.leverList.appendChild(message);
      return;
    }

    // 各レバーアイテムをDOM操作で生成
    levers.forEach(lever => {
      const leverItem = this._createLeverItemElement(lever);
      this.elements.leverList.appendChild(leverItem);
    });
  }

  /**
   * レバーアイテム要素を生成（リアルデバイスと同じ構造）
   * @private
   * @param {Object} lever - 仮想レバー
   * @returns {HTMLElement} レバーアイテム要素
   */
  _createLeverItemElement(lever) {
    const item = document.createElement('div');
    item.className = 'device-group virtual-lever-item';
    item.dataset.leverId = lever.id;

    // === アイコンセクション ===
    const iconContainer = document.createElement('div');
    iconContainer.className = 'device-icon-container';

    const iconDisplay = document.createElement('img');
    iconDisplay.className = 'device-icon-display';
    iconDisplay.src = lever.iconUrl || './assets/icon.svg';
    iconDisplay.alt = lever.name || '仮想レバー';

    const iconOverlay = document.createElement('img');
    iconOverlay.className = 'device-icon-overlay';
    iconOverlay.src = './assets/icon.svg';
    iconOverlay.alt = 'アイコンオーバーレイ';

    iconContainer.appendChild(iconDisplay);
    iconContainer.appendChild(iconOverlay);

    // === コンテンツセクション ===
    const contentColumn = document.createElement('div');
    contentColumn.className = 'device-content-column';

    // --- トップ行 (ID + ボタン群) ---
    const topRow = document.createElement('div');
    topRow.className = 'device-top-row';

    const idContainer = document.createElement('div');
    idContainer.className = 'device-id-container';
    idContainer.textContent = `ID: ${lever.id.replace('virtual_', '')}`;

    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'device-button-group';

    // アイコン設定ボタン
    const iconButton = document.createElement('button');
    iconButton.className = 'icon-button';
    iconButton.textContent = 'アイコン設定';
    iconButton.title = 'アイコンを設定';
    buttonGroup.appendChild(iconButton);

    // ファイル入力（隠す）
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.className = 'icon-file-input';
    fileInput.style.display = 'none';
    fileInput.setAttribute('data-lever-id', lever.id);

    // アイコンボタンクリックでファイル選択ダイアログ
    iconButton.addEventListener('click', () => {
      fileInput.click();
    });

    // ファイル選択時の処理
    fileInput.addEventListener('change', (event) => {
      if (!event.target.files || !event.target.files[0]) return;

      const file = event.target.files[0];
      const leverId = fileInput.getAttribute('data-lever-id');

      if (!leverId) return;

      // FileReader APIを使用してファイルを読み込み
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const dataUrl = e.target.result;

          // 画像のサイズを確認（大きすぎる場合は警告）
          const size = dataUrl.length;

          if (size > 1024 * 1024) { // 1MB以上
            alert('ファイルサイズが大きすぎます（1MB以下にしてください）');
            return;
          }

          // レバーのiconUrlを更新
          this._onLeverUpdate(leverId, { iconUrl: dataUrl });

          // パネル内のアイコン表示を即座に更新
          const iconDisplay = item.querySelector('.device-icon-display');
          if (iconDisplay) {
            iconDisplay.src = dataUrl;
          }

          // メーター表示にも反映（DEVICE_ICON_CHANGEDイベント発行）
          this.eventBus.emit(EventTypes.DEVICE_ICON_CHANGED, {
            deviceId: leverId,
            iconUrl: dataUrl
          });

        } catch (error) {
          console.error(`Error processing icon file for lever ${leverId}:`, error);
          alert('アイコンファイルの処理中にエラーが発生しました');
        }
      };

      reader.onerror = () => {
        console.error(`Error reading icon file for lever ${leverId}`);
        alert('アイコンファイルの読み込み中にエラーが発生しました');
      };

      // ファイルをデータURLとして読み込み
      reader.readAsDataURL(file);
    });

    // 削除ボタン
    const deleteButton = document.createElement('button');
    deleteButton.className = 'device-delete-button';
    deleteButton.textContent = '🗑️';
    deleteButton.title = '削除';
    deleteButton.addEventListener('click', () => this._onRemoveLever(lever.id));

    buttonGroup.appendChild(deleteButton);
    buttonGroup.appendChild(fileInput);
    topRow.appendChild(idContainer);
    topRow.appendChild(buttonGroup);

    // --- ボトム行 (トグル + 名前 + 編集) ---
    const bottomRow = document.createElement('div');
    bottomRow.className = 'device-bottom-row';

    // 表示トグル
    const toggleLabel = document.createElement('label');
    toggleLabel.className = 'toggle-switch';
    toggleLabel.title = '表示/非表示';

    const toggleInput = document.createElement('input');
    toggleInput.type = 'checkbox';
    toggleInput.checked = lever.visible !== false;
    toggleInput.addEventListener('change', (e) => {
      this._onLeverUpdate(lever.id, { visible: e.target.checked });
    });

    const toggleSlider = document.createElement('span');
    toggleSlider.className = 'toggle-slider';

    toggleLabel.appendChild(toggleInput);
    toggleLabel.appendChild(toggleSlider);

    // 名前表示/編集
    const nameContainer = document.createElement('div');
    nameContainer.className = 'device-name-edit-container';

    const nameText = document.createElement('span');
    nameText.className = 'device-name-text';
    nameText.textContent = lever.name;

    const nameInput = document.createElement('input');
    nameInput.className = 'device-name-input';
    nameInput.type = 'text';
    nameInput.value = lever.name;
    nameInput.placeholder = 'レバー名';
    nameInput.style.display = 'none';
    nameInput.addEventListener('change', (e) => {
      this._onLeverUpdate(lever.id, { name: e.target.value });
      nameText.textContent = e.target.value;
      nameText.style.display = 'inline';
      nameInput.style.display = 'none';
    });

    nameContainer.appendChild(nameText);
    nameContainer.appendChild(nameInput);

    // 編集ボタン
    const editButton = document.createElement('button');
    editButton.className = 'device-name-edit-btn';
    editButton.textContent = '✏️';
    editButton.title = '名前を編集';
    editButton.addEventListener('click', () => {
      const isEditing = nameInput.style.display !== 'none';
      nameText.style.display = isEditing ? 'inline' : 'none';
      nameInput.style.display = isEditing ? 'none' : 'inline-block';
      if (!isEditing) nameInput.focus();
    });

    bottomRow.appendChild(toggleLabel);
    bottomRow.appendChild(nameContainer);
    bottomRow.appendChild(editButton);

    contentColumn.appendChild(topRow);
    contentColumn.appendChild(bottomRow);

    // === セグメント設定エリア（仮想レバー専用） ===
    const segmentsContainer = this._createSegmentsSection(lever);
    contentColumn.appendChild(segmentsContainer);

    // 実デバイス由来バッジ
    if (lever.sourceDeviceId) {
      const badge = document.createElement('span');
      badge.className = 'device-badge';
      badge.textContent = '実デバイス由来';
      contentColumn.appendChild(badge);
    }

    // 組み立て
    item.appendChild(iconContainer);
    item.appendChild(contentColumn);

    return item;
  }

  /**
   * セグメント設定セクションを作成（アコーディオン形式）
   * @private
   * @param {Object} lever - 仮想レバー
   * @returns {HTMLElement} セグメント設定コンテナ
   */
  _createSegmentsSection(lever) {
    const container = document.createElement('div');
    container.className = 'segments-container collapsed'; // 初期状態は折り畳み
    container.dataset.leverId = lever.id;

    // ヘッダー部分（クリックで開閉）
    const header = document.createElement('div');
    header.className = 'segments-section-header';

    const toggleIcon = document.createElement('span');
    toggleIcon.className = 'segment-toggle-icon';
    toggleIcon.textContent = '▶';

    const headerLabel = document.createElement('span');
    headerLabel.className = 'segments-section-label';
    headerLabel.textContent = 'セグメント設定';

    header.appendChild(toggleIcon);
    header.appendChild(headerLabel);

    // ヘッダークリックでトグル
    header.addEventListener('click', () => {
      this._toggleSegmentSection(container);
    });

    container.appendChild(header);

    // コンテンツ部分（セグメントと追加ボタン）
    const content = document.createElement('div');
    content.className = 'segments-section-content';

    const segments = lever.segments || [{
      initialValue: lever.initialValue,
      endValue: lever.endValue,
      speedPerSecond: lever.speedPerSecond,
      startDelay: lever.startDelay
    }];

    segments.forEach((segment, index) => {
      const segmentEl = this._createSegmentElement(lever.id, segment, index, segments.length);
      content.appendChild(segmentEl);
    });

    // セグメント追加ボタン
    const addBtn = document.createElement('button');
    addBtn.className = 'add-segment-button';
    addBtn.textContent = '+ セグメント追加';
    addBtn.addEventListener('click', () => this._onAddSegment(lever.id));
    content.appendChild(addBtn);

    container.appendChild(content);

    return container;
  }

  /**
   * セグメント要素を作成
   * @private
   * @param {string} leverId - レバーID
   * @param {Object} segment - セグメント設定
   * @param {number} index - セグメントインデックス
   * @param {number} totalCount - 総セグメント数
   * @returns {HTMLElement} セグメント要素
   */
  _createSegmentElement(leverId, segment, index, totalCount) {
    const segmentEl = document.createElement('div');
    segmentEl.className = 'segment-item';

    // セグメントヘッダー（番号と削除ボタン）
    const header = document.createElement('div');
    header.className = 'segment-header';

    const label = document.createElement('span');
    label.textContent = `セグメント ${index + 1}`;
    header.appendChild(label);

    // 2つ以上のセグメントがある場合のみ削除ボタンを表示
    if (totalCount > 1) {
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-segment-button';
      deleteBtn.textContent = '×';
      deleteBtn.addEventListener('click', () => {
        this._onRemoveSegment(leverId, index);
      });
      header.appendChild(deleteBtn);
    }

    segmentEl.appendChild(header);

    // 設定フィールド（初期値、終了値、速度、ディレイ）
    const config = document.createElement('div');
    config.className = 'segment-config';

    config.appendChild(this._createConfigRow('初期値 (%)', 'number', segment.initialValue, 0, 100, 0.1, (value) => {
      this._onSegmentUpdate(leverId, index, { initialValue: parseFloat(value) });
    }));

    config.appendChild(this._createConfigRow('終了値 (%)', 'number', segment.endValue, 0, 100, 0.1, (value) => {
      this._onSegmentUpdate(leverId, index, { endValue: parseFloat(value) });
    }));

    config.appendChild(this._createConfigRow('速度 (%/秒)', 'number', segment.speedPerSecond, 0.1, 1000, 0.1, (value) => {
      this._onSegmentUpdate(leverId, index, { speedPerSecond: parseFloat(value) });
    }));

    config.appendChild(this._createConfigRow('開始ディレイ (秒)', 'number', segment.startDelay, 0, 3600, 0.1, (value) => {
      this._onSegmentUpdate(leverId, index, { startDelay: parseFloat(value) });
    }));

    segmentEl.appendChild(config);

    return segmentEl;
  }

  /**
   * 設定行を作成
   * @private
   */
  _createConfigRow(labelText, inputType, value, min, max, step, onChange) {
    const row = document.createElement('div');
    row.className = 'config-row';

    const label = document.createElement('label');
    label.textContent = labelText;

    const input = document.createElement('input');
    input.type = inputType;
    input.value = value;
    input.min = min;
    input.max = max;
    input.step = step;
    input.addEventListener('change', (e) => onChange(e.target.value));

    row.appendChild(label);
    row.appendChild(input);

    return row;
  }

  /**
   * レバー追加ハンドラー
   * @private
   */
  async _onAddLever() {
    const config = {
      name: `仮想レバー ${this.virtualLeverManager.getAllLevers().length + 1}`,
      initialValue: 0,
      endValue: 100,
      speedPerSecond: 10,
      startDelay: 0
    };

    await this.virtualLeverManager.addLever(config);
  }

  /**
   * レバー削除ハンドラー
   * @private
   */
  async _onRemoveLever(leverId) {
    if (confirm('この仮想レバーを削除しますか?')) {
      await this.virtualLeverManager.removeLever(leverId);
    }
  }

  /**
   * レバー更新ハンドラー
   * @private
   */
  async _onLeverUpdate(leverId, updates) {
    await this.virtualLeverManager.updateLever(leverId, updates);
  }

  /**
   * セグメント追加ハンドラー
   * @private
   * @param {string} leverId - レバーID
   */
  async _onAddSegment(leverId) {
    const lever = this.virtualLeverManager.getAllLevers().find(l => l.id === leverId);
    if (!lever) return;

    const segments = lever.segments || [{
      initialValue: lever.initialValue,
      endValue: lever.endValue,
      speedPerSecond: lever.speedPerSecond,
      startDelay: lever.startDelay
    }];

    // 前のセグメントの終了値を新しいセグメントの初期値にする
    const lastSegment = segments[segments.length - 1];
    const newSegment = {
      initialValue: lastSegment.endValue,
      endValue: lastSegment.endValue + 50 > 100 ? 100 : lastSegment.endValue + 50,
      speedPerSecond: 10,
      startDelay: 0
    };

    const newSegments = [...segments, newSegment];
    await this.virtualLeverManager.updateLever(leverId, { segments: newSegments });
  }

  /**
   * セグメント削除ハンドラー
   * @private
   * @param {string} leverId - レバーID
   * @param {number} index - セグメントインデックス
   */
  async _onRemoveSegment(leverId, index) {
    if (!confirm(`セグメント${index + 1}を削除しますか?`)) return;

    const lever = this.virtualLeverManager.getAllLevers().find(l => l.id === leverId);
    if (!lever) return;

    const segments = lever.segments || [];
    if (segments.length <= 1) return; // 最低1つは残す

    const newSegments = segments.filter((_, i) => i !== index);
    await this.virtualLeverManager.updateLever(leverId, { segments: newSegments });
  }

  /**
   * セグメント更新ハンドラー
   * @private
   * @param {string} leverId - レバーID
   * @param {number} index - セグメントインデックス
   * @param {Object} updates - 更新内容
   */
  async _onSegmentUpdate(leverId, index, updates) {
    const lever = this.virtualLeverManager.getAllLevers().find(l => l.id === leverId);
    if (!lever) return;

    const segments = lever.segments || [];
    const newSegments = [...segments];
    newSegments[index] = { ...newSegments[index], ...updates };

    await this.virtualLeverManager.updateLever(leverId, { segments: newSegments });
  }

  /**
   * アニメーション開始ハンドラー
   * @private
   */
  _onStartAnimation() {
    const success = this.virtualLeverManager.startAnimation();
    if (!success) {
      alert('アニメーションを開始できませんでした。仮想レバーが設定されているか確認してください。');
    }
  }

  /**
   * アニメーション停止ハンドラー
   * @private
   */
  _onStopAnimation() {
    this.virtualLeverManager.stopAnimation();
  }

  /**
   * アニメーションリセットハンドラー
   * @private
   */
  _onResetAnimation() {
    const success = this.virtualLeverManager.resetAnimation();
    if (success) {
      this.elements.animationStatus.textContent = '↺ 初期値にリセットしました';
      setTimeout(() => {
        if (!this.virtualLeverManager.isAnimating()) {
          this.elements.animationStatus.textContent = '';
        }
      }, 2000);
    }
  }

  /**
   * アニメーションコントロールを更新
   * @private
   */
  _updateAnimationControls(isAnimating) {
    this.elements.startAnimationButton.style.display = isAnimating ? 'none' : 'inline-block';
    this.elements.stopAnimationButton.style.display = isAnimating ? 'inline-block' : 'none';

    if (isAnimating) {
      this.elements.animationStatus.textContent = '⏯️ アニメーション実行中...';
      this.elements.animationStatus.className = 'animation-status active';
    } else {
      this.elements.animationStatus.textContent = '';
      this.elements.animationStatus.className = 'animation-status';
    }
  }

  /**
   * セグメントセクションをトグル
   * @private
   * @param {HTMLElement} container - セグメントコンテナ要素
   */
  _toggleSegmentSection(container) {
    const isExpanded = container.classList.contains('expanded');
    const toggleIcon = container.querySelector('.segment-toggle-icon');

    if (isExpanded) {
      container.classList.remove('expanded');
      container.classList.add('collapsed');
      if (toggleIcon) toggleIcon.textContent = '▶';
    } else {
      container.classList.remove('collapsed');
      container.classList.add('expanded');
      if (toggleIcon) toggleIcon.textContent = '▼';
    }
  }

  /**
   * すべてのセグメントセクションを展開
   * @private
   */
  _expandAllSegments() {
    const containers = this.container.querySelectorAll('.segments-container');
    containers.forEach(container => {
      const toggleIcon = container.querySelector('.segment-toggle-icon');
      container.classList.remove('collapsed');
      container.classList.add('expanded');
      if (toggleIcon) toggleIcon.textContent = '▼';
    });
  }

  /**
   * すべてのセグメントセクションを折り畳み
   * @private
   */
  _collapseAllSegments() {
    const containers = this.container.querySelectorAll('.segments-container');
    containers.forEach(container => {
      const toggleIcon = container.querySelector('.segment-toggle-icon');
      container.classList.remove('expanded');
      container.classList.add('collapsed');
      if (toggleIcon) toggleIcon.textContent = '▶';
    });
  }

  /**
   * コンポーネントを破棄
   */
  dispose() {
    if (this.container) {
      this.container.textContent = '';
    }
  }
}
