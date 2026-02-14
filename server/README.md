# 分词服务端

Python FastAPI 服务，提供文本分词功能。

## 本地开发

### 安装依赖

```bash
cd server
uv sync
```

### 启动服务

```bash
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## Railway 部署

### 通过 GitHub 集成

1. 在 Railway 创建新项目
2. 选择 "Deploy from GitHub repo"
3. 设置 Root Directory 为 server
4. Railway 会自动检测 Dockerfile 并部署

### 环境变量

- PORT (自动设置)
- SPACY_MODEL (可选)
- OPENAI_API_KEY (可选)

## API

- POST /api/segment - 文本分词
- GET /health - 健康检查
