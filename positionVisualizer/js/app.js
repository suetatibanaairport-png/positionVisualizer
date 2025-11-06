(function () {
  if (window.USE_MVVM) {
    const { MeterState, MeterViewModel, Bindings } = window.MVVM;
    window.addEventListener('DOMContentLoaded', () => {
      const initial = new MeterState(
        [],
        [
          document.getElementById('device1-name')?.value || '',
          document.getElementById('device2-name')?.value || '',
          document.getElementById('device3-name')?.value || '',
          document.getElementById('device4-name')?.value || '',
          document.getElementById('device5-name')?.value || '',
          document.getElementById('device6-name')?.value || ''
        ],
        'assets/icon.svg'
      );
      const vm = new MeterViewModel(initial);
      // expose VM for replay controller
      window.AppVM = vm;

      // Bind UI -> VM
      document.getElementById('start-btn').addEventListener('click', () => vm.start());
      document.getElementById('stop-btn').addEventListener('click', () => vm.stop());
      document.getElementById('clear-history-btn').addEventListener('click', () => {
        const el = document.getElementById('history-content'); el.innerHTML = '';
      });
      ['device1-name','device2-name','device3-name','device4-name','device5-name','device6-name'].forEach((id, idx) => {
        const el = document.getElementById(id);
        if (!el) return;
        const handler = () => vm.setName(idx, el.value);
        el.addEventListener('input', handler); el.addEventListener('change', handler);
      });
      const mockToggle = document.getElementById('mock-mode');
      const manualBox = document.getElementById('manual-controls');
      mockToggle.addEventListener('change', () => { 
        vm.setMockMode(mockToggle.checked); 
        manualBox.style.display = mockToggle.checked ? '' : 'none'; 
        if (mockToggle.checked) vm.stop();
        // Trigger update to refresh visible icons based on mock mode
        vm._notify();
      });
      
      // Listen to IP address changes to update visible icons
      ['device1-ip', 'device2-ip', 'device3-ip', 'device4-ip','device5-ip','device6-ip'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
          el.addEventListener('input', () => {
            if (!vm.mockMode) {
              // Trigger update when IP changes in non-mock mode
              vm._notify();
            }
          });
          el.addEventListener('change', () => {
            if (!vm.mockMode) {
              // Trigger update when IP changes in non-mock mode
              vm._notify();
            }
          });
        }
      });
      const pollInput = document.getElementById('poll-interval');
      if (pollInput) pollInput.addEventListener('change', () => vm.setPollInterval(pollInput.value));
      
      // Range settings
      const minValueInput = document.getElementById('min-value');
      const maxValueInput = document.getElementById('max-value');
      const unitInput = document.getElementById('value-unit');
      
      if (minValueInput) {
        minValueInput.addEventListener('change', () => {
          vm.setMinValue(minValueInput.value);
          updateSliderRanges(vm);
        });
        minValueInput.addEventListener('input', () => {
          vm.setMinValue(minValueInput.value);
          updateSliderRanges(vm);
        });
      }
      
      if (maxValueInput) {
        maxValueInput.addEventListener('change', () => {
          vm.setMaxValue(maxValueInput.value);
          updateSliderRanges(vm);
        });
        maxValueInput.addEventListener('input', () => {
          vm.setMaxValue(maxValueInput.value);
          updateSliderRanges(vm);
        });
      }
      
      if (unitInput) {
        unitInput.addEventListener('change', () => vm.setUnit(unitInput.value));
        unitInput.addEventListener('input', () => vm.setUnit(unitInput.value));
      }
      
      // Update slider ranges based on min/max values
      function updateSliderRanges(vm) {
        ['slider1','slider2','slider3','slider4'].forEach((id, idx) => {
          const el = document.getElementById(id);
          if (el) {
            el.min = vm.minValue;
            el.max = vm.maxValue;
            el.step = (vm.maxValue - vm.minValue) / 1000; // Fine step
            // Update current value to stay within new range
            const currentActual = vm.getActualValue(idx);
            const clamped = Math.max(vm.minValue, Math.min(vm.maxValue, currentActual));
            vm.setValue(idx, clamped);
          }
        });
      }
      
      // Per-device icon uploads
      [['device1-icon',0],['device2-icon',1],['device3-icon',2],['device4-icon',3],['device5-icon',4],['device6-icon',5]].forEach(([id, idx]) => {
        const input = document.getElementById(id);
        if (!input) return;
        input.addEventListener('change', () => {
          const file = input.files && input.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = String(reader.result || '');
            if (dataUrl) vm.setIconAt(idx, dataUrl);
          };
          reader.readAsDataURL(file);
        });
      });

      ['slider1','slider2','slider3','slider4'].forEach((id, idx) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('input', (e) => {
          // Slider value is in actual range, convert to normalized
          const actualValue = Number(e.target.value);
          vm.setValue(idx, actualValue);
        });
      });

      // Sync initial mock mode from checkbox BEFORE first render
      vm.setMockMode(mockToggle.checked);
      // In mock mode, show four dummy icons/values; otherwise, start empty
      if (mockToggle.checked) {
        [20,45,75,45].forEach((v, i) => vm.setValue(i, v));
      }

      // View + Sync
      const binding = new Bindings.MonitorBinding(vm);
      binding.attach();
      
      // Initialize slider ranges and values
      updateSliderRanges(vm);
      ['slider1','slider2','slider3','slider4'].forEach((id, idx) => {
        const el = document.getElementById(id);
        if (el) {
          const actualValue = vm.getActualValue(idx);
          el.value = actualValue;
        }
      });

      // Append history when running non-mock
      vm.onChange((state) => {
        if (vm.running && !vm.mockMode) {
          const el = document.getElementById('history-content');
          const row = document.createElement('div');
          const actualValues = vm.getActualValues();
          const unit = vm.unit || '%';
          row.textContent = `${new Date().toLocaleTimeString()} - ${actualValues.map(v => Math.round(v) + unit).join(', ')}`;
          el.prepend(row);
          while (el.children.length > 100) el.removeChild(el.lastChild);
        }
      });

      // Initial manual panel visibility
      manualBox.style.display = mockToggle.checked ? '' : 'none';

      // Replay controls
      const logFile = document.getElementById('log-file');
      const playBtn = document.getElementById('play-log');
      const stopBtn = document.getElementById('stop-log');
      if (playBtn && logFile) {
        playBtn.addEventListener('click', () => {
          const f = logFile.files && logFile.files[0];
          if (!f) return alert('ログファイル（JSON）を選択してください');
          Replay.loadFile(f, (err, meta) => {
            if (err) { alert('読み込み失敗: ' + err.message); return; }
            vm.setMockMode(true); // manual-like
            Replay.play();
          });
        });
      }
      if (stopBtn) stopBtn.addEventListener('click', () => Replay.stop());
    });
    return; // prevent legacy code below from running
  }
  let running = false;
  let unsubscribe = null;
  let names = ['出演者1','出演者2','出演者3','出演者4'];
  let manualValues = [20, 45, 75, 45];
  let bc;
  try { bc = new BroadcastChannel('meter-overlay'); } catch(e) { bc = null; }

  function broadcast(values) {
    if (bc) {
      bc.postMessage({ values: values.slice(0,4), names, icon: 'assets/icon.svg' });
    }
    try {
      localStorage.setItem('meter-state', JSON.stringify({
        values: values.slice(0,4),
        names,
        icon: 'assets/icon.svg',
        ts: Date.now()
      }));
    } catch(e) {}
    // (Reverted) No Service Worker relay
  }

  function appendHistory(values) {
    const el = document.getElementById('history-content');
    const row = document.createElement('div');
    row.textContent = `${new Date().toLocaleTimeString()} - ${values.map(v => Math.round(v)).join(', ')}`;
    el.prepend(row);
    while (el.children.length > 100) el.removeChild(el.lastChild);
  }

  function readNamesFromInputs() {
    names = [
      document.getElementById('device1-name')?.value || '出演者1',
      document.getElementById('device2-name')?.value || '出演者2',
      document.getElementById('device3-name')?.value || '出演者3',
      document.getElementById('device4-name')?.value || '出演者4',
    ];
  }

  function start() {
    if (running) return;
    running = true;
    readNamesFromInputs();
    const poll = Number(document.getElementById('poll-interval').value) || 200;
    const mock = document.getElementById('mock-mode').checked;

    MeterRenderer.initMeter(document.getElementById('meter-container'));

    if (mock) {
      // Manual mode: just render current slider values, no interval
      MeterRenderer.updateMeter(manualValues, { names, icon: 'assets/icon.svg' });
      broadcast(manualValues);
      unsubscribe = null;
    } else {
      // TODO: implement real device polling via provided IPs
      MockData.startMock((values) => {
        MeterRenderer.updateMeter(values, { names, icon: 'assets/icon.svg' });
        appendHistory(values);
        broadcast(values);
      }, poll);
      unsubscribe = () => MockData.stopMock();
    }
  }

  function stop() {
    if (!running) return;
    running = false;
    if (unsubscribe) unsubscribe();
    unsubscribe = null;
  }

  function clearHistory() {
    const el = document.getElementById('history-content');
    el.innerHTML = '';
  }

  function bindUI() {
    document.getElementById('start-btn').addEventListener('click', start);
    document.getElementById('stop-btn').addEventListener('click', stop);
    document.getElementById('clear-history-btn').addEventListener('click', clearHistory);
    ['device1-name','device2-name','device3-name','device4-name'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', readNamesFromInputs);
    });

    const mockToggle = document.getElementById('mock-mode');
    const manualBox = document.getElementById('manual-controls');

    function applyNamesToLabels() {
      document.getElementById('slider1-label').childNodes[0].nodeValue = `${names[0]}: `;
      document.getElementById('slider2-label').childNodes[0].nodeValue = `${names[1]}: `;
      document.getElementById('slider3-label').childNodes[0].nodeValue = `${names[2]}: `;
      document.getElementById('slider4-label').childNodes[0].nodeValue = `${names[3]}: `;
    }

    function syncSlidersToValues() {
      const sliders = [
        { s: 'slider1', v: 'slider1-value', i: 0 },
        { s: 'slider2', v: 'slider2-value', i: 1 },
        { s: 'slider3', v: 'slider3-value', i: 2 },
        { s: 'slider4', v: 'slider4-value', i: 3 },
      ];
      sliders.forEach(({ s, v, i }) => {
        const el = document.getElementById(s);
        const valEl = document.getElementById(v);
        if (el && valEl) {
          el.value = String(manualValues[i]);
          valEl.textContent = String(Math.round(manualValues[i]));
        }
      });
    }

    function bindManualEvents() {
      ['slider1','slider2','slider3','slider4'].forEach((id, idx) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('input', (e) => {
          const val = Number(e.target.value);
          manualValues[idx] = val;
          document.getElementById(`slider${idx+1}-value`).textContent = String(Math.round(val));
          MeterRenderer.updateMeter(manualValues, { names, icon: 'assets/icon.svg' });
        broadcast(manualValues);
        });
      });
    }

    mockToggle.addEventListener('change', () => {
      const isMock = mockToggle.checked;
      if (isMock) {
        manualBox.style.display = '';
        readNamesFromInputs();
        applyNamesToLabels();
        syncSlidersToValues();
        MeterRenderer.updateMeter(manualValues, { names, icon: 'assets/icon.svg' });
        broadcast(manualValues);
        stop(); // ensure no intervals running
      } else {
        manualBox.style.display = 'none';
        stop();
      }
    });

    // Keep labels in sync when names change
    ['device1-name','device2-name','device3-name','device4-name'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', () => {
        readNamesFromInputs();
        applyNamesToLabels();
        MeterRenderer.updateMeter(manualValues, { names, icon: 'assets/icon.svg' });
        broadcast(manualValues);
      });
    });

    applyNamesToLabels();
    bindManualEvents();
    // initial visibility
    manualBox.style.display = mockToggle.checked ? '' : 'none';
  }

  window.addEventListener('DOMContentLoaded', () => {
    bindUI();
    // 初期描画
    MeterRenderer.initMeter(document.getElementById('meter-container'));
    MeterRenderer.updateMeter([20, 45, 75, 45], { names, icon: 'assets/icon.svg' });
    broadcast([20,45,75,45]);
  });
})();

// デバイス管理と状態
const devices = [];
const MAX_DEVICES = 4;
let pollInterval = 200;
let pollTimer = null;
let history = [];
let mockMode = true;

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    initializeMeter();
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('start-btn').addEventListener('click', startPolling);
    document.getElementById('stop-btn').addEventListener('click', stopPolling);
    document.getElementById('clear-history-btn').addEventListener('click', clearHistory);
    document.getElementById('poll-interval').addEventListener('change', (e) => {
        pollInterval = parseInt(e.target.value);
        if (pollTimer) {
            stopPolling();
            startPolling();
        }
    });
    
    const mockModeCheckbox = document.getElementById('mock-mode');
    mockModeCheckbox.addEventListener('change', (e) => {
        mockMode = e.target.checked;
        updateModeUI();
    });
    updateModeUI();
}

function updateModeUI() {
    const container = document.querySelector('.container');
    const ipInputs = document.querySelectorAll('.device-ip');
    
    if (mockMode) {
        container.classList.add('mock-mode');
        ipInputs.forEach(input => {
            input.disabled = false;
        });
    } else {
        container.classList.remove('mock-mode');
        ipInputs.forEach(input => {
            input.disabled = false;
        });
    }
}

// ポーリング開始
function startPolling() {

    mockMode = document.getElementById('mock-mode').checked;
    

    devices.length = 0;
    for (let i = 1; i <= MAX_DEVICES; i++) {
        const ip = document.getElementById(`device${i}-ip`).value.trim();
        const name = document.getElementById(`device${i}-name`).value.trim() || `出演者${i}`;
        
        if (mockMode) {
            if (name) {
                devices.push(createMockDevice(i, name));
            }
        } else {
        if (ip) {
            devices.push({
                id: i,
                ip: ip,
                name: name,
                value: 0,
                percentage: 0,
                active: true,
                lastUpdate: null
            });
            }
        }
    }

    if (devices.length === 0) {
        if (mockMode) {
            alert('少なくとも1つの出演者名を入力してください。');
        } else {
        alert('少なくとも1つのデバイスIPを入力してください。');
        }
        return;
    }

    const iconsContainer = document.getElementById('icons-container');
    iconsContainer.innerHTML = '';

    devices.forEach(device => {
        createIcon(device);
    });


    pollTimer = setInterval(pollAllDevices, pollInterval);
    pollAllDevices();

    document.getElementById('start-btn').disabled = true;
    document.getElementById('stop-btn').disabled = false;
}

// ポーリング停止
function stopPolling() {
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
    document.getElementById('start-btn').disabled = false;
    document.getElementById('stop-btn').disabled = true;
}

// 全デバイスをポーリング
async function pollAllDevices() {
    const promises = devices.map(device => pollDevice(device));
    await Promise.all(promises);
    updateDisplay(); // iconRenderer.jsの関数を使用
}

// 個別デバイスのポーリング
async function pollDevice(device) {
    if (mockMode && isMockDevice(device.ip)) {
        return pollDeviceMock(device, addHistory);
    } else {
        return pollDeviceReal(device);
    }
}

async function pollDeviceReal(device) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1000);
        
        const response = await fetch(`http://${device.ip}/api`, {
            method: 'GET',
            mode: 'cors',
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const calibratedValue = parseFloat(data.calibrated_value || 0);
        
        // 値が変化した場合のみ更新
        if (Math.abs(device.value - calibratedValue) > 0.01) {
            const oldValue = device.value;
            device.value = calibratedValue;
            // レバー角度40°〜140°を0〜100％に変換（既にcalibrated_valueで変換済みの場合も考慮）
            device.percentage = Math.max(0, Math.min(100, calibratedValue));
            device.lastUpdate = new Date();
            
            // 履歴に記録（値が変化した場合のみ）
            if (Math.abs(oldValue - calibratedValue) > 0.5) {
                addHistory(device.name, oldValue, calibratedValue);
            }
        }
    } catch (error) {
        console.error(`デバイス ${device.name} (${device.ip}) のポーリングエラー:`, error);
    }
}

// 表示更新（iconRenderer.jsの関数を使用）
function updateDisplay() {
    updateIconDisplay(devices);
}

// 履歴に追加
function addHistory(deviceName, oldValue, newValue) {
    const entry = {
        timestamp: new Date(),
        deviceName: deviceName,
        oldValue: oldValue,
        newValue: newValue
    };
    
    history.unshift(entry); // 最新を先頭に
    
    // 履歴は最大100件まで保持
    if (history.length > 100) {
        history = history.slice(0, 100);
    }
    
    updateHistoryDisplay();
}

// 履歴表示を更新
function updateHistoryDisplay() {
    const historyContent = document.getElementById('history-content');
    historyContent.innerHTML = '';
    
    history.slice(0, 50).forEach(entry => { // 最新50件を表示
        const entryDiv = document.createElement('div');
        entryDiv.className = 'history-entry';
        
        const timeStr = entry.timestamp.toLocaleTimeString('ja-JP');
        const changeStr = entry.oldValue !== undefined 
            ? `${entry.oldValue.toFixed(1)}% → ${entry.newValue.toFixed(1)}%`
            : `${entry.newValue.toFixed(1)}%`;
        
        entryDiv.innerHTML = `
            <span class="time">${timeStr}</span>
            <span class="device-name">${entry.deviceName}</span>
            <span class="value">${changeStr}</span>
        `;
        
        historyContent.appendChild(entryDiv);
    });
}

// 履歴をクリア
function clearHistory() {
    history = [];
    updateHistoryDisplay();
}

