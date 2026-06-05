@echo off
echo Starting Autonomous IT Helpdesk System...
if exist venv\Scripts\activate.bat (
    call venv\Scripts\activate.bat
)
python run.py %*
