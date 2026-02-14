# 部署指南

本项目采用前后端分离的部署方案：
- **后端**: Python FastAPI 服务器（提供 AI 分词服务）
- **前端**: Tauri 桌面应用（跨平台）

## 架构说明

```
┌─────────────────┐         HTTP API          ┌─────────────────┐
│                 │ ◄───────────────────────► │                 │
│  Tauri 客户端    │    http://server:8000    │  Python 服务器   │
│  (桌面应用)      │                          │  (分词服务)      │
│                 │                          │                 │
└─────────────────┘                          └─────────────────┘
```

---

## 一、Python 服务器部署

### 1. 环境要求

- Python 3.10+
- uv 包管理器（推荐）或 pip

### 2. 安装依赖

```bash
cd server

# 使用 uv（推荐）
uv sync

# 或使用 pip
pip install -r requirements.txt
python -m spacy download en_core_web_sm
```

### 3. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 配置服务器地址和端口
```

### 4. 启动服务

**开发环境：**
```bash
cd server
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**生产环境（使用 Gunicorn）：**
```bash
cd server
uv run gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000
```

### 5. Docker 部署（推荐）

在 `server/` 目录下创建 `Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# 安装 uv
RUN pip install uv

# 复制依赖文件
COPY pyproject.toml uv.lock ./

# 安装依赖
RUN uv sync --frozen

# 复制应用代码
COPY . .

# 下载 spaCy 模型
RUN uv run python -m spacy download en_core_web_sm

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

构建并运行：
```bash
cd server
docker build -t spelling-server .
docker run -d -p 8000:8000 spelling-server
```

### 6. Systemd 服务（Linux）

创建 `/etc/systemd/system/spelling-server.service`:

```ini
[Unit]
Description=Spelling Practice Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/spelling-server
ExecStart=/opt/spelling-server/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

启动服务：
```bash
sudo systemctl enable spelling-server
sudo systemctl start spelling-server
```

---

## 二、Tauri 客户端打包

### 1. 环境要求

- Node.js 18+
- Rust 1.70+
- 平台特定依赖：
  - **macOS**: Xcode Command Line Tools
  - **Windows**: Microsoft Visual Studio C++ Build Tools
  - **Linux**: webkit2gtk, openssl 等

### 2. 配置服务器地址

编辑 `src/renderer/utils/api.ts`，修改分词 API 地址：

```typescript
const SEGMENT_API_URL = 'http://your-server-address:8000'
```

或使用环境变量：
```bash
export VITE_SEGMENT_API_URL=http://your-server:8000
```

### 3. 构建客户端

```bash
# 安装依赖
npm install

# 开发模式
npm run tauri dev

# 构建生产版本
npm run tauri build
```

### 4. 构建产物

构建完成后，安装包位于 `src-tauri/target/release/bundle/` 目录：

- **macOS**: 
  - `dmg/单词拼写练习_x.x.x_x64.dmg`
  - `dmg/单词拼写练习_x.x.x_aarch64.dmg`
  - `macos/单词拼写练习.app`
  
- **Windows**: 
  - `msi/单词拼写练习_x.x.x_x64.msi`
  - `nsis/单词拼写练习_x.x.x_x64-setup.exe`
  
- **Linux**: 
  - `deb/单词拼写练习_x.x.x_amd64.deb`
  - `appimage/单词拼写练习_x.x.x_amd64.AppImage`

### 5. 跨平台构建

使用 GitHub Actions 自动构建：

```yaml
# .github/workflows/build.yml
name: Build
on: [push, pull_request]

jobs:
  build:
    strategy:
      fail-fast: false
      matrix:
        os: [macos-latest, ubuntu-latest, windows-latest]
    runs-on: ${{ matrix.os }}
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
      
      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable
      
      - name: Install dependencies (Ubuntu)
        if: matrix.os == 'ubuntu-latest'
        run: |
          sudo apt-get update
          sudo apt-get install -y webkit2gtk-4.1 libappindicator3-dev librsvg2-dev patchelf
      
      - name: Build
        run: |
          npm install
          npm run tauri build
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: ${{ matrix.os }}-build
          path: src-tauri/target/release/bundle/
```

---

## 三、配置客户端连接服务器

### 方法 1: 修改代码（推荐用于固定部署）

编辑 `src/renderer/utils/api.ts`:

```typescript
// 分词 API 基础 URL
const SEGMENT_API_URL = import.meta.env.VITE_SEGMENT_API_URL || 'http://localhost:8000'
```

### 方法 2: 环境变量（推荐用于 CI/CD）

创建 `.env.production`:

```env
VITE_SEGMENT_API_URL=http://your-server:8000
```

### 方法 3: 用户配置（最灵活）

在应用内添加服务器配置界面，让用户自行输入服务器地址。

---

## 四、完整部署示例

### 场景: 公司内网部署

1. **服务器部署** (192.168.1.100)
   ```bash
   # 在服务器上
   cd /opt/spelling-server
   uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```

2. **配置客户端**
   ```bash
   # 设置环境变量
   export VITE_SEGMENT_API_URL=http://192.168.1.100:8000
   
   # 构建
   npm run tauri build
   ```

3. **分发客户端**
   - 将构建好的安装包分发给用户
   - 用户安装后自动连接到内网服务器

---

## 五、注意事项

1. **网络安全**
   - 生产环境建议使用 HTTPS
   - 可以在服务器前部署 Nginx 反向代理
   - 考虑添加 API 认证

2. **服务器资源**
   - spaCy 模型需要约 500MB 内存
   - 建议每 worker 预留 1GB 内存
   - CPU 密集型，建议多核服务器

3. **客户端更新**
   - Tauri 支持自动更新功能
   - 配置 `tauri.conf.json` 中的 `updater` 端点

4. **离线模式**
   - 当前版本需要连接服务器才能使用分词功能
   - 未来可以考虑在客户端内置轻量级分词模型
