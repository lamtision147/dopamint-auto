#!/bin/bash

# ========================================
# Dopamint Playwright Auto Test Runner
# For AWS CodeBuild / Linux environments
# Supports parallel execution of spec files
# ========================================

set -e

# Default values (can be overridden by environment variables)
TEST_FILE="${TEST_FILE:-dopamintLogin.spec.ts}"
TEST_NAME="${TEST_NAME:-Dopamint Test}"

echo ""
echo "========================================"
echo "  Config: $TEST_FILE"
echo "  Name: $TEST_NAME"
echo "========================================"

# Create test-results folder if not exists
mkdir -p test-results

# Clean up previous test artifacts
rm -f test-results/token-urls.json
rm -f test-results/collection-url.txt
rm -f test-results/create-info.json

# Track overall exit code
OVERALL_EXIT_CODE=0

# Generate timestamp and log file
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
LOGFILE="test-results/test-log-${TIMESTAMP}.txt"

# Function to run tests and send notification
run_tests() {
    local TEST_PATTERN="$1"
    local TEST_DISPLAY_NAME="$2"

    echo ""
    echo "========================================"
    echo "  Running: $TEST_DISPLAY_NAME"
    echo "  Pattern: $TEST_PATTERN"
    echo "========================================"

    # Log start
    echo "========================================" >> "$LOGFILE"
    echo "Test started at $(date)" >> "$LOGFILE"
    echo "Test pattern: $TEST_PATTERN" >> "$LOGFILE"
    echo "========================================" >> "$LOGFILE"

    # Record start time
    START_TIME=$(date +%s)

    echo "Running Playwright tests in PARALLEL..."
    echo "Running tests..." >> "$LOGFILE"

    # Run all tests in parallel (Playwright handles parallelization)
    local TEST_EXIT_CODE=0
    npx playwright test $TEST_PATTERN --reporter=list 2>&1 | tee -a "$LOGFILE" || TEST_EXIT_CODE=$?

    # Calculate duration
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))

    echo "Duration: $DURATION seconds" >> "$LOGFILE"

    # Determine status
    local STATUS
    if [ $TEST_EXIT_CODE -eq 0 ]; then
        STATUS="PASSED"
        echo "[PASSED] All tests passed"
    else
        STATUS="FAILED"
        OVERALL_EXIT_CODE=1
        echo "[FAILED] Some tests failed"
    fi

    echo "Test finished with status: $STATUS" >> "$LOGFILE"
    echo "Exit code: $TEST_EXIT_CODE" >> "$LOGFILE"

    # Send Telegram notification
    echo "Sending Telegram notification..."
    node scripts/send-telegram.js "$STATUS" "$DURATION" "$TEST_DISPLAY_NAME" "$TEST_DISPLAY_NAME" "$LOGFILE" || true
}

# Build test pattern from TEST_FILE
if [ "$TEST_FILE" = "all" ]; then
    echo ""
    echo "Running ALL tests in parallel..."
    run_tests "tests/" "All Tests"

# Check if multiple files (contains comma)
elif [[ "$TEST_FILE" == *","* ]]; then
    echo ""
    echo "Multiple files detected, running ALL in parallel..."

    # Parse comma-separated files and build pattern
    IFS=',' read -ra FILES <<< "$TEST_FILE"
    TEST_PATTERNS=""

    for FILE in "${FILES[@]}"; do
        # Remove whitespace
        FILE=$(echo "$FILE" | xargs)
        TEST_PATTERNS="$TEST_PATTERNS tests/$FILE"
    done

    echo "Test files: $TEST_PATTERNS"
    run_tests "$TEST_PATTERNS" "$TEST_FILE"

# Single file mode
else
    echo ""
    echo "Running single test file: $TEST_FILE"
    run_tests "tests/$TEST_FILE" "$TEST_FILE"
fi

echo ""
echo "========================================"
echo "  All Tests Complete! Check Telegram."
echo "========================================"
echo ""

exit $OVERALL_EXIT_CODE
