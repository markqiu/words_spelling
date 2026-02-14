# 分词服务端

Python FastAPI 服务，提供文本分词功能，支持 spaCy 本地分词和 OpenAI API 分词。

## 使用 uv 管理依赖

### 安装 uv

```bash
# macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# 或使用 pip
pip install uv
```

### 安装依赖

```bash
cd server

# 创建虚拟环境并安装依赖
uv sync

# 下载 spaCy 模型
uv run python -m spacy download en_core_web_sm
```

### 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，配置 OpenAI API Key（可选）
```

### 启动服务

```bash
# 方式 1: 使用 uv run
uv run python -m app.main

# 方式 2: 使用脚本入口
uv run serve

# 方式 3: 直接运行 uvicorn
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

服务启动后访问：
- API: http://localhost:8000/api/segment
- 健康检查: http://localhost:8000/api/health
- API 文档: http://localhost:8000/docs

## API 接口

### POST /api/segment

分词接口

**请求体：**
```json
{
  "text": "Hello world, this is a test.",
  "mode": "word",  // "word" | "phrase" | "sentence"
  "engine": "spacy"  // "spacy" | "api" (可选)
}
```

**响应：**
```json
{
  "segments": ["hello", "world", "test"],
  "engine_used": "spacy",
  "success": true,
  "error": null,
  "metadata": {"count": 3}
}
```

## 开发

### 运行测试

```bash
uv run pytest
```

### 添加新依赖

```bash
uv add package-name
```

### 添加开发依赖

```bash
uv add --dev package-name
```
