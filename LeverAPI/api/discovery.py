#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
レバーデバイス ディスカバリーモジュール

ネットワーク上のレバーデバイスを検出するためのUDPディスカバリー実装。
"""

import socket
import json
import time
import logging
from datetime import datetime

# ロギング設定
logger = logging.getLogger(__name__)

# 設定
UDP_PORT = 4210
DISCOVERY_TOKEN = "DISCOVER_LEVER"
BROADCAST_IP = "255.255.255.255"
DEVICE_TIMEOUT = 30  # デバイスがタイムアウトするまでの秒数

class LeverDiscovery:
    """レバーデバイスのディスカバリーを管理するクラス"""

    def __init__(self, udp_port=None):
        """ディスカバリーマネージャーの初期化

        Args:
            udp_port (int, optional): UDPディスカバリーポート。Noneの場合はデフォルト値を使用
        """
        self.udp_port = udp_port if udp_port is not None else UDP_PORT
        self.is_scanning = False
        self.devices = {}  # 検出されたデバイスの辞書 {device_id: device_info}

    def discover_devices(self, timeout=3, retries=3, retry_interval=0.5):
        """
        UDPブロードキャストを使用してネットワーク上のレバーデバイスを検出する
        最適化: 複数回のブロードキャストと再試行メカニズム

        Args:
            timeout (int): スキャンのタイムアウト時間（秒）
            retries (int): 再試行回数
            retry_interval (float): 再試行間隔（秒）

        Returns:
            dict: スキャン結果の情報
        """
        if self.is_scanning:
            logger.warning("スキャンは既に実行中です")
            return {"status": "error", "message": "スキャンは既に実行中です"}

        self.is_scanning = True
        logger.info("デバイススキャン開始")
        discovered = 0

        try:
            # UDPソケットの作成
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
                # ブロードキャスト有効化
                sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
                # タイムアウト設定（応答待機時間を短く設定）
                sock.settimeout(1)
                # SO_REUSEADDRオプション設定（アドレス再利用を有効化）
                sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

                # 複数回のブロードキャスト送信（より確実な検出のため）
                for attempt in range(retries):
                    # ディスカバリーパケットの送信
                    sock.sendto(DISCOVERY_TOKEN.encode(), (BROADCAST_IP, self.udp_port))
                    logger.debug(f"ディスカバリーパケット送信: 試行 {attempt + 1}/{retries}, port: {self.udp_port}")

                    # 応答の待機と処理
                    broadcast_time = time.time()
                    while time.time() - broadcast_time < retry_interval:
                        try:
                            data, addr = sock.recvfrom(1024)

                            # JSONレスポンスの解析
                            try:
                                response = json.loads(data.decode())
                                if "type" in response and response["type"] == "lever":
                                    device_id = response["id"]
                                    ip = addr[0]  # 応答送信元IPを使用（より信頼性が高い）

                                    # デバイス情報を格納
                                    if device_id not in self.devices:
                                        self.devices[device_id] = {
                                            "id": device_id,
                                            "name": f"レバー {len(self.devices) + 1}",  # デフォルト名
                                            "ip": ip,
                                            "last_seen": datetime.now().timestamp(),
                                            "status": "online"
                                        }
                                        logger.info(f"新規デバイス検出: {device_id} ({ip})")
                                        discovered += 1
                                    else:
                                        # 既存デバイスの情報を更新
                                        self.devices[device_id]["ip"] = ip
                                        self.devices[device_id]["last_seen"] = datetime.now().timestamp()
                                        self.devices[device_id]["status"] = "online"
                                        logger.info(f"既存デバイス更新: {device_id} ({ip})")
                            except json.JSONDecodeError:
                                logger.warning(f"無効なJSONレスポンス: {data} from {addr}")

                        except socket.timeout:
                            continue

                # 最終的な待機（タイムアウト - (再試行回数 * 再試行間隔)）
                remaining_time = max(0, timeout - (retries * retry_interval))
                if remaining_time > 0:
                    wait_end = time.time() + remaining_time
                    sock.settimeout(0.5)  # 短いタイムアウトで複数回のチェック

                    while time.time() < wait_end:
                        try:
                            data, addr = sock.recvfrom(1024)
                            # 上記と同様のレスポンス処理
                            try:
                                response = json.loads(data.decode())
                                if "type" in response and response["type"] == "lever":
                                    device_id = response["id"]
                                    ip = addr[0]

                                    if device_id not in self.devices:
                                        self.devices[device_id] = {
                                            "id": device_id,
                                            "name": f"レバー {len(self.devices) + 1}",
                                            "ip": ip,
                                            "last_seen": datetime.now().timestamp(),
                                            "status": "online"
                                        }
                                        logger.info(f"最終待機中の新規デバイス検出: {device_id} ({ip})")
                                        discovered += 1
                                    else:
                                        self.devices[device_id]["ip"] = ip
                                        self.devices[device_id]["last_seen"] = datetime.now().timestamp()
                                        self.devices[device_id]["status"] = "online"
                                        logger.debug(f"最終待機中の既存デバイス更新: {device_id} ({ip})")
                            except json.JSONDecodeError:
                                logger.warning(f"最終待機中の無効なJSONレスポンス: {data} from {addr}")
                        except socket.timeout:
                            continue

        except Exception as e:
            logger.error(f"ディスカバリー中にエラーが発生しました: {e}")

        # スキャン状態を更新
        self.is_scanning = False

        logger.info(f"デバイススキャン完了: {discovered}台の新規デバイスを発見")
        return {
            "status": "success",
            "message": "スキャン完了",
            "devices_found": discovered,
            "total_devices": len(self.devices)
        }

    def check_device_timeouts(self):
        """
        一定時間応答のないデバイスをオフライン状態に設定
        """
        current_time = datetime.now().timestamp()
        timeout_count = 0

        for device_id, info in self.devices.items():
            if current_time - info["last_seen"] > DEVICE_TIMEOUT:
                if info["status"] != "offline":
                    info["status"] = "offline"
                    logger.info(f"デバイスがオフラインになりました: {device_id}")
                    timeout_count += 1

        return timeout_count

    def get_devices(self):
        """
        検出されたすべてのデバイスのリストを取得

        Returns:
            list: デバイス情報のリスト
        """
        self.check_device_timeouts()  # タイムアウトチェック
        return list(self.devices.values())

    def get_device(self, device_id):
        """
        指定されたIDのデバイス情報を取得

        Args:
            device_id (str): デバイスID

        Returns:
            dict: デバイス情報、存在しない場合はNone
        """
        if device_id in self.devices:
            return self.devices[device_id]
        return None

    def update_device_name(self, device_id, name):
        """
        デバイスの表示名を更新

        Args:
            device_id (str): デバイスID
            name (str): 新しい名前

        Returns:
            bool: 更新に成功したかどうか
        """
        if device_id in self.devices:
            self.devices[device_id]["name"] = name
            return True
        return False