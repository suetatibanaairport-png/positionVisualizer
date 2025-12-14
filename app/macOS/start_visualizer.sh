#!/bin/bash

# ターミナルのタイトルを設定（対応しているターミナルの場合）
echo -e "\033]0;LeverVisualizer - ポジション可視化ツール\007"

# 現在のディレクトリを取得
APP_DIR=$(dirname "$0")
cd "$APP_DIR"

# ターミナルの色を設定（緑色のテキスト）
echo -e "\033[32m"

# ヘッダー表示
echo "=========================================="
echo "      LeverVisualizer - ポジション可視化ツール"
echo "=========================================="
echo ""
echo "アプリケーションを起動しています..."
echo "ログはlogs/ディレクトリに保存されます。"
echo ""
echo "終了するには、このウィンドウでQキーまたはCtrl+Cを押してください"
echo ""

# ログディレクトリの作成（存在しない場合）
mkdir -p ./logs

# 日時を含むログファイル名を作成
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="./logs/leverVisualizer-${TIMESTAMP}.log"

# プロセスID変数
LEVERVisualizer_PID=""

# 関数: クリーンアップ処理
cleanup() {
  echo ""
  echo "アプリケーションを終了しています..."
  echo "すべてのプロセスをクリーンアップしています..."

  # LeverVisualizerプロセスの終了
  if [ -n "$LEVERVisualizer_PID" ]; then
    kill -9 $LEVERVisualizer_PID 2>/dev/null
  else
    pkill -f "LeverVisualizer" 2>/dev/null
  fi

  # HTTPサーバーとWebSocketサーバーのプロセスを強制終了（念のため）
  pkill -f "http-server" 2>/dev/null
  pkill -f "bridge-server" 2>/dev/null

  echo ""
  echo "終了しました。Enterキーを押すと閉じます..."
  read -p ""
  exit 0
}

# Ctrl+C でクリーンアップ関数を呼び出す
trap cleanup SIGINT SIGTERM

# exe実行時のパラメータを設定（必要に応じて）
PARAMS=""

# アプリケーションを実行
./LeverVisualizer $PARAMS > "$LOG_FILE" 2>&1 &
LEVERVisualizer_PID=$!

# プロセスが実行中かチェック
if ps -p $LEVERVisualizer_PID > /dev/null; then
  echo "LeverVisualizer が起動しました (PID: $LEVERVisualizer_PID)"
  echo "ログ: $LOG_FILE"
else
  echo "[エラー] LeverVisualizer の起動に失敗しました"
  exit 1
fi

# キー入力を待機するループ
echo ""
echo "アプリケーションは実行中です..."
echo "終了するには Q または q キーを押してください"

while true; do
  # sttyを使って1文字だけ読み取る（Enterキー不要）
  read -n 1 -s key

  # Q/qキーが押されたらクリーンアップして終了
  if [ "$key" = "q" ] || [ "$key" = "Q" ]; then
    cleanup
  fi
done