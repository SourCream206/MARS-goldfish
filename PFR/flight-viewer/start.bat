@echo off
cd /d "%~dp0"
echo Starting Rocket Flight Visualizer at http://localhost:5173
npx --yes serve . -p 5173
