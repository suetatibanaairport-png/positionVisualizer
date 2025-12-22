// テスト用UI用JavaScriptコード
// このコードはテスト目的でのみ使用されます

console.log('テスト用UIが起動しました - このUIは本番環境では使用しないでください');

// アプリケーションの状態管理
const appState = {
    devices: {},            // デバイス情報を保持
    deviceValues: {},       // デバイスの値を保持（グローバルな状態として）
    selectedDeviceId: null, // 選択中のデバイスID
    chart: null,            // Chart.jsインスタンス
    socket: null,           // WebSocketコネクション
    isTestMode: true,       // テストモードフラグ
    simulation: {
        isEnabled: false,   // シミュレーションモード状態
        deviceCount: 3,     // シミュレーションデバイス数
        devices: []         // シミュレーションデバイスリスト
    }
};

// DOM要素
const elements = {
    scanButton: document.getElementById('scanButton'),
    scanStatus: document.getElementById('scanStatus'),
    deviceList: document.getElementById('deviceList'),
    currentValues: document.getElementById('currentValues'),
    deviceDetails: document.getElementById('deviceDetails'),
    modal: document.getElementById('modal'),
    closeModal: document.querySelector('.close'),
    renameForm: document.getElementById('renameForm'),
    deviceIdInput: document.getElementById('deviceId'),
    deviceNameInput: document.getElementById('deviceName'),

    // シミュレーション関連の要素
    simStatus: document.getElementById('simStatus'),
    toggleSimulation: document.getElementById('toggleSimulation'),
    deviceCount: document.getElementById('deviceCount'),
    updateDeviceCount: document.getElementById('updateDeviceCount'),
    simDeviceList: document.getElementById('simDeviceList'),
    addDevice: document.getElementById('addDevice'),
    removeDevice: document.getElementById('removeDevice'),
    removeDeviceById: document.getElementById('removeDeviceById')
};

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    console.log('テストUIを初期化中...');

    // テストモード表示
    const testBanner = document.createElement('div');
    testBanner.className = 'test-banner';
    testBanner.textContent = 'テスト用UI - 本番環境では使用しないでください';
    document.body.prepend(testBanner);

    // アプリケーション状態を初期化
    appState.devices = {};
    appState.deviceValues = {};
    appState.selectedDeviceId = null;
    appState.chart = null;
    appState.socket = null;
    appState.isTestMode = true;
    appState.simulation = {
        isEnabled: false,
        deviceCount: 3,
        devices: []
    };

    // UIコンポーネントを初期化
    initChart();
    setupEventListeners();

    // WebSocketとデータ取得を初期化
    initWebSocket();
    scanForDevices(); // 初回スキャン
    getSimulationStatus(); // シミュレーションモードのステータスを取得
});

// イベントリスナーの設定
function setupEventListeners() {
    // スキャンボタン
    elements.scanButton.addEventListener('click', scanForDevices);

    // モーダル関連
    elements.closeModal.addEventListener('click', () => {
        elements.modal.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target === elements.modal) {
            elements.modal.style.display = 'none';
        }
    });

    // デバイス名変更フォーム
    elements.renameForm.addEventListener('submit', (event) => {
        event.preventDefault();
        renameDevice();
    });

    // シミュレーションモード切り替えボタン
    elements.toggleSimulation.addEventListener('click', toggleSimulationMode);

    // デバイス数更新ボタン
    elements.updateDeviceCount.addEventListener('click', updateSimulationDeviceCount);

    // デバイス追加ボタン
    elements.addDevice.addEventListener('click', addSimulationDevice);

    // デバイス削除ボタン
    elements.removeDevice.addEventListener('click', removeSimulationDevice);

    // 特定のデバイスを削除ボタン
    elements.removeDeviceById.addEventListener('click', () => {
        // 削除するデバイスIDを入力するためのプロンプト
        const deviceId = prompt('削除するデバイスIDを入力してください（例: sim_2）');
        if (deviceId) {
            removeSpecificSimulationDevice(deviceId);
        }
    });
}

// デバイススキャン
async function scanForDevices() {
    try {
        elements.scanButton.disabled = true;
        elements.scanStatus.textContent = 'スキャン中...';
        elements.scanStatus.classList.add('scanning');

        const response = await fetch('/api/scan', {
            method: 'POST'
        });

        const result = await response.json();

        if (result.status === 'success') {
            await fetchDevices(); // デバイスリストを更新
            elements.scanStatus.textContent = `スキャン完了: ${result.devices_found}台の新規デバイスを発見`;
            setTimeout(() => {
                elements.scanStatus.textContent = '';
                elements.scanStatus.classList.remove('scanning');
            }, 3000);
        } else {
            elements.scanStatus.textContent = `エラー: ${result.message}`;
            elements.scanStatus.classList.remove('scanning');
        }
    } catch (error) {
        console.error('スキャン中にエラーが発生しました:', error);
        elements.scanStatus.textContent = 'スキャン失敗';
        elements.scanStatus.classList.remove('scanning');
    } finally {
        elements.scanButton.disabled = false;
    }
}

// デバイスリスト取得
async function fetchDevices() {
    try {
        const response = await fetch('/api/devices');
        const data = await response.json();

        // デバイス情報を更新
        data.devices.forEach(device => {
            appState.devices[device.id] = device;

            // オンラインデバイスをWebSocketで購読
            if (appState.socket && device.status === 'online') {
                appState.socket.emit('subscribe', { device_id: device.id });
                console.log(`デバイス ${device.id} を購読しました`);
            }
        });

        renderDeviceList();
    } catch (error) {
        console.error('デバイス情報の取得に失敗しました:', error);
    }
}

// デバイスリスト描画
function renderDeviceList() {
    const devices = Object.values(appState.devices);

    if (devices.length === 0) {
        elements.deviceList.innerHTML = '<p class="placeholder">デバイスが見つかりません</p>';
        return;
    }

    elements.deviceList.innerHTML = '';

    devices.forEach(device => {
        const deviceEl = document.createElement('div');
        deviceEl.className = `device-item ${device.status === 'online' ? '' : 'offline'} ${device.id === appState.selectedDeviceId ? 'selected' : ''}`;
        deviceEl.setAttribute('data-device-id', device.id);

        deviceEl.innerHTML = `
            <div class="device-info">
                <div class="device-name">${device.name}</div>
                <div class="device-id">${device.id}</div>
            </div>
            <span class="device-status status-${device.status}">${device.status}</span>
        `;

        deviceEl.addEventListener('click', () => selectDevice(device.id));
        elements.deviceList.appendChild(deviceEl);
    });
}

// デバイス選択
function selectDevice(deviceId) {
    appState.selectedDeviceId = deviceId;
    renderDeviceList();
    fetchDeviceDetails(deviceId);

    // WebSocketで該当デバイスを購読
    if (appState.socket && appState.devices[deviceId]?.status === 'online') {
        appState.socket.emit('subscribe', { device_id: deviceId });
        console.log(`デバイス ${deviceId} を購読しました`);
    }
}

// デバイス詳細取得
async function fetchDeviceDetails(deviceId) {
    try {
        const device = appState.devices[deviceId];
        if (!device) return;

        const detailsContent = elements.deviceDetails.querySelector('.details-content');

        if (device.status !== 'online') {
            detailsContent.innerHTML = `
                <p class="placeholder">デバイスはオフラインです</p>
            `;
            return;
        }

        detailsContent.innerHTML = `
            <div class="loading">詳細情報を取得中...</div>
        `;

        try {
            const response = await fetch(`/api/devices/${deviceId}/value`);
            const data = await response.json();

            detailsContent.innerHTML = `
                <div class="detail-column">
                    <div class="detail-group">
                        <h3>デバイスID</h3>
                        <div class="detail-value">${device.id}</div>
                    </div>
                    <div class="detail-group">
                        <h3>IPアドレス</h3>
                        <div class="detail-value">${device.ip}</div>
                    </div>
                    <div class="detail-group">
                        <h3>ステータス</h3>
                        <div class="detail-value status-${device.status}">${device.status}</div>
                    </div>
                </div>
                <div class="detail-column">
                    <div class="detail-group">
                        <h3>現在値</h3>
                        <div class="detail-value">${data.value}</div>
                    </div>
                    <div class="detail-group">
                        <h3>生値</h3>
                        <div class="detail-value">${data.raw || 'N/A'}</div>
                    </div>
                    <div class="detail-group">
                        <h3>最終更新</h3>
                        <div class="detail-value">${formatTimestamp(data.timestamp)}</div>
                    </div>
                </div>
            `;

            // デバイス操作ボタン
            const actions = document.createElement('div');
            actions.className = 'actions';
            actions.innerHTML = `
                <button class="button secondary rename-btn">名前の変更</button>
            `;
            detailsContent.appendChild(actions);

            // 名前変更ボタンのイベントリスナー
            const renameBtn = actions.querySelector('.rename-btn');
            renameBtn.addEventListener('click', () => showRenameModal(deviceId, device.name));

        } catch (error) {
            console.error('デバイス詳細の取得に失敗しました:', error);
            detailsContent.innerHTML = `
                <p class="placeholder">デバイス情報の取得に失敗しました</p>
            `;
        }

    } catch (error) {
        console.error('デバイス詳細の表示中にエラーが発生しました:', error);
    }
}

// 名前変更モーダル表示
function showRenameModal(deviceId, currentName) {
    elements.deviceIdInput.value = deviceId;
    elements.deviceNameInput.value = currentName;
    elements.modal.style.display = 'block';
}

// デバイス名変更
async function renameDevice() {
    const deviceId = elements.deviceIdInput.value;
    const newName = elements.deviceNameInput.value;

    if (!deviceId || !newName) return;

    try {
        const response = await fetch(`/api/devices/${deviceId}/name`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: newName })
        });

        const result = await response.json();

        if (result.status === 'success') {
            // デバイス名を更新
            if (appState.devices[deviceId]) {
                appState.devices[deviceId].name = newName;
                renderDeviceList();
                if (appState.selectedDeviceId === deviceId) {
                    fetchDeviceDetails(deviceId);
                }
            }
        } else {
            console.error('デバイス名の変更に失敗しました:', result.message);
        }
    } catch (error) {
        console.error('デバイス名の変更中にエラーが発生しました:', error);
    }

    elements.modal.style.display = 'none';
}


// 現在値表示の更新
function renderCurrentValues(values) {
    // 必ず最初にコンテナをクリア
    elements.currentValues.innerHTML = '';

    const valueIds = Object.keys(values);

    if (valueIds.length === 0) {
        elements.currentValues.innerHTML = '<p class="placeholder">データがありません</p>';
        return;
    }

    valueIds.forEach(deviceId => {
        const data = values[deviceId];
        // 無効なデータをスキップ
        if (!data) return;

        const card = document.createElement('div');
        card.className = 'value-card';

        // 有効なデータかフォールバック値を確保
        const name = data.name || deviceId;
        const value = data.value !== undefined ? data.value : 'N/A';
        const timestamp = data.timestamp || Date.now() / 1000;

        card.innerHTML = `
            <h3>${name}</h3>
            <div class="value-number">${value}</div>
            <div class="value-timestamp">${formatTimestamp(timestamp)}</div>
        `;

        elements.currentValues.appendChild(card);
    });
}

// グラフ初期化
function initChart() {
    const ctx = document.getElementById('leverChart').getContext('2d');

    appState.chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'レバー値（テスト用）',
                data: [],
                backgroundColor: 'rgba(54, 162, 235, 0.8)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: '値'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: 'レバー値グラフ（テスト用）'
                }
            }
        }
    });
}

// グラフ更新
function updateChart(values) {
    const devices = Object.keys(values).map(deviceId => values[deviceId]);

    if (devices.length === 0) return;

    appState.chart.data.labels = devices.map(device => device.name || device.device_id || 'Unknown');
    appState.chart.data.datasets[0].data = devices.map(device =>
        device.value !== undefined ? device.value : 0
    );
    appState.chart.update();
}

// WebSocketの初期化と接続
function initWebSocket() {
    // すでにソケットが存在する場合は切断して重複接続を避ける
    if (appState.socket) {
        appState.socket.disconnect();
        appState.socket = null;
    }

    // Socket.IOクライアントの作成
    appState.socket = io(`http://${window.location.hostname}:5001`);

    // 接続イベント
    appState.socket.on('connect', () => {
        console.log('WebSocketサーバーに接続しました');

        // 接続状態表示を追加（存在しない場合）
        if (!document.getElementById('connectionStatus')) {
            const statusEl = document.createElement('div');
            statusEl.id = 'connectionStatus';
            statusEl.className = 'connection-status connected';
            statusEl.textContent = '接続中';
            document.querySelector('.controls').appendChild(statusEl);
        } else {
            document.getElementById('connectionStatus').className = 'connection-status connected';
            document.getElementById('connectionStatus').textContent = '接続中';
        }
    });

    // 切断イベント
    appState.socket.on('disconnect', () => {
        console.log('WebSocketサーバーから切断されました');
        if (document.getElementById('connectionStatus')) {
            document.getElementById('connectionStatus').className = 'connection-status disconnected';
            document.getElementById('connectionStatus').textContent = '切断';
        }
    });

    // すべてのデバイス値の受信
    appState.socket.on('all_values', (values) => {
        console.log('すべてのデバイス値を受信:', values);

        // グローバルなデバイス値の状態を完全にリセットして更新
        appState.deviceValues = {}; // 一旦空にする

        // 有効なデータだけを追加
        if (values && typeof values === 'object') {
            Object.keys(values).forEach(deviceId => {
                if (values[deviceId]) {
                    appState.deviceValues[deviceId] = values[deviceId];
                }
            });
        }

        // UIを更新
        renderCurrentValues(appState.deviceValues);
        updateChart(appState.deviceValues);

        // デバイス情報を更新（オンラインステータス）
        Object.keys(appState.deviceValues).forEach(deviceId => {
            if (appState.devices[deviceId]) {
                appState.devices[deviceId].status = 'online';
            }
        });

        renderDeviceList();
    });

    // デバイス値の更新（リアルタイム）
    appState.socket.on('device_update', (update) => {
        console.log('デバイス更新:', update);

        // 有効なデータのチェック
        if (!update || !update.device_id || !update.data) {
            console.error('無効なデバイス更新データ:', update);
            return;
        }

        const { device_id, data } = update;

        // デバイスが表示リストに存在しない場合は、デバイス情報を取得
        if (!appState.devices[device_id]) {
            fetchDevices();
        }

        // グローバルなデバイス値の状態を更新
        appState.deviceValues[device_id] = data;

        // UIを更新（常に全体を再レンダリング）
        renderCurrentValues(appState.deviceValues);
        updateChart(appState.deviceValues);

        // 選択中デバイスの詳細を更新
        if (appState.selectedDeviceId === device_id) {
            fetchDeviceDetails(device_id);
        }
    });
}

// タイムスタンプのフォーマット
function formatTimestamp(timestamp) {
    if (!timestamp) return 'N/A';

    const date = new Date(timestamp * 1000);
    return date.toLocaleString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
}

// -------- シミュレーション機能の実装 --------

/**
 * シミュレーションモードの状態を取得
 */
async function getSimulationStatus() {
    try {
        const response = await fetch('/api/simulation/status');
        const data = await response.json();

        if (data.status === 'success') {
            appState.simulation.isEnabled = data.data.simulation_mode;
            appState.simulation.deviceCount = data.data.device_count;

            // UI更新
            updateSimulationUI();
        }

        if (appState.simulation.isEnabled) {
            // シミュレーションデバイスリストを取得
            getSimulationDevices();
        }

    } catch (error) {
        console.error('シミュレーションステータス取得エラー:', error);
    }
}

/**
 * シミュレーションデバイスリスト取得
 */
async function getSimulationDevices() {
    try {
        const response = await fetch('/api/simulation/devices');
        const data = await response.json();

        if (data.status === 'success') {
            appState.simulation.devices = data.data.devices;

            // シミュレーションデバイスリストのUI更新
            updateSimDeviceListUI();
        }

    } catch (error) {
        console.error('シミュレーションデバイス一覧取得エラー:', error);
    }
}

/**
 * シミュレーションモードの切り替え
 */
async function toggleSimulationMode() {
    try {
        elements.toggleSimulation.disabled = true;
        elements.toggleSimulation.textContent = '処理中...';

        const response = await fetch('/api/simulation/toggle', {
            method: 'POST'
        });
        const data = await response.json();

        if (data.status === 'success') {
            appState.simulation.isEnabled = data.data.simulation_mode;

            // UIを更新
            updateSimulationUI();

            // デバイスリストを更新
            await fetchDevices();

            if (appState.simulation.isEnabled) {
                // シミュレーションデバイスリストを取得
                getSimulationDevices();
            }

            console.log(`シミュレーションモードを${appState.simulation.isEnabled ? '有効' : '無効'}に切り替えました`);
        } else {
            alert(`エラー: ${data.message}`);
        }
    } catch (error) {
        console.error('シミュレーションモード切り替えエラー:', error);
        alert('シミュレーションモードの切り替えに失敗しました');
    } finally {
        elements.toggleSimulation.disabled = false;
        elements.toggleSimulation.textContent = '有効/無効の切り替え';
    }
}

/**
 * シミュレーション設定の更新（デバイス数）
 */
async function updateSimulationDeviceCount() {
    const count = parseInt(elements.deviceCount.value, 10);

    if (isNaN(count) || count < 1 || count > 20) {
        alert('デバイス数は1〜20の範囲で指定してください');
        return;
    }

    try {
        elements.updateDeviceCount.disabled = true;
        elements.updateDeviceCount.textContent = '更新中...';

        const response = await fetch('/api/simulation/config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ device_count: count })
        });
        const data = await response.json();

        if (data.status === 'success') {
            appState.simulation.deviceCount = data.data.device_count;

            // シミュレーションデバイスリストを更新
            getSimulationDevices();

            // デバイスリストを更新
            await fetchDevices();

            console.log(`シミュレーションデバイス数を${count}に更新しました`);
        } else {
            alert(`エラー: ${data.message}`);
        }
    } catch (error) {
        console.error('シミュレーションデバイス数更新エラー:', error);
        alert('シミュレーションデバイス数の更新に失敗しました');
    } finally {
        elements.updateDeviceCount.disabled = false;
        elements.updateDeviceCount.textContent = '更新';
    }
}

/**
 * シミュレーションデバイス追加
 */
async function addSimulationDevice() {
    if (!appState.simulation.isEnabled) {
        alert('シミュレーションモードが無効です');
        return;
    }

    try {
        elements.addDevice.disabled = true;
        elements.addDevice.textContent = '追加中...';

        const response = await fetch('/api/simulation/devices/add', {
            method: 'POST'
        });
        const data = await response.json();

        if (data.status === 'success') {
            appState.simulation.devices = data.data.simulation_devices;

            // UIを更新
            updateSimDeviceListUI();

            // デバイスリストを更新
            await fetchDevices();

            console.log(`シミュレーションデバイスを追加しました: ${data.data.added_device_id}`);
        } else {
            alert(`エラー: ${data.message}`);
        }
    } catch (error) {
        console.error('シミュレーションデバイス追加エラー:', error);
        alert('シミュレーションデバイスの追加に失敗しました');
    } finally {
        elements.addDevice.disabled = false;
        elements.addDevice.textContent = 'デバイスを追加';
    }
}

/**
 * シミュレーションデバイス削除（最新のデバイス）
 */
async function removeSimulationDevice() {
    if (!appState.simulation.isEnabled) {
        alert('シミュレーションモードが無効です');
        return;
    }

    try {
        elements.removeDevice.disabled = true;
        elements.removeDevice.textContent = '削除中...';

        const response = await fetch('/api/simulation/devices/remove', {
            method: 'POST'
        });
        const data = await response.json();

        if (data.status === 'success') {
            appState.simulation.devices = data.data.remaining_devices;

            // UIを更新
            updateSimDeviceListUI();

            // デバイスリストを更新
            await fetchDevices();

            console.log(`シミュレーションデバイスを削除しました: ${data.data.removed_device_id}`);
        } else {
            alert(`エラー: ${data.message}`);
        }
    } catch (error) {
        console.error('シミュレーションデバイス削除エラー:', error);
        alert('シミュレーションデバイスの削除に失敗しました');
    } finally {
        elements.removeDevice.disabled = false;
        elements.removeDevice.textContent = 'デバイスを削除';
    }
}

/**
 * 特定のシミュレーションデバイス削除
 */
async function removeSpecificSimulationDevice(deviceId) {
    if (!appState.simulation.isEnabled) {
        alert('シミュレーションモードが無効です');
        return;
    }

    if (!deviceId.startsWith('sim_')) {
        alert('有効なシミュレーションデバイスIDを指定してください（例: sim_2）');
        return;
    }

    try {
        elements.removeDeviceById.disabled = true;
        elements.removeDeviceById.textContent = '削除中...';

        const response = await fetch('/api/simulation/devices/remove', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ device_id: deviceId })
        });
        const data = await response.json();

        if (data.status === 'success') {
            appState.simulation.devices = data.data.remaining_devices;

            // UIを更新
            updateSimDeviceListUI();

            // デバイスリストを更新
            await fetchDevices();

            console.log(`シミュレーションデバイスを削除しました: ${data.data.removed_device_id}`);
        } else {
            alert(`エラー: ${data.message}`);
        }
    } catch (error) {
        console.error('シミュレーションデバイス削除エラー:', error);
        alert('シミュレーションデバイスの削除に失敗しました');
    } finally {
        elements.removeDeviceById.disabled = false;
        elements.removeDeviceById.textContent = '特定デバイスを削除';
    }
}

/**
 * シミュレーションUIの更新
 */
function updateSimulationUI() {
    // ステータスバッジ更新
    if (appState.simulation.isEnabled) {
        elements.simStatus.textContent = '有効';
        elements.simStatus.className = 'status-badge status-online';

        // デバイス管理UI有効化
        elements.deviceCount.disabled = false;
        elements.updateDeviceCount.disabled = false;
        elements.addDevice.disabled = false;
        elements.removeDevice.disabled = false;
        elements.removeDeviceById.disabled = false;

        // デバイス数の値を設定
        elements.deviceCount.value = appState.simulation.deviceCount;

        // デバイスリスト表示を更新
        updateSimDeviceListUI();
    } else {
        elements.simStatus.textContent = '無効';
        elements.simStatus.className = 'status-badge status-offline';

        // デバイス管理UI無効化
        elements.deviceCount.disabled = true;
        elements.updateDeviceCount.disabled = true;
        elements.addDevice.disabled = true;
        elements.removeDevice.disabled = true;
        elements.removeDeviceById.disabled = true;

        // デバイスリスト表示をクリア
        elements.simDeviceList.innerHTML = '<p class="placeholder">シミュレーションモードが無効です</p>';
    }
}

/**
 * シミュレーションデバイスリストUIの更新
 */
function updateSimDeviceListUI() {
    if (!appState.simulation.isEnabled) {
        elements.simDeviceList.innerHTML = '<p class="placeholder">シミュレーションモードが無効です</p>';
        return;
    }

    if (appState.simulation.devices.length === 0) {
        elements.simDeviceList.innerHTML = '<p class="placeholder">シミュレーションデバイスがありません</p>';
        return;
    }

    elements.simDeviceList.innerHTML = '';

    // デバイスリストを表示
    appState.simulation.devices.forEach(device => {
        const deviceItem = document.createElement('div');
        deviceItem.className = 'sim-device-item';
        deviceItem.innerHTML = `
            <div class="device-info">
                <span class="device-name">${device.name}</span>
                <span class="device-id">(${device.id})</span>
            </div>
            <div class="device-ip">${device.ip}</div>
        `;

        elements.simDeviceList.appendChild(deviceItem);
    });
}