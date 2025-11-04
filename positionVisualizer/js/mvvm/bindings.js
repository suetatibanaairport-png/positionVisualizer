(function(){
  const { MeterState, MeterViewModel } = window.MVVM;

  function MonitorBinding(vm){
    this.vm = vm;
    this.bc = null;
    try { this.bc = new BroadcastChannel('meter-overlay'); } catch(e) {}
    this._ws = null;
    this._wsTimer = null;
  }
  MonitorBinding.prototype._ensureWs = function(){
    if (this._ws && this._ws.readyState === WebSocket.OPEN) return this._ws;
    try {
      if (this._ws) { try { this._ws.close(); } catch(_){} this._ws = null; }
      const ws = new WebSocket('ws://127.0.0.1:8123');
      this._ws = ws;
      ws.onopen = () => { /* ready */ };
      ws.onclose = () => { if (this._wsTimer) clearTimeout(this._wsTimer); this._wsTimer = setTimeout(()=>this._ensureWs(), 1500); };
      ws.onerror = () => { try { ws.close(); } catch(_){} };
      ws.onmessage = () => {};
    } catch(_) {}
    if (!this._wsTimer) this._wsTimer = setTimeout(()=>this._ensureWs(), 1500);
    return this._ws;
  };
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
    // WebSocket send to local bridge (preferred)
    try {
      const ws = this._ensureWs();
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'state', payload: { ...s, svg: svgMarkup } }));
      }
    } catch(_) {}
    // HTTP fallback (optional)
    try {
      const payload = { ...s, svg: svgMarkup };
      fetch('http://127.0.0.1:8123/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        cache: 'no-store',
        keepalive: true
      }).catch(()=>{});
    } catch(_) {}
  };
  MonitorBinding.prototype.getVisibleIndices = function(){
    // In mock mode: show all → return null (no filtering)
    // In non-mock mode: show only devices with IP addresses
    const mockMode = this.vm.mockMode;
    if (mockMode) return null;
    const visibleIndices = [];
    for (let i = 0; i < 4; i++) {
      const ipEl = document.getElementById(`device${i+1}-ip`);
      const ip = ipEl ? ipEl.value.trim() : '';
      if (ip) visibleIndices.push(i);
    }
    // May be empty (hide all)
    return visibleIndices;
  };

  MonitorBinding.prototype.attach = function(){
    const vm = this.vm;
    MeterRenderer.initMeter(document.getElementById('meter-container'));
    this._ensureWs();
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
          const rounded = Math.round(actualValue);
          el.textContent = String(rounded) + unit;
          // Machine-readable attributes for UI parsing
          el.setAttribute('data-actual', String(rounded));
          el.setAttribute('data-unit', unit);
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
    this._ws = null;
    this._wsTimer = null;
  }
  OverlayBinding.prototype._ensureWs = function(onState){
    if (this._ws && this._ws.readyState === WebSocket.OPEN) return this._ws;
    try {
      if (this._ws) { try { this._ws.close(); } catch(_){} this._ws = null; }
      const ws = new WebSocket('ws://127.0.0.1:8123');
      this._ws = ws;
      ws.onopen = () => { /* connected */ };
      ws.onclose = () => { if (this._wsTimer) clearTimeout(this._wsTimer); this._wsTimer = setTimeout(()=>this._ensureWs(onState), 1500); };
      ws.onerror = () => { try { ws.close(); } catch(_){} };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data || '{}');
          if (msg && msg.type === 'state' && msg.payload) {
            onState && onState(msg.payload);
          }
        } catch(_){}
      };
    } catch(_) {}
    if (!this._wsTimer) this._wsTimer = setTimeout(()=>this._ensureWs(onState), 1500);
    return this._ws;
  };
  OverlayBinding.prototype.attach = function(){
    const container = document.getElementById('meter-container');
    let initialized = false;

    // Ensure there is at least a placeholder meter so overlay is never blank
    try {
      MeterRenderer.initMeter(container);
      MeterRenderer.updateMeter([20,45,75,45], { names: ['','','',''], icon: 'assets/icon.svg', numbersOnly: true, textYOffset: 15 });
      initialized = !!container.querySelector('svg[data-meter]');
    } catch(e) {}

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
      nextGroups.forEach((ng) => {
        const key = ng.getAttribute('data-perf');
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

    // WebSocket receiver (preferred across OBS)
    const onWsState = (payload) => {
      if (payload && typeof payload.svg === 'string' && payload.svg) {
        if (!initialized) renderSvgFull(payload.svg); else patchSvg(payload.svg);
        return;
      }
      if (payload && Array.isArray(payload.values)) {
        const usedIcon = payload.icon || 'assets/icon.svg';
        MeterRenderer.updateMeter(payload.values.slice(0,4), { names: ['','','',''], icon: usedIcon, numbersOnly: true, textYOffset: 15 });
        initialized = true;
      }
    };
    this._ensureWs(onWsState);

    // Bridge polling (OBS/browser-source safe) as a fallback
    async function pollBridge(){
      try {
        const res = await fetch('http://127.0.0.1:8123/state', { cache: 'no-store' });
        if (!res || !res.ok) return;
        const d = await res.json();
        onWsState(d);
      } catch(_){ }
    }
    setInterval(pollBridge, 1500);
    pollBridge();
  };

  window.MVVM.Bindings = { MonitorBinding, OverlayBinding };
})();


