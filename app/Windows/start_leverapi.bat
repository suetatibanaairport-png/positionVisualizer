@echo off
:: Ctrl+Cによる中断を無効化（Ctrl+Breakは有効）
break off

:: 終了時に必ず実行される関数を定義
setlocal enabledelayedexpansion
set "API_PID="

:: 現在のバッチファイルのディレクトリに移動
cd /d %~dp0

:: ログディレクトリの作成（存在しない場合）
if not exist logs mkdir logs

:: 日時を含むログファイル名を作成
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do set DATE=%%c%%a%%b
for /f "tokens=1-3 delims=:." %%a in ('time /t') do set TIME=%%a%%b
set TIMESTAMP=%DATE%_%TIME%
set API_LOG=logs\leverapi-%TIMESTAMP%.log

echo ====================================
echo LeverAPI サーバーを起動します
echo ====================================
echo.
echo ログは以下のファイルに保存されます:
echo  - %CD%\%API_LOG%
echo.

:: バッチ終了時に確実にクリーンアップを実行するためのトラップ
title LeverAPI_Controller
for /f "tokens=2" %%a in ('tasklist /fi "windowtitle eq LeverAPI_Controller" /fo list ^| find "PID:"') do set BATCH_PID=%%a

:: API起動
start /b "" LeverAPI.exe > %API_LOG% 2>&1
:: PIDを取得
for /f "tokens=2" %%a in ('tasklist /fi "imagename eq LeverAPI.exe" /fo list ^| find "PID:"') do set "API_PID=%%a"

echo.
echo サーバーが起動しました (ポート5001)
echo ブラウザでフロントエンド画面を開いてください
echo.
echo ※終了する場合は Q または q キーを押してください
echo ※Ctrl+C を押しても安全に終了できます
echo ※他のキーは無視されます
echo ※プログラムが完全に終了します

:WAIT_LOOP
choice /C Qq /N /M "終了するには Q または q キーを押してください" > nul
if errorlevel 1 if not errorlevel 3 (
    goto :CLEANUP
)
goto WAIT_LOOP

:CLEANUP
echo.
echo サーバーを終了しています...
if defined API_PID (
    taskkill /F /PID %API_PID% 2>nul
) else (
    taskkill /F /IM LeverAPI.exe 2>nul
)
echo 終了しました
pause
exit /b 0