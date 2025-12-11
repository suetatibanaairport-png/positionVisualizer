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
  const LANE_OFFSETS = [-40, -20, 0, 20, 40, 60]; // Fallback for max 6 devices
  const MAX_LANE_OFFSET = 30; // Maximum offset from base radius (within meter bounds)
  const MIN_LANE_OFFSET = -30; // Minimum offset from base radius (within meter bounds)

  // Calculate lane offsets dynamically based on device count
  function calculateLaneOffsets(deviceCount) {
    if (deviceCount <= 0) return [];
    if (deviceCount === 1) return [0]; // Center for single device
    // Distribute evenly between MIN_LANE_OFFSET and MAX_LANE_OFFSET
    const offsets = [];
    for (let i = 0; i < deviceCount; i++) {
      const t = deviceCount === 1 ? 0.5 : i / (deviceCount - 1); // 0 to 1
      const offset = MIN_LANE_OFFSET + (MAX_LANE_OFFSET - MIN_LANE_OFFSET) * t;
      offsets.push(offset);
    }
    return offsets;
  }

  const toRadians = (angle) => (angle * Math.PI) / 180;

  function calculateViewBox() { // 外側の円の大きさを計算（アイコンの位置も考慮）
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

    // Consider icon positions (icons are 50x50, with offsets up to 60)
    const maxIconOffset = Math.max(...LANE_OFFSETS.map(Math.abs));
    const iconRadius = 25; // Half of icon size (50/2)
    const maxRadius = baseRadius + maxIconOffset + iconRadius;

    // Check icon positions at start and end angles
    const startRad = toRadians(startAngle);
    const endRad = toRadians(endAngle);
    const iconPositions = [
      { x: baseCx + maxRadius * Math.cos(startRad), y: baseCy + maxRadius * Math.sin(startRad) },
      { x: baseCx + maxRadius * Math.cos(endRad), y: baseCy + maxRadius * Math.sin(endRad) }
    ];

    // Also check middle positions for icons
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const angle = startAngle + (endAngle - startAngle) * t;
      const angleRad = toRadians(angle);
      const radius = baseRadius + maxIconOffset;
      const x = baseCx + radius * Math.cos(angleRad);
      const y = baseCy + radius * Math.sin(angleRad);
      minX = Math.min(minX, x - iconRadius);
      maxX = Math.max(maxX, x + iconRadius);
      minY = Math.min(minY, y - iconRadius);
      maxY = Math.max(maxY, y + iconRadius);
    }

    // Add extra padding to ensure icons are never clipped
    const padding = 30; // Increased padding for overlay
    return {
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
      offsetX: -minX + padding,
      offsetY: -minY + padding
    };
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

  function calculateIconPosition(percentage, laneIndex, deviceCount) {
    const clamped = Math.max(0, Math.min(100, percentage));
    const t = clamped / 100;
    const angle = startAngle + (endAngle - startAngle) * t;
    const angleRad = toRadians(angle);

    // Use dynamic lane offsets if deviceCount is provided, otherwise fallback to fixed offsets
    let laneOffsets;
    if (deviceCount && deviceCount > 0) {
      laneOffsets = calculateLaneOffsets(deviceCount);
    } else {
      laneOffsets = LANE_OFFSETS;
    }

    // Clamp laneIndex to valid range
    const safeLaneIndex = Math.max(0, Math.min(laneOffsets.length - 1, laneIndex));
    const offset = laneOffsets[safeLaneIndex] || 0;
    const radius = baseRadius + offset;
    const x = cx + radius * Math.cos(angleRad);
    const y = cy + radius * Math.sin(angleRad);
    return { x, y };
  }

  function updateTickLabels(svg, minValue, maxValue, unit) {
    if (!svg) return;

    // Remove existing label group
    const existingGroup = svg.querySelector('g.tick-labels-group');
    if (existingGroup) {
      existingGroup.remove();
    }

  }

  function ensureSvg(containerEl) {
    let svg = containerEl.querySelector('svg[data-meter]');
    if (svg) return svg;
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('data-meter', '');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('viewBox', `0 0 ${viewBox.width} ${viewBox.height}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.style.display = 'block';
    svg.style.verticalAlign = 'middle';

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    gradient.setAttribute('id', 'meterGradient');
    gradient.setAttribute('x1', '0');
    gradient.setAttribute('y1', String(viewBox.height / 2));
    gradient.setAttribute('x2', String(viewBox.width));
    gradient.setAttribute('y2', String(viewBox.height / 2));
    gradient.setAttribute('gradientUnits', 'userSpaceOnUse');
    const s1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop'); s1.setAttribute('offset', '0'); s1.setAttribute('stop-color', '#71cce2');
    const s2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop'); s2.setAttribute('offset', '1'); s2.setAttribute('stop-color', '#6e40a9');
    gradient.append(s1, s2);

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
    const icon = (options && options.icon !== undefined) ? options.icon : null; // Default to null instead of 'assets/icon.svg'
    const icons = (options && options.icons) || null; // per-index icons
    const connectedDeviceIndices = (options && options.connectedDeviceIndices) || null; // null means calculate from values (non-null indices)
    const actualValues = (options && options.actualValues) || null; // Actual values for display (not normalized)
    const unit = (options && options.unit) || '%'; // Unit for display
    const minValue = (options && typeof options.minValue === 'number') ? options.minValue : 0;
    const maxValue = (options && typeof options.maxValue === 'number') ? options.maxValue : 100;

    // Calculate device count from connected device indices
    let deviceCount = 0;
    if (connectedDeviceIndices !== null && Array.isArray(connectedDeviceIndices)) {
      deviceCount = connectedDeviceIndices.length;
    } else {
      // If null, count non-null values (including 0)
      deviceCount = values.filter(v => v !== null && v !== undefined && !isNaN(v)).length;
    }
    // If no devices connected, don't render anything (early return)
    if (deviceCount === 0) {
      // Remove all existing icons
      const containerEl = document.getElementById('meter-container');
      const svg = containerEl ? containerEl.querySelector('svg[data-meter]') : null;
      if (svg) {
        svg.querySelectorAll('g[data-perf]').forEach(g => g.remove());
      }
      return;
    }

    // Helper function to convert normalized value (0-100%) to actual value based on min/max settings
    function denormalizeValue(percentage) {
      const range = maxValue - minValue;
      if (range === 0) return minValue; // Avoid division by zero
      return minValue + (percentage / 100) * range;
    }

    const containerEl = document.getElementById('meter-container');
    const svg = ensureSvg(containerEl);

    const existing = new Map();
    svg.querySelectorAll('g[data-perf]').forEach(g => {
      existing.set(g.getAttribute('data-perf'), g);
    });

    values.slice(0, 6).forEach((val, index) => {
      // Skip if value is null (device not connected)
      if (val === null || val === undefined) {
        // Remove icon if it exists
        const existingG = svg.querySelector(`g[data-perf="${index}"]`);
        if (existingG) existingG.remove();
        existing.delete(String(index));
        return;
      }

      // Skip if this index should be hidden (when connectedDeviceIndices is specified)
      if (connectedDeviceIndices !== null && !connectedDeviceIndices.includes(index)) {
        // Remove icon if it exists
        const existingG = svg.querySelector(`g[data-perf="${index}"]`);
        if (existingG) existingG.remove();
        existing.delete(String(index));
        return;
      }

      // Map index to lane index based on connected device indices
      let laneIndex = 0;
      if (connectedDeviceIndices !== null && Array.isArray(connectedDeviceIndices)) {
        const positionInConnected = connectedDeviceIndices.indexOf(index);
        laneIndex = positionInConnected >= 0 ? positionInConnected : 0;
      } else {
        // If no connected device indices specified, use index directly (but limit to deviceCount)
        laneIndex = index % deviceCount;
      }

      const numericVal = Number(val);
      const safeVal = Number.isFinite(numericVal) ? numericVal : 0;
      const pos = calculateIconPosition(safeVal, laneIndex, deviceCount);

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
          bgImage.style.display = 'block';
        } else {
          bgImage.style.display = 'none';
        }
        bgImage.setAttribute('x', String(-25));
        bgImage.setAttribute('y', String(-25));
        bgImage.setAttribute('width', '50');
        bgImage.setAttribute('height', '50');
        bgImage.setAttribute('mask', 'url(#maskIconCircle)');

        // Foreground SVG icon (only if icon is provided)
        let fgImage = null;
        if (icon) {
          fgImage = document.createElementNS('http://www.w3.org/2000/svg', 'image');
          fgImage.setAttributeNS('http://www.w3.org/1999/xlink', 'href', icon);
          fgImage.setAttribute('href', icon);
          fgImage.setAttribute('x', String(-25));
          fgImage.setAttribute('y', String(-25));
          fgImage.setAttribute('width', '50');
          fgImage.setAttribute('height', '50');
          fgImage.setAttribute('filter', 'url(#iconShadow)');
        }

        // Machine-readable attributes for UI parsing
        const displayValue = actualValues && actualValues[index] !== undefined
          ? actualValues[index]
          : denormalizeValue(safeVal);
        const roundedDisplay = Math.round(displayValue);
        g.setAttribute('data-percentage', String(Math.max(0, Math.min(100, safeVal))));
        g.setAttribute('data-actual', String(roundedDisplay));
        g.setAttribute('data-unit', unit);

        // Append in order: background, foreground (if exists)
        if (fgImage) {
          g.append(bgImage, fgImage);
        } else {
          g.append(bgImage);
        }
        // Set initial transform (no animation on first paint)
        g.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);
        svg.appendChild(g);
      } else {
        // Remove any existing text element(legacy)
        const t = g.querySelector('text');
        if (t) {
          t.remove();
        }
        // Update machine-readable attributes
        const displayValue = actualValues && actualValues[index] !== undefined
          ? actualValues[index]
          : denormalizeValue(safeVal);
        const roundedDisplay = Math.round(displayValue);
        const clampedPercent = Math.max(0, Math.min(100, safeVal));
        g.setAttribute('data-percentage', String(clampedPercent));
        g.setAttribute('data-actual', String(roundedDisplay));
        g.setAttribute('data-unit', unit);
        // Update background user icon and foreground SVG icon
        const imgs = g.querySelectorAll('image');
        // imgs[0] -> bg, imgs[1] -> fg (if exists)
        const bg = imgs[0];
        const fg = imgs.length >= 2 ? imgs[1] : null;

        if (bg) {
          const desiredBg = (icons && icons[index]) ? icons[index] : '';
          if (desiredBg) {
            if (bg.getAttribute('href') !== desiredBg) {
              bg.setAttributeNS('http://www.w3.org/1999/xlink', 'href', desiredBg);
              bg.setAttribute('href', desiredBg);
            }
            bg.style.display = 'block';
          } else {
            // If no bg icon, clear href AND hide
            if (bg.getAttribute('href')) {
              bg.removeAttribute('href');
              bg.removeAttributeNS('http://www.w3.org/1999/xlink', 'href');
            }
            bg.style.display = 'none';
          }
        }

        // Handle foreground icon
        if (icon) {
          // Icon should be shown
          if (fg) {
            // Update existing foreground icon
            if (fg.getAttribute('href') !== icon) {
              fg.setAttributeNS('http://www.w3.org/1999/xlink', 'href', icon);
              fg.setAttribute('href', icon);
            }
          } else {
            // Create new foreground icon
            const newFg = document.createElementNS('http://www.w3.org/2000/svg', 'image');
            newFg.setAttributeNS('http://www.w3.org/1999/xlink', 'href', icon);
            newFg.setAttribute('href', icon);
            newFg.setAttribute('x', String(-25));
            newFg.setAttribute('y', String(-25));
            newFg.setAttribute('width', '50');
            newFg.setAttribute('height', '50');
            newFg.setAttribute('filter', 'url(#iconShadow)');
            g.appendChild(newFg);
          }
        } else {
          // Icon should be hidden - remove foreground icon if it exists
          if (fg) {
            fg.remove();
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

    // Update tick labels with min/max values (after all other updates)
    updateTickLabels(svg, minValue, maxValue, unit);
  }

  function initMeter(containerEl) {
    ensureSvg(containerEl);
  }

  window.MeterRenderer = { initMeter, updateMeter };
})();

