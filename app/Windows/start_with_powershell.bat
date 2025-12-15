@echo off
:: PowerShellスクリプトを管理者権限で起動するラッパー
powershell -ExecutionPolicy Bypass -File "%~dp0run_leverapp.ps1"