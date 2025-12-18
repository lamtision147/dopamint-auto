#!/bin/bash

# ========================================
# Dopamint Playwright Auto Test Runner
# For AWS CodeBuild / Linux environments
# - Spec files run IN PARALLEL (each with unique TMPDIR)
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

# Clean up dappwright sessions to avoid conflicts
rm -rf /tmp/dappwright* 2>/dev/null || true

# Array to track background PIDs
declare -a PIDS=()
declare -a SPEC_NAMES=()

# Function to run a single spec file with unique TMPDIR
run_single_spec_parallel() {
    local SPEC_FILE="$1"
    local SPEC_INDEX="$2"
    local TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    local LOGFILE="test-results/test-log-${SPEC_FILE}-${TIMESTAMP}.txt"

    # Create unique TMPDIR for this spec file to avoid dappwright session conflicts
    local UNIQUE_TMPDIR="/tmp/dappwright-${SPEC_INDEX}-$$"
    mkdir -p "$UNIQUE_TMPDIR"

    echo ""
    echo "========================================"
    echo "  Starting: $SPEC_FILE (parallel, TMPDIR=$UNIQUE_TMPDIR)"
    echo "========================================"

    # Log start
    echo "========================================" >> "$LOGFILE"
    echo "Test started at $(date)" >> "$LOGFILE"
    echo "Test file: $SPEC_FILE" >> "$LOGFILE"
    echo "TMPDIR: $UNIQUE_TMPDIR" >> "$LOGFILE"
    echo "========================================" >> "$LOGFILE"

    # Record start time
    local START_TIME=$(date +%s)

    echo "Running: $SPEC_FILE..."
    echo "Running tests..." >> "$LOGFILE"

    # Run the single spec file with unique TMPDIR
    local TEST_EXIT_CODE=0
    TMPDIR="$UNIQUE_TMPDIR" npx playwright test "tests/$SPEC_FILE" --reporter=list 2>&1 | tee -a "$LOGFILE" || TEST_EXIT_CODE=$?

    # Calculate duration
    local END_TIME=$(date +%s)
    local DURATION=$((END_TIME - START_TIME))

    echo "Duration: $DURATION seconds" >> "$LOGFILE"

    # Determine status based on exit code
    local STATUS
    if [ $TEST_EXIT_CODE -eq 0 ]; then
        STATUS="PASSED"
        echo "[PASSED] $SPEC_FILE (exit code: $TEST_EXIT_CODE, duration: ${DURATION}s)"
    else
        STATUS="FAILED"
        echo "[FAILED] $SPEC_FILE (exit code: $TEST_EXIT_CODE, duration: ${DURATION}s)"
    fi

    echo "Test finished with status: $STATUS" >> "$LOGFILE"
    echo "Exit code: $TEST_EXIT_CODE" >> "$LOGFILE"

    # Send Telegram notification for this spec file
    echo "Sending Telegram notification for $SPEC_FILE..."
    node scripts/send-telegram.js "$STATUS" "$DURATION" "$SPEC_FILE" "$SPEC_FILE" "$LOGFILE" || true

    # Clean up unique TMPDIR
    rm -rf "$UNIQUE_TMPDIR" 2>/dev/null || true

    # Return exit code
    return $TEST_EXIT_CODE
}

# Function to run a single spec file sequentially (for single file mode)
run_single_spec() {
    local SPEC_FILE="$1"
    local TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    local LOGFILE="test-results/test-log-${SPEC_FILE}-${TIMESTAMP}.txt"

    echo ""
    echo "========================================"
    echo "  Running: $SPEC_FILE"
    echo "========================================"

    # Clean up dappwright session before test
    rm -rf /tmp/dappwright/session 2>/dev/null || true

    # Log start
    echo "========================================" >> "$LOGFILE"
    echo "Test started at $(date)" >> "$LOGFILE"
    echo "Test file: $SPEC_FILE" >> "$LOGFILE"
    echo "========================================" >> "$LOGFILE"

    # Record start time
    local START_TIME=$(date +%s)

    echo "Running: $SPEC_FILE..."
    echo "Running tests..." >> "$LOGFILE"

    # Run the single spec file
    local TEST_EXIT_CODE=0
    npx playwright test "tests/$SPEC_FILE" --reporter=list 2>&1 | tee -a "$LOGFILE" || TEST_EXIT_CODE=$?

    # Calculate duration
    local END_TIME=$(date +%s)
    local DURATION=$((END_TIME - START_TIME))

    echo "Duration: $DURATION seconds" >> "$LOGFILE"

    # Determine status based on exit code
    local STATUS
    if [ $TEST_EXIT_CODE -eq 0 ]; then
        STATUS="PASSED"
        echo "[PASSED] $SPEC_FILE (exit code: $TEST_EXIT_CODE)"
    else
        STATUS="FAILED"
        OVERALL_EXIT_CODE=1
        echo "[FAILED] $SPEC_FILE (exit code: $TEST_EXIT_CODE)"
    fi

    echo "Test finished with status: $STATUS" >> "$LOGFILE"
    echo "Exit code: $TEST_EXIT_CODE" >> "$LOGFILE"

    # Send Telegram notification for this spec file
    echo "Sending Telegram notification for $SPEC_FILE..."
    node scripts/send-telegram.js "$STATUS" "$DURATION" "$SPEC_FILE" "$SPEC_FILE" "$LOGFILE" || true

    # Clean up session after test
    rm -rf /tmp/dappwright/session 2>/dev/null || true
}

# Track overall exit code
OVERALL_EXIT_CODE=0

# Check if running all tests
if [ "$TEST_FILE" = "all" ]; then
    echo ""
    echo "Running ALL spec files IN PARALLEL..."
    echo "Each file will send its own Telegram notification when done."

    SPEC_INDEX=0
    for SPEC in tests/*.spec.ts; do
        SPEC_NAME=$(basename "$SPEC")
        SPEC_NAMES+=("$SPEC_NAME")
        run_single_spec_parallel "$SPEC_NAME" "$SPEC_INDEX" &
        PIDS+=($!)
        ((SPEC_INDEX++))
    done

    echo ""
    echo "Waiting for ${#PIDS[@]} parallel tests to complete..."

    # Wait for all background processes
    for i in "${!PIDS[@]}"; do
        wait ${PIDS[$i]}
        EXIT_CODE=$?
        if [ $EXIT_CODE -ne 0 ]; then
            OVERALL_EXIT_CODE=1
            echo "  [FAILED] ${SPEC_NAMES[$i]}"
        else
            echo "  [PASSED] ${SPEC_NAMES[$i]}"
        fi
    done

# Check if multiple files (contains comma)
elif [[ "$TEST_FILE" == *","* ]]; then
    echo ""
    echo "Multiple files detected, running IN PARALLEL..."
    echo "Each file will send its own Telegram notification when done."

    # Parse comma-separated files
    IFS=',' read -ra FILES <<< "$TEST_FILE"

    SPEC_INDEX=0
    for FILE in "${FILES[@]}"; do
        # Remove whitespace
        FILE=$(echo "$FILE" | xargs)
        SPEC_NAMES+=("$FILE")
        run_single_spec_parallel "$FILE" "$SPEC_INDEX" &
        PIDS+=($!)
        ((SPEC_INDEX++))
    done

    echo ""
    echo "Waiting for ${#PIDS[@]} parallel tests to complete..."

    # Wait for all background processes
    for i in "${!PIDS[@]}"; do
        wait ${PIDS[$i]}
        EXIT_CODE=$?
        if [ $EXIT_CODE -ne 0 ]; then
            OVERALL_EXIT_CODE=1
            echo "  [FAILED] ${SPEC_NAMES[$i]}"
        else
            echo "  [PASSED] ${SPEC_NAMES[$i]}"
        fi
    done

# Single file mode - run sequentially (no parallel needed)
else
    echo ""
    echo "Running single test file: $TEST_FILE"
    run_single_spec "$TEST_FILE"
fi

echo ""
echo "========================================"
echo "  All Tests Complete!"
echo "  Overall Status: $([ $OVERALL_EXIT_CODE -eq 0 ] && echo 'PASSED' || echo 'FAILED')"
echo "========================================"
echo ""

exit $OVERALL_EXIT_CODE
