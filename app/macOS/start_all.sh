#!/bin/bash

# ターミナルのタイトルを設定（対応しているターミナルの場合）
echo -e "\033]0;LeverScope 統合起動ツール\007"

# ターミナルの色を設定（青色のテキスト）
echo -e "\033[34m"

# 現在のディレクトリを取得
APP_DIR=$(dirname "$0")
cd "$APP_DIR"

# ログディレクトリの作成
mkdir -p ./logs

# 日時を含むログファイル名を作成
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
API_LOG="./logs/leverapi-${TIMESTAMP}.log"
FE_LOG="./logs/visualizer-${TIMESTAMP}.log"

# プロセスID変数
API_PID=""
FE_PID=""

# ヘッダー表示
echo "======================================================="
echo "               LeverScope 統合起動ツール"
echo "======================================================="
echo ""
echo "このスクリプトはLeverAPIとフロントエンドを起動します。"
echo "終了するにはQキーまたはCtrl+Cを押してください。"
echo ""
echo "ログは以下のファイルに保存されます："
echo " - LeverAPI: $API_LOG"
echo " - フロントエンド: $FE_LOG"
echo ""
echo "======================================================="
echo ""

# 関数: クリーンアップ処理
cleanup() {
  echo ""
  echo "======================================================="
  echo "               アプリケーションを終了しています"
  echo "======================================================="
  echo ""

  # LeverAPIの終了
  echo "[1/2] LeverAPIを終了しています..."
  if [ -n "$API_PID" ]; then
    kill -9 $API_PID 2>/dev/null
    if [ $? -eq 0 ]; then
      echo "       LeverAPIを終了しました"
    else
      echo "       [警告] LeverAPIの終了に失敗しました"
      pkill -f "LeverAPI" 2>/dev/null
    fi
  else
    pkill -f "LeverAPI" 2>/dev/null
  fi

  # フロントエンドの終了
  echo "[2/2] フロントエンドを終了しています..."
  if [ -n "$FE_PID" ]; then
    kill -9 $FE_PID 2>/dev/null
    if [ $? -eq 0 ]; then
      echo "       フロントエンドを終了しました"
    else
      echo "       [警告] フロントエンドの終了に失敗しました"
      pkill -f "LeverScope" 2>/dev/null
    fi
  else
    pkill -f "LeverScope" 2>/dev/null
  fi

  # HTTPサーバーとWebSocketサーバーのプロセスを強制終了（念のため）
  pkill -f "http-server" 2>/dev/null
  pkill -f "bridge-server" 2>/dev/null

  echo ""
  echo "======================================================="
  echo "               全てのプロセスを終了しました"
  echo "======================================================="
  echo ""
  echo "Enterキーを押すと閉じます..."
  read -p ""
  exit 0
}

# エラー処理
error_exit() {
  echo ""
  echo "[エラー] 起動に失敗しました"
  echo "Enterキーを押すと閉じます..."
  read -p ""
  exit 1
}

# Ctrl+C でクリーンアップ関数を呼び出す
trap cleanup SIGINT SIGTERM

# LeverAPIを起動
echo "[1/2] LeverAPIを起動しています..."
if [ -f "./LeverAPI" ]; then
  ./LeverAPI > "$API_LOG" 2>&1 &
  API_PID=$!

  # プロセスが起動したか確認
  if ps -p $API_PID > /dev/null; then
    echo "       LeverAPIが起動しました (PID: $API_PID)"
  else
    echo "       [警告] LeverAPIのPID取得に失敗しました"
  fi
else
  echo "       [エラー] LeverAPIが見つかりません"
  echo "                $APP_DIR/LeverAPI"
  error_exit
fi

# 少し待機
sleep 3

# フロントエンドを起動
echo "[2/2] フロントエンドを起動しています..."
if [ -f "./LeverScope" ]; then
  ./LeverScope > "$FE_LOG" 2>&1 &
  FE_PID=$!

  # プロセスが起動したか確認
  if ps -p $FE_PID > /dev/null; then
    echo "       フロントエンドが起動しました (PID: $FE_PID)"
  else
    echo "       [警告] フロントエンドのPID取得に失敗しました"
  fi
else
  echo "       [エラー] LeverScopeが見つかりません"
  echo "                $APP_DIR/LeverScope"
  error_exit
fi

echo ""
echo "======================================================="
echo "               全てのサービスが起動しました"
echo "======================================================="
echo ""
echo "終了するには Q または q キーを押してください"
echo ""

# キー入力を待機するループ
while true; do
  # sttyを使って1文字だけ読み取る（Enterキー不要）
  read -n 1 -s key

  # Q/qキーが押されたらクリーンアップして終了
  if [ "$key" = "q" ] || [ "$key" = "Q" ]; then
    cleanup
  fi
done