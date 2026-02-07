#!/bin/bash

# run_leverapp.sh
# LeverAPI、LeverHTTP、LeverBridgeを統合的に管理するシンプルなスクリプト

# 文字コードをUTF-8に設定
export LANG="en_US.UTF-8"
export LC_ALL="en_US.UTF-8"

# アプリケーションディレクトリを取得
APP_DIR=$(dirname "$0")
cd "$APP_DIR"

# config.jsonから設定を読み込む
CONFIG_FILE="$APP_DIR/config.json"
HOSTNAME="localhost"
HTTP_PORT="8000"

if [ -f "$CONFIG_FILE" ]; then
  # hostname を取得
  HOSTNAME=$(grep '"hostname"' "$CONFIG_FILE" | sed 's/.*:.*"\([^"]*\)".*/\1/' | tr -d ' ')
  # http.port を取得
  HTTP_PORT=$(awk '/"http"/{f=1} f && /"port"/{gsub(/[^0-9]/,"",$2);print $2;exit}' "$CONFIG_FILE")
fi

# デフォルト値にフォールバック
HOSTNAME="${HOSTNAME:-localhost}"
HTTP_PORT="${HTTP_PORT:-8000}"

# ログディレクトリの作成
LOG_DIR="$APP_DIR/logs"
mkdir -p "$LOG_DIR"

# タイムスタンプを取得
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
# ログファイルのパス設定
API_LOG="$LOG_DIR/leverapi_${TIMESTAMP}.log"
HTTP_LOG="$LOG_DIR/leverhttp_${TIMESTAMP}.log"
BRIDGE_LOG="$LOG_DIR/leverbridge_${TIMESTAMP}.log"
# リソース使用状況ログファイル
# RESOURCE_LOG="$LOG_DIR/resources_${TIMESTAMP}.log"
RESOURCE_LOG="/dev/null"  # リソースログを無効化

# プロセスIDを保存する変数
API_PID=""
HTTP_PID=""
BRIDGE_PID=""
MONITOR_PID=""

# リソース監視関数
monitor_resources() {
  echo "タイムスタンプ, プロセス, PID, CPU(%), メモリ(%)" > "$RESOURCE_LOG"

  while true; do
    # 現在の日時を取得
    CURRENT_TIME=$(date +"%Y-%m-%d %H:%M:%S")

    # 各プロセスのリソース使用状況を取得して記録
    if [ -n "$API_PID" ] && ps -p $API_PID > /dev/null; then
      PS_DATA=$(ps -p $API_PID -o %cpu,%mem | tail -n 1)
      echo "$CURRENT_TIME, LeverAPI, $API_PID, $PS_DATA" >> "$RESOURCE_LOG"
    fi

    if [ -n "$HTTP_PID" ] && ps -p $HTTP_PID > /dev/null; then
      PS_DATA=$(ps -p $HTTP_PID -o %cpu,%mem | tail -n 1)
      echo "$CURRENT_TIME, LeverHTTP, $HTTP_PID, $PS_DATA" >> "$RESOURCE_LOG"
    fi

    if [ -n "$BRIDGE_PID" ] && ps -p $BRIDGE_PID > /dev/null; then
      PS_DATA=$(ps -p $BRIDGE_PID -o %cpu,%mem | tail -n 1)
      echo "$CURRENT_TIME, LeverBridge, $BRIDGE_PID, $PS_DATA" >> "$RESOURCE_LOG"
    fi

    # 5秒待機してから次の測定
    sleep 5
  done
}

# 終了時の処理
cleanup() {
  echo ""
  echo "=== アプリケーションを終了しています ==="

  # リソース監視の終了
  if [ -n "$MONITOR_PID" ]; then
    echo "リソース監視を終了中... (PID: $MONITOR_PID)"
    kill $MONITOR_PID 2>/dev/null
  fi

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
  echo "リソース使用状況ログ: $RESOURCE_LOG"
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
echo "ログ: $API_LOG"
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
echo "ログ: $HTTP_LOG"
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
echo "ログ: $BRIDGE_LOG"
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
echo "- HTTP: http://$HOSTNAME:$HTTP_PORT"
echo ""
echo "ログファイル:"
echo "- LeverAPI: $API_LOG"
echo "- LeverHTTP: $HTTP_LOG"
echo "- LeverBridge: $BRIDGE_LOG"
echo "- リソース監視: $RESOURCE_LOG (5秒ごとに更新)"
echo ""
echo "終了するには Ctrl+C を押してください"
echo ""
echo "ブラウザで自動的にアプリケーションを開いています..."

# リソース監視を開始
echo "リソース監視を開始します... (5秒間隔で記録)"
monitor_resources &
MONITOR_PID=$!
echo "リソース監視プロセス開始 (PID: $MONITOR_PID)"

# 3秒待機してからブラウザを起動（サービスが完全に起動するまで待つ）
sleep 3

# メインページをデフォルトブラウザで開く
open "http://$HOSTNAME:$HTTP_PORT"

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