@echo off
echo ====================================
echo LeverAPI サーバーを起動します
echo ====================================
echo.
start /b LeverAPI.exe
echo.
echo サーバーが起動しました (ポート5001)
echo ブラウザでフロントエンド画面を開いてください
echo.
echo ※終了する場合はこのウィンドウで何かキーを押してください
echo ※プログラムが完全に終了します
pause > nul
echo.
echo サーバーを終了しています...
taskkill /f /im LeverAPI.exe
echo 終了しました
pause