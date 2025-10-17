# encoder_monitor_qt_v6_dark_panelstyling.py
# ダークテーマ + Static 4 Panels（破棄しない）
# DevicePanel: 名前=ラベル、次行に数値=ラベル、進捗バー削除、色とサイズはHTMLで指定（Unifiedのマーカー色と一致）

import sys, json, socket, time, concurrent.futures
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
    QLineEdit, QTextEdit, QSpinBox { border: 1px solid #3a3a3a; border-radius: 4px; padding: 4px; }
    QPushButton { border: 1px solid #3a3a3a; border-radius: 4px; padding: 6px 10px; background: #2a2a2a; }
    QPushButton:hover { background: #333333; }
    QTableWidget QHeaderView::section { background:#1a1a1a; color:#ddd; border: 1px solid #333; padding: 4px; }
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
        self.color = color  # ← 統合ラインとパネルで共通に使用

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
        # self.ax.set_xlabel("Percent")
        # self.ax.set_title("Unified Value Line (0..100)")
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

# =============== 下：固定4パネル（破棄しない） =================
class DevicePanel(QtWidgets.QFrame):
    """固定スロットのパネル。名前=ラベル、次行に数値ラベル。色とサイズはHTMLで指定。"""
    def __init__(self, slot_index: int):
        super().__init__()
        self.setFrameShape(QtWidgets.QFrame.Shape.StyledPanel)
        self.setFixedSize(360, 140)
        self.setStyleSheet("QFrame { background-color: #1E1E1E; border: 1px solid #2f2f2f; }")
        self._device = None

        lay = QtWidgets.QGridLayout(self)
        lay.setContentsMargins(10,10,10,10); lay.setHorizontalSpacing(8); lay.setVerticalSpacing(6)

        # 大きめの名前・数値ラベル（HTMLを使う）
        self.lblName = QtWidgets.QLabel("")
        self.lblName.setTextFormat(QtCore.Qt.TextFormat.RichText)
        self.lblName.setAlignment(QtCore.Qt.AlignmentFlag.AlignLeft | QtCore.Qt.AlignmentFlag.AlignVCenter)

        self.lblVal = QtWidgets.QLabel("")
        self.lblVal.setTextFormat(QtCore.Qt.TextFormat.RichText)
        self.lblVal.setAlignment(QtCore.Qt.AlignmentFlag.AlignLeft | QtCore.Qt.AlignmentFlag.AlignVCenter)

        # 補助情報
        self.lblId = QtWidgets.QLabel("ID: -")
        self.lblIp = QtWidgets.QLabel("IP: -")
        self.lblSeen = QtWidgets.QLabel("(未選択)")
        for w in (self.lblId, self.lblIp, self.lblSeen):
            w.setStyleSheet("color:#A0A0A0;")

        # 行配置：0:名前(大) / 1:数値(大) / 2:ID,IP / 3:Last
        lay.addWidget(self.lblName, 0, 0, 1, 4)
        lay.addWidget(self.lblVal,  1, 0, 1, 4)
        lay.addWidget(self.lblId,   2, 0, 1, 2)
        lay.addWidget(self.lblIp,   2, 2, 1, 2)
        lay.addWidget(self.lblSeen, 3, 0, 1, 4)

        self._set_placeholder_mode(True)

    def _set_placeholder_mode(self, on: bool):
        for w in (self.lblName, self.lblVal, self.lblId, self.lblIp, self.lblSeen):
            w.setEnabled(not on)
        if on:
            self.lblName.setText('<span style="color:#777;">（未選択）</span>')
            self.lblVal.setText("")
            self.lblId.setText("ID: -")
            self.lblIp.setText("IP: -")
            self.lblSeen.setText("(未選択)")

    def bind_device(self, device):
        if self._device is not None:
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
        self.refresh()

    def refresh(self):
        if not self._device:
            return
        d = self._device
        color = d.color or "#4EA1FF"
        # 名前（大きめ、太字、色付き）
        self.lblName.setText(f'<span style="color:{color}; font-size:18pt; font-weight:600;">{d.name}</span>')
        # 数値（さらに大きく、太字、色付き）
        self.lblVal.setText(f'<span style="color:{color}; font-size:22pt; font-weight:700;">{d.value:.0f}%</span>')
        # 補助
        self.lblId.setText(f"ID: {d.id}")
        self.lblIp.setText(f"IP: {d.ip}")
        self.lblSeen.setText(f"Last: {d.last_seen}" if d.last_seen else "(未受信)")

# =============== メインウィンドウ =================
class MainWindow(QtWidgets.QMainWindow):
    dataUpdated = QtCore.Signal(str, float) if qt_api=="PySide6" else QtCore.pyqtSignal(str, float)
    devicesDiscovered = QtCore.Signal(list) if qt_api=="PySide6" else QtCore.pyqtSignal(list)

    def __init__(self):
        super().__init__()
        self.setWindowTitle("Encoder Monitor (Qt/Dark) - Static 4 Panels")
        self.resize(1200, 800)

        self.devices = {}
        self.executor = concurrent.futures.ThreadPoolExecutor(max_workers=12)

        # カラーパレット（デバイスに一度だけ割当）
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

        left.addWidget(QtWidgets.QLabel("ポーリング周期(ms)"))
        self.spinPoll = QtWidgets.QSpinBox(); self.spinPoll.setRange(50, 5000); self.spinPoll.setValue(200); self.spinPoll.setSingleStep(50)
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
        self.unified = UnifiedAxisCanvas(); self.unified.setMinimumHeight(300)
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
        right.addWidget(gridContainer, 1)
        root.addLayout(right, 1)

        # タイマー／シグナル
        self.timer = QtCore.QTimer(self); self.timer.setInterval(self.spinPoll.value())
        self.timer.timeout.connect(self.poll_once)
        self.btnDiscover.clicked.connect(self.discover_clicked)
        self.btnClear.clicked.connect(self.clear_all)
        self.spinPoll.valueChanged.connect(self.timer.setInterval)
        self.dataUpdated.connect(self.on_value_from_worker)
        self.devicesDiscovered.connect(self.on_devices_discovered)
        self.table.itemChanged.connect(self._on_table_item_changed)

    # --- 検出 ---
    def discover_clicked(self):
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
                # 新規色を割当
                color = self.palette[self._color_idx % len(self.palette)]
                self._color_idx += 1
                dev = Device(dev_id, ip, color=color)
                self.devices[dev_id] = dev

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

    # --- ポーリング ---
    def poll_once(self):
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
        for dev in targets:
            self.executor.submit(self._poll_device, dev)

    def _poll_device(self, dev: Device):
        url = f"http://{dev.ip}/api"
        try:
            r = requests.get(url, timeout=1.0)
            r.raise_for_status()
            obj = r.json()
            val = float(obj.get("calibrated_value", 0))
            self.dataUpdated.emit(dev.id, val)
        except Exception:
            pass

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
