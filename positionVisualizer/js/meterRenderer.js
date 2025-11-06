// Gradient meter + ticks + icons rendering
// Public API:
//   initMeter(containerEl)
//   updateMeter(values: number[], options?: { names?: string[], icon?: string })

(function () {
  const baseCx = 251.74;
  const baseCy = 168.17;
  const baseRadius = Math.sqrt((503.48 / 2) ** 2 + (168.17 * 0.52) ** 2);
  const strokeWidth = 100;
  const startAngle = -140;
  const endAngle = -40;
  const LANE_OFFSETS = [-40, -20, 0, 20, 40, 60]

  const toRadians = (angle) => (angle * Math.PI) / 180;

  function calculateViewBox() { // 外側の円の大きさを計算
    const outerRadius = baseRadius + strokeWidth / 2;
    const innerRadius = baseRadius - strokeWidth / 2;
    const angles = [startAngle, endAngle];
    for (let angle = Math.ceil(startAngle); angle <= Math.floor(endAngle); angle++) {
      if (angle % 90 === 0) angles.push(angle);
    }
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    angles.forEach(angle => {
      const rad = (angle * Math.PI) / 180;
      const x_outer = baseCx + outerRadius * Math.cos(rad);
      const y_outer = baseCy + outerRadius * Math.sin(rad);
      const x_inner = baseCx + innerRadius * Math.cos(rad);
      const y_inner = baseCy + innerRadius * Math.sin(rad);
      minX = Math.min(minX, x_outer, x_inner);
      maxX = Math.max(maxX, x_outer, x_inner);
      minY = Math.min(minY, y_outer, y_inner);
      maxY = Math.max(maxY, y_outer, y_inner);
    });
    return { width: maxX - minX, height: maxY - minY, offsetX: -minX, offsetY: -minY };
  }

  const viewBox = calculateViewBox();
  const cx = baseCx + viewBox.offsetX;
  const cy = baseCy + viewBox.offsetY;

  function describeArc() {
    const startRad = toRadians(startAngle);
    const endRad = toRadians(endAngle);
    const innerRadius = baseRadius - strokeWidth / 2;
    const outerRadius = baseRadius + strokeWidth / 2;
    const x1 = cx + innerRadius * Math.cos(startRad);
    const y1 = cy + innerRadius * Math.sin(startRad);
    const x2 = cx + outerRadius * Math.cos(startRad);
    const y2 = cy + outerRadius * Math.sin(startRad);
    const x3 = cx + outerRadius * Math.cos(endRad);
    const y3 = cy + outerRadius * Math.sin(endRad);
    const x4 = cx + innerRadius * Math.cos(endRad);
    const y4 = cy + innerRadius * Math.sin(endRad);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${x1} ${y1} L ${x2} ${y2} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x3} ${y3} L ${x4} ${y4} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x1} ${y1}`;
  }

  function calculateIconPosition(percentage, laneIndex) {
    const clamped = Math.max(0, Math.min(100, percentage));
    const t = clamped / 100;
    const angle = startAngle + (endAngle - startAngle) * t;
    const angleRad = toRadians(angle);
    const radius = baseRadius + LANE_OFFSETS[laneIndex];
    const x = cx + radius * Math.cos(angleRad);
    const y = cy + radius * Math.sin(angleRad);
    return { x, y };
  }

  function ensureSvg(containerEl) {
    let svg = containerEl.querySelector('svg[data-meter]');
    if (svg) return svg;
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('data-meter', '');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', 'auto');
    svg.setAttribute('viewBox', `0 0 ${viewBox.width} ${viewBox.height}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.style.display = 'block';

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    gradient.setAttribute('id', 'meterGradient');
    gradient.setAttribute('x1', '0');
    gradient.setAttribute('y1', String(viewBox.height / 2));
    gradient.setAttribute('x2', String(viewBox.width));
    gradient.setAttribute('y2', String(viewBox.height / 2));
    gradient.setAttribute('gradientUnits', 'userSpaceOnUse');
    const s1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop'); s1.setAttribute('offset', '0'); s1.setAttribute('stop-color', '#1497bc');
    const s2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop'); s2.setAttribute('offset', '0.52'); s2.setAttribute('stop-color', '#9c96c8');
    const s3 = document.createElementNS('http://www.w3.org/2000/svg', 'stop'); s3.setAttribute('offset', '1'); s3.setAttribute('stop-color', '#6e4096');
    gradient.append(s1, s2, s3);

    const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    filter.setAttribute('id', 'iconShadow');
    const fe = document.createElementNS('http://www.w3.org/2000/svg', 'feDropShadow');
    fe.setAttribute('dx', '0'); fe.setAttribute('dy', '2'); fe.setAttribute('stdDeviation', '3'); fe.setAttribute('flood-opacity', '0.3');
    filter.appendChild(fe);
    // Circle mask for icons (objectBoundingBox units to keep it centered)
    const mask = document.createElementNS('http://www.w3.org/2000/svg', 'mask');
    mask.setAttribute('id', 'maskIconCircle');
    mask.setAttribute('maskContentUnits', 'objectBoundingBox');
    mask.setAttribute('maskUnits', 'objectBoundingBox');
    const maskCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    maskCircle.setAttribute('cx', '0.5');
    maskCircle.setAttribute('cy', '0.5');
    maskCircle.setAttribute('r', '0.5');
    maskCircle.setAttribute('fill', '#fff');
    mask.appendChild(maskCircle);
    defs.append(gradient, filter, mask);

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('data-arc', '');
    path.setAttribute('d', describeArc());
    path.setAttribute('fill', 'url(#meterGradient)');

    svg.append(defs, path);

    // ticks
    const tickCount = 11;
    const totalAngle = endAngle - startAngle;
    for (let i = 1; i < tickCount; i++) {
      const angle = startAngle + (totalAngle / tickCount) * i;
      const angleRad = toRadians(angle);
      const innerR = baseRadius - strokeWidth / 2;
      const outerR = baseRadius - strokeWidth / 2 + 10;
      const x1 = cx + innerR * Math.cos(angleRad);
      const y1 = cy + innerR * Math.sin(angleRad);
      const x2 = cx + outerR * Math.cos(angleRad);
      const y2 = cy + outerR * Math.sin(angleRad);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(x1)); line.setAttribute('y1', String(y1));
      line.setAttribute('x2', String(x2)); line.setAttribute('y2', String(y2));
      line.setAttribute('stroke', '#fff'); line.setAttribute('stroke-width', '3');
      svg.appendChild(line);
    }

    containerEl.innerHTML = '';
    containerEl.appendChild(svg);
    return svg;
  }

  function updateMeter(values, options) {
    const names = (options && options.names) || ['出演者A','出演者B','出演者C','出演者D'];
    const icon = (options && options.icon) || 'assets/icon.svg';
    const icons = (options && options.icons) || null; // per-index icons
    const numbersOnly = !!(options && options.numbersOnly);
    const textYOffset = (options && typeof options.textYOffset === 'number') ? options.textYOffset : (numbersOnly ? 15 : 45);
    const visibleIndices = (options && options.visibleIndices) || null; // null means all visible
    const actualValues = (options && options.actualValues) || null; // Actual values for display (not normalized)
    const unit = (options && options.unit) || '%'; // Unit for display
    const containerEl = document.getElementById('meter-container');
    const svg = ensureSvg(containerEl);

    const existing = new Map();
    svg.querySelectorAll('g[data-perf]').forEach(g => {
      existing.set(g.getAttribute('data-perf'), g);
    });

    values.slice(0, 6).forEach((val, index) => {
      // Skip if this index should be hidden (when visibleIndices is specified)
      if (visibleIndices !== null && !visibleIndices.includes(index)) {
        // Remove icon if it exists
        const existingG = svg.querySelector(`g[data-perf="${index}"]`);
        if (existingG) existingG.remove();
        existing.delete(String(index));
        return;
      }

      const laneIndex = index % LANE_OFFSETS.length;
      const numericVal = Number(val);
      const safeVal = Number.isFinite(numericVal) ? numericVal : 0;
      const pos = calculateIconPosition(safeVal, laneIndex);

      let g = svg.querySelector(`g[data-perf="${index}"]`);
      if (!g) {
        g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('data-perf', String(index));
        g.style.transition = 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)';
        g.style.willChange = 'transform';

        // Background user image (if provided), masked as circle
        const bgImage = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        const bgHref = (icons && icons[index]) ? icons[index] : '';
        if (bgHref) {
          bgImage.setAttributeNS('http://www.w3.org/1999/xlink', 'href', bgHref);
          bgImage.setAttribute('href', bgHref);
        }
        bgImage.setAttribute('x', String(-25));
        bgImage.setAttribute('y', String(-25));
        bgImage.setAttribute('width', '50');
        bgImage.setAttribute('height', '50');
        bgImage.setAttribute('mask', 'url(#maskIconCircle)');

        // Foreground SVG icon (always shown on top)
        const fgImage = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        fgImage.setAttributeNS('http://www.w3.org/1999/xlink', 'href', icon);
        fgImage.setAttribute('href', icon);
        fgImage.setAttribute('x', String(-25));
        fgImage.setAttribute('y', String(-25));
        fgImage.setAttribute('width', '50');
        fgImage.setAttribute('height', '50');
        fgImage.setAttribute('filter', 'url(#iconShadow)');

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', '0');
        text.setAttribute('y', String(textYOffset));
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-size', '14');
        text.setAttribute('font-weight', '700');
        text.setAttribute('font-style', 'normal');
        text.setAttribute('font-family', 'fot-udkakugoc80-pro, sans-serif');
        text.setAttribute('fill', '#ffffff');
        text.setAttribute('paint-order', 'stroke');
        text.setAttribute('stroke', 'rgba(0,0,0,0.6)');
        text.setAttribute('stroke-width', '3');
        // Display actual value if provided, otherwise use normalized value
        const displayValue = actualValues && actualValues[index] !== undefined 
          ? actualValues[index] 
          : val;
        const roundedDisplay = Math.round(displayValue);
        const displayText = numbersOnly 
          ? `${roundedDisplay}${unit}` 
          : `${names[index] || ''} ${roundedDisplay}${unit}`;
        text.textContent = displayText;

        // Machine-readable attributes for UI parsing
        g.setAttribute('data-percentage', String(Math.max(0, Math.min(100, safeVal))));
        g.setAttribute('data-actual', String(roundedDisplay));
        g.setAttribute('data-unit', unit);
        text.setAttribute('data-actual', String(roundedDisplay));
        text.setAttribute('data-unit', unit);

        // Append in order: background, foreground, text (text on top)
        g.append(bgImage, fgImage, text);
        // Set initial transform (no animation on first paint)
        g.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);
        svg.appendChild(g);
      } else {
        // Update label
        const t = g.querySelector('text');
        if (t) {
          // Display actual value if provided, otherwise use normalized value
          const displayValue = actualValues && actualValues[index] !== undefined 
            ? actualValues[index] 
            : val;
          const roundedDisplay = Math.round(displayValue);
          const displayText = numbersOnly 
            ? `${roundedDisplay}${unit}` 
            : `${names[index] || ''} ${roundedDisplay}${unit}`;
          t.textContent = displayText;
          // Update machine-readable attributes
          const clampedPercent = Math.max(0, Math.min(100, safeVal));
          const parentG = t.closest('g[data-perf]');
          if (parentG) {
            parentG.setAttribute('data-percentage', String(clampedPercent));
            parentG.setAttribute('data-actual', String(roundedDisplay));
            parentG.setAttribute('data-unit', unit);
          }
          t.setAttribute('data-actual', String(roundedDisplay));
          t.setAttribute('data-unit', unit);
          t.setAttribute('y', String(textYOffset));
          t.setAttribute('font-weight', '700');
          t.setAttribute('font-style', 'normal');
          t.setAttribute('font-family', 'fot-udkakugoc80-pro, sans-serif');
        }
        // Update background user icon and foreground SVG icon
        const imgs = g.querySelectorAll('image');
        // imgs[0] -> bg, imgs[1] -> fg
        if (imgs && imgs.length >= 2) {
          const bg = imgs[0];
          const fg = imgs[1];
          const desiredBg = (icons && icons[index]) ? icons[index] : '';
          if (desiredBg) {
            if (bg.getAttribute('href') !== desiredBg) {
              bg.setAttributeNS('http://www.w3.org/1999/xlink', 'href', desiredBg);
              bg.setAttribute('href', desiredBg);
            }
          } else {
            // If no bg icon, clear href to hide (keeps element for layout consistency)
            if (bg.getAttribute('href')) {
              bg.removeAttribute('href');
              bg.removeAttributeNS('http://www.w3.org/1999/xlink', 'href');
            }
          }
          if (fg.getAttribute('href') !== icon) {
            fg.setAttributeNS('http://www.w3.org/1999/xlink', 'href', icon);
            fg.setAttribute('href', icon);
          }
        }
        // Trigger transition by changing transform only
        g.style.transition = 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)';
        g.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);
      }
      existing.delete(String(index));
    });

    // Remove any extra stale groups
    existing.forEach((g) => g.remove());
  }

  function initMeter(containerEl) {
    ensureSvg(containerEl);
  }

  window.MeterRenderer = { initMeter, updateMeter };
})();


