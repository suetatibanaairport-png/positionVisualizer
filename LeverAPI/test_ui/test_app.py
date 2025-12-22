#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
PedanticLeverController - テスト用UIサーバー

このモジュールはテスト用のUIサーバーを提供します。
本番環境では使用せず、動作確認用途のみに使用してください。
"""

# eventlet monkey_patch()を最初に実行する
import eventlet
eventlet.monkey_patch()

import os
import sys
import logging
import requests
from flask import Flask, render_template, redirect, url_for, request, jsonify
from flask_socketio import SocketIO

# 親ディレクトリのモジュールをインポートするためにパスを追加
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if parent_dir not in sys.path:
    sys.path.append(parent_dir)

# APIサーバーのインポートは必要ない - 直接プロキシで対応
# from app import app as api_app

# ロギング設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('test_ui')

# テスト用UIアプリケーション設定
app = Flask(__name__,
            static_folder='static',
            template_folder='templates')

# Socket.IOの初期化
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# CORS等の設定はAPIサーバーが行うので省略

# メインページ（シミュレーション制御ユーティリティにリダイレクト）
@app.route('/')
def index():
    """シミュレーション制御ユーティリティを表示（メインページ）"""
    logger.info("シミュレーション制御ユーティリティがメインページとして表示されました")
    return render_template('sim_utility.html')

# 旧UIへのアクセスパス
@app.route('/old')
def old_ui():
    """旧テスト用UIを表示"""
    logger.info("旧テスト用UIが表示されました")
    return render_template('index.html')

# シミュレーション制御ユーティリティ（/simでもアクセス可能に保持）
@app.route('/sim')
def sim_utility():
    """シミュレーション制御ユーティリティを表示"""
    logger.info("シミュレーション制御ユーティリティが表示されました")
    return render_template('sim_utility.html')

# リアルタイムテストページ
@app.route('/realtime')
def realtime():
    """リアルタイムテスト用UIページを表示"""
    logger.info("リアルタイムテスト用UIが表示されました")
    return render_template('realtime.html')

# APIへのルーティング - すべてのAPIリクエストを本体のAPIサーバーにプロキシ
@app.route('/api/<path:subpath>', methods=['GET', 'POST', 'PUT', 'DELETE'])
def api_proxy(subpath):
    """APIリクエストを本体のAPIサーバーに転送"""
    # APIサーバーはポート5001で動作していると想定
    api_url = f'http://localhost:5001/api/{subpath}'
    logger.info(f"APIリクエストをプロキシ: {api_url}")

    try:
        # リクエストメソッドをそのまま転送
        method = request.method
        headers = {k: v for k, v in request.headers if k != 'Host'}
        data = request.get_data()

        # リクエスト実行
        response = requests.request(
            method=method,
            url=api_url,
            headers=headers,
            data=data,
            params=request.args
        )

        # レスポンスを返す
        return (response.content, response.status_code, response.headers.items())
    except Exception as e:
        logger.error(f"APIプロキシエラー: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

# Socket.IO WebSocketサーバーを別のエンドポイントとして提供
@socketio.on('connect')
def handle_connect():
    """クライアント接続時の処理"""
    logger.info(f"WebSocketクライアント接続: {request.sid}")

@socketio.on('disconnect')
def handle_disconnect():
    """クライアント切断時の処理"""
    logger.info(f"WebSocketクライアント切断: {request.sid}")

# API Socket.IOプロキシ設定
api_socketio = None
def connect_to_api_socketio():
    """APIサーバーのSocket.IOに接続"""
    import socketio as sio_client
    global api_socketio

    try:
        # SocketIOクライアント作成
        api_socketio = sio_client.Client()

        # イベントハンドラー
        @api_socketio.on('connect')
        def on_connect():
            logger.info("APIサーバーWebSocket接続完了")

        @api_socketio.on('disconnect')
        def on_disconnect():
            logger.info("APIサーバーWebSocket切断")

        @api_socketio.on('*')
        def catch_all(event, data):
            # すべてのイベントをテストUIクライアントに転送
            logger.debug(f"APIイベント転送: {event}")
            socketio.emit(event, data)

        # APIサーバーに接続
        api_socketio.connect('http://localhost:5001')
        logger.info("APIサーバーWebSocketに接続しました")
    except Exception as e:
        logger.error(f"APIサーバーWebSocketへの接続エラー: {e}")

if __name__ == '__main__':
    # テスト用アプリケーション起動
    print("====================================================")
    print(" 警告: これはテスト用UIサーバーです")
    print(" 本番環境での使用は避けてください")
    print("====================================================")

    # APIサーバーを別プロセスで起動する方法を提示
    print("\n本来のAPIサーバーを起動するには:")
    print("  python ../app.py")
    print("\nテスト用UIサーバーを起動中...")

    # APIサーバーのSocket.IOに接続
    try:
        # 非同期で接続試行（APIサーバーが起動していない場合でもテストUIは起動する）
        eventlet.spawn(connect_to_api_socketio)
    except Exception as e:
        logger.warning(f"APIサーバー接続試行エラー: {e}")

    # SocketIOサーバーとして起動
    socketio.run(app, host='0.0.0.0', port=5005, debug=True)
