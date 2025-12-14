@echo off
REM create-package.bat - Windowsバージョン
REM コンパイル済みのアプリケーションからZIPパッケージを作成します

REM 文字コードをUTF-8に設定
chcp 65001 > nul

echo ====== パッケージ作成プロセスを開始します ======

REM 作業ディレクトリを設定
set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%SCRIPT_DIR%..\.."
cd /d "%PROJECT_ROOT%"

echo プロジェクトルート: %PROJECT_ROOT%
echo 出力先ディレクトリ: %SCRIPT_DIR% (スクリプトと同じディレクトリ)

REM -------------------------------------------------------------------
REM 必要なファイルを準備
REM -------------------------------------------------------------------
echo.
echo ==== 必要なファイルの準備 ====

REM 必要なバイナリファイルが存在することを確認
if not exist "%SCRIPT_DIR%LeverAPI.exe" (
    echo エラー: LeverAPIバイナリが見つかりません: %SCRIPT_DIR%LeverAPI.exe
    exit /b 1
)

if not exist "%SCRIPT_DIR%LeverVisualizer.exe" (
    echo エラー: LeverVisualizerバイナリが見つかりません: %SCRIPT_DIR%LeverVisualizer.exe
    exit /b 1
)

REM リリース用のディレクトリ構造を作成
set "TEMP_DIR=%PROJECT_ROOT%\leverApp"
if exist "%TEMP_DIR%" rd /s /q "%TEMP_DIR%"
mkdir "%TEMP_DIR%"

REM バイナリをコピー
copy /Y "%SCRIPT_DIR%LeverAPI.exe" "%TEMP_DIR%\"
copy /Y "%SCRIPT_DIR%LeverVisualizer.exe" "%TEMP_DIR%\"

REM 必要なディレクトリとファイルをコピー
copy /Y "%PROJECT_ROOT%\positionVisualizer\*.html" "%TEMP_DIR%\"
xcopy /E /I /Y "%PROJECT_ROOT%\positionVisualizer\assets" "%TEMP_DIR%\assets"
xcopy /E /I /Y "%PROJECT_ROOT%\positionVisualizer\css" "%TEMP_DIR%\css"
xcopy /E /I /Y "%PROJECT_ROOT%\positionVisualizer\js" "%TEMP_DIR%\js"

REM 起動バッチファイルをコピー
copy /Y "%SCRIPT_DIR%start_all.bat" "%TEMP_DIR%\start.bat"

echo 既存の起動スクリプト(start_all.bat)をコピーしました

REM -------------------------------------------------------------------
REM zipパッケージ作成
REM -------------------------------------------------------------------
echo.
echo ==== zipパッケージの作成 ====

REM zipファイル名（スクリプトと同じディレクトリに出力）
set "ZIP_FILE=%SCRIPT_DIR%leverApp.zip"

REM PowerShellを使用してzipファイルを作成
powershell -command "Compress-Archive -Path '%TEMP_DIR%\*' -DestinationPath '%ZIP_FILE%' -Force"

REM 一時ディレクトリを削除
rd /s /q "%TEMP_DIR%"

echo.
echo ====== パッケージ作成プロセスが完了しました ======
echo パッケージが作成されました: %ZIP_FILE%
echo %date% %time%: パッケージ作成完了

pause