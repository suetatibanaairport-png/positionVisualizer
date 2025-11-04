(function(){
  let frames = [];
  let timer = null;
  let frameIndex = 0;
  let intervalMs = 200;

  function inferInterval(sorted) {
    if (sorted.length < 2) return 200;
    const deltas = [];
    for (let i=1;i<sorted.length;i++) deltas.push(sorted[i].ts - sorted[i-1].ts);
    deltas.sort((a,b)=>a-b);
    return Math.max(20, deltas[Math.floor(deltas.length/2)] || 200);
  }

  function parseLogArray(arr) {
    // rr: [{ id, value, ts }]
    const byTs = new Map();
    const ids = new Set();
    arr.forEach(r=>{
      if (!r) return; const id = Number(r.id); const v = Number(r.value); const ts = Number(r.ts);
      if (!Number.isFinite(id) || !Number.isFinite(v) || !Number.isFinite(ts)) return;
      ids.add(id);
      if (!byTs.has(ts)) byTs.set(ts, new Map());
      byTs.get(ts).set(id, Math.max(0, Math.min(100, v)));
    });
    const sortedTs = Array.from(byTs.keys()).sort((a,b)=>a-b);
    intervalMs = inferInterval(sortedTs.map(ts=>({ts})));
    const idList = Array.from(ids).sort((a,b)=>a-b).slice(0,4);
    // carry-forward values
    const lastVals = new Map();
    frames = sortedTs.map(ts=>{
      const m = byTs.get(ts);
      idList.forEach(id=>{ if (m.has(id)) lastVals.set(id, m.get(id)); });
      const values = [0,0,0,0];
      for (let i=0;i<idList.length;i++) {
        values[i] = lastVals.has(idList[i]) ? lastVals.get(idList[i]) : 0;
      }
      return { ts, values };
    });
  }

  function loadFile(file, cb){
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (Array.isArray(data)) parseLogArray(data);
        else if (Array.isArray(data.records)) parseLogArray(data.records);
        else throw new Error('Invalid log format');
        cb && cb(null, { framesCount: frames.length, intervalMs });
      } catch (e) { cb && cb(e); }
    };
    reader.onerror = () => cb && cb(reader.error || new Error('Failed to read file'));
    reader.readAsText(file);
  }

  function stop(){ if (timer) { clearInterval(timer); timer = null; } }

  function play(){
    if (!window.AppVM || !frames.length) return;
    window.AppVM.stop(); // stop VM timers
    frameIndex = 0;
    const step = () => {
      if (frameIndex >= frames.length) { stop(); return; }
      const vals = frames[frameIndex].values;
      for (let i=0;i<Math.min(vals.length,4);i++) window.AppVM.setValue(i, vals[i]);
      frameIndex++;
    };
    stop();
    step();
    timer = setInterval(step, intervalMs);
  }

  window.Replay = { loadFile, play, stop };
})();


