#!/bin/bash

# run_leverapp.sh
# LeverAPI、LeverHTTP、LeverBridgeを統合的に管理するシンプルなスクリプト

# 文字コードをUTF-8に設定
export LANG="en_US.UTF-8"
export LC_ALL="en_US.UTF-8"

# アプリケーションディレクトリを取得
APP_DIR=$(dirname "$0")
cd "$APP_DIR"

# ログディレクトリの作成は行わない

# タイムスタンプを取得
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
# プロセス出力はコンソールに表示（ファイル保存しない）
API_LOG="/dev/null"
HTTP_LOG="/dev/null"
BRIDGE_LOG="/dev/null"

# プロセスIDを保存する変数
API_PID=""
HTTP_PID=""
BRIDGE_PID=""

# 終了時の処理
cleanup() {
  echo ""
  echo "=== アプリケーションを終了しています ==="

  # LeverAPIの終了
  if [ -n "$API_PID" ]; then
    echo "LeverAPIを終了中... (PID: $API_PID)"
    kill $API_PID 2>/dev/null || pkill -f "LeverAPI"
  fi

  # LeverHTTPの終了
  if [ -n "$HTTP_PID" ]; then
    echo "LeverHTTPを終了中... (PID: $HTTP_PID)"
    kill $HTTP_PID 2>/dev/null || pkill -f "LeverHTTP"
  fi

  # LeverBridgeの終了
  if [ -n "$BRIDGE_PID" ]; then
    echo "LeverBridgeを終了中... (PID: $BRIDGE_PID)"
    kill $BRIDGE_PID 2>/dev/null || pkill -f "LeverBridge"
  fi

  echo "すべてのプロセスを終了しました"
  exit 0
}

# Ctrl+Cなどの割り込み時に cleanup を呼び出す
trap cleanup SIGINT SIGTERM

# ターミナル表示
clear
echo "======================================="
echo "        LeverApp 起動スクリプト"
echo "======================================="
echo ""
echo "以下のコンポーネントを起動します:"
echo "1. LeverAPI (バックエンド API サーバー)"
echo "2. LeverHTTP (HTTP サーバー)"
echo "3. LeverBridge (WebSocket ブリッジ)"
echo ""
echo "ログはコンソールに表示されます"
echo "終了するには Ctrl+C を押してください"
echo ""

# 各バイナリが存在するか確認
if [ ! -f "./LeverAPI" ]; then
  echo "エラー: LeverAPIが見つかりません"
  exit 1
fi

if [ ! -f "./LeverHTTP" ]; then
  echo "エラー: LeverHTTPが見つかりません"
  exit 1
fi

if [ ! -f "./LeverBridge" ]; then
  echo "エラー: LeverBridgeが見つかりません"
  exit 1
fi

# 実行権限を付与
chmod +x ./LeverAPI
chmod +x ./LeverHTTP
chmod +x ./LeverBridge

# 1. LeverAPI を起動
echo "[1/3] LeverAPIを起動しています..."
./LeverAPI > "$API_LOG" 2>&1 &
API_PID=$!

# PIDが有効か確認
if ps -p $API_PID > /dev/null; then
  echo "✅ LeverAPIが起動しました (PID: $API_PID)"
else
  echo "❌ LeverAPIの起動に失敗しました"
  cleanup
fi

# 2秒待機（APIサーバーが起動するのを待つ）
sleep 2

# 2. LeverHTTP を起動
echo "[2/3] LeverHTTPを起動しています..."
./LeverHTTP > "$HTTP_LOG" 2>&1 &
HTTP_PID=$!

# PIDが有効か確認
if ps -p $HTTP_PID > /dev/null; then
  echo "✅ LeverHTTPが起動しました (PID: $HTTP_PID)"
else
  echo "❌ LeverHTTPの起動に失敗しました"
  cleanup
fi

# 1秒待機
sleep 1

# 3. LeverBridge を起動
echo "[3/3] LeverBridgeを起動しています..."
./LeverBridge > "$BRIDGE_LOG" 2>&1 &
BRIDGE_PID=$!

# PIDが有効か確認
if ps -p $BRIDGE_PID > /dev/null; then
  echo "✅ LeverBridgeが起動しました (PID: $BRIDGE_PID)"
else
  echo "❌ LeverBridgeの起動に失敗しました"
  cleanup
fi

echo ""
echo "======================================="
echo "        すべてのサービスが起動しました"
echo "======================================="
echo ""
echo "アクセス:"
echo "- HTTP: http://localhost:8000"
echo "- WebSocket: ws://localhost:8123"
echo ""
echo "終了するには Ctrl+C を押してください"
echo ""
echo "ブラウザで自動的にアプリケーションを開いています..."

# 3秒待機してからブラウザを起動（サービスが完全に起動するまで待つ）
sleep 3

# メインページをデフォルトブラウザで開く
open "http://localhost:8000"

# プロセスの監視ループ
while true; do
  # すべてのプロセスが実行中か確認
  if ! ps -p $API_PID > /dev/null; then
    echo "⚠️ LeverAPIが終了しました。アプリケーションを終了します。"
    cleanup
  fi

  if ! ps -p $HTTP_PID > /dev/null; then
    echo "⚠️ LeverHTTPが終了しました。アプリケーションを終了します。"
    cleanup
  fi

  if ! ps -p $BRIDGE_PID > /dev/null; then
    echo "⚠️ LeverBridgeが終了しました。アプリケーションを終了します。"
    cleanup
  fi

  # 5秒待機してからプロセスを再チェック
  sleep 5
done