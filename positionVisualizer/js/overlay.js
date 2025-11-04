(function(){
  function startVersionWatcher() {
    let lastHash = null;
    function hashString(s){
      let h = 5381; for (let i=0;i<s.length;i++){ h = ((h<<5)+h) ^ s.charCodeAt(i); } return (h>>>0).toString(16);
    }
    async function checkOnce(){
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('_v', String(Date.now()));
        const res = await fetch(url.toString(), { cache: 'no-store' });
        if (!res.ok) return;
        const text = await res.text();
        const sig = hashString(text);
        if (lastHash === null) { lastHash = sig; return; }
        if (sig !== lastHash) {
          window.location.reload();
        }
      } catch(_) {}
    }
    setInterval(checkOnce, 3000);
    checkOnce();
  }
  startVersionWatcher();

  if (window.USE_MVVM) {
    const { MeterState, MeterViewModel, Bindings } = window.MVVM;
    window.addEventListener('DOMContentLoaded', () => {
      const vm = new MeterViewModel(new MeterState([20,45,75,45], ['','','',''], 'assets/icon.svg'));
      const binding = new Bindings.OverlayBinding(vm);
      binding.attach();
    });
    return;
  }
  const url = new URL(window.location.href);
  const icon = url.searchParams.get('icon') || 'assets/icon.svg';
  const namesParam = url.searchParams.get('names');
  let names = ['出演者1','出演者2','出演者3','出演者4'];
  if (namesParam) {
    try {
      const parsed = JSON.parse(namesParam);
      if (Array.isArray(parsed) && parsed.length) names = parsed.slice(0,4);
    } catch(e) {}
  }

  function init() {
    MeterRenderer.initMeter(document.getElementById('meter-container'));
    // initial placeholder
    MeterRenderer.updateMeter([20,45,75,45], { names: ['','','',''], icon, numbersOnly: true, textYOffset: 15 });
    // Also try to load the last known state from localStorage
    readFromLocalStorage();
  }

  // Listen for broadcasts from the main UI
  let ch;
  try { ch = new BroadcastChannel('meter-overlay'); } catch(e) { ch = null; }
  if (ch) {
    ch.onmessage = (ev) => {
      const data = ev.data || {};
      if (Array.isArray(data.values)) {
        if (Array.isArray(data.names)) names = data.names.slice(0,4);
        const usedIcon = data.icon || icon;
        MeterRenderer.updateMeter(data.values.slice(0,4), { names: ['','','',''], icon: usedIcon, numbersOnly: true, textYOffset: 15 });
      }
    };
  }

  // localStorage-based sync
  function readFromLocalStorage() {
    try {
      const raw = localStorage.getItem('meter-state');
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.values)) return;
      if (Array.isArray(data.names)) names = data.names.slice(0,4);
      const usedIcon = data.icon || icon;
      MeterRenderer.updateMeter(data.values.slice(0,4), { names: ['','','',''], icon: usedIcon, numbersOnly: true, textYOffset: 15 });
    } catch(e) {}
  }

  window.addEventListener('storage', (e) => {
    if (e.key === 'meter-state') {
      readFromLocalStorage();
    }
  });

  // Polling localStorage periodically (OBS may block storage events)
  setInterval(readFromLocalStorage, 700);

  // WebSocket bridge (preferred)
  function startWs(){
    try {
      const ws = new WebSocket('ws://127.0.0.1:8123');
      ws.onmessage = (ev)=>{
        try {
          const msg = JSON.parse(ev.data || '{}');
          if (msg && msg.type === 'state' && msg.payload) {
            const d = msg.payload;
            if (d && typeof d.svg === 'string' && d.svg) {
              const container = document.getElementById('meter-container');
              if (container) container.innerHTML = d.svg;
              return;
            }
            if (d && Array.isArray(d.values)) {
              const usedIcon = d.icon || icon;
              MeterRenderer.updateMeter(d.values.slice(0,4), { names: ['','','',''], icon: usedIcon, numbersOnly: true, textYOffset: 15 });
            }
          }
        } catch(_){}
      };
      ws.onclose = ()=>{ setTimeout(startWs, 1500); };
      ws.onerror = ()=>{ try { ws.close(); } catch(_){} };
    } catch(_) { setTimeout(startWs, 1500); }
  }
  startWs();

  // Bridge polling (works across OBS browser source)
  async function pollBridge(){
    try {
      const res = await fetch('http://127.0.0.1:8123/state', { cache: 'no-store' });
      if (!res || !res.ok) return;
      const d = await res.json();
      if (d && typeof d.svg === 'string' && d.svg) {
        const container = document.getElementById('meter-container');
        if (container) container.innerHTML = d.svg;
        return;
      }
      if (d && Array.isArray(d.values)) {
        const usedIcon = d.icon || icon;
        MeterRenderer.updateMeter(d.values.slice(0,4), { names: ['','','',''], icon: usedIcon, numbersOnly: true, textYOffset: 15 });
      }
    } catch(_){}
  }
  setInterval(pollBridge, 1500);
  pollBridge();

  window.addEventListener('DOMContentLoaded', init);
  
})();


