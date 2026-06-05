@echo off
echo Starting Autonomous IT Helpdesk System...
if exist venv\Scripts\python.exe (
    venv\Scripts\python.exe run.py %*
) else (
    python run.py %*
)
