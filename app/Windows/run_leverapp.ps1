# run_leverapp.ps1
# LeverAPI、LeverHTTP、LeverBridgeを統合的に管理するPowerShellスクリプト

# タイトルの設定
$Host.UI.RawUI.WindowTitle = "LeverApp 統合管理コンソール"

# カラーの設定
$Host.UI.RawUI.ForegroundColor = "Green"
$Host.UI.RawUI.BackgroundColor = "Black"
Clear-Host

# アプリケーションディレクトリを取得
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -Path $scriptPath

# ログディレクトリの作成は行わない
# タイムスタンプを取得
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
# プロセス出力はコンソールに表示（ファイル保存しない）
$apiLog = $null
$httpLog = $null
$bridgeLog = $null

# プロセスを保存する変数
$apiProcess = $null
$httpProcess = $null
$bridgeProcess = $null

# 終了時の処理
function Cleanup {
    Write-Host ""
    Write-Host "=== アプリケーションを終了しています ===" -ForegroundColor Yellow

    # LeverAPIの終了
    if ($apiProcess -ne $null -and -not $apiProcess.HasExited) {
        Write-Host "LeverAPIを終了中... (PID: $($apiProcess.Id))"
        try {
            $apiProcess.Kill()
            Write-Host "LeverAPIを終了しました"
        } catch {
            Write-Host "LeverAPIの終了に失敗しました" -ForegroundColor Red
        }
    }

    # LeverHTTPの終了
    if ($httpProcess -ne $null -and -not $httpProcess.HasExited) {
        Write-Host "LeverHTTPを終了中... (PID: $($httpProcess.Id))"
        try {
            $httpProcess.Kill()
            Write-Host "LeverHTTPを終了しました"
        } catch {
            Write-Host "LeverHTTPの終了に失敗しました" -ForegroundColor Red
        }
    }

    # LeverBridgeの終了
    if ($bridgeProcess -ne $null -and -not $bridgeProcess.HasExited) {
        Write-Host "LeverBridgeを終了中... (PID: $($bridgeProcess.Id))"
        try {
            $bridgeProcess.Kill()
            Write-Host "LeverBridgeを終了しました"
        } catch {
            Write-Host "LeverBridgeの終了に失敗しました" -ForegroundColor Red
        }
    }

    # 念のため、残っているプロセスを強制終了
    Get-Process -Name "LeverAPI", "LeverHTTP", "LeverBridge" -ErrorAction SilentlyContinue | ForEach-Object {
        try {
            $_.Kill()
        } catch {}
    }

    Write-Host "すべてのプロセスを終了しました"
    Write-Host ""
    Read-Host "Enterキーを押して終了"
    exit
}

# Ctrl+Cでの中断時にCleanupを実行
$null = [Console]::TreatControlCAsInput = $true
$cancelTokenSource = New-Object System.Threading.CancellationTokenSource

# 各バイナリが存在するか確認
if (-not (Test-Path ".\LeverAPI.exe")) {
    Write-Host "エラー: LeverAPIが見つかりません" -ForegroundColor Red
    Read-Host "Enterキーを押して終了"
    exit 1
}

if (-not (Test-Path ".\LeverHTTP.exe")) {
    Write-Host "エラー: LeverHTTPが見つかりません" -ForegroundColor Red
    Read-Host "Enterキーを押して終了"
    exit 1
}

if (-not (Test-Path ".\LeverBridge.exe")) {
    Write-Host "エラー: LeverBridgeが見つかりません" -ForegroundColor Red
    Read-Host "Enterキーを押して終了"
    exit 1
}

# ターミナル表示
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host "        LeverApp 起動スクリプト        " -ForegroundColor White
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "以下のコンポーネントを起動します:" -ForegroundColor Yellow
Write-Host "1. LeverAPI (バックエンド API サーバー)"
Write-Host "2. LeverHTTP (HTTP サーバー)"
Write-Host "3. LeverBridge (WebSocket ブリッジ)"
Write-Host ""
Write-Host "ログは logs\ ディレクトリに保存されます"
Write-Host "終了するには Ctrl+C を押してください"
Write-Host ""

# 1. LeverAPI を起動
Write-Host "[1/3] LeverAPIを起動しています..." -ForegroundColor Yellow
try {
    $apiProcess = Start-Process -FilePath ".\LeverAPI.exe" -PassThru -WindowStyle Hidden
    Start-Sleep -Seconds 2

    if ($apiProcess -ne $null -and -not $apiProcess.HasExited) {
        Write-Host "✓ LeverAPIが起動しました (PID: $($apiProcess.Id))" -ForegroundColor Green
    } else {
        Write-Host "× LeverAPIの起動に失敗しました" -ForegroundColor Red
        Cleanup
    }
} catch {
    Write-Host "× LeverAPIの起動中にエラーが発生しました: $_" -ForegroundColor Red
    Cleanup
}

# 2秒待機（APIサーバーが起動するのを待つ）
Start-Sleep -Seconds 2

# 2. LeverHTTP を起動
Write-Host "[2/3] LeverHTTPを起動しています..." -ForegroundColor Yellow
try {
    $httpProcess = Start-Process -FilePath ".\LeverHTTP.exe" -PassThru -WindowStyle Hidden
    Start-Sleep -Seconds 2

    if ($httpProcess -ne $null -and -not $httpProcess.HasExited) {
        Write-Host "✓ LeverHTTPが起動しました (PID: $($httpProcess.Id))" -ForegroundColor Green
    } else {
        Write-Host "× LeverHTTPの起動に失敗しました" -ForegroundColor Red
        Cleanup
    }
} catch {
    Write-Host "× LeverHTTPの起動中にエラーが発生しました: $_" -ForegroundColor Red
    Cleanup
}

# 1秒待機
Start-Sleep -Seconds 1

# 3. LeverBridge を起動
Write-Host "[3/3] LeverBridgeを起動しています..." -ForegroundColor Yellow
try {
    $bridgeProcess = Start-Process -FilePath ".\LeverBridge.exe" -PassThru -WindowStyle Hidden
    Start-Sleep -Seconds 2

    if ($bridgeProcess -ne $null -and -not $bridgeProcess.HasExited) {
        Write-Host "✓ LeverBridgeが起動しました (PID: $($bridgeProcess.Id))" -ForegroundColor Green
    } else {
        Write-Host "× LeverBridgeの起動に失敗しました" -ForegroundColor Red
        Cleanup
    }
} catch {
    Write-Host "× LeverBridgeの起動中にエラーが発生しました: $_" -ForegroundColor Red
    Cleanup
}

Write-Host ""
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host "        すべてのサービスが起動しました        " -ForegroundColor Green
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "アクセス:" -ForegroundColor Yellow
Write-Host "- HTTP: http://localhost:8000"
Write-Host "- WebSocket: ws://localhost:8123"
Write-Host ""
Write-Host "終了するには Ctrl+C を押してください"
Write-Host ""
Write-Host "ブラウザで自動的にアプリケーションを開いています..." -ForegroundColor Yellow

# 3秒待機してからブラウザを起動（サービスが完全に起動するまで待つ）
Start-Sleep -Seconds 3

# メインページをデフォルトブラウザで開く
Start-Process "http://localhost:8000"

# プロセスの監視ループ
try {
    while ($true) {
        # すべてのプロセスが実行中か確認
        if ($apiProcess.HasExited) {
            Write-Host "⚠️ LeverAPIが終了しました。アプリケーションを終了します。" -ForegroundColor Red
            Cleanup
            break
        }

        if ($httpProcess.HasExited) {
            Write-Host "⚠️ LeverHTTPが終了しました。アプリケーションを終了します。" -ForegroundColor Red
            Cleanup
            break
        }

        if ($bridgeProcess.HasExited) {
            Write-Host "⚠️ LeverBridgeが終了しました。アプリケーションを終了します。" -ForegroundColor Red
            Cleanup
            break
        }

        # Ctrl+Cの処理
        if ([Console]::KeyAvailable) {
            $key = [Console]::ReadKey($true)
            if (($key.Modifiers -band [ConsoleModifiers]::Control) -and ($key.Key -eq [ConsoleKey]::C)) {
                Write-Host "Ctrl+C が押されました。終了しています..." -ForegroundColor Yellow
                Cleanup
                break
            }
        }

        Write-Host "サービス実行中... Ctrl+C で終了" -ForegroundColor DarkGray
        Start-Sleep -Seconds 5
        [Console]::SetCursorPosition(0, [Console]::CursorTop - 1)
        [Console]::Write(New-Object String(' ', [Console]::BufferWidth))
        [Console]::SetCursorPosition(0, [Console]::CursorTop)
    }
} finally {
    Cleanup
}