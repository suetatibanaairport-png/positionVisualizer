#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
レバーデバイス マネージャーモジュール

レバーデバイスとの通信と状態管理を行います。
"""

import httpx
import logging
import time
from datetime import datetime
from .transformers import transform_device_for_frontend, transform_value_for_frontend, transform_statistics_for_frontend, transform_device_summary_for_frontend
from .cache import ValueCache, StatsCache, SummaryCache

# ロギング設定
logger = logging.getLogger(__name__)

class DeviceManager:
    """レバーデバイスの管理と通信を行うクラス"""

    def __init__(self, discovery_manager):
        """
        デバイスマネージャーの初期化

        Args:
            discovery_manager: デバイスを検出するディスカバリーマネージャー
        """
        self.discovery = discovery_manager

        # デバイス値の内部保存（キャッシュとは別）
        self.device_values = {}  # {device_id: value_data}

        # キャッシュシステム
        self.value_cache = ValueCache(default_ttl=2.0)  # デバイス値のキャッシュ（リクエスト頻度が高い場合に効果的）
        self.stats_cache = StatsCache(default_ttl=1.0)  # 統計情報のキャッシュ（適応的TTL）
        self.summary_cache = SummaryCache(default_ttl=2.0)  # サマリー情報のキャッシュ（適応的TTL）

        # キャッシュクリーンアップ用のタイマー設定
        self.last_cleanup = time.time()
        self.cleanup_interval = 60.0  # 60秒ごとにクリーンアップ

        # HTTP Client（コネクションプーリング用）
        self.http_client = httpx.Client(
            timeout=httpx.Timeout(1.0, connect=0.5),
            headers={
                'Connection': 'keep-alive',
                'Accept': 'application/json'
            }
        )

    def get_device_value(self, device_id, use_cache=True):
        """
        指定されたデバイスの現在値をHTTPリクエストで取得
        最適化: キャッシュ機構と接続タイムアウト設定の改善
        データ変換: transform_value_for_frontendを使用して一貫したフォーマットを確保

        Args:
            device_id (str): デバイスID
            use_cache (bool): キャッシュを使用するかどうか

        Returns:
            dict: デバイス値の情報、取得できない場合はNone
        """
        # 定期的なキャッシュクリーンアップ
        self._check_cleanup_cache()

        # キャッシュが無効の場合はスキップ
        if not use_cache:
            return self._fetch_device_value(device_id)

        # キャッシュから値を取得（ヒットすればそのまま返す）
        cached_value = self.value_cache.get(device_id)
        if cached_value is not None:
            return cached_value

        # キャッシュミス時はデバイス値を取得して保存
        return self._fetch_device_value(device_id)

    def _fetch_device_value(self, device_id):
        """
        実際にデバイスから値を取得する内部メソッド

        Args:
            device_id (str): デバイスID

        Returns:
            dict: デバイス値の情報、取得できない場合はNone
        """
        # シミュレーションデバイスの場合はHTTPリクエストを送信しない
        if device_id.startswith('sim_'):
            return None
        
        # デバイス情報の取得
        device_info = self.discovery.get_device(device_id)
        if not device_info or device_info["status"] != "online":
            return None

        current_time = datetime.now().timestamp()

        try:
            # デバイスのAPIエンドポイントにリクエスト（タイムアウト設定の最適化）
            url = f"http://{device_info['ip']}/api"
            # HTTP Clientを使用（Keep-Alive接続を再利用）
            # connect timeout=0.5秒、read timeout=1.0秒で設定（WiFi環境の安定性を重視）
            response = self.http_client.get(url)

            if response.status_code == 200:
                data = response.json()

                # 応答データからレバー値を抽出
                if "data" in data and "value" in data["data"]:
                    value = data["data"]["value"]
                    raw_value = data.get("data", {}).get("raw", 0)
                    is_calibrated = data.get("data", {}).get("calibrated", False)

                    # タイムスタンプはサーバー側の現在時刻を使用
                    timestamp = current_time

                    # 基本データを構築
                    value_data = {
                        "value": value,
                        "raw": raw_value,
                        "calibrated": is_calibrated,
                        "timestamp": timestamp
                    }

                    # 内部保存用に元データをコピー
                    self.device_values[device_id] = value_data.copy()

                    # フロントエンド用に変換
                    transformed_data = transform_value_for_frontend(device_id, value_data, device_info)

                    # キャッシュに変換済みデータを保存（値の変動が少ないほど長めのTTL）
                    ttl = self._calculate_value_ttl(device_id, value)
                    self.value_cache.set(device_id, transformed_data, ttl)

                    # デバイスの最終応答時間を更新
                    if device_id in self.discovery.devices:
                        self.discovery.devices[device_id]["last_seen"] = timestamp
                        self.discovery.devices[device_id]["status"] = "online"

                    return transformed_data

        except httpx.HTTPError as e:
            logger.warning(f"デバイスとの通信エラー: {device_id} - {e}")
            # 通信エラーの場合、必要に応じて古いデータを使用可能（オプション）
            if device_id in self.device_values:
                logger.debug(f"通信エラー - 最後の既知の値を使用: {device_id}")

                # 古い値をキャッシュ（短いTTLで）
                last_value = self.device_values[device_id]
                transformed_data = transform_value_for_frontend(device_id, last_value, self.discovery.get_device(device_id))

                # エラー時は短いTTLを設定（0.5秒）
                self.value_cache.set(device_id, transformed_data, ttl=0.5)

                return transformed_data

        return None

    def _calculate_value_ttl(self, device_id, current_value):
        """
        値の特性に応じてキャッシュTTLを計算する

        Args:
            device_id (str): デバイスID
            current_value (int): 現在の値

        Returns:
            float: 計算されたTTL（秒）
        """
        # デフォルトTTL
        default_ttl = 2.0

        # 前回の値が存在する場合、変化量に応じてTTLを調整
        if device_id in self.device_values:
            prev_value = self.device_values[device_id].get("value")

            if prev_value is not None:
                # 値の変化率を計算 (0-100の範囲)
                change_rate = abs(current_value - prev_value) / 100.0

                if change_rate > 0.2:
                    # 大きな変化がある場合はTTLを短く
                    return 0.5
                elif change_rate > 0.05:
                    # 中程度の変化の場合
                    return 1.0
                else:
                    # 変化が小さい場合はTTLを長く
                    return 3.0

        # 初回取得時はデフォルト値
        return default_ttl

    def _check_cleanup_cache(self):
        """キャッシュクリーンアップが必要か確認し実行する"""
        current_time = time.time()

        # クリーンアップインターバル以上経過していたら実行
        if current_time - self.last_cleanup > self.cleanup_interval:
            logger.debug("定期キャッシュクリーンアップを実行")

            # 各種キャッシュのクリーンアップ実行
            self.value_cache.cleanup()
            self.stats_cache.cleanup()
            self.summary_cache.cleanup()

            # 次回クリーンアップ時間更新
            self.last_cleanup = current_time

    def get_all_values(self):
        """
        すべてのオンラインデバイスの値を取得（並行処理による最適化）

        Returns:
            dict: デバイスIDをキーとしたデバイス値の辞書
        """
        import concurrent.futures

        self.discovery.check_device_timeouts()  # タイムアウトチェック

        values = {}
        online_devices = {
            device_id: info for device_id, info in self.discovery.devices.items()
            if info["status"] == "online" and not device_id.startswith('sim_')
        }

        # 並行処理でデバイス値を取得
        if online_devices:
            with concurrent.futures.ThreadPoolExecutor(max_workers=min(10, len(online_devices))) as executor:
                # デバイスIDごとに並行してget_device_valueを実行
                future_to_device = {
                    executor.submit(self.get_device_value, device_id): (device_id, info)
                    for device_id, info in online_devices.items()
                }

                # 完了した処理から結果を収集
                for future in concurrent.futures.as_completed(future_to_device):
                    device_id, info = future_to_device[future]
                    try:
                        value_data = future.result()
                        if value_data:
                            # 変換関数を使用して一貫したデータフォーマットに変換
                            values[device_id] = transform_value_for_frontend(
                                device_id,
                                value_data,
                                info
                            )
                    except Exception as e:
                        logger.warning(f"デバイス値の取得に失敗: {device_id} - {e}")

        return values

    def get_device_statistics(self, use_cache=True):
        """
        デバイスの統計情報を計算
        最適化: キャッシュ機構を追加して短期間の連続呼び出し時のパフォーマンスを向上

        Args:
            use_cache (bool): キャッシュを使用するかどうか

        Returns:
            dict: 統計情報の辞書
        """
        # 定期的なキャッシュクリーンアップ
        self._check_cleanup_cache()

        # キャッシュが無効の場合はスキップ
        if not use_cache:
            return self._calculate_statistics()

        # キャッシュから統計情報を取得
        cache_key = "device_statistics"
        cached_stats = self.stats_cache.get(cache_key)
        if cached_stats is not None:
            logger.debug("統計情報をキャッシュから取得")
            return cached_stats

        # キャッシュミスの場合、新たに計算して保存
        return self._calculate_statistics()

    def _calculate_statistics(self):
        """
        デバイスの統計情報を計算する内部メソッド

        Returns:
            dict: 統計情報の辞書
        """
        current_time = datetime.now().timestamp()

        # 値を取得（並行処理済み）
        values = self.get_all_values()

        if not values:
            # データがない場合
            stats = {
                "count": 0,
                "online_count": 0,
                "average_value": None,
                "min_value": None,
                "max_value": None,
                "timestamp": current_time
            }

            # 統計情報を変換関数でフロントエンド用に整形
            transformed_stats = transform_statistics_for_frontend(stats)

            # キャッシュに保存（短いTTLで）
            self.stats_cache.set("device_statistics", transformed_stats, ttl=0.5)

            return transformed_stats

        # 値を抽出
        numeric_values = [data["value"] for data in values.values()]

        # 統計情報を計算
        stats = {
            "count": len(self.discovery.devices),
            "online_count": len(values),
            "average_value": sum(numeric_values) / len(numeric_values) if numeric_values else None,
            "min_value": min(numeric_values) if numeric_values else None,
            "max_value": max(numeric_values) if numeric_values else None,
            "timestamp": current_time
        }

        # 統計情報を変換関数でフロントエンド用に整形
        transformed_stats = transform_statistics_for_frontend(stats)

        # 統計情報の特性に応じたTTLを計算
        ttl = self.stats_cache.adaptive_ttl(transformed_stats)

        # キャッシュに保存
        self.stats_cache.set("device_statistics", transformed_stats, ttl)

        return transformed_stats

    def get_device_summary(self, use_cache=True):
        """
        すべてのデバイスの要約情報を取得 (BFF用)
        最適化: キャッシュと効率的なデータ取得、変換関数によるデータフォーマットの一貫性確保

        Args:
            use_cache (bool): キャッシュを使用するかどうか

        Returns:
            dict: デバイス要約情報
        """
        # 定期的なキャッシュクリーンアップ
        self._check_cleanup_cache()

        # キャッシュが無効の場合はスキップ
        if not use_cache:
            return self._generate_device_summary()

        # キャッシュからサマリー情報を取得
        cache_key = "device_summary"
        cached_summary = self.summary_cache.get(cache_key)
        if cached_summary is not None:
            logger.debug("サマリー情報をキャッシュから取得")
            return cached_summary

        # キャッシュミスの場合、新たに生成して保存
        return self._generate_device_summary()

    def _generate_device_summary(self):
        """
        デバイスサマリー情報を生成する内部メソッド

        Returns:
            dict: デバイス要約情報
        """
        current_time = datetime.now().timestamp()

        # デバイス情報の効率的な取得
        devices = self.discovery.get_devices()

        # 値の一括取得（並行処理済みメソッド）
        values = self.get_all_values()

        # 変換関数を使用して一貫したデータフォーマットでサマリーを生成
        summary = transform_device_summary_for_frontend(devices, values)

        # 後続のリクエストのためにデバイス情報更新時間を記録
        summary["timestamp"] = current_time

        # サマリー情報の特性に応じたTTLを計算
        ttl = self.summary_cache.adaptive_ttl(summary)

        # キャッシュに保存
        self.summary_cache.set("device_summary", summary, ttl)

        return summary