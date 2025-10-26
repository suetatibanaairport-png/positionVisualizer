# encoder_monitor_qt_full_dark_led_stable.py
# ダークテーマ + Static 4 Panels（破棄しない）+ LED制御 + 安定通信（Session再利用・位相ずらし・重複禁止）
import sys, json, socket, time, concurrent.futures, threading
from functools import partial

# ==== Qt 互換レイヤ ====
qt_api = None
try:
    from PySide6 import QtCore, QtGui, QtWidgets
    from matplotlib.backends.backend_qtagg import FigureCanvasQTAgg as FigureCanvas
    qt_api = "PySide6"
except Exception:
    from PyQt5 import QtCore, QtGui, QtWidgets
    from matplotlib.backends.backend_qt5agg import FigureCanvasQTAgg as FigureCanvas
    qt_api = "PyQt5"

import requests
from matplotlib.figure import Figure
import matplotlib as mpl

DISCOVERY_PORT = 4210
DISCOVERY_TOKEN = b"DISCOVER_ENCODER"

# ---------- ダークテーマ適用（Qt） ----------
def apply_qt_dark(app: "QtWidgets.QApplication"):
    app.setStyle("Fusion")
    pal = QtGui.QPalette()
    bg        = QtGui.QColor("#121212")
    base      = QtGui.QColor("#1E1E1E")
    alt_base  = QtGui.QColor("#242424")
    text      = QtGui.QColor("#DDDDDD")
    disabled  = QtGui.QColor("#888888")
    button    = QtGui.QColor("#2A2A2A")
    highlight = QtGui.QColor("#3D6FB4")
    link      = QtGui.QColor("#4EA1FF")
    pal.setColor(QtGui.QPalette.Window, bg)
    pal.setColor(QtGui.QPalette.WindowText, text)
    pal.setColor(QtGui.QPalette.Base, base)
    pal.setColor(QtGui.QPalette.AlternateBase, alt_base)
    pal.setColor(QtGui.QPalette.ToolTipBase, base)
    pal.setColor(QtGui.QPalette.ToolTipText, text)
    pal.setColor(QtGui.QPalette.Text, text)
    pal.setColor(QtGui.QPalette.Disabled, QtGui.QPalette.Text, disabled)
    pal.setColor(QtGui.QPalette.Button, button)
    pal.setColor(QtGui.QPalette.ButtonText, text)
    pal.setColor(QtGui.QPalette.BrightText, QtCore.Qt.red)
    pal.setColor(QtGui.QPalette.Link, link)
    pal.setColor(QtGui.QPalette.Highlight, highlight)
    pal.setColor(QtGui.QPalette.HighlightedText, QtGui.QColor("#FFFFFF"))
    app.setPalette(pal)
    app.setStyleSheet("""
    QToolTip { color: #ddd; background: #2a2a2a; border: 1px solid #3d3d3d; }
    QLineEdit, QTextEdit, QSpinBox, QComboBox { border: 1px solid #3a3a3a; border-radius: 4px; padding: 4px; }
    QPushButton { border: 1px solid #3a3a3a; border-radius: 4px; padding: 6px 10px; background: #2a2a2a; }
    QPushButton:hover { background: #333333; }
    QTableWidget QHeaderView::section { background:#1a1a1a; color:#ddd; border: 1px solid #333; padding: 4px; }
    QSlider::groove:horizontal { height: 6px; background: #2a2a2a; border: 1px solid #3a3a3a; border-radius: 3px; }
    QSlider::handle:horizontal { background: #3D6FB4; border: 1px solid #3a3a3a; width: 14px; margin: -5px 0; border-radius: 7px; }
    """)

# ---------- 日本語フォント（matplotlib）＋ダーク配色 ----------
def set_mpl_dark_cjk():
    mpl.rcParams["axes.unicode_minus"] = False
    mpl.rcParams["font.family"] = "sans-serif"
    mpl.rcParams["font.sans-serif"] = ["Yu Gothic UI", "Meiryo", "Noto Sans CJK JP", "MS Gothic", "IPAGothic"]
    mpl.rcParams["figure.facecolor"] = "#121212"
    mpl.rcParams["axes.facecolor"]   = "#121212"
    mpl.rcParams["savefig.facecolor"]= "#121212"
    mpl.rcParams["text.color"]       = "#DDDDDD"
    mpl.rcParams["axes.labelcolor"]  = "#DDDDDD"
    mpl.rcParams["xtick.color"]      = "#CCCCCC"
    mpl.rcParams["ytick.color"]      = "#CCCCCC"
    mpl.rcParams["grid.color"]       = "#2E2E2E"
set_mpl_dark_cjk()

# ================= ヘルパー =================
def rgb_to_css(r, g, b) -> str:
    return f"#{int(r):02X}{int(g):02X}{int(b):02X}"

class DeviceHttpClient:
    """各デバイスに1つだけ持つHTTPクライアント。接続再利用＆同時発射禁止。"""
    def __init__(self, ip: str):
        self.ip = ip
        self.session = requests.Session()
        adapter = requests.adapters.HTTPAdapter(pool_connections=1, pool_maxsize=1, max_retries=0)
        self.session.mount("http://", adapter)
        self.lock = threading.Lock()
        self.in_flight = False
        # keep-alive が不安定なら "close" に変更
        self.headers = {"Connection": "keep-alive"}

    def try_begin(self) -> bool:
        with self.lock:
            if self.in_flight:
                return False
            self.in_flight = True
            return True

    def end(self):
        with self.lock:
            self.in_flight = False

# ================= モデル =================
class Device(QtCore.QObject):
    changed = QtCore.Signal() if qt_api=="PySide6" else QtCore.pyqtSignal()
    def __init__(self, dev_id, ip, color="#4EA1FF"):
        super().__init__()
        self.id = dev_id
        self.ip = ip
        self.name = f"Device-{dev_id[-4:]}"
        self.value = 0.0
        self.last_seen = None
        self.selected = True
        self.color = color  # 可視化色（統合ライン・下パネル）
        # LED 状態（任意保持）
        self.led_r, self.led_g, self.led_b = (64, 128, 255)
        self.brightness = 255

    def set_value(self, v):
        v = max(0.0, min(100.0, float(v)))
        if abs(v - self.value) > 1e-6:
            self.value = v
            self.changed.emit()

    def set_name(self, name):
        if name and name != self.name:
            self.name = name
            self.changed.emit()

    def set_selected(self, sel: bool):
        if sel != self.selected:
            self.selected = sel
            self.changed.emit()

    def set_color_css(self, css):
        if css and css != self.color:
            self.color = css
            self.changed.emit()

    def touch(self):
        self.last_seen = time.strftime("%H:%M:%S")
        self.changed.emit()

# ================== 上：統合数直線 ==================
class UnifiedAxisCanvas(FigureCanvas):
    def __init__(self):
        self.fig = Figure(figsize=(6, 2.6), dpi=100)
        super().__init__(self.fig)
        self.ax = self.fig.add_subplot(111)
        self.fig.tight_layout(pad=1.0)
        self.devices = []
        self._init_axis()

    def _init_axis(self):
        self.ax.clear()
        self.ax.set_xlim(0, 100)
        self.ax.set_ylim(-1, 1)
        self.ax.get_yaxis().set_visible(False)
        self.ax.set_xlabel("Percent")
        self.ax.set_title("Unified Value Line (0..100)")
        self.ax.hlines(y=0, xmin=0, xmax=100, colors="#BBBBBB", linewidth=2)
        self.ax.set_xticks([0, 20, 40, 60, 80, 100])

    def set_devices(self, devices):
        self.devices = devices

    def redraw(self):
        self._init_axis()
        slot_map = {}
        for d in [x for x in self.devices if x.selected]:
            x = max(0.0, min(100.0, d.value))
            key = int(round(x))
            n = slot_map.get(key, 0)
            slot_map[key] = n + 1
            dy = 0.25 * ((n % 3) - 1)
            color = d.color or "#4EA1FF"
            self.ax.plot([x], [0], marker="v", markersize=16, color=color, markeredgecolor="#FFFFFF", markeredgewidth=0.8)
            label = f"{d.name} ({d.value:.0f}%)"
            self.ax.text(x, dy, label, ha="center", va="center", fontsize=10, color="#FFFFFF",
                         bbox=dict(boxstyle="round,pad=0.2", fc="#263238", ec="#607D8B", lw=1))
        self.fig.canvas.draw_idle()

# =============== 下：固定4パネル（破棄しない） ===============
class DevicePanel(QtWidgets.QFrame):
    # LED操作のシグナル
    setColorRequested = QtCore.Signal(str, int, int, int) if qt_api=="PySide6" else QtCore.pyqtSignal(str, int, int, int)
    setBrightnessRequested = QtCore.Signal(str, int) if qt_api=="PySide6" else QtCore.pyqtSignal(str, int)
    saveLedRequested = QtCore.Signal(str) if qt_api=="PySide6" else QtCore.pyqtSignal(str)

    def __init__(self, slot_index: int):
        super().__init__()
        self.setFrameShape(QtWidgets.QFrame.Shape.StyledPanel)
        self.setFixedSize(360, 240)
        self.setStyleSheet("QFrame { background-color: #1E1E1E; border: 1px solid #2f2f2f; }")
        self._device = None

        lay = QtWidgets.QGridLayout(self)
        lay.setContentsMargins(10,10,10,10); lay.setHorizontalSpacing(8); lay.setVerticalSpacing(6)

        # 名前（大）・数値（大）— HTMLで色・サイズ
        self.lblName = QtWidgets.QLabel("")
        self.lblName.setTextFormat(QtCore.Qt.TextFormat.RichText)
        self.lblName.setAlignment(QtCore.Qt.AlignmentFlag.AlignLeft | QtCore.Qt.AlignmentFlag.AlignVCenter)
        self.lblVal = QtWidgets.QLabel("")
        self.lblVal.setTextFormat(QtCore.Qt.TextFormat.RichText)
        self.lblVal.setAlignment(QtCore.Qt.AlignmentFlag.AlignLeft | QtCore.Qt.AlignmentFlag.AlignVCenter)

        # 補助
        self.lblId = QtWidgets.QLabel("ID: -")
        self.lblIp = QtWidgets.QLabel("IP: -")
        self.lblSeen = QtWidgets.QLabel("(未選択)")
        for w in (self.lblId, self.lblIp, self.lblSeen):
            w.setStyleSheet("color:#A0A0A0;")

        # LED 操作 UI
        self.cmbColor = QtWidgets.QComboBox()
        self.presets = [
            ("ブルー",   (0, 128, 255)),
            ("シアン",   (0, 255, 255)),
            ("レッド",   (255, 0, 0)),
            ("オレンジ", (255, 128, 0)),
            ("イエロー", (255, 255, 0)),
            ("グリーン", (0, 200, 70)),
            ("パープル", (128, 0, 255)),
            ("マゼンタ", (255, 0, 255)),
            ("ピンク",   (255, 105, 180)),
            ("ホワイト", (255, 255, 255)),
        ]
        for name, (r,g,b) in self.presets:
            self.cmbColor.addItem(name, (r,g,b))
        self.btnApplyColor = QtWidgets.QPushButton("色を適用")
        self.btnSave = QtWidgets.QPushButton("保存(saveled)")

        self.sldBright = QtWidgets.QSlider(QtCore.Qt.Orientation.Horizontal)
        self.sldBright.setRange(0, 255); self.sldBright.setValue(255)
        self.lblBright = QtWidgets.QLabel("明るさ: 255")

        # レイアウト
        lay.addWidget(self.lblName,   0, 0, 1, 4)
        lay.addWidget(self.lblVal,    1, 0, 1, 4)
        lay.addWidget(self.lblId,     2, 0, 1, 2)
        lay.addWidget(self.lblIp,     2, 2, 1, 2)
        lay.addWidget(self.lblSeen,   3, 0, 1, 4)
        lay.addWidget(QtWidgets.QLabel("カラー"), 4, 0)
        lay.addWidget(self.cmbColor,  4, 1, 1, 3)
        lay.addWidget(self.lblBright, 5, 0)
        lay.addWidget(self.sldBright, 5, 1, 1, 3)
        lay.addWidget(self.btnApplyColor, 6, 0, 1, 2)
        lay.addWidget(self.btnSave,        6, 2, 1, 2)

        self._set_placeholder_mode(True)

        # イベント
        self.btnApplyColor.clicked.connect(self._apply_color_clicked)
        self.sldBright.sliderReleased.connect(self._brightness_released)
        self.sldBright.valueChanged.connect(lambda v: self.lblBright.setText(f"明るさ: {v}"))
        self.btnSave.clicked.connect(self._save_led_clicked)

    def _set_placeholder_mode(self, on: bool):
        widgets = (self.lblName, self.lblVal, self.lblId, self.lblIp, self.lblSeen,
                   self.cmbColor, self.btnApplyColor, self.sldBright, self.lblBright, self.btnSave)
        for w in widgets:
            w.setEnabled(not on)
        if on:
            self.lblName.setText('<span style="color:#777;">（未選択）</span>')
            self.lblVal.setText("")
            self.lblId.setText("ID: -")
            self.lblIp.setText("IP: -")
            self.lblSeen.setText("(未選択)")
            self.sldBright.setValue(255)
            self.lblBright.setText("明るさ: 255")

    def bind_device(self, device):
        if hasattr(self, "_device") and self._device is not None:
            try:
                self._device.changed.disconnect(self.refresh)
            except Exception:
                pass
        self._device = device
        if device is None:
            self._set_placeholder_mode(True)
            return
        device.changed.connect(self.refresh)
        self._set_placeholder_mode(False)
        self.sldBright.setValue(device.brightness if hasattr(device, "brightness") else 255)
        self.lblBright.setText(f"明るさ: {self.sldBright.value()}")
        self.refresh()

    def _apply_color_clicked(self):
        if not self._device:
            return
        (r,g,b) = self.cmbColor.currentData()
        self.setColorRequested.emit(self._device.id, int(r), int(g), int(b))

    def _brightness_released(self):
        if not self._device:
            return
        v = int(self.sldBright.value())
        self.setBrightnessRequested.emit(self._device.id, v)

    def _save_led_clicked(self):
        if not self._device:
            return
        self.saveLedRequested.emit(self._device.id)

    def refresh(self):
        if not self._device:
            return
        d = self._device
        color = d.color or "#4EA1FF"
        self.lblName.setText(f'<span style="color:{color}; font-size:18pt; font-weight:600;">{d.name}</span>')
        self.lblVal.setText(f'<span style="color:{color}; font-size:22pt; font-weight:700;">{d.value:.0f}%</span>')
        self.lblId.setText(f"ID: {d.id}")
        self.lblIp.setText(f"IP: {d.ip}")
        self.lblSeen.setText(f"Last: {d.last_seen}" if d.last_seen else "(未受信)")

# =============== メインウィンドウ ===============
class MainWindow(QtWidgets.QMainWindow):
    dataUpdated = QtCore.Signal(str, float) if qt_api=="PySide6" else QtCore.pyqtSignal(str, float)
    devicesDiscovered = QtCore.Signal(list) if qt_api=="PySide6" else QtCore.pyqtSignal(list)

    def __init__(self):
        super().__init__()
        self.setWindowTitle("Encoder Monitor (Qt/Dark) - LED Control (Stable)")
        self.resize(1220, 840)

        self.devices = {}
        self.clients = {}  # dev_id -> DeviceHttpClient
        self.executor = concurrent.futures.ThreadPoolExecutor(max_workers=12)

        # 可視化色パレット（初期割当用）
        self.palette = ["#4EA1FF", "#00C853", "#FFD54F", "#FF7043", "#BA68C8", "#80CBC4"]
        self._color_idx = 0

        central = QtWidgets.QWidget(self)
        self.setCentralWidget(central)
        root = QtWidgets.QHBoxLayout(central); root.setContentsMargins(8,8,8,8); root.setSpacing(8)

        # 左ペイン
        left = QtWidgets.QVBoxLayout(); left.setSpacing(8)
        self.btnDiscover = QtWidgets.QPushButton("検出(UDP)")
        self.btnClear = QtWidgets.QPushButton("全解除")
        rowTop = QtWidgets.QHBoxLayout(); rowTop.addWidget(self.btnDiscover); rowTop.addWidget(self.btnClear); rowTop.addStretch()
        left.addLayout(rowTop)

        left.addWidget(QtWidgets.QLabel("ポーリング周期(ms) ※内部は位相ずらし"))
        self.spinPoll = QtWidgets.QSpinBox(); self.spinPoll.setRange(200, 5000); self.spinPoll.setValue(1000); self.spinPoll.setSingleStep(100)
        left.addWidget(self.spinPoll)

        left.addWidget(QtWidgets.QLabel("デバイス一覧（名前はテーブルで編集可）"))
        self.table = QtWidgets.QTableWidget(0, 4)
        self.table.setHorizontalHeaderLabels(["選択", "名前", "ID", "IP"])
        self.table.horizontalHeader().setStretchLastSection(True)
        self.table.setSelectionMode(QtWidgets.QAbstractItemView.SelectionMode.NoSelection)
        self.table.setEditTriggers(QtWidgets.QAbstractItemView.EditTrigger.NoEditTriggers)
        self.table.setColumnWidth(0, 48)
        self.table.setColumnWidth(1, 180)
        self.table.setColumnWidth(2, 160)
        left.addWidget(self.table, 1)
        root.addLayout(left, 0)

        # 右ペイン（上：統合ライン、下：固定4パネル）
        right = QtWidgets.QVBoxLayout(); right.setSpacing(8)
        self.unified = UnifiedAxisCanvas(); self.unified.setMinimumHeight(220)
        right.addWidget(self.unified, 0)

        gridContainer = QtWidgets.QWidget()
        grid = QtWidgets.QGridLayout(gridContainer)
        grid.setContentsMargins(0,0,0,0)
        grid.setHorizontalSpacing(8)
        grid.setVerticalSpacing(8)
        self.slotPanels = []
        for i in range(4):
            p = DevicePanel(i)
            self.slotPanels.append(p)
            r, c = divmod(i, 2)
            grid.addWidget(p, r, c)
            # LEDシグナル接続
            p.setColorRequested.connect(self._on_setcolor)
            p.setBrightnessRequested.connect(self._on_setbrightness)
            p.saveLedRequested.connect(self._on_saveled)

        right.addWidget(gridContainer, 1)
        root.addLayout(right, 1)

        # タイマー／シグナル
        self.poll_base_ms = self.spinPoll.value()
        self.timer = QtCore.QTimer(self)
        self.timer.setInterval(self.poll_base_ms)
        self._tick = 0

        self.timer.timeout.connect(self.poll_once)
        self.btnDiscover.clicked.connect(self.discover_clicked)
        self.btnClear.clicked.connect(self.clear_all)
        self.spinPoll.valueChanged.connect(self._on_poll_interval_changed)
        self.dataUpdated.connect(self.on_value_from_worker)
        self.devicesDiscovered.connect(self.on_devices_discovered)
        self.table.itemChanged.connect(self._on_table_item_changed)

    # --- UIイベント ---
    def _on_poll_interval_changed(self, v: int):
        self.poll_base_ms = int(v)
        self.timer.setInterval(self.poll_base_ms)

    # --- 検出 ---
    def discover_clicked(self):
        if self.timer.isActive():
            self.timer.stop()  # 検出中は停止
        self.executor.submit(self._discover_worker)

    def _discover_worker(self):
        results = []
        try:
            udp = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            udp.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
            udp.settimeout(0.8)
            udp.sendto(DISCOVERY_TOKEN, ("<broadcast>", DISCOVERY_PORT))
            start = time.time()
            while time.time() - start < 0.8:
                try:
                    data, addr = udp.recvfrom(2048)
                    obj = json.loads(data.decode("utf-8", errors="ignore"))
                    if obj.get("type") == "encoder" and obj.get("id") and obj.get("ip"):
                        results.append((obj["id"], obj["ip"]))
                except socket.timeout:
                    break
                except Exception:
                    pass
            udp.close()
        except Exception:
            pass
        uniq = {}
        for i, p in results: uniq[i] = p
        self.devicesDiscovered.emit([(i, uniq[i]) for i in uniq])

    @QtCore.Slot(list) if qt_api=="PySide6" else QtCore.pyqtSlot(list)
    def on_devices_discovered(self, items):
        for dev_id, ip in items:
            if dev_id not in self.devices:
                color = self.palette[self._color_idx % len(self.palette)]
                self._color_idx += 1
                dev = Device(dev_id, ip, color=color)
                self.devices[dev_id] = dev
                self.clients[dev_id] = DeviceHttpClient(ip)

                r = self.table.rowCount()
                self.table.insertRow(r)
                chk = QtWidgets.QTableWidgetItem()
                chk.setFlags(chk.flags() | QtCore.Qt.ItemFlag.ItemIsUserCheckable | QtCore.Qt.ItemFlag.ItemIsEnabled)
                chk.setCheckState(QtCore.Qt.CheckState.Checked)
                chk.setData(QtCore.Qt.ItemDataRole.UserRole, dev_id)
                self.table.setItem(r, 0, chk)

                ed = QtWidgets.QLineEdit(dev.name)
                ed.editingFinished.connect(partial(self._on_name_edit_from_table, ed, dev_id))
                self.table.setCellWidget(r, 1, ed)

                self.table.setItem(r, 2, QtWidgets.QTableWidgetItem(dev_id))
                self.table.setItem(r, 3, QtWidgets.QTableWidgetItem(ip))

                dev.changed.connect(self._refresh_unified)
            else:
                dev = self.devices[dev_id]
                dev.ip = ip
                dev.touch()
                # クライアントIP更新（再生成は不要）
                cli = self.clients.get(dev_id)
                if cli is None:
                    self.clients[dev_id] = DeviceHttpClient(ip)
                else:
                    cli.ip = ip
                for r in range(self.table.rowCount()):
                    if self.table.item(r, 2) and self.table.item(r, 2).text() == dev_id:
                        self.table.setItem(r, 3, QtWidgets.QTableWidgetItem(ip))
        self._refresh_unified()
        self._update_static_slots()
        if not self.timer.isActive():
            self.timer.start()

    # --- 左テーブル操作 ---
    def _on_table_item_changed(self, item: QtWidgets.QTableWidgetItem):
        if item.column() == 0:
            dev_id = item.data(QtCore.Qt.ItemDataRole.UserRole)
            if dev_id in self.devices:
                self.devices[dev_id].set_selected(item.checkState() == QtCore.Qt.CheckState.Checked)
            self._refresh_unified()
            self._update_static_slots()

    def _on_name_edit_from_table(self, editor: QtWidgets.QLineEdit, dev_id: str):
        name = editor.text().strip()
        if not name:
            editor.setText(self.devices[dev_id].name)
            return
        self.devices[dev_id].set_name(name)
        self._refresh_unified()

    # --- 全解除 ---
    def clear_all(self):
        for r in range(self.table.rowCount()):
            it = self.table.item(r, 0)
            if it:
                it.setCheckState(QtCore.Qt.CheckState.Unchecked)
        self._refresh_unified()
        self._update_static_slots()

    # --- ポーリング（位相ずらし＆重複禁止） ---
    def poll_once(self):
        self._tick = (self._tick + 1) % 1000000

        targets = []
        for r in range(self.table.rowCount()):
            it = self.table.item(r, 0)
            id_item = self.table.item(r, 2)
            if not id_item:
                continue
            dev_id = id_item.text()
            if it and it.checkState() == QtCore.Qt.CheckState.Checked and dev_id in self.devices:
                targets.append(self.devices[dev_id])
                self.devices[dev_id].set_selected(True)
            else:
                if dev_id in self.devices:
                    self.devices[dev_id].set_selected(False)

        n = max(1, len(targets))
        for idx, dev in enumerate(targets):
            if (self._tick % n) != idx:
                continue  # 位相分割：このtickでは idx 番のみ実行
            self._poll_device_async(dev)

    def _poll_device_async(self, dev):
        cli = self.clients.get(dev.id)
        if cli is None:
            self.clients[dev.id] = DeviceHttpClient(dev.ip)
            cli = self.clients[dev.id]
        if not cli.try_begin():
            return  # 前回未完了ならスキップ
        self.executor.submit(self._poll_device_with_client, dev, cli)

    def _poll_device_with_client(self, dev: Device, cli: DeviceHttpClient):
        try:
            url = f"http://{cli.ip}/api"
            r = cli.session.get(url, timeout=0.8, headers=cli.headers)
            r.raise_for_status()
            obj = r.json()
            val = float(obj.get("calibrated_value", 0))
            self.dataUpdated.emit(dev.id, val)
        except Exception:
            pass
        finally:
            cli.end()

    @QtCore.Slot(str, float) if qt_api=="PySide6" else QtCore.pyqtSlot(str, float)
    def on_value_from_worker(self, dev_id, val):
        if dev_id in self.devices:
            dev = self.devices[dev_id]
            dev.set_value(val)
            dev.touch()
            self._refresh_unified()

    # --- 上統合グラフ更新 & 下4スロット割当 ---
    def _refresh_unified(self):
        self.unified.set_devices([d for d in self.devices.values() if d.selected])
        self.unified.redraw()

    def _update_static_slots(self):
        selected_ids = []
        for r in range(self.table.rowCount()):
            it = self.table.item(r, 0)
            id_item = self.table.item(r, 2)
            if it and id_item and it.checkState() == QtCore.Qt.CheckState.Checked:
                selected_ids.append(id_item.text())
        selected_ids = selected_ids[:4]
        for idx in range(4):
            dev = self.devices.get(selected_ids[idx]) if idx < len(selected_ids) else None
            self.slotPanels[idx].bind_device(dev)

    # ---------------- LED API 呼び出し系 ----------------
    @QtCore.Slot(str, int, int, int) if qt_api=="PySide6" else QtCore.pyqtSlot(str, int, int, int)
    def _on_setcolor(self, dev_id, r, g, b):
        dev = self.devices.get(dev_id)
        if not dev: return
        # 可視化色に先反映（UI即時）
        dev.set_color_css(rgb_to_css(r,g,b))
        self._refresh_unified()
        self.executor.submit(self._send_setcolor, dev, r, g, b)

    def _send_setcolor(self, dev: Device, r: int, g: int, b: int):
        cli = self.clients.get(dev.id)
        if cli is None:
            cli = DeviceHttpClient(dev.ip); self.clients[dev.id] = cli
        try:
            url = f"http://{cli.ip}/setcolor?r={r}&g={g}&b={b}"
            cli.session.get(url, timeout=0.8, headers=cli.headers).raise_for_status()
            dev.led_r, dev.led_g, dev.led_b = (r, g, b)
        except Exception:
            pass

    @QtCore.Slot(str, int) if qt_api=="PySide6" else QtCore.pyqtSlot(str, int)
    def _on_setbrightness(self, dev_id, v):
        dev = self.devices.get(dev_id)
        if not dev: return
        dev.brightness = v  # ローカル保持
        self.executor.submit(self._send_setbrightness, dev, v)

    def _send_setbrightness(self, dev: Device, v: int):
        cli = self.clients.get(dev.id)
        if cli is None:
            cli = DeviceHttpClient(dev.ip); self.clients[dev.id] = cli
        try:
            url = f"http://{cli.ip}/setbrightness?v={v}"
            cli.session.get(url, timeout=0.8, headers=cli.headers).raise_for_status()
        except Exception:
            pass

    @QtCore.Slot(str) if qt_api=="PySide6" else QtCore.pyqtSlot(str)
    def _on_saveled(self, dev_id):
        dev = self.devices.get(dev_id)
        if not dev: return
        self.executor.submit(self._send_saveled, dev)

    def _send_saveled(self, dev: Device):
        cli = self.clients.get(dev.id)
        if cli is None:
            cli = DeviceHttpClient(dev.ip); self.clients[dev.id] = cli
        try:
            url = f"http://{cli.ip}/saveled"
            cli.session.get(url, timeout=2.0, headers=cli.headers).raise_for_status()
            # 成功通知
            QtCore.QMetaObject.invokeMethod(
                self, "_notify_saved", QtCore.Qt.ConnectionType.QueuedConnection,
                QtCore.Q_ARG(str, dev.id)
            )
        except Exception:
            pass

    @QtCore.Slot(str) if qt_api=="PySide6" else QtCore.pyqtSlot(str)
    def _notify_saved(self, dev_id: str):
        dev = self.devices.get(dev_id)
        if not dev: return
        dev.last_seen = (dev.last_seen or "") + " / saved"
        dev.changed.emit()

# ================= エントリポイント =================
def main():
    app = QtWidgets.QApplication(sys.argv)
    # Qtフォント（CJK）
    try:
        db = QtGui.QFontDatabase()
        for fam in ["Yu Gothic UI", "Meiryo", "Noto Sans CJK JP", "MS UI Gothic"]:
            if fam in db.families():
                QtWidgets.QApplication.setFont(QtGui.QFont(fam, 9))
                break
    except Exception:
        pass
    apply_qt_dark(app)

    w = MainWindow()
    w.show()
    sys.exit(app.exec())

if __name__ == "__main__":
    main()
