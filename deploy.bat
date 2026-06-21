@echo off
REM Misane Portal — one-click deploy. Double-click to publish the app (frontend + backend).
cd /d "%~dp0"
echo ============================================
echo  Deploying the Misane Portal app
echo ============================================
echo.
echo [1/2] Commit + push to GitHub...
git add -A
git commit -m "deploy %date% %time%" || echo (nothing new to commit)
git push origin main
echo.
echo [2/2] Pull + build + restart on the server...
echo  (if prompted, enter the server password)
ssh root@76.13.103.171 "bash -lc 'cd /var/www/misane-portal && git fetch origin main && git reset --hard origin/main && cd frontend && npm run build && cd .. && systemctl restart misane-portal && echo SERVER-DEPLOYED-OK'"
echo.
echo Done. Look for SERVER-DEPLOYED-OK above. If you see it, you are live.
pause
