@echo off
chcp 65001 >nul
cd /d "%~dp0"

if not exist node_modules (
    echo 처음 실행이라 필요한 파일을 설치합니다. 잠시만 기다려주세요...
    call npm install
)

echo 게임 서버를 시작합니다...
echo 이 창을 닫으면 게임이 꺼집니다.
echo.

start "" cmd /c "timeout /t 8 /nobreak >nul & start "" http://localhost:5173/"

call npm run dev
