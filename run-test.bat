@echo off
setlocal enabledelayedexpansion

:: ========================================
:: Dopamint Playwright Auto Test Runner
:: ========================================

:: Set working directory
cd /d D:\claudecli

:: Create test-results folder if not exists
if not exist "test-results" mkdir test-results

:: Get current date/time for log file
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set LOGFILE=test-results\test-log-%datetime:~0,8%-%datetime:~8,6%.txt

:: Log start
echo ======================================== >> %LOGFILE%
echo Test started at %date% %time% >> %LOGFILE%
echo ======================================== >> %LOGFILE%

:: Record start time
set START_TIME=%time%

echo.
echo ========================================
echo   DOPAMINT AUTO TEST - Starting...
echo ========================================
echo.

:: Run Playwright test
echo Running Playwright tests...
echo Running tests... >> %LOGFILE%

call npx playwright test tests/dopamintLogin.spec.ts --reporter=list 2>&1 >> %LOGFILE%
set TEST_EXIT_CODE=%errorlevel%

:: Record end time
set END_TIME=%time%

:: Calculate duration (simplified - just show times)
echo Start: %START_TIME% >> %LOGFILE%
echo End: %END_TIME% >> %LOGFILE%

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
if defined SCREENSHOT (
    node scripts/send-telegram.js %STATUS% 0 "Login Test" "%SCREENSHOT%"
) else (
    node scripts/send-telegram.js %STATUS% 0 "Login Test"
)

echo.
echo ========================================
echo   Test Complete! Check Telegram.
echo ========================================
echo.

:: Keep window open for 5 seconds
timeout /t 5

exit /b %TEST_EXIT_CODE%
