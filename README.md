# 单词拼写练习 / Words Spelling Practice

<p align="center">
  <b>一款帮助提升英文拼写和打字能力的桌面应用</b><br>
  <b>A desktop app to help improve English spelling and typing skills</b>
</p>

<p align="center">
  <a href="https://github.com/markqiu/words_spelling/releases">下载 / Download</a> •
  <a href="#功能特性--features">功能 / Features</a> •
  <a href="#安装说明--installation">安装 / Installation</a>
</p>

---

## 简体中文

### 功能特性

- 📚 **文章库管理** - 支持小说、新闻、故事、传记、专业文章等多种分类
- 🌐 **自动爬取文章** - 从 Project Gutenberg 和 Wikipedia 获取英文文章
- 🎯 **拼写练习模式** - 听单词发音，输入正确拼写
- 🔊 **语音朗读** - 使用系统 TTS 引擎朗读单词
- ⌨️ **打字练习模式** - 实时检测输入正确性，逐字符验证
- 🏆 **排行榜系统** - 记录练习成绩，与好友比拼
- 📊 **学习统计** - 追踪词汇掌握进度和错词本
- ⚙️ **可配置词数** - 支持 10/20/30/50/100 个词的练习量

### 安装说明

1. 访问 [Releases 页面](https://github.com/markqiu/words_spelling/releases) 下载安装包
2. 根据你的 Mac 芯片类型选择对应版本：
   - **Intel Mac**: 下载 `单词拼写练习-1.0.0.dmg`
   - **Apple Silicon (M1/M2/M3)**: 下载 `单词拼写练习-1.0.0-arm64.dmg`
3. 双击 DMG 文件，将应用拖拽到 Applications 文件夹
4. 首次打开时可能需要在 系统设置 > 隐私与安全性 中允许

### 开发运行

```bash
# 克隆仓库
git clone https://github.com/markqiu/words_spelling.git
cd words_spelling

# 安装依赖
npm install

# 开发模式运行
npm run dev

# 打包 macOS 应用
npm run build:mac
```

---

## English

### Features

- 📚 **Article Library** - Manage articles by category: novels, news, stories, biographies, technical articles
- 🌐 **Auto Crawling** - Fetch English articles from Project Gutenberg and Wikipedia
- 🎯 **Spelling Practice** - Listen to word pronunciation and type correct spelling
- 🔊 **Text-to-Speech** - Uses system TTS engine for word pronunciation
- ⌨️ **Typing Practice** - Real-time character-by-character input validation
- 🏆 **Leaderboard** - Track practice scores and compete with friends
- 📊 **Learning Stats** - Track vocabulary mastery progress and mistake words
- ⚙️ **Configurable Word Count** - Practice with 10/20/30/50/100 words per session

### Installation

1. Visit the [Releases page](https://github.com/markqiu/words_spelling/releases) to download
2. Choose the appropriate version for your Mac:
   - **Intel Mac**: Download `单词拼写练习-1.0.0.dmg`
   - **Apple Silicon (M1/M2/M3)**: Download `单词拼写练习-1.0.0-arm64.dmg`
3. Double-click the DMG file and drag the app to Applications folder
4. On first launch, you may need to allow it in System Settings > Privacy & Security

### Development

```bash
# Clone repository
git clone https://github.com/markqiu/words_spelling.git
cd words_spelling

# Install dependencies
npm install

# Run in development mode
npm run dev

# Build macOS app
npm run build:mac
```

---

## 技术栈 / Tech Stack

- **Framework**: Electron + React + TypeScript
- **Build Tool**: Vite
- **Database**: SQLite (better-sqlite3)
- **Web Scraping**: Axios + Cheerio
- **TTS**: macOS `say` command (native) / Web Speech API (fallback)

## 许可证 / License

MIT License - 详见 [LICENSE](LICENSE) 文件 / See [LICENSE](LICENSE) file for details

## 作者 / Author

- **markqiu** - [GitHub](https://github.com/markqiu)

---

<p align="center">
  如果觉得有帮助，请给个 ⭐ Star！<br>
  If you find this helpful, please give it a ⭐ Star!
</p>
