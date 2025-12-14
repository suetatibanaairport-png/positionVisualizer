#!/bin/bash

# 現在のディレクトリを取得
APP_DIR=$(dirname "$0")
cd "$APP_DIR"

# ログディレクトリの作成
mkdir -p ./logs

# 日時を含むログファイル名を作成
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
API_LOG="./logs/leverapi-${TIMESTAMP}.log"

# 関数: クリーンアップ処理
cleanup() {
  echo ""
  echo "サーバーを終了しています..."
  if [ -n "$API_PID" ]; then
    kill -9 $API_PID 2>/dev/null
  else
    pkill -f "LeverAPI" 2>/dev/null
  fi
  echo "終了しました"
  exit 0
}

# Ctrl+C でクリーンアップ関数を呼び出す
trap cleanup SIGINT SIGTERM

# ヘッダーを表示
echo "===================================="
echo "LeverAPI サーバーを起動します"
echo "===================================="
echo ""
echo "ログは以下のファイルに保存されます："
echo " - $API_LOG"
echo ""

# APIを起動（バックグラウンド実行）
./LeverAPI > "$API_LOG" 2>&1 &
API_PID=$!

echo ""
echo "サーバーが起動しました (ポート5001)"
echo "ブラウザでフロントエンド画面を開いてください"
echo ""
echo "※終了する場合は Q キーまたは Ctrl+C を押してください"
echo "※他のキーは無視されます"
echo "※プログラムが完全に終了します"

# キー入力を待機するループ
while true; do
  # sttyを使って1文字だけ読み取る（Enterキー不要）
  read -n 1 -s key

  # Q/qキーが押されたらクリーンアップして終了
  if [ "$key" = "q" ] || [ "$key" = "Q" ]; then
    cleanup
  fi
done