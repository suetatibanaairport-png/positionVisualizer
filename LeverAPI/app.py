#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
LeverAPI - レバーデバイス管理 BFF APIサーバー

このスクリプトは、ネットワーク上のレバーデバイスを検出し、
それらとの通信を管理するFlask APIサーバーです。
BFF（Backend For Frontend）として動作し、フロントエンド向けに最適化された
データ集約・変換機能を備えたHTTP APIエンドポイントとWebSocketリアルタイム通信を提供します。
"""

import os
import sys
import json
import time
import socket
import logging
import threading

from flask import Flask, jsonify, request, render_template, send_from_directory, Response
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import requests
from datetime import datetime, timedelta
import orjson

# 内部モジュールのインポート
from api.discovery import LeverDiscovery
from api.device_manager import DeviceManager
from api.transformers import transform_device_for_frontend

# ロギング設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# httpxとwerkzeugの正常系ログを抑制（エラーログのみ表示）
logging.getLogger('httpx').setLevel(logging.WARNING)
logging.getLogger('werkzeug').setLevel(logging.WARNING)

# アプリケーション設定
app = Flask(__name__)
CORS(app)  # クロスオリジンリクエストを許可
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')  # WebSocket初期化

# シミュレーションモード設定
SIMULATION_MODE = False
SIMULATION_DEVICE_COUNT = 3  # シミュレーションデバイスのデフォルト数

# WebSocketリアルタイムデータ更新設定
UPDATE_INTERVAL = 0.033  # 約33ミリ秒ごとに更新（WebSocket通知用） - 30Hz
LAST_DEVICE_VALUES = {}  # 前回のデバイス値を格納（変更検出用）
NOTIFICATION_THRESHOLDS = {
    'value_change': 0.1,  # 値の変化が0.1以上の場合に通知（ほぼ全ての変化を通知）
    'time_threshold': 0.01,  # 最後の通知から10ms以上経過した場合は小さな変化でも通知
    'force_interval': 0.5,  # 最後の通知から0.5秒以上経過した場合は変化がなくても通知
}
LAST_NOTIFICATION_TIMES = {}  # デバイスごとの最後の通知時間
LAST_KNOWN_DEVICE_IDS = set()  # 前回のデバイスIDセット（接続/切断検出用）

# ディスカバリーとデバイスマネージャーの初期化
discovery = LeverDiscovery()
device_manager = DeviceManager(discovery)

# APIレスポンスの標準化関数

def create_error_response(code, message, details=None):
    """
    一貫したフォーマットでエラーレスポンスを作成

    orjsonを使用して高速なJSON生成を実現

    Args:
        code (int): HTTPエラーコード
        message (str): エラーメッセージ
        details (dict, optional): 追加のエラー詳細

    Returns:
        tuple: (json_response, status_code)
    """
    response = {
        "status": "error",
        "code": code,
        "message": message
    }

    if details:
        response["details"] = details

    return Response(
        orjson.dumps(response),
        mimetype='application/json'
    ), code

def create_success_response(data, meta=None):
    """
    一貫したフォーマットで成功レスポンスを作成

    orjsonを使用して高速なJSON生成を実現

    Args:
        data (dict/list): レスポンスデータ
        meta (dict, optional): メタデータ

    Returns:
        flask.Response: JSONレスポンス
    """
    response = {
        "status": "success",
        "data": data
    }

    if meta:
        response["meta"] = meta

    return Response(
        orjson.dumps(response),
        mimetype='application/json'
    )

# API v1 エンドポイント (BFF用)

@app.route('/api/devices', methods=['GET'])
def get_devices():
    """検出されたすべてのデバイスのリストを取得"""
    devices = discovery.get_devices()
    meta = {
        "count": len(devices),
        "online_count": len([d for d in devices if d["status"] == "online"])
    }
    return create_success_response({"devices": devices}, meta)

@app.route('/api/devices/<device_id>/value', methods=['GET'])
def get_device_value_endpoint(device_id):
    """指定されたデバイスの現在値を取得"""
    value_data = device_manager.get_device_value(device_id)

    if not value_data:
        return create_error_response(404, "Device not found or offline")

    # デバイス情報を取得
    device_info = discovery.get_device(device_id)
    if not device_info:
        return create_error_response(404, "Device information not available")

    # 変換関数はすでにdevice_managerで処理済み
    # result = value_data.copy()がすでに最適なフォーマットになっている
    return create_success_response(value_data)

# @app.route('/api/values', methods=['GET'])
# def get_all_values():
#     """すべてのデバイスの現在値をまとめて取得"""
#     values = device_manager.get_all_values()
#     meta = {
#         "count": len(values),
#         "timestamp": datetime.now().timestamp()
#     }
#     return create_success_response({"values": values}, meta)

@app.route('/api/values', methods=['GET'])
def get_all_values():
    """すべてのデバイスの現在値をまとめて取得"""
    global SIMULATION_MODE, LAST_DEVICE_VALUES
    
    values = device_manager.get_all_values()
    
    # シミュレーションモードが有効な場合、シミュレーションデバイスの値を追加
    if SIMULATION_MODE:
        sim_device_ids = [f"sim_{i}" for i in range(1, SIMULATION_DEVICE_COUNT + 1)]
        for sim_id in sim_device_ids:
            if sim_id in LAST_DEVICE_VALUES:
                # デバイス情報を取得
                device_info = discovery.get_device(sim_id)
                if device_info:
                    # 変換関数を使用して一貫したフォーマットに変換
                    from api.transformers import transform_value_for_frontend
                    values[sim_id] = transform_value_for_frontend(
                        sim_id,
                        LAST_DEVICE_VALUES[sim_id],
                        device_info
                    )
    
    meta = {
        "count": len(values),
        "timestamp": datetime.now().timestamp()
    }
    return create_success_response({"values": values}, meta)

@app.route('/api/scan', methods=['POST'])
def scan_devices():
    """ネットワークスキャンを開始"""
    # 非同期でスキャンを実行
    threading.Thread(target=lambda: discovery.discover_devices()).start()
    return create_success_response({
        "message": "スキャンを開始しました"
    })

@app.route('/api/devices/<device_id>/name', methods=['PUT'])
def update_device_name(device_id):
    """デバイスの表示名を更新"""
    data = request.json
    if not data or "name" not in data:
        return create_error_response(400, "Name is required")

    # デバイス名を更新
    if discovery.update_device_name(device_id, data["name"]):
        return create_success_response({
            "device_id": device_id,
            "new_name": data["name"]
        })
    else:
        return create_error_response(404, "Device not found")

# 拡張BFFエンドポイント

@app.route('/api/statistics', methods=['GET'])
def get_statistics():
    """デバイスの統計情報を取得"""
    stats = device_manager.get_device_statistics()
    meta = {
        "timestamp": datetime.now().timestamp(),
        "calculation_mode": "real-time"
    }
    return create_success_response({"statistics": stats}, meta)

@app.route('/api/devices/summary', methods=['GET'])
def get_device_summary():
    """デバイス情報と値をまとめて取得（BFF向けデータ集約）"""
    global SIMULATION_MODE, LAST_DEVICE_VALUES
    summary = device_manager.get_device_summary()
    
    # シミュレーションモードが有効な場合、シミュレーションデバイスの値を追加
    if SIMULATION_MODE:
        sim_device_ids = [f"sim_{i}" for i in range(1, SIMULATION_DEVICE_COUNT + 1)]
        for sim_id in sim_device_ids:
            if sim_id in LAST_DEVICE_VALUES:
                # デバイス情報を取得
                device_info = discovery.get_device(sim_id)
                if device_info:
                    # 変換関数を使用して一貫したフォーマットに変換
                    from api.transformers import transform_value_for_frontend
                    if "values" not in summary:
                        summary["values"] = {}
                    summary["values"][sim_id] = transform_value_for_frontend(
                        sim_id,
                        LAST_DEVICE_VALUES[sim_id],
                        device_info
                    )
    
    meta = {
        "timestamp": datetime.now().timestamp(),
        "device_count": len(summary.get("devices", [])),
        "source": "BFF aggregation"
    }
    return create_success_response(summary, meta)

@app.route('/api/batch', methods=['POST'])
def batch_operations():
    """
    複数操作の一括処理（BFFの集約機能）- 並行処理で最適化

    複数のAPI操作を一度のリクエストで処理し、レスポンスを返します。
    操作数が1以下の場合は逐次処理、それ以上の場合は並行処理で最適化します。

    Returns:
        flask.Response: 操作結果のJSONレスポンス
    """
    import concurrent.futures

    operations = request.json.get('operations', [])

    # 操作が空の場合は空の結果を返す
    if not operations:
        return create_success_response({'results': []}, {'count': 0})

    # 操作が1つだけの場合は並行処理を使用しない
    if len(operations) == 1:
        results = [process_single_operation(operations[0])]
        return create_success_response({'results': results}, {'count': 1})

    # 並行処理を使用して操作を処理
    results = [None] * len(operations)  # 結果を格納する配列を初期化

    # ThreadPoolExecutorを使用して並行処理
    with concurrent.futures.ThreadPoolExecutor(max_workers=min(10, len(operations))) as executor:
        # 操作とインデックスをマップして並行実行
        future_to_index = {
            executor.submit(process_single_operation, op): i
            for i, op in enumerate(operations)
        }

        # 完了した順に結果を取得
        for future in concurrent.futures.as_completed(future_to_index):
            index = future_to_index[future]
            try:
                results[index] = future.result()
            except Exception as e:
                logger.error(f"バッチ処理の結果取得でエラー: {e}")
                results[index] = {
                    'type': operations[index].get('type', 'unknown'),
                    'result': None,
                    'error': f"処理エラー: {str(e)}"
                }

    return create_success_response(
        {'results': results},
        {'count': len(results), 'timestamp': datetime.now().timestamp()}
    )

def process_single_operation(operation):
    """
    単一の操作を処理する共通関数

    Args:
        operation (dict): 処理する操作の辞書

    Returns:
        dict: 処理結果
    """
    op_type = operation.get('type')
    op_params = operation.get('params', {})

    try:
        if op_type == 'get_device':
            device_id = op_params.get('device_id')
            device = discovery.get_device(device_id)
            # デバイス情報がある場合は変換関数を使用
            if device:
                device = transform_device_for_frontend(device)
            return {
                'type': 'get_device',
                'result': device
            }

        elif op_type == 'get_device_value':
            device_id = op_params.get('device_id')
            value = device_manager.get_device_value(device_id)
            # すでに変換済みのデータを受け取るのでそのまま使用
            return {
                'type': 'get_device_value',
                'result': value
            }

        elif op_type == 'get_statistics':
            stats = device_manager.get_device_statistics()
            # すでに変換済みのデータを受け取るのでそのまま使用
            return {
                'type': 'get_statistics',
                'result': stats
            }

        else:
            # 不明な操作タイプの場合はエラーを返す
            logger.warning(f"不明な操作タイプ: {op_type}")
            return {
                'type': op_type,
                'result': None,
                'error': 'Unknown operation type'
            }
    except Exception as e:
        # 例外が発生した場合はエラーログを記録して詳細を返す
        logger.error(f"操作処理でエラー: {op_type} - {e}")
        return {
            'type': op_type,
            'result': None,
            'error': str(e)
        }

# シミュレーションモード関連のエンドポイント
@app.route('/api/simulation/toggle', methods=['POST'])
def toggle_simulation_mode():
    """シミュレーションモードの切り替え"""
    global SIMULATION_MODE, LAST_DEVICE_VALUES
    SIMULATION_MODE = not SIMULATION_MODE
    
    # シミュレーションモードが有効になった場合、即座にデバイスを作成して通知
    if SIMULATION_MODE:
        sim_device_ids = [f"sim_{i}" for i in range(1, SIMULATION_DEVICE_COUNT + 1)]
        for sim_id in sim_device_ids:
            is_new = create_or_update_sim_device(sim_id)
            if is_new:
                # 初回作成時は個別通知（接続時の初期表示のため）
                socketio.emit('device_update', {
                    'device_id': sim_id,
                    'data': LAST_DEVICE_VALUES[sim_id]
                })
                logger.info(f"シミュレーションデバイス {sim_id} を作成して通知しました")
    else:
        # シミュレーションモードが無効になった場合、シミュレーションデバイスを削除
        sim_device_ids = [f"sim_{i}" for i in range(1, SIMULATION_DEVICE_COUNT + 1)]
        for sim_id in sim_device_ids:
            if sim_id in discovery.devices:
                del discovery.devices[sim_id]
            if sim_id in LAST_DEVICE_VALUES:
                del LAST_DEVICE_VALUES[sim_id]
            # 切断通知を送信
            socketio.emit('device_disconnected', {'device_id': sim_id})
            logger.info(f"シミュレーションデバイス {sim_id} を削除しました")

    return create_success_response({
        "simulation_mode": SIMULATION_MODE
    })

@app.route('/api/simulation/status', methods=['GET'])
def get_simulation_status():
    """シミュレーションモードのステータスを取得"""
    return create_success_response({
        "simulation_mode": SIMULATION_MODE,
        "device_count": SIMULATION_DEVICE_COUNT
    })

@app.route('/api/simulation/config', methods=['POST'])
def configure_simulation():
    """シミュレーションデバイスの個数を設定"""
    global SIMULATION_DEVICE_COUNT

    data = request.json
    if not data or "device_count" not in data:
        return create_error_response(400, "device_count is required")

    count = data.get('device_count')
    try:
        count = int(count)
    except (ValueError, TypeError):
        return create_error_response(400, "device_count must be an integer")

    # 1～20の範囲で制限
    if count < 1 or count > 20:
        return create_error_response(400, "device_count must be between 1 and 20")

    SIMULATION_DEVICE_COUNT = count
    logger.info(f"シミュレーションデバイス数を {SIMULATION_DEVICE_COUNT} に設定しました")

    return create_success_response({
        "device_count": SIMULATION_DEVICE_COUNT
    })

@app.route('/api/simulation/config', methods=['GET'])
def get_simulation_config():
    """シミュレーション設定を取得"""
    return create_success_response({
        "device_count": SIMULATION_DEVICE_COUNT
    })

@app.route('/api/simulation/devices/add', methods=['POST'])
def add_sim_device():
    """シミュレーションデバイスを1つ追加"""
    if not SIMULATION_MODE:
        return create_error_response(400, "Simulation mode is not enabled")

    # シミュレーションデバイス数の上限チェック
    sim_count = sum(1 for device_id in discovery.devices if device_id.startswith("sim_"))
    if sim_count >= SIMULATION_DEVICE_COUNT:
        error_message = f"Device count limit ({SIMULATION_DEVICE_COUNT}) reached. Cannot add more devices."
        # WebSocketでエラー通知
        socketio.emit('error', {
            'type': 'error',
            'code': 400,
            'message': f"device_count limit ({SIMULATION_DEVICE_COUNT}) reached"
        })
        return create_error_response(400, error_message)

    # シミュレーションデバイスの現在のIDを探す
    sim_ids = []
    for device_id in discovery.devices:
        if device_id.startswith("sim_"):
            sim_ids.append(device_id)

    # 次のIDを決定
    next_num = 1
    if sim_ids:
        # 既存のIDから番号を抽出して最大値を見つける
        existing_nums = []
        for sim_id in sim_ids:
            try:
                num = int(sim_id.split("_")[1])
                existing_nums.append(num)
            except (IndexError, ValueError):
                continue

        if existing_nums:
            next_num = max(existing_nums) + 1

    # 新しいデバイスを作成
    new_device_id = f"sim_{next_num}"
    is_new = create_or_update_sim_device(new_device_id)

    if is_new:
        # 初回作成時は個別通知
        socketio.emit('device_update', {
            'device_id': new_device_id,
            'data': LAST_DEVICE_VALUES[new_device_id]
        })
        logger.info(f"新しいシミュレーションデバイス {new_device_id} を追加しました")

    # 現在のシミュレーションデバイスリストを取得
    sim_devices = []
    for device_id in discovery.devices:
        if device_id.startswith("sim_"):
            sim_devices.append({
                "id": device_id,
                "name": discovery.devices[device_id].get("name", "Unknown"),
                "ip": discovery.devices[device_id].get("ip", "")
            })

    return create_success_response({
        "added_device_id": new_device_id,
        "simulation_devices": sim_devices
    })

@app.route('/api/simulation/devices/remove', methods=['POST'])
def remove_sim_device():
    """シミュレーションデバイスを1つ削除"""
    if not SIMULATION_MODE:
        return create_error_response(400, "Simulation mode is not enabled")

    data = request.json or {}
    device_id = data.get('device_id')

    # シミュレーションデバイスの現在のIDを探す
    sim_ids = []
    for did in discovery.devices:
        if did.startswith("sim_"):
            sim_ids.append(did)

    if not sim_ids:
        return create_error_response(404, "No simulation devices found")

    # 削除するデバイスを決定
    if device_id and device_id in sim_ids:
        # 指定されたIDのデバイスを削除
        target_device_id = device_id
    else:
        # 指定がなければ最も大きい番号のデバイスを削除
        existing_nums = []
        id_map = {}
        for sim_id in sim_ids:
            try:
                num = int(sim_id.split("_")[1])
                existing_nums.append(num)
                id_map[num] = sim_id
            except (IndexError, ValueError):
                continue

        if not existing_nums:
            return create_error_response(500, "Failed to parse device IDs")

        target_num = max(existing_nums)
        target_device_id = id_map[target_num]

    # デバイスを削除
    if target_device_id in discovery.devices:
        del discovery.devices[target_device_id]
    if target_device_id in LAST_DEVICE_VALUES:
        del LAST_DEVICE_VALUES[target_device_id]

    # 切断通知を送信
    socketio.emit('device_disconnected', {'device_id': target_device_id})
    logger.info(f"シミュレーションデバイス {target_device_id} を削除しました")

    # 残りのシミュレーションデバイスリストを取得
    remaining_devices = []
    for did in discovery.devices:
        if did.startswith("sim_"):
            remaining_devices.append({
                "id": did,
                "name": discovery.devices[did].get("name", "Unknown"),
                "ip": discovery.devices[did].get("ip", "")
            })

    return create_success_response({
        "removed_device_id": target_device_id,
        "remaining_devices": remaining_devices
    })

@app.route('/api/simulation/devices', methods=['GET'])
def list_sim_devices():
    """シミュレーションデバイスの一覧を取得"""
    sim_devices = []
    for device_id in discovery.devices:
        if device_id.startswith("sim_"):
            sim_devices.append({
                "id": device_id,
                "name": discovery.devices[device_id].get("name", "Unknown"),
                "ip": discovery.devices[device_id].get("ip", "")
            })

    return create_success_response({
        "devices": sim_devices,
        "count": len(sim_devices)
    })


# 値変更検出と通知の共通関数
def check_and_notify_value_change(device_id):
    """
    デバイス値を取得し、変更があれば通知する共通関数
    アダプティブ通知：値の変化率と時間経過に基づいて通知頻度を最適化

    Args:
        device_id (str): デバイスID

    Returns:
        bool: 値が変更され通知が送信された場合はTrue、それ以外はFalse
    """
    global LAST_DEVICE_VALUES, LAST_NOTIFICATION_TIMES

    current_time = datetime.now().timestamp()
    value_data = device_manager.get_device_value(device_id, use_cache=False)
    if not value_data:
        return False

    # 初回の場合は単純に通知
    if device_id not in LAST_DEVICE_VALUES:
        LAST_DEVICE_VALUES[device_id] = value_data.copy()
        LAST_NOTIFICATION_TIMES[device_id] = current_time

        # WebSocketで通知
        socketio.emit('device_update', {
            'device_id': device_id,
            'data': value_data
        })

        logger.debug(f"デバイス {device_id} の初期値を通知: {value_data['value']}")
        return True

    # 前回の値と時間を取得
    prev_value = LAST_DEVICE_VALUES[device_id]['value']
    prev_notification_time = LAST_NOTIFICATION_TIMES.get(device_id, 0)
    time_since_last_notification = current_time - prev_notification_time

    # 値の変化量を計算
    value_change = abs(value_data['value'] - prev_value)

    # 通知条件の評価
    should_notify = False

    # 条件1: 大きな値の変化
    if value_change >= NOTIFICATION_THRESHOLDS['value_change']:
        should_notify = True
        logger.debug(f"通知理由: 値の変化が大きい ({value_change})")

    # 条件2: 適度な時間経過かつ値の変化
    elif time_since_last_notification >= NOTIFICATION_THRESHOLDS['time_threshold'] and value_change > 0:
        should_notify = True
        logger.debug(f"通知理由: 時間経過 ({time_since_last_notification:.1f}秒) と値の変化あり")

    # 条件3: 一定時間以上経過（変化がなくてもハートビートとして通知）
    elif time_since_last_notification >= NOTIFICATION_THRESHOLDS['force_interval']:
        should_notify = True
        logger.debug(f"通知理由: 定期通知 ({time_since_last_notification:.1f}秒)")

    # 通知が必要な場合
    if should_notify:
        # 値と通知時間を更新
        LAST_DEVICE_VALUES[device_id] = value_data.copy()
        LAST_NOTIFICATION_TIMES[device_id] = current_time

        # WebSocketで通知（バッテリー最適化のためにクライアント数を確認）
        client_count = len(socketio.server.eio.sockets)

        # クライアントが接続されている場合のみ通知
        if client_count > 0:
            socketio.emit('device_update', {
                'device_id': device_id,
                'data': value_data
            })

            logger.debug(f"デバイス {device_id} の値変更を {client_count} クライアントに通知: {value_data['value']}")
            return True
        else:
            logger.debug(f"クライアント接続なし - 通知スキップ: {device_id}")

    # 値は更新するが通知はしない（次回の変化検出のため）
    LAST_DEVICE_VALUES[device_id] = value_data.copy()
    return False

def create_or_update_sim_device(sim_id):
    """
    シミュレーションデバイスの作成または更新を行う

    Args:
        sim_id (str): シミュレーションデバイスのID

    Returns:
        bool: デバイスが新規作成された場合はTrue、それ以外はFalse
    """
    global LAST_DEVICE_VALUES
    import random

    # デバイスが存在しなければ作成
    if sim_id not in LAST_DEVICE_VALUES:
        # シミュレーションデバイスを登録
        if sim_id not in discovery.devices:
            sim_device = {
                "id": sim_id,
                "name": f"シミュレーション {sim_id[-1]}",
                "ip": f"127.0.0.{sim_id[-1]}",
                "status": "online",
                "last_seen": datetime.now().timestamp()
            }
            discovery.devices[sim_id] = sim_device

        # 初期値を設定
        LAST_DEVICE_VALUES[sim_id] = {
            "value": random.randint(0, 100),
            "raw": random.randint(0, 1023),
            "timestamp": datetime.now().timestamp()
        }
        return True

    return False

def update_sim_device_value(sim_id, change_probability=0.3, max_change=10):
    """
    シミュレーションデバイスの値を変更し、アダプティブ通知戦略に基づいて必要に応じて通知する

    Args:
        sim_id (str): シミュレーションデバイスのID
        change_probability (float): 値変更の確率（0.0-1.0）
        max_change (int): 最大変化量

    Returns:
        bool: 値が変更され通知が送信された場合はTrue、それ以外はFalse
    """
    import random
    global LAST_DEVICE_VALUES, LAST_NOTIFICATION_TIMES

    current_time = datetime.now().timestamp()

    # 前回の値と通知時間を取得
    prev_value = LAST_DEVICE_VALUES[sim_id]["value"]
    prev_notification_time = LAST_NOTIFICATION_TIMES.get(sim_id, 0)
    time_since_last_notification = current_time - prev_notification_time

    # シミュレーション値の変更
    if random.random() < change_probability:  # 指定された確率で変更
        # 前回の値から少しだけ変化させる（自然な動き）
        new_value = max(0, min(100, prev_value + random.randint(-max_change, max_change)))
    else:
        # 変更しない場合は前回の値をそのまま使用
        new_value = prev_value

    # 生の値を計算
    new_raw = int(new_value * 10.23)  # 0-100を0-1023に変換

    # シミュレーションデータを作成
    sim_data = {
        "value": new_value,
        "raw": new_raw,
        "timestamp": current_time
    }

    # 値の変化量を計算
    value_change = abs(new_value - prev_value)

    # 通知条件の評価
    should_notify = False

    # 条件1: 大きな値の変化
    if value_change >= NOTIFICATION_THRESHOLDS['value_change']:
        should_notify = True
        logger.debug(f"通知理由: 値の変化が大きい ({value_change})")

    # 条件2: 適度な時間経過かつ値の変化
    elif time_since_last_notification >= NOTIFICATION_THRESHOLDS['time_threshold'] and value_change > 0:
        should_notify = True
        logger.debug(f"通知理由: 時間経過 ({time_since_last_notification:.1f}秒) と値の変化あり")

    # 条件3: 一定時間以上経過（変化がなくてもハートビートとして通知）
    elif time_since_last_notification >= NOTIFICATION_THRESHOLDS['force_interval']:
        should_notify = True
        logger.debug(f"通知理由: 定期通知 ({time_since_last_notification:.1f}秒)")

    # 通知が必要な場合
    if should_notify:
        # 値と通知時間を更新
        LAST_NOTIFICATION_TIMES[sim_id] = current_time

        # WebSocketで通知（バッテリー最適化のためにクライアント数を確認）
        client_count = len(socketio.server.eio.sockets)

        # クライアントが接続されている場合のみ通知
        if client_count > 0:
            socketio.emit('device_update', {
                'device_id': sim_id,
                'data': sim_data
            })

            logger.debug(f"シミュレーションデバイス {sim_id} の値変更を {client_count} クライアントに通知: {new_value}")
            result = True
        else:
            logger.debug(f"クライアント接続なし - 通知スキップ: {sim_id}")
            result = False
    else:
        result = False

    # 値は常に更新（次回の変化検出のため）
    LAST_DEVICE_VALUES[sim_id] = sim_data.copy()

    return result

# ステータスエンドポイント
@app.route('/api/status', methods=['GET'])
def get_status():
    """APIサーバーのステータスを取得"""
    status_data = {
        "api_status": "online",
        "version": "1.0.0",
        "simulation_mode": SIMULATION_MODE,
        "device_count": len(discovery.devices)
    }

    meta = {
        "timestamp": datetime.now().timestamp(),
        "uptime": time.time() - app.start_time if hasattr(app, 'start_time') else 0
    }

    return create_success_response(status_data, meta)

# アプリケーション初期化関数（起動時に直接実行）
def initialize_app():
    """アプリケーション初期化"""
    # アプリケーション起動時間を記録
    app.start_time = time.time()

    # 設定値をログ出力（デバッグ用）
    logger.info(f"========================================")
    logger.info(f"LeverAPI 起動設定:")
    logger.info(f"  UPDATE_INTERVAL = {UPDATE_INTERVAL} 秒 ({1/UPDATE_INTERVAL:.1f}Hz)")
    logger.info(f"  予想リクエスト頻度: {1/UPDATE_INTERVAL:.1f} req/sec/device")
    logger.info(f"========================================")

    # 別スレッドで初期スキャンを実行
    threading.Thread(target=lambda: discovery.discover_devices()).start()

    # リアルタイム監視タスクをバックグラウンドで開始
    socketio.start_background_task(realtime_monitor)

# エラーハンドラ
@app.errorhandler(404)
def not_found(error):
    return create_error_response(404, "Endpoint not found")

@app.errorhandler(500)
def server_error(error):
    logger.error(f"サーバーエラーが発生しました: {error}")
    details = None
    if app.debug:
        details = {
            "exception": str(error),
            "traceback": str(error.__traceback__)
        }
    return create_error_response(500, "Internal server error", details)

# WebSocketイベントハンドラ
@socketio.on('connect')
def handle_connect():
    """クライアント接続時の処理"""
    logger.info("WebSocketクライアント接続: %s", request.sid)
    # 接続時に最新の全デバイス値を送信
    all_values = device_manager.get_all_values()
    emit('all_values', all_values)

@socketio.on('disconnect')
def handle_disconnect():
    """クライアント切断時の処理"""
    logger.info("WebSocketクライアント切断: %s", request.sid)

@socketio.on('subscribe')
def handle_subscribe(data):
    """特定のデバイスのみ購読する"""
    device_id = data.get('device_id')
    if device_id:
        logger.info("クライアント %s がデバイス %s を購読", request.sid, device_id)
        # そのデバイスの最新値を送信
        value_data = device_manager.get_device_value(device_id)
        if value_data:
            emit('device_update', {'device_id': device_id, 'data': value_data})

# 一括通知のための変更検知とバッファリング
def batch_notify_changes(device_updates):
    """
    複数のデバイス更新を一括通知

    Args:
        device_updates (dict): デバイスIDをキーとする更新データ辞書

    Returns:
        int: 通知されたデバイス数
    """
    if not device_updates:
        return 0

    # クライアント数を確認
    client_count = len(socketio.server.eio.sockets)
    if client_count == 0:
        logger.debug(f"クライアント接続なし - 一括通知スキップ ({len(device_updates)}デバイス)")
        return 0

    # WebSocketで一括通知
    socketio.emit('devices_update', {
        'updates': device_updates,
        'timestamp': datetime.now().timestamp()
    })

    logger.debug(f"一括通知: {len(device_updates)}デバイスの更新を{client_count}クライアントに送信")
    return len(device_updates)

# リアルタイムデータ監視タスク
def realtime_monitor():
    """
    デバイスの値をリアルタイムに監視し、変更があればWebSocketで通知する
    アダプティブ通知戦略とバッチ処理で最適化
    短い間隔（100ms）で実行され、値の変化を即座に検出する
    """
    global LAST_KNOWN_DEVICE_IDS, LAST_DEVICE_VALUES, LAST_NOTIFICATION_TIMES

    logger.info("リアルタイム監視タスク開始")

    # 一括通知用の変数
    batch_interval = 0.033  # 一括通知間隔（秒） - 約33ms (30Hz)
    logger.info(f"  batch_interval = {batch_interval} 秒 ({1/batch_interval:.1f}Hz)")
    last_batch_time = time.time()
    pending_updates = {}  # 通知待ちの更新 {device_id: value_data}

    while True:
        try:
            current_time = time.time()

            # オンラインデバイスの現在の値を取得
            devices = discovery.get_devices()
            online_devices = [d['id'] for d in devices if d['status'] == 'online']
            current_device_ids = set(online_devices)
            
            # デバイス接続/切断の検出
            connected_devices = current_device_ids - LAST_KNOWN_DEVICE_IDS
            disconnected_devices = LAST_KNOWN_DEVICE_IDS - current_device_ids
            
            # 新規接続デバイスの通知
            for device_id in connected_devices:
                device_info = discovery.get_device(device_id)
                if device_info:
                    socketio.emit('device_connected', {
                        'device_id': device_id,
                        'device_info': device_info
                    })
                    logger.info(f"デバイス接続を通知: {device_id}")
            
            # 切断デバイスの通知
            for device_id in disconnected_devices:
                socketio.emit('device_disconnected', {
                    'device_id': device_id
                })
                logger.info(f"デバイス切断を通知: {device_id}")
                # 切断されたデバイスの値をクリア
                if device_id in LAST_DEVICE_VALUES:
                    del LAST_DEVICE_VALUES[device_id]
                if device_id in LAST_NOTIFICATION_TIMES:
                    del LAST_NOTIFICATION_TIMES[device_id]
            
            # デバイスIDセットを更新
            LAST_KNOWN_DEVICE_IDS = current_device_ids.copy()

            # それぞれのデバイスの値をチェック（共通関数を使用）
            for device_id in online_devices:
                # 値を取得して変更を確認
                value_data = device_manager.get_device_value(device_id, use_cache=False)
                if not value_data:
                    continue

                # 初回または値の変化がある場合
                if device_id not in LAST_DEVICE_VALUES:
                    # 初回の場合は即時通知（接続時の初期表示のため）
                    LAST_DEVICE_VALUES[device_id] = value_data.copy()
                    LAST_NOTIFICATION_TIMES[device_id] = current_time
                    # 接続時の初期表示は重要なので個別通知
                    socketio.emit('device_update', {
                        'device_id': device_id,
                        'data': value_data
                    })
                    logger.debug(f"デバイス {device_id} の初期値を通知: {value_data['value']}")
                    continue

                # 前回の値と時間を取得
                prev_value = LAST_DEVICE_VALUES[device_id]['value']
                prev_notification_time = LAST_NOTIFICATION_TIMES.get(device_id, 0)
                time_since_last_notification = current_time - prev_notification_time

                # 値の変化量を計算
                value_change = abs(value_data['value'] - prev_value)

                # 通知条件の評価
                should_notify = False

                # 条件1: 大きな値の変化
                if value_change >= NOTIFICATION_THRESHOLDS['value_change']:
                    should_notify = True

                # 条件2: 適度な時間経過かつ値の変化
                elif time_since_last_notification >= NOTIFICATION_THRESHOLDS['time_threshold'] and value_change > 0:
                    should_notify = True

                # 条件3: 一定時間以上経過（変化がなくてもハートビートとして通知）
                elif time_since_last_notification >= NOTIFICATION_THRESHOLDS['force_interval']:
                    should_notify = True

                # 通知が必要な場合は更新バッファに追加
                if should_notify:
                    # 通知時間と値を更新
                    LAST_DEVICE_VALUES[device_id] = value_data.copy()
                    LAST_NOTIFICATION_TIMES[device_id] = current_time

                    # アイドル後の最初の変化は即時通知（バッチを待たない）
                    # 100ms以上経過していたら即時通知でレスポンス改善
                    if time_since_last_notification >= 0.1:
                        socketio.emit('device_update', {
                            'device_id': device_id,
                            'data': value_data
                        })
                        logger.debug(f"デバイス {device_id} の変化を即時通知（アイドル後）: {value_data['value']}")
                    else:
                        # 通常はバッチ通知用にバッファに追加
                        pending_updates[device_id] = value_data
                else:
                    # 値は常に更新（次回の変化検出のため）
                    LAST_DEVICE_VALUES[device_id] = value_data.copy()

            # シミュレーションモードの場合も処理
            if SIMULATION_MODE:
                # シミュレーション用デバイスを確保（存在しなければ作成）
                sim_device_ids = [f"sim_{i}" for i in range(1, SIMULATION_DEVICE_COUNT + 1)]  # 3つのシミュレーションデバイス

                for sim_id in sim_device_ids:
                    # デバイスが存在しなければ作成
                    is_new = create_or_update_sim_device(sim_id)
                    if is_new:
                        # 初回作成時は個別通知（接続時の初期表示のため）
                        socketio.emit('device_update', {
                            'device_id': sim_id,
                            'data': LAST_DEVICE_VALUES[sim_id]
                        })
                        continue

                    # シミュレーション値を更新
                    current_time = time.time()
                    prev_value = LAST_DEVICE_VALUES[sim_id]["value"]
                    prev_notification_time = LAST_NOTIFICATION_TIMES.get(sim_id, 0)
                    time_since_last_notification = current_time - prev_notification_time

                    # シミュレーション値の計算
                    import random
                    if random.random() < 0.3:  # 30%の確率で値が変わる
                        new_value = max(0, min(100, prev_value + random.randint(-10, 10)))
                    else:
                        new_value = prev_value

                    new_raw = int(new_value * 10.23)  # 0-100を0-1023に変換

                    # シミュレーションデータを作成
                    sim_data = {
                        "value": new_value,
                        "raw": new_raw,
                        "timestamp": current_time
                    }

                    # 値の変化量を計算
                    value_change = abs(new_value - prev_value)

                    # 通知条件の評価
                    should_notify = False

                    # 条件1: 大きな値の変化
                    if value_change >= NOTIFICATION_THRESHOLDS['value_change']:
                        should_notify = True

                    # 条件2: 適度な時間経過かつ値の変化
                    elif time_since_last_notification >= NOTIFICATION_THRESHOLDS['time_threshold'] and value_change > 0:
                        should_notify = True

                    # 条件3: 一定時間以上経過（変化がなくてもハートビートとして通知）
                    elif time_since_last_notification >= NOTIFICATION_THRESHOLDS['force_interval']:
                        should_notify = True

                    # 値は常に更新（次回の変化検出のため）
                    LAST_DEVICE_VALUES[sim_id] = sim_data.copy()

                    # 通知が必要な場合はバッファに追加
                    if should_notify:
                        LAST_NOTIFICATION_TIMES[sim_id] = current_time
                        pending_updates[sim_id] = sim_data

            # 一定間隔で一括通知（バッファに貯まっている更新を送信）
            if (current_time - last_batch_time >= batch_interval) and pending_updates:
                batch_notify_changes(pending_updates)
                pending_updates = {}  # バッファをクリア
                last_batch_time = current_time

            # 短い間隔で監視（100ms）
            socketio.sleep(UPDATE_INTERVAL)

        except Exception as e:
            logger.error(f"リアルタイム監視エラー: {e}")
            socketio.sleep(1)  # エラー時は少し長めに待機

# メイン実行
if __name__ == '__main__':
    # 開発モードでの起動
    print("====================================================")
    print(" PedanticLeverController BFF API サーバー")
    print(" (C) 2023 Pedantic Co., Ltd.")
    print("====================================================")

    # アプリケーション初期化を実行（起動時に1回だけ）
    initialize_app()

    # WebSocketサーバーとして起動
    # PyInstallerでコンパイルされた場合はデバッグモードを無効化
    is_frozen = getattr(sys, 'frozen', False)
    socketio.run(app, host='0.0.0.0', port=5001, debug=(not is_frozen), allow_unsafe_werkzeug=True)