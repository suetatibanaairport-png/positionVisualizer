// テスト用UI用JavaScriptコード
// このコードはテスト目的でのみ使用されます

console.log('テスト用UIが起動しました - このUIは本番環境では使用しないでください');

// アプリケーションの状態管理
const appState = {
    devices: {},            // デバイス情報を保持
    selectedDeviceId: null, // 選択中のデバイスID
    chart: null,            // Chart.jsインスタンス
    socket: null,           // WebSocketコネクション
    isTestMode: true        // テストモードフラグ
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
};

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    console.log('テストUIを初期化中...');

    // テストモード表示
    const testBanner = document.createElement('div');
    testBanner.className = 'test-banner';
    testBanner.textContent = 'テスト用UI - 本番環境では使用しないでください';
    document.body.prepend(testBanner);

    initChart();
    setupEventListeners();
    initWebSocket();
    scanForDevices(); // 初回スキャン
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
    const valueIds = Object.keys(values);

    if (valueIds.length === 0) {
        elements.currentValues.innerHTML = '<p class="placeholder">データがありません</p>';
        return;
    }

    elements.currentValues.innerHTML = '';

    valueIds.forEach(deviceId => {
        const data = values[deviceId];
        const card = document.createElement('div');
        card.className = 'value-card';

        card.innerHTML = `
            <h3>${data.name}</h3>
            <div class="value-number">${data.value}</div>
            <div class="value-timestamp">${formatTimestamp(data.timestamp)}</div>
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

    appState.chart.data.labels = devices.map(device => device.name);
    appState.chart.data.datasets[0].data = devices.map(device => device.value);
    appState.chart.update();
}

// WebSocketの初期化と接続
function initWebSocket() {
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

        renderCurrentValues(values);
        updateChart(values);

        // デバイス情報を更新（オンラインステータス）
        Object.keys(values).forEach(deviceId => {
            if (appState.devices[deviceId]) {
                appState.devices[deviceId].status = 'online';
            }
        });

        renderDeviceList();
    });

    // デバイス値の更新（リアルタイム）
    appState.socket.on('device_update', (update) => {
        console.log('デバイス更新:', update);
        const { device_id, data } = update;

        // デバイスが表示リストに存在しない場合は、デバイス情報を取得
        if (!appState.devices[device_id]) {
            fetchDevices();
        }

        // 値を更新
        const values = {};
        values[device_id] = data;

        renderCurrentValues(values);
        updateChart(values);

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