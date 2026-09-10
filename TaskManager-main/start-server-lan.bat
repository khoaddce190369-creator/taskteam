@echo off
chcp 65001 >nul
title Task Manager - Server LAN
color 0B

echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║     TASK MANAGER — LOCAL NETWORK SERVER      ║
echo  ╚══════════════════════════════════════════════╝
echo.

:: ── Kiểm tra quyền Admin ──
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Cần quyền Administrator để mở firewall.
    echo [*] Đang yêu cầu quyền Admin...
    echo.
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

:: ── Thiết lập biến ──
set PORT=3000
set APP_DIR=%~dp0

:: ── Mở Firewall port ──
echo [1/4] Đang mở Firewall cho port %PORT%...
netsh advfirewall firewall delete rule name="TaskManager-LAN" >nul 2>&1
netsh advfirewall firewall add rule name="TaskManager-LAN" dir=in action=allow protocol=TCP localport=%PORT% >nul 2>&1
if %errorlevel% equ 0 (
    echo       ✓ Firewall đã mở port %PORT%
) else (
    echo       ✗ Không thể mở firewall, kiểm tra lại quyền Admin
)

:: ── Lấy IP LAN ──
echo.
echo [2/4] Đang tìm địa chỉ IP mạng nội bộ...
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /C:"IPv4"') do (
    set RAW_IP=%%a
)
:: Trim khoảng trắng đầu
for /f "tokens=*" %%b in ("%RAW_IP%") do set LAN_IP=%%b

echo       ✓ IP LAN: %LAN_IP%

:: ── Kiểm tra Node.js ──
echo.
echo [3/4] Đang kiểm tra Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo       ✗ Không tìm thấy Node.js! Vui lòng cài đặt tại https://nodejs.org
    pause
    exit /b
)
for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo       ✓ Node.js %NODE_VER%

:: ── Hiển thị thông tin truy cập ──
echo.
echo  ══════════════════════════════════════════════
echo.
echo   Truy cập từ máy này:
echo       http://localhost:%PORT%
echo.
echo   Truy cập từ máy khác trong mạng LAN:
echo       http://%LAN_IP%:%PORT%
echo.
echo  ══════════════════════════════════════════════
echo.

:: ── Mở trình duyệt ──
echo [4/4] Đang khởi động server...
start "" "http://localhost:%PORT%"

:: ── Chạy Server ──
echo.
echo  Server đang chạy... Nhấn Ctrl+C để dừng.
echo  ──────────────────────────────────────────────
echo.
cd /d "%APP_DIR%"
node server.js

:: ── Khi server dừng, đóng Firewall rule ──
echo.
echo [*] Server đã dừng. Đang đóng Firewall rule...
netsh advfirewall firewall delete rule name="TaskManager-LAN" >nul 2>&1
echo     ✓ Đã xóa rule Firewall "TaskManager-LAN"
echo.
pause
