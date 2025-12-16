#!/bin/bash

# ========================================
# Dopamint Playwright Auto Test Runner
# For AWS CodeBuild / Linux environments
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

# Track overall exit code
OVERALL_EXIT_CODE=0

# Function to run a single test
run_single_test() {
    local SINGLE_FILE="$1"
    local SINGLE_NAME="$2"

    # Generate log file name
    local TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    local LOGFILE="test-results/test-log-${SINGLE_FILE}-${TIMESTAMP}.txt"

    echo ""
    echo "========================================"
    echo "  Running: $SINGLE_FILE"
    echo "========================================"

    # Log start
    echo "========================================" >> "$LOGFILE"
    echo "Test started at $(date)" >> "$LOGFILE"
    echo "Test file: $SINGLE_FILE" >> "$LOGFILE"
    echo "========================================" >> "$LOGFILE"

    # Record start time
    START_TIME=$(date +%s)

    echo "Running Playwright test: $SINGLE_FILE..."
    echo "Running tests..." >> "$LOGFILE"

    # Run the test
    local TEST_EXIT_CODE=0
    if [ "$SINGLE_FILE" = "all" ]; then
        npx playwright test tests/ --reporter=list 2>&1 | tee -a "$LOGFILE" || TEST_EXIT_CODE=$?
    else
        npx playwright test "tests/$SINGLE_FILE" --reporter=list 2>&1 | tee -a "$LOGFILE" || TEST_EXIT_CODE=$?
    fi

    # Calculate duration
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))

    echo "Duration: $DURATION seconds" >> "$LOGFILE"

    # Determine status
    local STATUS
    if [ $TEST_EXIT_CODE -eq 0 ]; then
        STATUS="PASSED"
        echo "[PASSED] $SINGLE_FILE"
    else
        STATUS="FAILED"
        OVERALL_EXIT_CODE=1
        echo "[FAILED] $SINGLE_FILE"
    fi

    echo "Test finished with status: $STATUS" >> "$LOGFILE"
    echo "Exit code: $TEST_EXIT_CODE" >> "$LOGFILE"

    # Send Telegram notification
    echo "Sending Telegram notification for $SINGLE_FILE..."
    node scripts/send-telegram.js "$STATUS" "$DURATION" "$SINGLE_NAME" "$SINGLE_FILE" "$LOGFILE" || true

    # Small delay between notifications
    sleep 2
}

# Check if running all tests
if [ "$TEST_FILE" = "all" ]; then
    echo ""
    echo "Running ALL tests..."
    run_single_test "all" "All Tests"

# Check if multiple files (contains comma)
elif [[ "$TEST_FILE" == *","* ]]; then
    echo ""
    echo "Multiple files detected, running each separately..."

    # Parse comma-separated files
    IFS=',' read -ra FILES <<< "$TEST_FILE"
    FILE_INDEX=0

    for FILE in "${FILES[@]}"; do
        FILE_INDEX=$((FILE_INDEX + 1))
        # Remove whitespace
        FILE=$(echo "$FILE" | xargs)

        echo ""
        echo "----------------------------------------"
        echo "  [$FILE_INDEX] Running: $FILE"
        echo "----------------------------------------"

        run_single_test "$FILE" "$FILE"
    done

# Single file mode
else
    echo ""
    echo "Running single test: $TEST_FILE"
    run_single_test "$TEST_FILE" "$TEST_NAME"
fi

echo ""
echo "========================================"
echo "  All Tests Complete! Check Telegram."
echo "========================================"
echo ""

exit $OVERALL_EXIT_CODE
