@echo off
cd /d "%~dp0"
node scripts/receiver.mjs
if errorlevel 1 pause
