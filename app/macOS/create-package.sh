#!/bin/bash

# create-package.sh - macOSバージョン
# コンパイル済みのアプリケーションからZIPパッケージを作成します

# 文字コードをUTF-8に設定（ja_JP.UTF-8が利用できない場合はen_US.UTF-8を使用）
if locale -a | grep -q "ja_JP.UTF-8"; then
    export LANG="ja_JP.UTF-8"
    export LC_ALL="ja_JP.UTF-8"
    export LC_CTYPE="ja_JP.UTF-8"
else
    export LANG="en_US.UTF-8"
    export LC_ALL="en_US.UTF-8"
    export LC_CTYPE="en_US.UTF-8"
fi

# エラーが発生したらスクリプトを停止
set -e

echo "スクリプト実行開始: $(date)"

# 作業ディレクトリを保存
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "スクリプトディレクトリ: ${SCRIPT_DIR}"

# 現在の作業ディレクトリを表示
echo "現在の作業ディレクトリ: $(pwd)"

# プロジェクトルートディレクトリを計算
if [ -d "${SCRIPT_DIR}/../.." ]; then
    PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
    echo "プロジェクトルートディレクトリが存在します: ${PROJECT_ROOT}"
else
    echo "エラー: プロジェクトルートディレクトリが見つかりません: ${SCRIPT_DIR}/../.."
    exit 1
fi

echo "====== パッケージ作成プロセスを開始します ======"
echo "プロジェクトルート: ${PROJECT_ROOT}"
echo "出力先ディレクトリ: ${SCRIPT_DIR} (スクリプトと同じディレクトリ)"

# -------------------------------------------------------------------
# 必要なファイルを準備
# -------------------------------------------------------------------
echo ""
echo "==== 必要なファイルの準備 ===="

# 必要なバイナリファイルが存在することを確認
if [ ! -f "${SCRIPT_DIR}/LeverAPI" ]; then
    echo "エラー: LeverAPIバイナリが見つかりません: ${SCRIPT_DIR}/LeverAPI"
    exit 1
fi

if [ ! -f "${SCRIPT_DIR}/LeverVisualizer" ]; then
    echo "エラー: LeverVisualizerバイナリが見つかりません: ${SCRIPT_DIR}/LeverVisualizer"
    exit 1
fi

# リリース用の一時ディレクトリ構造を作成
TEMP_DIR="${PROJECT_ROOT}/leverApp"
rm -rf "${TEMP_DIR}" 2>/dev/null
mkdir -p "${TEMP_DIR}"

# バイナリをコピー
cp "${SCRIPT_DIR}/LeverAPI" "${TEMP_DIR}/"
cp "${SCRIPT_DIR}/LeverVisualizer" "${TEMP_DIR}/"

# 必要なディレクトリとファイルをコピー
cp -R "${PROJECT_ROOT}/positionVisualizer/"*.html "${TEMP_DIR}/"
cp -R "${PROJECT_ROOT}/positionVisualizer/assets" "${TEMP_DIR}/"
cp -R "${PROJECT_ROOT}/positionVisualizer/css" "${TEMP_DIR}/"
cp -R "${PROJECT_ROOT}/positionVisualizer/js" "${TEMP_DIR}/"

# 起動スクリプトをコピー
cp "${SCRIPT_DIR}/start_all.sh" "${TEMP_DIR}/start.sh"

# 実行権限を設定
chmod +x "${TEMP_DIR}/start.sh"
chmod +x "${TEMP_DIR}/LeverAPI"
chmod +x "${TEMP_DIR}/LeverVisualizer"

echo "既存の起動スクリプト(start_all.sh)をコピーしました"

# -------------------------------------------------------------------
# zipパッケージ作成
# -------------------------------------------------------------------
echo ""
echo "==== zipパッケージの作成 ===="

# zipファイル名（スクリプトと同じディレクトリに出力）
ZIP_FILE="${SCRIPT_DIR}/leverApp.zip"

# zipファイル作成
cd "${TEMP_DIR}/.."
zip -r "${ZIP_FILE}" "$(basename "${TEMP_DIR}")"

# 一時ディレクトリを削除
rm -rf "${TEMP_DIR}"

echo ""
echo "====== パッケージ作成プロセスが完了しました ======"
echo "パッケージが作成されました: ${ZIP_FILE}"
echo "$(date): パッケージ作成完了"