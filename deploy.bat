@echo off
echo ==========================================
echo      Starting Auto-Deployment to GitHub
echo ==========================================

:: 1. 添加所有更改
echo [1/3] Adding files...
git add .

:: 2. 提交更改 (自动生成包含时间的备注)
echo [2/3] Committing changes...
set "timestamp=%date% %time%"
git commit -m "Auto-update: %timestamp%"

:: 3. 推送到 GitHub
echo [3/3] Pushing to GitHub...
git push

echo ==========================================
echo      Success! Website updated.
echo ==========================================
pause