#!/bin/bash

# 开发环境启动脚本

set -e

echo "================================"
echo "  单词拼写练习 - 开发环境"
echo "================================"
echo ""

# 检查 Python 服务器
if ! lsof -i:8000 > /dev/null 2>&1; then
    echo "⚠️  Python 服务器未运行在端口 8000"
    echo ""
    read -p "是否现在启动? (y/n): " START_SERVER
    if [ "$START_SERVER" = "y" ]; then
        echo "🐍 启动 Python 服务器..."
        cd server
        if command -v uv &> /dev/null; then
            uv run uvicorn app.main:app --reload --port 8000 &
        else
            python -m uvicorn app.main:app --reload --port 8000 &
        fi
        cd ..
        sleep 3
        echo ""
    fi
fi

echo "🚀 启动 Tauri 开发服务器..."
npm run tauri dev
