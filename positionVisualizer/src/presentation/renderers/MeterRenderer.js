/**
 * MeterRenderer.js
 * SVGを使用したメーター表示のレンダラークラス
 * MeterViewModelの状態に基づいてメーター表示を描画する
 * 元の実装（meterRenderer.js）と同様の扇状メーター表示を行う
 */

/**
 * メーターレンダラークラス
 */
export class MeterRenderer {
  /**
   * レンダラーのコンストラクタ
   * @param {HTMLElement} container コンテナ要素
   * @param {Object} options オプション設定
   * @param {Object} logger ロガー
   */
  constructor(container, options = {}, logger = null) {
    this.container = container;
    this.svgNamespace = 'http://www.w3.org/2000/svg';
    this.svg = null;

    // 元の実装と一致させるための基本設定
    this.baseCx = 251.74;
    this.baseCy = 168.17;
    this.baseRadius = Math.sqrt((503.48 / 2) ** 2 + (168.17 * 0.52) ** 2);
    this.strokeWidth = 100;
    this.startAngle = -140; // 度数法
    this.endAngle = -40;    // 度数法
    this.LANE_OFFSETS = [-40, -20, 0, 20, 40, 60]; // 最大6台のデバイス用のオフセット
    this.MAX_LANE_OFFSET = 30;
    this.MIN_LANE_OFFSET = -30;

    // SVGのビューボックスを計算
    this.viewBox = this._calculateViewBox();

    // SVGの設定
    this.config = {
      iconSize: options.iconSize || 50,  // アイコンサイズ
      defaultIcon: options.defaultIcon || '/assets/icon.svg',  // デフォルトアイコン（ルートパスを使用）
      ...options
    };

    // MutationObserver用の追跡データ
    this.lastValues = new Map();
    this.mutationObserver = null;

    // ロガー
    this.logger = logger || { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

    // 初期化
    this._initialize();
  }

  /**
   * 度をラジアンに変換
   * @param {number} angle 角度（度）
   * @returns {number} ラジアン
   * @private
   */
  _toRadians(angle) {
    return (angle * Math.PI) / 180;
  }

  /**
   * SVGのビューボックスを計算
   * @private
   * @returns {Object} ビューボックス情報
   */
  _calculateViewBox() {
    const outerRadius = this.baseRadius + this.strokeWidth / 2;
    const innerRadius = this.baseRadius - this.strokeWidth / 2;
    const angles = [this.startAngle, this.endAngle];
    for (let angle = Math.ceil(this.startAngle); angle <= Math.floor(this.endAngle); angle++) {
      if (angle % 90 === 0) angles.push(angle);
    }

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    angles.forEach(angle => {
      const rad = this._toRadians(angle);
      const x_outer = this.baseCx + outerRadius * Math.cos(rad);
      const y_outer = this.baseCy + outerRadius * Math.sin(rad);
      const x_inner = this.baseCx + innerRadius * Math.cos(rad);
      const y_inner = this.baseCy + innerRadius * Math.sin(rad);
      minX = Math.min(minX, x_outer, x_inner);
      maxX = Math.max(maxX, x_outer, x_inner);
      minY = Math.min(minY, y_outer, y_inner);
      maxY = Math.max(maxY, y_outer, y_inner);
    });

    // アイコンの位置も考慮
    const maxIconOffset = Math.max(...this.LANE_OFFSETS.map(Math.abs));
    const iconRadius = 25; // アイコンサイズの半分
    const maxRadius = this.baseRadius + maxIconOffset + iconRadius;

    // 開始と終了角度でのアイコン位置を確認
    const startRad = this._toRadians(this.startAngle);
    const endRad = this._toRadians(this.endAngle);

    // 中間位置のアイコンも確認
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const angle = this.startAngle + (this.endAngle - this.startAngle) * t;
      const angleRad = this._toRadians(angle);
      const radius = this.baseRadius + maxIconOffset;
      const x = this.baseCx + radius * Math.cos(angleRad);
      const y = this.baseCy + radius * Math.sin(angleRad);
      minX = Math.min(minX, x - iconRadius);
      maxX = Math.max(maxX, x + iconRadius);
      minY = Math.min(minY, y - iconRadius);
      maxY = Math.max(maxY, y + iconRadius);
    }

    // 余白を追加
    const padding = 30;
    return {
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
      offsetX: -minX + padding,
      offsetY: -minY + padding
    };
  }

  /**
   * レーンオフセットの動的計算
   * @param {number} deviceCount デバイス数
   * @returns {Array} オフセット配列
   * @private
   */
  _calculateLaneOffsets(deviceCount) {
    if (deviceCount <= 0) return [];
    if (deviceCount === 1) return [0]; // 単一デバイスは中央

    // MIN_LANE_OFFSETとMAX_LANE_OFFSETの間で均等に分布
    const offsets = [];
    for (let i = 0; i < deviceCount; i++) {
      const t = deviceCount === 1 ? 0.5 : i / (deviceCount - 1); // 0から1
      const offset = this.MIN_LANE_OFFSET + (this.MAX_LANE_OFFSET - this.MIN_LANE_OFFSET) * t;
      offsets.push(offset);
    }
    return offsets;
  }

  /**
   * 円弧パスの説明を生成
   * @returns {string} SVGパス
   * @private
   */
  _describeArc() {
    const cx = this.baseCx + this.viewBox.offsetX;
    const cy = this.baseCy + this.viewBox.offsetY;
    const startRad = this._toRadians(this.startAngle);
    const endRad = this._toRadians(this.endAngle);
    const innerRadius = this.baseRadius - this.strokeWidth / 2;
    const outerRadius = this.baseRadius + this.strokeWidth / 2;
    const x1 = cx + innerRadius * Math.cos(startRad);
    const y1 = cy + innerRadius * Math.sin(startRad);
    const x2 = cx + outerRadius * Math.cos(startRad);
    const y2 = cy + outerRadius * Math.sin(startRad);
    const x3 = cx + outerRadius * Math.cos(endRad);
    const y3 = cy + outerRadius * Math.sin(endRad);
    const x4 = cx + innerRadius * Math.cos(endRad);
    const y4 = cy + innerRadius * Math.sin(endRad);
    const largeArc = this.endAngle - this.startAngle > 180 ? 1 : 0;

    return `M ${x1} ${y1} L ${x2} ${y2} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x3} ${y3} L ${x4} ${y4} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x1} ${y1}`;
  }

  /**
   * アイコン位置の計算
   * @param {number} percentage パーセント値
   * @param {number} laneIndex レーンインデックス
   * @param {number} deviceCount デバイス数
   * @returns {Object} {x, y} 座標
   * @private
   */
  _calculateIconPosition(percentage, laneIndex, deviceCount) {
    const cx = this.baseCx + this.viewBox.offsetX;
    const cy = this.baseCy + this.viewBox.offsetY;
    const clamped = Math.max(0, Math.min(100, percentage));
    const t = clamped / 100;
    const angle = this.startAngle + (this.endAngle - this.startAngle) * t;
    const angleRad = this._toRadians(angle);

    // デバイス数に基づいて動的にレーンオフセットを計算
    let laneOffsets;
    if (deviceCount && deviceCount > 0) {
      laneOffsets = this._calculateLaneOffsets(deviceCount);
    } else {
      laneOffsets = this.LANE_OFFSETS;
    }

    // laneIndexを有効な範囲に制限
    const safeLaneIndex = Math.max(0, Math.min(laneOffsets.length - 1, laneIndex));
    const offset = laneOffsets[safeLaneIndex] || 0;
    const radius = this.baseRadius + offset;
    const x = cx + radius * Math.cos(angleRad);
    const y = cy + radius * Math.sin(angleRad);

    return { x, y };
  }

  /**
   * SVGの初期化
   * @private
   */
  _initialize() {
    // コンテナの内容をクリア
    if (this.container) {
      this.container.innerHTML = '';
    }

    // SVG要素を作成
    this.svg = document.createElementNS(this.svgNamespace, 'svg');
    this.svg.setAttribute('data-meter', '');
    this.svg.setAttribute('width', '100%');
    this.svg.setAttribute('height', '100%');
    this.svg.setAttribute('viewBox', `0 0 ${this.viewBox.width} ${this.viewBox.height}`);
    this.svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    this.svg.style.display = 'block';
    this.svg.style.verticalAlign = 'middle';

    // defs要素（グラデーションやフィルター）
    const defs = document.createElementNS(this.svgNamespace, 'defs');

    // グラデーション定義
    const gradient = document.createElementNS(this.svgNamespace, 'linearGradient');
    gradient.setAttribute('id', 'meterGradient');
    gradient.setAttribute('x1', '0');
    gradient.setAttribute('y1', String(this.viewBox.height / 2));
    gradient.setAttribute('x2', String(this.viewBox.width));
    gradient.setAttribute('y2', String(this.viewBox.height / 2));
    gradient.setAttribute('gradientUnits', 'userSpaceOnUse');

    const s1 = document.createElementNS(this.svgNamespace, 'stop');
    s1.setAttribute('offset', '0');
    s1.setAttribute('stop-color', '#71cce2');

    const s2 = document.createElementNS(this.svgNamespace, 'stop');
    s2.setAttribute('offset', '1');
    s2.setAttribute('stop-color', '#6e40a9');

    gradient.append(s1, s2);

    // アイコン用シャドウフィルター
    const filter = document.createElementNS(this.svgNamespace, 'filter');
    filter.setAttribute('id', 'iconShadow');
    const fe = document.createElementNS(this.svgNamespace, 'feDropShadow');
    fe.setAttribute('dx', '0');
    fe.setAttribute('dy', '2');
    fe.setAttribute('stdDeviation', '3');
    fe.setAttribute('flood-opacity', '0.3');
    filter.appendChild(fe);

    // アイコン用円形マスク
    const mask = document.createElementNS(this.svgNamespace, 'mask');
    mask.setAttribute('id', 'maskIconCircle');
    mask.setAttribute('maskContentUnits', 'objectBoundingBox');
    mask.setAttribute('maskUnits', 'objectBoundingBox');
    const maskCircle = document.createElementNS(this.svgNamespace, 'circle');
    maskCircle.setAttribute('cx', '0.5');
    maskCircle.setAttribute('cy', '0.5');
    maskCircle.setAttribute('r', '0.5');
    maskCircle.setAttribute('fill', '#fff');
    mask.appendChild(maskCircle);

    defs.append(gradient, filter, mask);

    // 扇状の背景パス
    const path = document.createElementNS(this.svgNamespace, 'path');
    path.setAttribute('data-arc', '');
    path.setAttribute('d', this._describeArc());
    path.setAttribute('fill', 'url(#meterGradient)');

    this.svg.append(defs, path);

    // 目盛りを追加
    const tickCount = 11;
    const totalAngle = this.endAngle - this.startAngle;
    const cx = this.baseCx + this.viewBox.offsetX;
    const cy = this.baseCy + this.viewBox.offsetY;

    for (let i = 1; i < tickCount; i++) {
      const angle = this.startAngle + (totalAngle / tickCount) * i;
      const angleRad = this._toRadians(angle);
      const innerR = this.baseRadius - this.strokeWidth / 2;
      const outerR = this.baseRadius - this.strokeWidth / 2 + 10;
      const x1 = cx + innerR * Math.cos(angleRad);
      const y1 = cy + innerR * Math.sin(angleRad);
      const x2 = cx + outerR * Math.cos(angleRad);
      const y2 = cy + outerR * Math.sin(angleRad);

      const line = document.createElementNS(this.svgNamespace, 'line');
      line.setAttribute('x1', String(x1));
      line.setAttribute('y1', String(y1));
      line.setAttribute('x2', String(x2));
      line.setAttribute('y2', String(y2));
      line.setAttribute('stroke', '#fff');
      line.setAttribute('stroke-width', '3');

      this.svg.appendChild(line);
    }

    // SVGをDOMに追加
    if (this.container) {
      this.container.appendChild(this.svg);

      // MutationObserverのセットアップ
      this._setupMutationObserver();
    }

    this.logger.debug('MeterRenderer initialized');
  }

  /**
   * MutationObserverの設定
   * @private
   */
  _setupMutationObserver() {
    if (!this.container || !window.MutationObserver) {
      return;
    }

    try {
      // 既存のObserverをクリア
      if (this.mutationObserver) {
        this.mutationObserver.disconnect();
        this.mutationObserver = null;
      }

      // 新しいObserverを作成
      this.mutationObserver = new MutationObserver((mutations) => {
        try {
          let hasValueChange = false;

          mutations.forEach(mutation => {
            if (mutation.type === 'attributes' &&
                (mutation.attributeName === 'data-percentage' ||
                 mutation.attributeName === 'data-actual')) {

              // 値の変更を検出
              const target = mutation.target;
              if (target && target.tagName === 'g' && target.hasAttribute('data-perf')) {
                const index = parseInt(target.getAttribute('data-perf') || '0', 10);
                if (!isNaN(index)) {
                  const percentageAttr = target.getAttribute('data-percentage');
                  if (percentageAttr) {
                    const percentage = parseFloat(percentageAttr);
                    const lastValue = this.lastValues.get(index);

                    // 値が変わっている場合、またはnullの場合でも更新
                    // 値が同じでも毎回更新することで表示を確実に維持
                    if (lastValue !== percentage || percentage === null) {
                      // nullの場合は前回の値を使用（値が消えるのを防止）
                      const displayValue = percentage !== null ? percentage : (lastValue || 0);
                      this.lastValues.set(index, displayValue);
                      hasValueChange = true;

                      // テキスト要素を更新
                      this._updateIconValue(target, displayValue, target.getAttribute('data-unit') || '%');
                    }
                  }
                }
              }
            }
          });

          if (hasValueChange) {
            this.logger.debug('Values updated via MutationObserver');
          }
        } catch (error) {
          this.logger.error('Error in MutationObserver:', error);
        }
      });

      // SVGの監視を開始
      this.mutationObserver.observe(this.svg, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-percentage', 'data-actual', 'transform']
      });

      this.logger.debug('MutationObserver setup complete');
    } catch (error) {
      this.logger.error('Error setting up MutationObserver:', error);
    }
  }

  /**
   * アイコンの値を更新するテキスト要素を追加または更新
   * @param {SVGElement} g アイコン要素
   * @param {number} percentage パーセント値
   * @param {string} unit 単位
   * @private
   */
  _updateIconValue(g, percentage, unit = '%') {
    if (!g) return;

    // 値の計算
    const actualValue = percentage;
    const roundedValue = Math.round(actualValue);

    // テキスト要素の取得または作成
    let textEl = g.querySelector('text.icon-value');
    if (!textEl) {
      textEl = document.createElementNS(this.svgNamespace, 'text');
      textEl.setAttribute('class', 'icon-value');
      textEl.setAttribute('x', '0');
      textEl.setAttribute('y', '15');
      textEl.setAttribute('text-anchor', 'middle');
      textEl.setAttribute('font-size', '14');
      textEl.setAttribute('font-weight', '700');
      textEl.setAttribute('font-family', 'fot-udkakugoc80-pro, sans-serif');
      textEl.setAttribute('fill', '#ffffff');
      textEl.setAttribute('paint-order', 'stroke');
      textEl.setAttribute('stroke', 'rgba(0,0,0,0.6)');
      textEl.setAttribute('stroke-width', '3');
      g.appendChild(textEl);
    }

    // テキスト内容の更新
    const newText = `${roundedValue}${unit}`;
    if (textEl.textContent !== newText) {
      textEl.textContent = newText;
    }
  }

  /**
   * メーターの更新
   * @param {Object} viewModelState MeterViewModelの状態
   */
  update(viewModelState) {
    // 状態がない場合はスキップ
    if (!viewModelState) return;

    // 既存のアイコンを管理
    const existing = new Map();
    this.svg.querySelectorAll('g[data-perf]').forEach(g => {
      existing.set(g.getAttribute('data-perf'), g);
    });

    // viewModelStateが完全な形式であるかチェック
    const hasTempDisconnected = viewModelState &&
                               viewModelState.tempDisconnected &&
                               Array.isArray(viewModelState.tempDisconnected);

    // 接続されているデバイス、または一時的に切断されているデバイスのインデックスを取得
    const connectedIndices = viewModelState.connected
      .map((connected, i) => (connected || (hasTempDisconnected && viewModelState.tempDisconnected[i])) ? i : -1)
      .filter(i => i !== -1);

    // 接続デバイス数に合わせてレイアウトを調整
    const deviceCount = connectedIndices.length;

    // 実際の値を表示するためのユーティリティ関数
    const denormalizeValue = (percentage) => {
      return percentage; // 単純に返す（表示値として使用）
    };

    // デバイスの値を永続的にキャッシュするためのマップを初期化
    if (!this._lastDeviceValues) {
      this._lastDeviceValues = new Map();
      this.logger.debug('Initialized device values cache map');
    }

    viewModelState.values.forEach((val, index) => {
      // デバイスが接続されていない、かつ一時的な切断状態でもない場合、または表示が非表示に設定されている場合はスキップ
      const isConnected = viewModelState.connected[index];
      const isTempDisconnected = hasTempDisconnected && viewModelState.tempDisconnected[index];
      const isVisible = Array.isArray(viewModelState.visible) && viewModelState.visible[index] !== false;

      if ((!isConnected && !isTempDisconnected) || !isVisible) {
        // 既存のアイコンがあれば削除
        const existingG = this.svg.querySelector(`g[data-perf="${index}"]`);
        if (existingG) {
          existingG.remove();
        }
        existing.delete(String(index));
        // 接続状態を維持する場合は値のキャッシュもそのまま保持し、完全な切断の場合のみクリア
        if (!isConnected && !isTempDisconnected && this._lastDeviceValues.has(index)) {
          this._lastDeviceValues.delete(index);
        }
        return;
      }

      // 値がnullの場合は最後の有効な値を使用（アイコンが消えるのを防ぐ）
      let actualVal;
      if (val === null || val === undefined) {
        // 過去に有効な値があればそれを使用
        if (this._lastDeviceValues.has(index)) {
          actualVal = this._lastDeviceValues.get(index);
          this.logger.debug(`Using cached value for device ${index}: ${actualVal}`);
        } else {
          // 過去の値もなければ0を使用
          actualVal = 0;
          this.logger.debug(`No cached value for device ${index}, using default: 0`);
          // 初期値をキャッシュ
          this._lastDeviceValues.set(index, actualVal);
        }
      } else {
        // 有効な値を受け取ったら、その値をキャッシュして使用
        actualVal = val;
        this._lastDeviceValues.set(index, val);
      }

      // このインデックスのレーンインデックスを計算
      let laneIndex = connectedIndices.indexOf(index);
      if (laneIndex < 0) laneIndex = 0;

      // 数値への変換と安全な値の保証
      const numericVal = Number(actualVal);
      const safeVal = Number.isFinite(numericVal) ? numericVal : 0;

      // 値に問題があっても位置計算は必ず行う
      // レーンのオフセットとデバイス数を考慮した位置計算
      const pos = this._calculateIconPosition(safeVal, laneIndex, deviceCount);

      // アイコン要素を取得または作成
      let g = this.svg.querySelector(`g[data-perf="${index}"]`);
      if (!g) {
        // 新しいアイコン要素を作成
        g = document.createElementNS(this.svgNamespace, 'g');
        g.setAttribute('data-perf', String(index));
        g.style.transition = 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)';
        g.style.willChange = 'transform';

        // 背景画像（ユーザーアイコン）
        const bgImage = document.createElementNS(this.svgNamespace, 'image');
        let bgHref = viewModelState.icons && viewModelState.icons[index] ? viewModelState.icons[index] : '';

        // アイコンがあれば表示する（パス形式を確認）
        if (bgHref) {
          // Base64エンコードされた画像の場合は変換不要
          if (bgHref.startsWith('data:image/')) {
            // Base64エンコードされた画像はそのまま使用
          }
          // 絶対パスでないなら絶対パスに変換（HTTP URLや/で始まるパスは除外）
          else if (!bgHref.startsWith('/') && !bgHref.startsWith('http')) {
            bgHref = '/' + bgHref;
          }
          bgImage.setAttributeNS('http://www.w3.org/1999/xlink', 'href', bgHref);
          bgImage.setAttribute('href', bgHref);
          bgImage.style.display = 'block';
        } else {
          bgImage.style.display = 'none';
        }

        bgImage.setAttribute('x', String(-25));
        bgImage.setAttribute('y', String(-25));
        bgImage.setAttribute('width', '50');
        bgImage.setAttribute('height', '50');
        bgImage.setAttribute('mask', 'url(#maskIconCircle)');

        // フォアグラウンドアイコン（共通のアイコン）を追加
        const fgImage = document.createElementNS(this.svgNamespace, 'image');
        let defaultIconUrl = this.config.defaultIcon;
        // Base64エンコードされた画像の場合は変換不要
        if (defaultIconUrl.startsWith('data:image/')) {
          // Base64エンコードされた画像はそのまま使用
        }
        // 絶対パスでないなら絶対パスに変換
        else if (!defaultIconUrl.startsWith('/') && !defaultIconUrl.startsWith('http')) {
          defaultIconUrl = '/' + defaultIconUrl;
        }
        fgImage.setAttributeNS('http://www.w3.org/1999/xlink', 'href', defaultIconUrl);
        fgImage.setAttribute('href', defaultIconUrl);
        fgImage.setAttribute('x', String(-25));
        fgImage.setAttribute('y', String(-25));
        fgImage.setAttribute('width', '50');
        fgImage.setAttribute('height', '50');
        fgImage.setAttribute('filter', 'url(#iconShadow)');
        fgImage.classList.add('fg-icon');

        // 機械可読な属性を追加
        const displayValue = safeVal;
        const roundedDisplay = Math.round(displayValue);
        g.setAttribute('data-percentage', String(Math.max(0, Math.min(100, safeVal))));
        g.setAttribute('data-actual', String(roundedDisplay));
        g.setAttribute('data-unit', '%');

        g.append(bgImage, fgImage);

        // 値を表示するテキスト要素を追加
        this._updateIconValue(g, safeVal, '%');

        // 初期トランスフォーム（初回描画時はアニメーションなし）
        g.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);
        this.svg.appendChild(g);
      } else {
        // 既存要素を更新
        // 機械可読な属性を更新
        const displayValue = safeVal;
        const roundedDisplay = Math.round(displayValue);
        const clampedPercent = Math.max(0, Math.min(100, safeVal));
        g.setAttribute('data-percentage', String(clampedPercent));
        g.setAttribute('data-actual', String(roundedDisplay));
        g.setAttribute('data-unit', '%');

        // 背景画像の更新
        const imgs = g.querySelectorAll('image');
        const bg = imgs[0]; // 背景画像（ユーザーアイコン）
        const fg = imgs[1]; // フォアグラウンドアイコン（共通アイコン）

        if (bg) {
          let desiredBg = viewModelState.icons && viewModelState.icons[index] ? viewModelState.icons[index] : '';
          // アイコンがあれば表示する（パス形式を確認）
          if (desiredBg) {
            // Base64エンコードされた画像の場合は変換不要
            if (desiredBg.startsWith('data:image/')) {
              // Base64エンコードされた画像はそのまま使用
            }
            // 絶対パスでないなら絶対パスに変換（HTTP URLや/で始まるパスは除外）
            else if (!desiredBg.startsWith('/') && !desiredBg.startsWith('http')) {
              desiredBg = '/' + desiredBg;
            }

            if (bg.getAttribute('href') !== desiredBg) {
              bg.setAttributeNS('http://www.w3.org/1999/xlink', 'href', desiredBg);
              bg.setAttribute('href', desiredBg);
            }
            bg.style.display = 'block';
          } else {
            bg.style.display = 'none';
          }
        }

        // フォアグラウンドアイコンの追加または更新
        if (!fg) {
          // フォアグラウンドアイコンが存在しない場合は作成
          const fgImage = document.createElementNS(this.svgNamespace, 'image');
          let defaultIconUrl = this.config.defaultIcon;
          // Base64エンコードされた画像の場合は変換不要
          if (defaultIconUrl.startsWith('data:image/')) {
            // Base64エンコードされた画像はそのまま使用
          }
          // 絶対パスでないなら絶対パスに変換
          else if (!defaultIconUrl.startsWith('/') && !defaultIconUrl.startsWith('http')) {
            defaultIconUrl = '/' + defaultIconUrl;
          }
          fgImage.setAttributeNS('http://www.w3.org/1999/xlink', 'href', defaultIconUrl);
          fgImage.setAttribute('href', defaultIconUrl);
          fgImage.setAttribute('x', String(-25));
          fgImage.setAttribute('y', String(-25));
          fgImage.setAttribute('width', '50');
          fgImage.setAttribute('height', '50');
          fgImage.setAttribute('filter', 'url(#iconShadow)');
          fgImage.classList.add('fg-icon');
          g.appendChild(fgImage);
        }

        // 値を表示するテキスト要素を更新
        this._updateIconValue(g, safeVal, '%');

        // トランジションでトランスフォームのみを変更
        g.style.transition = 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)';
        g.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);
      }

      existing.delete(String(index));
    });

    // 不要な要素を削除
    existing.forEach((g) => g.remove());

    this.logger.debug('MeterRenderer updated');
  }

  /**
   * SVG要素の取得
   * @returns {SVGElement} SVG要素
   */
  getSVGElement() {
    return this.svg;
  }

  /**
   * サイズの変更
   * @param {number} width 幅
   * @param {number} height 高さ
   */
  resize(width, height) {
    if (!this.svg) return;

    // サイズ変更時は比率を維持
    this.svg.setAttribute('width', width);
    this.svg.setAttribute('height', height);

    this.logger.debug(`MeterRenderer resized to ${width}x${height}`);
  }

  /**
   * クリーンアップ処理
   */
  dispose() {
    // MutationObserverの解放
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }

    // SVG要素の削除
    if (this.container && this.svg) {
      this.container.removeChild(this.svg);
    }
    this.svg = null;

    this.logger.debug('MeterRenderer disposed');
  }
}