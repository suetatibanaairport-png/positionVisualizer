/**
 * OverlayBindings - Presentation Layer
 * オーバーレイウィンドウのDOMバインディング
 */
(function () {
  'use strict';

  const MeterRenderer = window.MeterRenderer;

  function OverlayBindings(viewModel, webSocketClient, httpPollingClient, overlayChannel) {
    this.viewModel = viewModel;
    this.webSocketClient = webSocketClient;
    this.httpPollingClient = httpPollingClient;
    this.overlayChannel = overlayChannel;
    this.initialized = false;
    this.isMainPageReplaying = false;
  }

  /**
   * SVGを完全にレンダリング
   */
  OverlayBindings.prototype._renderSvgFull = function (svgMarkup) {
    if (!svgMarkup) return;
    const container = document.getElementById('meter-container');
    if (!container) return;

    container.innerHTML = svgMarkup;
    this.initialized = true;

    if (window.IconRenderer && window.IconRenderer.updateAllIconValues) {
      setTimeout(() => {
        window.IconRenderer.updateAllIconValues();
      }, 50);
    }
  };

  /**
   * SVGをパッチ（差分更新）
   */
  OverlayBindings.prototype._patchSvg = function (svgMarkup) {
    if (!svgMarkup) return;
    const container = document.getElementById('meter-container');
    if (!container) return;

    const existingSvg = container.querySelector('svg[data-meter]');
    if (!existingSvg) {
      this._renderSvgFull(svgMarkup);
      return;
    }

    const temp = document.createElement('div');
    temp.innerHTML = svgMarkup;
    const nextSvg = temp.querySelector('svg[data-meter]');
    if (!nextSvg) return;

    // Update viewBox if changed
    const nextViewBox = nextSvg.getAttribute('viewBox');
    if (nextViewBox && existingSvg.getAttribute('viewBox') !== nextViewBox) {
      existingSvg.setAttribute('viewBox', nextViewBox);
    }

    // Update perf groups
    const nextGroups = nextSvg.querySelectorAll('g[data-perf]');
    nextGroups.forEach((ng) => {
      const key = ng.getAttribute('data-perf');
      let g = existingSvg.querySelector(`g[data-perf="${key}"]`);
      if (!g) {
        g = ng.cloneNode(true);
        existingSvg.appendChild(g);
        return;
      }

      // Update transform
      const tr = ng.getAttribute('transform');
      if (tr) g.setAttribute('transform', tr);

      // Update data attributes
      const dataPercentage = ng.getAttribute('data-percentage');
      const dataActual = ng.getAttribute('data-actual');
      const dataUnit = ng.getAttribute('data-unit');
      if (dataPercentage !== null) g.setAttribute('data-percentage', dataPercentage);
      if (dataActual !== null) g.setAttribute('data-actual', dataActual);
      if (dataUnit !== null) g.setAttribute('data-unit', dataUnit);

      // Update text
      const nt = ng.querySelector('text');
      const ct = g.querySelector('text');
      if (nt && ct) {
        if (ct.textContent !== nt.textContent) ct.textContent = nt.textContent;
        ct.setAttribute('y', nt.getAttribute('y') || ct.getAttribute('y') || '15');
      }

      // Update icon-value text
      const nIconText = ng.querySelector('text.icon-value');
      const cIconText = g.querySelector('text.icon-value');
      if (nIconText) {
        if (!cIconText) {
          g.appendChild(nIconText.cloneNode(true));
        } else {
          cIconText.textContent = nIconText.textContent;
          cIconText.setAttribute('data-actual', nIconText.getAttribute('data-actual') || '');
          cIconText.setAttribute('data-unit', nIconText.getAttribute('data-unit') || '');
        }
      }

      // Update images
      const nimgs = ng.querySelectorAll('image');
      const cimgs = g.querySelectorAll('image');
      if (nimgs && nimgs.length) {
        for (let i = 0; i < nimgs.length; i++) {
          if (!cimgs[i]) {
            g.insertBefore(nimgs[i].cloneNode(true), ct || null);
          }
        }
        const updatedCImgs = g.querySelectorAll('image');
        for (let i = 0; i < nimgs.length; i++) {
          const nimg = nimgs[i];
          const cimg = updatedCImgs[i];
          if (cimg) {
            const href = nimg.getAttribute('href') || nimg.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
            if (href) {
              cimg.setAttributeNS('http://www.w3.org/1999/xlink', 'href', href);
              cimg.setAttribute('href', href);
            } else {
              cimg.removeAttributeNS('http://www.w3.org/1999/xlink', 'href');
              cimg.removeAttribute('href');
            }

            // Copy style (display: none, etc)
            const style = nimg.getAttribute('style');
            if (style) {
              cimg.setAttribute('style', style);
            } else {
              cimg.removeAttribute('style');
            }
          }
        }
      }
    });

    if (window.IconRenderer && window.IconRenderer.updateAllIconValues) {
      setTimeout(() => {
        window.IconRenderer.updateAllIconValues();
      }, 50);
    }
  };

  /**
   * 状態を処理
   */
  OverlayBindings.prototype._handleState = function (payload) {
    if (payload && payload.isReplaying !== undefined) {
      this.isMainPageReplaying = !!payload.isReplaying;
    }
    if (payload && typeof payload.svg === 'string' && payload.svg) {
      if (!this.initialized) {
        this._renderSvgFull(payload.svg);
      } else {
        this._patchSvg(payload.svg);
      }
      return;
    }

    if (payload && Array.isArray(payload.values)) {
      const values = payload.values;

      // Update icons if present in payload (fixes missing images during replay)
      if (payload.icons && Array.isArray(payload.icons)) {
        this.viewModel.state.icons = payload.icons.slice(0, 6);
      }

      for (let i = 0; i < 6; i++) {
        const value = values[i];
        if (value !== null && value !== undefined) {
          this.viewModel.setValue(i, value, true, true);
        } else {
          this.viewModel.setValue(i, null, false);
        }
      }

      if (payload.icon !== undefined) {
        this.viewModel.setIcon(payload.icon);
      }
      if (payload.unit !== undefined) {
        this.viewModel.setUnit(payload.unit);
      }
      if (payload.minValue !== undefined) {
        this.viewModel.setMinValue(payload.minValue);
      }
      if (payload.maxValue !== undefined) {
        this.viewModel.setMaxValue(payload.maxValue);
      }

      this.initialized = true;
    }
  };

  /**
   * バインディングをアタッチ
   */
  OverlayBindings.prototype.attach = function () {
    const container = document.getElementById('meter-container');
    const self = this;

    // Initialize meter
    try {
      MeterRenderer.initMeter(container);
      MeterRenderer.updateMeter([], { icon: null });
      this.initialized = !!container.querySelector('svg[data-meter]');

      if (window.IconRenderer && window.IconRenderer.updateAllIconValues) {
        setTimeout(() => {
          window.IconRenderer.updateAllIconValues();
        }, 100);
      }
    } catch (e) { }

    // BroadcastChannel receiver
    if (this.overlayChannel) {
      this.overlayChannel.subscribe((event) => {
        if (event.type === 'message') {
          const d = event.data || {};
          if (typeof d.svg === 'string' && d.svg) {
            if (!self.initialized) {
              self._renderSvgFull(d.svg);
            } else {
              self._patchSvg(d.svg);
            }
            return;
          }
          if (Array.isArray(d.values)) {
            self._handleState(d);
            try {
              const svg = localStorage.getItem('meter-svg');
              if (svg) {
                if (!self.initialized) {
                  self._renderSvgFull(svg);
                } else {
                  self._patchSvg(svg);
                }
              }
            } catch (e) { }
          }
        }
      });
    }

    // localStorage storage event
    window.addEventListener('storage', (e) => {
      if (e.key === 'meter-svg' && typeof e.newValue === 'string') {
        if (!self.initialized) {
          self._renderSvgFull(e.newValue);
        } else {
          self._patchSvg(e.newValue);
        }
      }
    });

    // Initial load from localStorage
    try {
      const svg = localStorage.getItem('meter-svg');
      if (svg) {
        this._renderSvgFull(svg);
      }
    } catch (e) { }

    // WebSocket receiver
    if (this.webSocketClient) {
      this.webSocketClient.subscribe((event) => {
        if (self.isMainPageReplaying) return; // Ignore live data during replay

        if (event.type === 'message') {
          const msg = event.data || {};
          if (msg && msg.type === 'state' && msg.payload) {
            self._handleState(msg.payload);
          }
        }
      });
      this.webSocketClient.connect();
    }

    // HTTP polling fallback
    if (this.httpPollingClient) {
      this.httpPollingClient.subscribe((event) => {
        if (self.isMainPageReplaying) return; // Ignore live data during replay

        if (event.type === 'data') {
          self._handleState(event.data);
        }
      });
      this.httpPollingClient.start();
    }

    // Subscribe to ViewModel changes
    this.viewModel.onChange((state) => {
      const connectedDeviceIndices = this.viewModel.getConnectedDeviceIndices();
      const actualValues = this.viewModel.getActualValues();

      MeterRenderer.updateMeter(state.values, {
        names: state.names,
        icon: state.icon,
        numbersOnly: true,
        textYOffset: 15,
        connectedDeviceIndices: connectedDeviceIndices,
        actualValues: actualValues,
        unit: this.viewModel.unit,
        minValue: this.viewModel.minValue,
        maxValue: this.viewModel.maxValue,
        icons: state.icons
      });

      if (window.IconRenderer && window.IconRenderer.updateAllIconValues) {
        setTimeout(() => {
          window.IconRenderer.updateAllIconValues();
        }, 50);
      }
    });
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = OverlayBindings;
  } else {
    window.OverlayBindings = OverlayBindings;
  }
})();

