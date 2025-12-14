@echo off
setlocal enabledelayedexpansion
chcp 65001 > nul
title LeverScope - ポジション可視化ツール

:: 現在のディレクトリを取得
set "APP_DIR=%~dp0"
cd /d "%APP_DIR%"

:: コンソールウィンドウのサイズと色を設定
mode con: cols=80 lines=25
color 0A

echo ==========================================
echo      LeverScope - ポジション可視化ツール
echo ==========================================
echo.
echo アプリケーションを起動しています...
echo ログはlogs/ディレクトリに保存されます。
echo.
echo 終了するには、このウィンドウでQキーまたはCtrl+Cを押してください
echo.

:: exe実行時のパラメータを設定（必要に応じて）
set "PARAMS="

:: プロセスIDを記録
for /f "tokens=2" %%a in ('tasklist /fi "windowtitle eq LeverScope - ポジション可視化ツール" /fo list ^| find "PID:"') do set BATCH_PID=%%a

:: アプリケーションをバックグラウンドで実行
start "LeverVisualizer" /b "%APP_DIR%LeverVisualizer.exe" %PARAMS%

:: 少し待機して、プロセスIDを取得して表示
timeout /t 1 > nul
for /f "tokens=2" %%p in ('tasklist /fi "imagename eq LeverVisualizer.exe" /fo list ^| find "PID:"') do (
    set APP_PID=%%p
    echo LeverVisualizer が起動しました (PID: %%p)
    echo ログはlogs/ディレクトリに保存されます。
)

:: アプリケーションの終了を待機
echo.
echo アプリケーションは実行中です...
echo 終了するには、このウィンドウでQキーを押してください

:wait_loop
:: choiceコマンドが存在するかチェック
where choice >nul 2>&1
if %errorlevel% equ 0 (
    :: Qキーが押されたかチェック（1秒間待機、タイムアウトしたらループ続行）
    choice /c Q /t 1 /d X /n > nul 2>&1
    if errorlevel 2 goto wait_loop
    if errorlevel 1 goto cleanup
) else (
    :: choiceコマンドがない場合の代替手段
    :: timeoutコマンドを使用（より広いWindowsバージョンで動作）
    echo アプリケーションを終了するにはCtrl+Cを押すか、このウィンドウを閉じてください...
    timeout /t 60 > nul
    goto wait_loop
)

:cleanup

:: 終了処理
echo.
echo アプリケーションを終了しています...
echo すべてのプロセスをクリーンアップしています...

:: LeverVisualizerプロセスを終了
if defined APP_PID (
    echo プロセスID %APP_PID% を終了中...
    taskkill /F /PID %APP_PID% > nul 2>&1
) else (
    echo LeverVisualizerプロセスを検索して終了中...
    taskkill /F /FI "IMAGENAME eq LeverVisualizer.exe" > nul 2>&1
)

:: 念のため、関連するプロセスも終了
taskkill /F /FI "WINDOWTITLE eq LeverVisualizer HTTP Server" > nul 2>&1
taskkill /F /FI "WINDOWTITLE eq LeverVisualizer Bridge Server" > nul 2>&1
taskkill /F /FI "IMAGENAME eq node.exe" /FI "WINDOWTITLE eq LeverVisualizer*" > nul 2>&1

echo.
echo 終了しました。何かキーを押すと閉じます...
pause > nul
exit /b 0