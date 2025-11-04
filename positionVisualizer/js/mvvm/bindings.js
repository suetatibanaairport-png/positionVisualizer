(function(){
  const { MeterState, MeterViewModel } = window.MVVM;

  function MonitorBinding(vm){
    this.vm = vm;
    this.bc = null;
    try { this.bc = new BroadcastChannel('meter-overlay'); } catch(e) {}
  }
  MonitorBinding.prototype.broadcast = function(){
    const s = this.vm.toJSON();
    // Also serialize current SVG for mirroring
    const svgEl = document.querySelector('#meter-container svg[data-meter]');
    const svgMarkup = svgEl ? svgEl.outerHTML : '';
    if (this.bc) this.bc.postMessage({ ...s, svg: svgMarkup });
    try {
      localStorage.setItem('meter-state', JSON.stringify({ ...s, ts: Date.now() }));
      if (svgMarkup) localStorage.setItem('meter-svg', svgMarkup);
    } catch(e) {}
  };
  MonitorBinding.prototype.getVisibleIndices = function(){
    // In mock mode, show all devices with names
    // In non-mock mode, show only devices with IP addresses set
    const mockMode = this.vm.mockMode;
    const visibleIndices = [];
    
    for (let i = 0; i < 4; i++) {
      const ipEl = document.getElementById(`device${i+1}-ip`);
      const nameEl = document.getElementById(`device${i+1}-name`);
      const ip = ipEl ? ipEl.value.trim() : '';
      const name = nameEl ? nameEl.value.trim() : '';
      
      if (mockMode) {
        // In mock mode, show if name is set
        if (name) {
          visibleIndices.push(i);
        }
      } else {
        // In non-mock mode, show only if IP is set
        if (ip) {
          visibleIndices.push(i);
        }
      }
    }
    
    return visibleIndices.length > 0 ? visibleIndices : null;
  };

  MonitorBinding.prototype.attach = function(){
    const vm = this.vm;
    MeterRenderer.initMeter(document.getElementById('meter-container'));
    vm.onChange((state) => {
      const visibleIndices = this.getVisibleIndices();
      const actualValues = vm.getActualValues();
      MeterRenderer.updateMeter(state.values, { 
        names: state.names, 
        icon: state.icon, 
        numbersOnly: true, 
        textYOffset: 15,
        visibleIndices: visibleIndices,
        actualValues: actualValues,
        unit: vm.unit,
        icons: vm.state.icons
      });
      this.broadcast();
      ['slider1-value','slider2-value','slider3-value','slider4-value'].forEach((id, idx) => {
        const el = document.getElementById(id); 
        if (el) {
          const actualValue = vm.getActualValue(idx);
          const unit = vm.unit || '%';
          el.textContent = String(Math.round(actualValue)) + unit;
        }
      });
      [['slider1-label',0],['slider2-label',1],['slider3-label',2],['slider4-label',3]].forEach(([id,i])=>{ 
        const lab = document.getElementById(id);
        if (lab && lab.childNodes && lab.childNodes.length>0) {
          const unit = vm.unit || '%';
          lab.childNodes[0].nodeValue = `${state.names[i]}: `;
          // Update unit in the value span's parent
          const valueSpan = lab.querySelector('span');
          if (valueSpan && lab.childNodes.length > 1) {
            // Value span already exists, update it
          }
        }
      });
    });
    // initial paint
    const initialVisibleIndices = this.getVisibleIndices();
    const initialActualValues = vm.getActualValues();
    MeterRenderer.updateMeter(vm.state.values, { 
      names: vm.state.names, 
      icon: vm.state.icon, 
      numbersOnly: true, 
      textYOffset: 15,
      visibleIndices: initialVisibleIndices,
      actualValues: initialActualValues,
      unit: vm.unit,
      icons: vm.state.icons
    });
    this.broadcast();
  };

  function OverlayBinding(vm){
    this.vm = vm;
    this.bc = null;
    try { this.bc = new BroadcastChannel('meter-overlay'); } catch(e) {}
  }
  OverlayBinding.prototype.attach = function(){
    const container = document.getElementById('meter-container');
    let initialized = false;

    const setHref = (img, href) => {
      if (!img) return;
      if (href) {
        if (img.getAttribute('href') !== href) {
          img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', href);
          img.setAttribute('href', href);
        }
      } else {
        if (img.getAttribute('href')) {
          img.removeAttribute('href');
          img.removeAttributeNS('http://www.w3.org/1999/xlink', 'href');
        }
      }
    };

    const renderSvgFull = (svgMarkup) => {
      if (!svgMarkup) return;
      container.innerHTML = svgMarkup;
      initialized = true;
    };

    const patchSvg = (svgMarkup) => {
      if (!svgMarkup) return;
      const existingSvg = container.querySelector('svg[data-meter]');
      if (!existingSvg) { renderSvgFull(svgMarkup); return; }
      const temp = document.createElement('div'); temp.innerHTML = svgMarkup;
      const nextSvg = temp.querySelector('svg[data-meter]'); if (!nextSvg) return;
      // Update perf groups
      const nextGroups = nextSvg.querySelectorAll('g[data-perf]');
      const nextKeys = new Set();
      nextGroups.forEach((ng) => {
        const key = ng.getAttribute('data-perf');
        nextKeys.add(key);
        let g = existingSvg.querySelector(`g[data-perf="${key}"]`);
        if (!g) { g = ng.cloneNode(true); existingSvg.appendChild(g); return; }
        // Update transform for animation
        const tr = ng.getAttribute('transform'); if (tr) g.setAttribute('transform', tr);
        // Update text
        const nt = ng.querySelector('text'); const ct = g.querySelector('text');
        if (nt && ct) {
          if (ct.textContent !== nt.textContent) ct.textContent = nt.textContent;
          ct.setAttribute('y', nt.getAttribute('y') || ct.getAttribute('y') || '15');
        }
        // Update images: [0]=bg, [1]=fg
        const nimgs = ng.querySelectorAll('image');
        const cimgs = g.querySelectorAll('image');
        if (nimgs && nimgs.length) {
          // Ensure at least as many images
          for (let i=0;i<nimgs.length;i++) {
            if (!cimgs[i]) { g.insertBefore(nimgs[i].cloneNode(true), ct || null); }
          }
          const updatedCImgs = g.querySelectorAll('image');
          for (let i=0;i<nimgs.length;i++) {
            const href = nimgs[i].getAttribute('href') || nimgs[i].getAttributeNS('http://www.w3.org/1999/xlink','href');
            setHref(updatedCImgs[i], href);
          }
        }
      });
      // Remove groups not present anymore
      existingSvg.querySelectorAll('g[data-perf]').forEach((cg) => {
        const k = cg.getAttribute('data-perf');
        if (!nextKeys.has(k)) cg.remove();
      });
    };
    // receivers: prefer svg mirroring
    if (this.bc) this.bc.onmessage = (ev)=>{
      const d = ev.data || {};
      if (typeof d.svg === 'string' && d.svg) {
        if (!initialized) renderSvgFull(d.svg); else patchSvg(d.svg);
        return;
      }
      // Fallback (legacy): if only state arrived
      if (Array.isArray(d.values)) {
        const { MeterState } = window.MVVM;
        this.vm.setState(new MeterState(d.values, d.names, d.icon, d.icons));
        // And try to read latest svg from LS
        try { const svg = localStorage.getItem('meter-svg'); if (svg) { if (!initialized) renderSvgFull(svg); else patchSvg(svg); } } catch(e){}
      }
    };
    // Listen to localStorage updates for svg
    window.addEventListener('storage', (e)=>{ if (e.key==='meter-svg' && typeof e.newValue==='string') { if (!initialized) renderSvgFull(e.newValue); else patchSvg(e.newValue); } });
    // initial
    try { const svg = localStorage.getItem('meter-svg'); if (svg) renderSvgFull(svg); } catch(e){}
  };

  window.MVVM.Bindings = { MonitorBinding, OverlayBinding };
})();


