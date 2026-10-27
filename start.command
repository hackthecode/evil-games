#!/bin/bash
# Стартира портала локално: двоен клик върху файла (macOS) или ./start.command
cd "$(dirname "$0")"
PORT=8080
echo "Порталът работи на http://localhost:$PORT  (Ctrl+C за спиране)"
(sleep 1 && open "http://localhost:$PORT") &
python3 serve.py $PORT
