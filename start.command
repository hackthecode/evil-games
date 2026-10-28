#!/bin/bash
# Starts the portal locally: double-click the file (macOS) or ./start.command
cd "$(dirname "$0")"
PORT=8080
echo "The portal runs at http://localhost:$PORT  (Ctrl+C to stop)"
(sleep 1 && open "http://localhost:$PORT") &
python3 serve.py $PORT
