#!/bin/bash

# 部署脚本 - 构建生产版本

set -e

echo "================================"
echo "  单词拼写练习 - 构建脚本"
echo "================================"
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装，请先安装 Node.js 18+"
    exit 1
fi

# 检查 Rust
if ! command -v rustc &> /dev/null; then
    echo "❌ Rust 未安装，请先安装 Rust"
    echo "   访问: https://rustup.rs/"
    exit 1
fi

# 默认使用生产服务器
DEFAULT_SERVER="https://wordsspelling-production.up.railway.app"

# 询问服务器地址
read -p "请输入分词服务器地址 (默认: $DEFAULT_SERVER): " SERVER_URL
SERVER_URL=${SERVER_URL:-$DEFAULT_SERVER}

echo ""
echo "📡 服务器地址: $SERVER_URL"
echo ""

# 设置环境变量
export SEGMENT_SERVER_URL=$SERVER_URL
export VITE_SEGMENT_API_URL=$SERVER_URL

# 安装依赖
echo "📦 安装依赖..."
npm install

# 构建
echo ""
echo "🔨 构建应用..."
npm run tauri build

echo ""
echo "================================"
echo "✅ 构建完成！"
echo ""
echo "安装包位置:"
ls -la src-tauri/target/release/bundle/ 2>/dev/null || echo "请查看 src-tauri/target/release/bundle/ 目录"
echo "================================"
