@echo off
cd /d "%~dp0"
echo TatameSmart - agente da impressora termica
echo Deixe esta janela aberta enquanto usa o sistema.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0TatameSmart-Impressora.ps1"
pause
