@echo off
setlocal enabledelayedexpansion

:: ========================================
:: Dopamint Playwright Auto Test Runner
:: Supports: single file, multiple files, filter by test case
:: ========================================

:: Set working directory
cd /d D:\claudecli

:: Create test-results folder if not exists
if not exist "test-results" mkdir test-results

:: ========================================
:: Load config from test-config.txt
:: ========================================
:: Check for child process argument
if "%1"=="--child" (
    set "TEST_FILE=%~2"
    set "IS_CHILD=1"
) else (
    set TEST_FILE=dopamintLogin.spec.ts
)

set TEST_NAME=Login Test
set TEST_CASE=

if not defined IS_CHILD (
    if exist "test-config.txt" (
        for /f "tokens=1,* delims==" %%A in ('findstr /v "^#" test-config.txt ^| findstr /v "^$"') do (
            if "%%A"=="TEST_FILE" set TEST_FILE=%%B
            if "%%A"=="TEST_NAME" set TEST_NAME=%%B
            :: <--- MỚI: Đọc thêm cấu hình TEST_CASE
            if "%%A"=="TEST_CASE" set TEST_CASE=%%B
        )
    )
)

echo.
echo ========================================
echo   Config: %TEST_FILE%
echo   Name: %TEST_NAME%
:: <--- MỚI: Hiển thị case đang lọc
if not "%TEST_CASE%"=="" echo   Case Filter: "%TEST_CASE%"
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
    echo Multiple files detected, running in PARALLEL mode like CodeBuild...

    :: Parse comma-separated files
    set FILE_INDEX=0
    for %%F in (%TEST_FILE%) do (
        set /a FILE_INDEX+=1
        set "CURRENT_FILE=%%F"
        set "CURRENT_FILE=!CURRENT_FILE: =!"
        
        if !FILE_INDEX! GTR 1 (
            echo Waiting 70s before starting next test...
            timeout /t 70 /nobreak
        )

        echo.
        echo ----------------------------------------
        echo   [!FILE_INDEX!] Spawning: !CURRENT_FILE!
        echo ----------------------------------------
        
        :: Create unique temp dir for child process to avoid conflicts
        set "CHILD_TMP=%TEMP%\dappwright-!RANDOM!-!FILE_INDEX!"
        if not exist "!CHILD_TMP!" mkdir "!CHILD_TMP!"

        :: Start in new window with unique temp dir
        start "Test: !CURRENT_FILE!" cmd /c "set TEMP=!CHILD_TMP!&& set TMP=!CHILD_TMP!&& run-test.bat --child !CURRENT_FILE!"
    )
    
    echo.
    echo All tests spawned in separate windows.
    echo Please check individual windows for progress.
    goto :eof
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

:: Get current date/time for log
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
:: <--- MỚI: Ghi log case filter
if not "%TEST_CASE%"=="" echo Test Case Filter: "%TEST_CASE%" >> !LOGFILE!
echo ======================================== >> !LOGFILE!

:: Record start time
for /f "tokens=1-4 delims=:.," %%a in ("%time%") do (
    set /a START_H=%%a
    set /a START_M=1%%b-100
    set /a START_S=1%%c-100
)
set /a START_TOTAL=!START_H!*3600+!START_M!*60+!START_S!

echo Running Playwright test: %SINGLE_FILE%...
if not "%TEST_CASE%"=="" echo   ...Filtering for case: "%TEST_CASE%"
echo Running tests... >> !LOGFILE!

:: ======================================================
:: <--- MỚI: Xử lý logic ghép lệnh chạy
:: ======================================================
set "CMD_ARGS=--reporter=list"

:: Nếu có TEST_CASE, thêm tham số -g (grep) vào lệnh
if not "%TEST_CASE%"=="" (
    set "CMD_ARGS=!CMD_ARGS! -g "%TEST_CASE%""
)

if /i "%SINGLE_FILE%"=="all" (
    call node_modules\.bin\playwright.cmd test tests/ !CMD_ARGS! 2>&1 >> !LOGFILE!
) else (
    call node_modules\.bin\playwright.cmd test tests/%SINGLE_FILE% !CMD_ARGS! 2>&1 >> !LOGFILE!
)
set TEST_EXIT_CODE=!errorlevel!
:: ======================================================

:: Record end time
for /f "tokens=1-4 delims=:.," %%a in ("%time%") do (
    set /a END_H=%%a
    set /a END_M=1%%b-100
    set /a END_S=1%%c-100
)
set /a END_TOTAL=!END_H!*3600+!END_M!*60+!END_S!

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

:: Send Telegram
echo Sending Telegram notification for %SINGLE_FILE%...
node scripts/send-telegram.js !STATUS! !DURATION! "%SINGLE_NAME%" "%SINGLE_FILE%" "!LOGFILE!"

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

timeout /t 5
exit /b %OVERALL_EXIT_CODE%