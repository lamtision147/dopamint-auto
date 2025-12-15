@echo off
setlocal enabledelayedexpansion

:: ========================================
:: Dopamint Playwright Auto Test Runner
:: ========================================

:: Set working directory
cd /d D:\claudecli

:: Create test-results folder if not exists
if not exist "test-results" mkdir test-results

:: ========================================
:: Load config from test-config.txt
:: ========================================
set TEST_FILE=dopamintLogin.spec.ts
set TEST_NAME=Login Test

if exist "test-config.txt" (
    for /f "tokens=1,* delims==" %%A in ('findstr /v "^#" test-config.txt ^| findstr /v "^$"') do (
        if "%%A"=="TEST_FILE" set TEST_FILE=%%B
        if "%%A"=="TEST_NAME" set TEST_NAME=%%B
    )
)

echo.
echo ========================================
echo   Config: %TEST_FILE%
echo   Name: %TEST_NAME%
echo ========================================

:: Get current date/time for log file
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set LOGFILE=test-results\test-log-%datetime:~0,8%-%datetime:~8,6%.txt

:: Log start
echo ======================================== >> %LOGFILE%
echo Test started at %date% %time% >> %LOGFILE%
echo Test file: %TEST_FILE% >> %LOGFILE%
echo ======================================== >> %LOGFILE%

:: Record start time in seconds
for /f "tokens=1-4 delims=:.," %%a in ("%time%") do (
    set /a START_H=%%a
    set /a START_M=1%%b-100
    set /a START_S=1%%c-100
)
set /a START_TOTAL=%START_H%*3600+%START_M%*60+%START_S%

echo.
echo ========================================
echo   DOPAMINT AUTO TEST - Starting...
echo ========================================
echo.

:: Run Playwright test
echo Running Playwright tests...
echo Running tests... >> %LOGFILE%

if /i "%TEST_FILE%"=="all" (
    echo Running all tests...
    call npx playwright test tests/ --reporter=list 2>&1 >> %LOGFILE%
) else (
    call npx playwright test tests/%TEST_FILE% --reporter=list 2>&1 >> %LOGFILE%
)
set TEST_EXIT_CODE=%errorlevel%

:: Record end time and calculate duration
for /f "tokens=1-4 delims=:.," %%a in ("%time%") do (
    set /a END_H=%%a
    set /a END_M=1%%b-100
    set /a END_S=1%%c-100
)
set /a END_TOTAL=%END_H%*3600+%END_M%*60+%END_S%

:: Calculate duration in seconds
set /a DURATION=%END_TOTAL%-%START_TOTAL%
if %DURATION% lss 0 set /a DURATION=%DURATION%+86400

echo Start: %time% >> %LOGFILE%
echo Duration: %DURATION% seconds >> %LOGFILE%

:: Determine status
if %TEST_EXIT_CODE%==0 (
    set STATUS=PASSED
    echo.
    echo ✅ TEST PASSED!
) else (
    set STATUS=FAILED
    echo.
    echo ❌ TEST FAILED!
)

echo Test finished with status: %STATUS% >> %LOGFILE%
echo Exit code: %TEST_EXIT_CODE% >> %LOGFILE%

:: Find latest screenshot
set SCREENSHOT=
if exist "test-results\dopamint-metamask-connected.png" (
    set SCREENSHOT=test-results\dopamint-metamask-connected.png
)

:: Send Telegram notification
echo.
echo Sending Telegram notification...
node scripts/send-telegram.js %STATUS% %DURATION% "%TEST_NAME%" "%TEST_FILE%"

echo.
echo ========================================
echo   Test Complete! Check Telegram.
echo ========================================
echo.

:: Keep window open for 5 seconds
timeout /t 5

exit /b %TEST_EXIT_CODE%
