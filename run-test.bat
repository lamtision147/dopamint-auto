@echo off
setlocal enabledelayedexpansion

:: ========================================
:: Dopamint Playwright Auto Test Runner
:: Supports: single file, multiple files (comma-separated), or "all"
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

:: Track overall exit code
set OVERALL_EXIT_CODE=0

:: Check if running all tests
if /i "%TEST_FILE%"=="all" (
    echo.
    echo Running ALL tests...
    call :RunSingleTest "all" "All Tests"
    goto :EndScript
)

:: Check if multiple files (contains comma)
echo %TEST_FILE% | findstr /C:"," >nul
if %errorlevel%==0 (
    echo.
    echo Multiple files detected, running each separately...

    :: Parse comma-separated files
    set FILE_INDEX=0
    for %%F in (%TEST_FILE%) do (
        set /a FILE_INDEX+=1
        set "CURRENT_FILE=%%F"
        :: Remove any spaces
        set "CURRENT_FILE=!CURRENT_FILE: =!"
        echo.
        echo ----------------------------------------
        echo   [!FILE_INDEX!] Running: !CURRENT_FILE!
        echo ----------------------------------------
        call :RunSingleTest "!CURRENT_FILE!" "!CURRENT_FILE!"
    )
    goto :EndScript
)

:: Single file mode
echo.
echo Running single test: %TEST_FILE%
call :RunSingleTest "%TEST_FILE%" "%TEST_NAME%"
goto :EndScript

:: ========================================
:: Function: Run a single test file
:: ========================================
:RunSingleTest
set "SINGLE_FILE=%~1"
set "SINGLE_NAME=%~2"

:: Get current date/time for log file (instant - no external commands)
set "HH=%time:~0,2%"
set "MM=%time:~3,2%"
set "SS=%time:~6,2%"
if "%HH:~0,1%"==" " set "HH=0%HH:~1,1%"
set "datetime=%date:~-4%%date:~-7,2%%date:~-10,2%-%HH%%MM%%SS%"
set "datetime=%datetime:/=%"
set "datetime=%datetime:-=%"
set LOGFILE=test-results\test-log-%SINGLE_FILE%-%RANDOM%.txt

:: Log start
echo ======================================== >> !LOGFILE!
echo Test started at %date% %time% >> !LOGFILE!
echo Test file: %SINGLE_FILE% >> !LOGFILE!
echo ======================================== >> !LOGFILE!

:: Record start time in seconds
for /f "tokens=1-4 delims=:.," %%a in ("%time%") do (
    set /a START_H=%%a
    set /a START_M=1%%b-100
    set /a START_S=1%%c-100
)
set /a START_TOTAL=!START_H!*3600+!START_M!*60+!START_S!

echo Running Playwright test: %SINGLE_FILE%...
echo Running tests... >> !LOGFILE!

:: Use direct call instead of npx for faster startup
if /i "%SINGLE_FILE%"=="all" (
    call node_modules\.bin\playwright.cmd test tests/ --reporter=list 2>&1 >> !LOGFILE!
) else (
    call node_modules\.bin\playwright.cmd test tests/%SINGLE_FILE% --reporter=list 2>&1 >> !LOGFILE!
)
set TEST_EXIT_CODE=!errorlevel!

:: Record end time and calculate duration
for /f "tokens=1-4 delims=:.," %%a in ("%time%") do (
    set /a END_H=%%a
    set /a END_M=1%%b-100
    set /a END_S=1%%c-100
)
set /a END_TOTAL=!END_H!*3600+!END_M!*60+!END_S!

:: Calculate duration in seconds
set /a DURATION=!END_TOTAL!-!START_TOTAL!
if !DURATION! lss 0 set /a DURATION=!DURATION!+86400

echo Duration: !DURATION! seconds >> !LOGFILE!

:: Determine status
if !TEST_EXIT_CODE!==0 (
    set STATUS=PASSED
    echo [PASSED] %SINGLE_FILE%
) else (
    set STATUS=FAILED
    set OVERALL_EXIT_CODE=1
    echo [FAILED] %SINGLE_FILE%
)

echo Test finished with status: !STATUS! >> !LOGFILE!
echo Exit code: !TEST_EXIT_CODE! >> !LOGFILE!

:: Send Telegram notification for this test
echo Sending Telegram notification for %SINGLE_FILE%...
node scripts/send-telegram.js !STATUS! !DURATION! "%SINGLE_NAME%" "%SINGLE_FILE%" "!LOGFILE!"

:: Small delay between notifications to avoid rate limiting
timeout /t 2 /nobreak >nul

goto :eof

:: ========================================
:: End Script
:: ========================================
:EndScript
echo.
echo ========================================
echo   All Tests Complete! Check Telegram.
echo ========================================
echo.

:: Keep window open for 5 seconds
timeout /t 5

exit /b %OVERALL_EXIT_CODE%
