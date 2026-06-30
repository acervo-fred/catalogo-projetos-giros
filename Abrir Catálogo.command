#!/bin/bash
cd "$(dirname "$0")"
pkill -f "server.py" 2>/dev/null
pkill -f "http.server 8766" 2>/dev/null
sleep 0.3
python3 server.py &
sleep 0.6
open -a "Google Chrome" "http://localhost:8766"
