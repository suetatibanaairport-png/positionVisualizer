@echo off
setlocal enabledelayedexpansion
chcp 65001 > nul
break off

:: ウィンドウタイトルを設定
title LeverScope 統合起動ツール

:: 色設定
color 0B

:: 現在のディレクトリを取得
set "APP_DIR=%~dp0"
cd /d "%APP_DIR%"

:: ログディレクトリの作成
if not exist "%APP_DIR%logs" mkdir "%APP_DIR%logs"

:: 日時を含むログファイル名を作成
set "TIMESTAMP=%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%%time:~6,2%"
set "TIMESTAMP=%TIMESTAMP: =0%"
set "API_LOG=%APP_DIR%logs\leverapi-%TIMESTAMP%.log"
set "FE_LOG=%APP_DIR%logs\visualizer-%TIMESTAMP%.log"

:: プロセスID保存用の変数
set "API_PID="
set "FE_PID="

echo =======================================================
echo               LeverScope 統合起動ツール
echo =======================================================
echo.
echo このバッチファイルはLeverAPIとフロントエンドを起動します。
echo 終了するにはQキーまたはCtrl+Cを押してください。
echo.
echo ログは以下のファイルに保存されます：
echo  - LeverAPI: %API_LOG%
echo  - フロントエンド: %FE_LOG%
echo.
echo =======================================================
echo.

:: LeverAPIを起動
echo [1/2] LeverAPIを起動しています...
if exist "%APP_DIR%LeverAPI.exe" (
    start /b "LeverAPI" "%APP_DIR%LeverAPI.exe" > "%API_LOG%" 2>&1

    :: PIDを取得
    for /f "tokens=2" %%a in ('tasklist /fi "imagename eq LeverAPI.exe" /fo list ^| find "PID:"') do set "API_PID=%%a"

    if defined API_PID (
        echo       LeverAPIが起動しました (PID: !API_PID!)
    ) else (
        echo       [警告] LeverAPIのPID取得に失敗しました
    )
) else (
    echo       [エラー] LeverAPI.exeが見つかりません
    echo               %APP_DIR%LeverAPI.exe
    goto :ERROR
)

:: 少し待機
timeout /t 3 /nobreak > nul

:: フロントエンドを起動
echo [2/2] フロントエンドを起動しています...
if exist "%APP_DIR%LeverVisualizer.exe" (
    start /b "LeverVisualizer" "%APP_DIR%LeverVisualizer.exe" > "%FE_LOG%" 2>&1

    :: PIDを取得
    for /f "tokens=2" %%a in ('tasklist /fi "imagename eq LeverVisualizer.exe" /fo list ^| find "PID:"') do set "FE_PID=%%a"

    if defined FE_PID (
        echo       フロントエンドが起動しました (PID: !FE_PID!)
    ) else (
        echo       [警告] フロントエンドのPID取得に失敗しました
    )
) else (
    echo       [エラー] LeverVisualizer.exeが見つかりません
    echo               %APP_DIR%LeverVisualizer.exe
    goto :ERROR
)

echo.
echo =======================================================
echo               全てのサービスが起動しました
echo =======================================================
echo.
echo 終了するには Q または q キーを押してください
echo.

:WAIT_LOOP
choice /C Qq /N /M "終了するには Q または q キーを押してください" > nul
if errorlevel 1 if not errorlevel 3 (
    goto :CLEANUP
)
goto WAIT_LOOP

:CLEANUP
echo.
echo =======================================================
echo               アプリケーションを終了しています
echo =======================================================
echo.

:: LeverAPIの終了
echo [1/2] LeverAPIを終了しています...
if defined API_PID (
    taskkill /F /PID %API_PID% 2>nul
    if !errorlevel! equ 0 (
        echo       LeverAPIを終了しました
    ) else (
        echo       [警告] LeverAPIの終了に失敗しました
        taskkill /F /IM LeverAPI.exe 2>nul
    )
) else (
    taskkill /F /IM LeverAPI.exe 2>nul
)

:: フロントエンドの終了
echo [2/2] フロントエンドを終了しています...
if defined FE_PID (
    taskkill /F /PID %FE_PID% 2>nul
    if !errorlevel! equ 0 (
        echo       フロントエンドを終了しました
    ) else (
        echo       [警告] フロントエンドの終了に失敗しました
        taskkill /F /IM LeverVisualizer.exe 2>nul
    )
) else (
    taskkill /F /IM LeverVisualizer.exe 2>nul
)

:: HTTPサーバーとWebSocketサーバーのプロセスを強制終了（念のため）
taskkill /F /FI "WINDOWTITLE eq LeverVisualizer HTTP Server" > nul 2>&1
taskkill /F /FI "WINDOWTITLE eq LeverVisualizer Bridge Server" > nul 2>&1
taskkill /F /FI "IMAGENAME eq node.exe" /FI "WINDOWTITLE eq LeverVisualizer*" > nul 2>&1

echo.
echo =======================================================
echo               全てのプロセスを終了しました
echo =======================================================
echo.
echo 何かキーを押すと閉じます...
pause > nul
exit /b 0

:ERROR
echo.
echo [エラー] 起動に失敗しました
echo 何かキーを押すと閉じます...
pause > nul
exit /b 1