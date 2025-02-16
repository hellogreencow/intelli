#!/bin/bash

# Define script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FALLBACK_FILE="$SCRIPT_DIR/fallback.html"
VITE_PORT=5173

# Store process IDs
FALLBACK_PID=""

# Function to check if Vite is running
is_vite_running() {
    # Check if something is actively listening on Vite's port
    if lsof -i :5173 | grep LISTEN > /dev/null; then
        # Also check if Vite actually serves responses (wait for it to settle)
        curl -s http://localhost:5173 > /dev/null
        if [[ $? -eq 0 ]]; then
            return 0  # Vite is truly running
        fi
    fi
    return 1  # Vite is down
}

# Function to serve the fallback page if Vite is down
start_fallback_page() {
    echo "⚠️ Vite (or agent) is down! Serving fallback page..."

    # Generate fallback HTML
    cat <<EOF > "$FALLBACK_FILE"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Intelligencer is Down</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        h1 { color: #ff0000; }
    </style>
</head>
<body>
    <h1>Hey sorry about that!</h1>
    <p>Your friendly neighborhood Intelligencer is down! Be Back Soon.</p>
</body>
</html>
EOF

    # Serve the fallback page on port 5173
    python3 -m http.server 5173 --directory "$SCRIPT_DIR" &
    FALLBACK_PID=$!
}

# Function to clean up on exit
cleanup() {
    echo "�� Stopping fallback page..."
    [[ ! -z "$FALLBACK_PID" ]] && kill "$FALLBACK_PID" 2>/dev/null
    exit 0
}

# Trap script exit to run cleanup
trap cleanup SIGINT SIGTERM EXIT

# Monitor Vite and serve fallback if needed
while true; do
    if ! is_vite_running; then
        if [[ -z "$FALLBACK_PID" ]]; then
            echo "⚠️ Vite (or agent) is down! Serving fallback page..."
            start_fallback_page
        fi
    else
        if [[ ! -z "$FALLBACK_PID" ]]; then
            echo "✅ Vite is truly back! Waiting 5 seconds before removing fallback..."
            sleep 5  # Ensure Vite is stable before removing fallback
            if is_vite_running; then
                echo "✅ Vite is fully running! Removing fallback page..."
                kill "$FALLBACK_PID" 2>/dev/null
                FALLBACK_PID=""
                rm -f "$FALLBACK_FILE"
            else
                echo "⚠️ False alarm, Vite is still down."
            fi
        fi
    fi
    sleep 5
done