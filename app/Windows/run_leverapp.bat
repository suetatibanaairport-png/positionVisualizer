@echo off
setlocal EnableDelayedExpansion

:: run_leverapp.bat
:: LeverAPI、LeverHTTP、LeverBridgeを統合的に管理するWindowsスクリプト

:: コンソールウィンドウのサイズと色を設定
mode con: cols=80 lines=30
color 0A
title LeverApp 統合管理コンソール

:: アプリケーションディレクトリを取得
set "APP_DIR=%~dp0"
cd /d "%APP_DIR%"

:: ログディレクトリの作成は行わない

:: タイムスタンプを取得
for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set "dt=%%a"
set "TIMESTAMP=%dt:~0,8%_%dt:~8,6%"
:: プロセス出力はコンソールに表示（ファイル保存しない）
set "API_LOG=nul"
set "HTTP_LOG=nul"
set "BRIDGE_LOG=nul"

:: プロセスIDを保存する変数
set "API_PID="
set "HTTP_PID="
set "BRIDGE_PID="

:: 各バイナリが存在するか確認
if not exist ".\LeverAPI.exe" (
    echo エラー: LeverAPIが見つかりません
    pause
    exit /b 1
)

if not exist ".\LeverHTTP.exe" (
    echo エラー: LeverHTTPが見つかりません
    pause
    exit /b 1
)

if not exist ".\LeverBridge.exe" (
    echo エラー: LeverBridgeが見つかりません
    pause
    exit /b 1
)

:: ターミナル表示
cls
echo =======================================
echo         LeverApp 起動スクリプト
echo =======================================
echo.
echo 以下のコンポーネントを起動します:
echo 1. LeverAPI (バックエンド API サーバー)
echo 2. LeverHTTP (HTTP サーバー)
echo 3. LeverBridge (WebSocket ブリッジ)
echo.
echo ログはコンソールに表示されます
echo 終了するには Ctrl+C を押してください
echo.

:: 終了時の処理（関数の代わりにラベルを使用）
goto :start_services

:cleanup
echo.
echo === アプリケーションを終了しています ===
echo.

:: バックグラウンドで実行中のプロセスを終了
if defined API_PID (
    echo LeverAPIを終了中... (PID: %API_PID%)
    taskkill /F /PID %API_PID% >nul 2>&1
    if !ERRORLEVEL! NEQ 0 (
        echo LeverAPIの終了に失敗しました
    ) else (
        echo LeverAPIを終了しました
    )
)

if defined HTTP_PID (
    echo LeverHTTPを終了中... (PID: %HTTP_PID%)
    taskkill /F /PID %HTTP_PID% >nul 2>&1
    if !ERRORLEVEL! NEQ 0 (
        echo LeverHTTPの終了に失敗しました
    ) else (
        echo LeverHTTPを終了しました
    )
)

if defined BRIDGE_PID (
    echo LeverBridgeを終了中... (PID: %BRIDGE_PID%)
    taskkill /F /PID %BRIDGE_PID% >nul 2>&1
    if !ERRORLEVEL! NEQ 0 (
        echo LeverBridgeの終了に失敗しました
    ) else (
        echo LeverBridgeを終了しました
    )
)

:: 念のため、関連する実行ファイルを検索して終了
taskkill /F /IM LeverAPI.exe >nul 2>&1
taskkill /F /IM LeverHTTP.exe >nul 2>&1
taskkill /F /IM LeverBridge.exe >nul 2>&1

echo.
echo すべてのプロセスを終了しました
echo.
pause
exit /b 0

:start_services
:: 1. LeverAPI を起動
echo [1/3] LeverAPIを起動しています...
start /b "" ".\LeverAPI.exe" > "%API_LOG%" 2>&1

:: PIDの取得を試みる - より堅牢な方法
timeout /t 2 /nobreak > nul
for /f "tokens=2" %%a in ('wmic process where "name='LeverAPI.exe'" get ProcessId ^| findstr /r "[0-9]"') do (
    set "API_PID=%%a"
    goto :api_pid_found
)
:api_pid_found

:: PIDが有効か確認
if defined API_PID (
    echo [成功] LeverAPIが起動しました (PID: %API_PID%)
) else (
    echo [失敗] LeverAPIの起動に失敗しました
    goto cleanup
)

:: 2秒待機（APIサーバーが起動するのを待つ）
timeout /t 2 /nobreak > nul

:: 2. LeverHTTP を起動
echo [2/3] LeverHTTPを起動しています...
start /b "" ".\LeverHTTP.exe" > "%HTTP_LOG%" 2>&1

:: PIDの取得を試みる - より堅牢な方法
timeout /t 2 /nobreak > nul
for /f "tokens=2" %%a in ('wmic process where "name='LeverHTTP.exe'" get ProcessId ^| findstr /r "[0-9]"') do (
    set "HTTP_PID=%%a"
    goto :http_pid_found
)
:http_pid_found

:: PIDが有効か確認
if defined HTTP_PID (
    echo [成功] LeverHTTPが起動しました (PID: %HTTP_PID%)
) else (
    echo [失敗] LeverHTTPの起動に失敗しました
    goto cleanup
)

:: 1秒待機
timeout /t 1 /nobreak > nul

:: 3. LeverBridge を起動
echo [3/3] LeverBridgeを起動しています...
start /b "" ".\LeverBridge.exe" > "%BRIDGE_LOG%" 2>&1

:: PIDの取得を試みる - より堅牢な方法
timeout /t 2 /nobreak > nul
for /f "tokens=2" %%a in ('wmic process where "name='LeverBridge.exe'" get ProcessId ^| findstr /r "[0-9]"') do (
    set "BRIDGE_PID=%%a"
    goto :bridge_pid_found
)
:bridge_pid_found

:: PIDが有効か確認
if defined BRIDGE_PID (
    echo [成功] LeverBridgeが起動しました (PID: %BRIDGE_PID%)
) else (
    echo [失敗] LeverBridgeの起動に失敗しました
    goto cleanup
)

echo.
echo =======================================
echo        すべてのサービスが起動しました
echo =======================================
echo.
echo アクセス:
echo - HTTP: http://localhost:8000
echo - WebSocket: ws://localhost:8123
echo.
echo 終了するには Ctrl+C を押してください
echo.
echo ブラウザで自動的にアプリケーションを開いています...

:: 3秒待機してからブラウザを起動（サービスが完全に起動するまで待つ）
timeout /t 3 /nobreak > nul

:: メインページをデフォルトブラウザで開く
start "" "http://localhost:8000"

:: プロセスの監視ループ
:check_loop
:: すべてのプロセスが実行中か確認
tasklist /FI "PID eq %API_PID%" 2>nul | find "%API_PID%" >nul
if %ERRORLEVEL% NEQ 0 (
    echo [警告] LeverAPIが終了しました。アプリケーションを終了します。
    goto cleanup
)

tasklist /FI "PID eq %HTTP_PID%" 2>nul | find "%HTTP_PID%" >nul
if %ERRORLEVEL% NEQ 0 (
    echo [警告] LeverHTTPが終了しました。アプリケーションを終了します。
    goto cleanup
)

tasklist /FI "PID eq %BRIDGE_PID%" 2>nul | find "%BRIDGE_PID%" >nul
if %ERRORLEVEL% NEQ 0 (
    echo [警告] LeverBridgeが終了しました。アプリケーションを終了します。
    goto cleanup
)

:: 定期的なチェック
echo サービス実行中... [Ctrl+C で終了]
timeout /t 5 > nul
goto check_loop