#!/bin/bash

# ========================================
# Dopamint Playwright Auto Test Runner
# For AWS CodeBuild / Linux environments
# - Multiple spec files run in PARALLEL
# - Each spec file sends its own Telegram notification
# - Test cases within each file run SERIALLY
# ========================================

# Don't exit on error - we want to continue and send notifications
set +e

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

# Array to store background PIDs
declare -a PIDS

# Function to run a single spec file and send notification
run_single_spec() {
    local SPEC_FILE="$1"
    local TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    local LOGFILE="test-results/test-log-${SPEC_FILE}-${TIMESTAMP}.txt"

    echo ""
    echo "========================================"
    echo "  Starting: $SPEC_FILE"
    echo "========================================"

    # Log start
    echo "========================================" >> "$LOGFILE"
    echo "Test started at $(date)" >> "$LOGFILE"
    echo "Test file: $SPEC_FILE" >> "$LOGFILE"
    echo "========================================" >> "$LOGFILE"

    # Record start time
    local START_TIME=$(date +%s)

    echo "Running: $SPEC_FILE..."
    echo "Running tests..." >> "$LOGFILE"

    # Run the single spec file (tests within file run serially due to config)
    local TEST_EXIT_CODE=0
    npx playwright test "tests/$SPEC_FILE" --reporter=list 2>&1 | tee -a "$LOGFILE" || TEST_EXIT_CODE=$?

    # Calculate duration
    local END_TIME=$(date +%s)
    local DURATION=$((END_TIME - START_TIME))

    echo "Duration: $DURATION seconds" >> "$LOGFILE"

    # Determine status
    local STATUS
    if [ $TEST_EXIT_CODE -eq 0 ]; then
        STATUS="PASSED"
        echo "[PASSED] $SPEC_FILE"
    else
        STATUS="FAILED"
        echo "[FAILED] $SPEC_FILE"
    fi

    echo "Test finished with status: $STATUS" >> "$LOGFILE"
    echo "Exit code: $TEST_EXIT_CODE" >> "$LOGFILE"

    # Send Telegram notification immediately for this spec file
    echo "Sending Telegram notification for $SPEC_FILE..."
    node scripts/send-telegram.js "$STATUS" "$DURATION" "$SPEC_FILE" "$SPEC_FILE" "$LOGFILE" || true

    # Return exit code
    return $TEST_EXIT_CODE
}

# Check if running all tests
if [ "$TEST_FILE" = "all" ]; then
    echo ""
    echo "Running ALL spec files in parallel..."

    # Find all spec files and run them in parallel
    for SPEC in tests/*.spec.ts; do
        SPEC_NAME=$(basename "$SPEC")
        run_single_spec "$SPEC_NAME" &
        PIDS+=($!)
    done

# Check if multiple files (contains comma)
elif [[ "$TEST_FILE" == *","* ]]; then
    echo ""
    echo "Multiple files detected, running in PARALLEL..."
    echo "Each file will send its own Telegram notification when done."

    # Parse comma-separated files
    IFS=',' read -ra FILES <<< "$TEST_FILE"

    for FILE in "${FILES[@]}"; do
        # Remove whitespace
        FILE=$(echo "$FILE" | xargs)
        echo "Launching: $FILE"
        run_single_spec "$FILE" &
        PIDS+=($!)
    done

# Single file mode
else
    echo ""
    echo "Running single test file: $TEST_FILE"
    run_single_spec "$TEST_FILE"
    OVERALL_EXIT_CODE=$?
fi

# Wait for all background processes if any
if [ ${#PIDS[@]} -gt 0 ]; then
    echo ""
    echo "Waiting for all spec files to complete..."

    for PID in "${PIDS[@]}"; do
        wait $PID
        EXIT_CODE=$?
        if [ $EXIT_CODE -ne 0 ]; then
            OVERALL_EXIT_CODE=1
        fi
    done
fi

echo ""
echo "========================================"
echo "  All Tests Complete!"
echo "  Overall Status: $([ $OVERALL_EXIT_CODE -eq 0 ] && echo 'PASSED' || echo 'FAILED')"
echo "========================================"
echo ""

exit $OVERALL_EXIT_CODE
