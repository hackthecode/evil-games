#!/usr/bin/env bash
# Имоти и Империи — стартиране под Linux/macOS
set -e
cd "$(dirname "$0")"

if ! command -v python3 >/dev/null 2>&1; then
    echo "ГРЕШКА: python3 не е инсталиран."
    exit 1
fi

if [ ! -d ".venv" ]; then
    echo "Създаване на виртуална среда..."
    python3 -m venv .venv
fi

source .venv/bin/activate

if [ ! -f ".venv/.deps_installed" ]; then
    echo "Инсталиране на пакетите..."
    python -m pip install --upgrade pip >/dev/null
    python -m pip install -r requirements.txt
    touch .venv/.deps_installed
fi

python start.py "$@"
