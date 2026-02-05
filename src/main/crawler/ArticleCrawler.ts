import axios from 'axios'
import * as cheerio from 'cheerio'
import type { ArticleCategory, CrawledArticle } from '../../types'

export class ArticleCrawler {
  // 为每个分类配置多个 URL 源，每次随机选择
  private readonly sources: Record<ArticleCategory, string[]> = {
    novel: [
      'https://www.gutenberg.org/files/1342/1342-0.txt', // Pride and Prejudice
      'https://www.gutenberg.org/files/84/84-0.txt', // Frankenstein
      'https://www.gutenberg.org/files/98/98-0.txt', // A Tale of Two Cities
      'https://www.gutenberg.org/files/2701/2701-0.txt', // Moby Dick
      'https://www.gutenberg.org/files/76/76-0.txt', // Adventures of Tom Sawyer
      'https://www.gutenberg.org/files/345/345-0.txt', // Dracula
      'https://www.gutenberg.org/files/1661/1661-0.txt', // Sherlock Holmes
      'https://www.gutenberg.org/files/6130/6130-0.txt', // The Iliad
    ],
    news: [
      'https://en.wikipedia.org/wiki/World_War_II',
      'https://en.wikipedia.org/wiki/Industrial_Revolution',
      'https://en.wikipedia.org/wiki/Great_Depression',
      'https://en.wikipedia.org/wiki/Cold_War',
      'https://en.wikipedia.org/wiki/Space_Race',
    ],
    story: [
      'https://www.gutenberg.org/files/11/11-0.txt', // Alice in Wonderland
      'https://www.gutenberg.org/files/2554/2554-0.txt', // The Wonderful Wizard of Oz
      'https://www.gutenberg.org/files/2591/2591-0.txt', // Grimm's Fairy Tales
      'https://www.gutenberg.org/files/236/236-0.txt', // The Jungle Book
      'https://www.gutenberg.org/files/2785/2785-0.txt', // Peter Pan
    ],
    biography: [
      'https://en.wikipedia.org/wiki/Marie_Curie',
      'https://en.wikipedia.org/wiki/Albert_Einstein',
      'https://en.wikipedia.org/wiki/Leonardo_da_Vinci',
      'https://en.wikipedia.org/wiki/Winston_Churchill',
      'https://en.wikipedia.org/wiki/Nelson_Mandela',
      'https://en.wikipedia.org/wiki/Isaac_Newton',
      'https://en.wikipedia.org/wiki/Charles_Darwin',
      'https://en.wikipedia.org/wiki/Ada_Lovelace',
    ],
    technical: [
      'https://en.wikipedia.org/wiki/Computer_programming',
      'https://en.wikipedia.org/wiki/Artificial_intelligence',
      'https://en.wikipedia.org/wiki/Climate_change',
      'https://en.wikipedia.org/wiki/Renewable_energy',
      'https://en.wikipedia.org/wiki/Space_exploration',
      'https://en.wikipedia.org/wiki/Internet',
      'https://en.wikipedia.org/wiki/Machine_learning',
      'https://en.wikipedia.org/wiki/Quantum_computing',
    ],
    other: []
  }

  // 记录每个分类最近爬取的 URL，避免连续重复
  private recentUrls: Record<ArticleCategory, string[]> = {
    novel: [],
    news: [],
    story: [],
    biography: [],
    technical: [],
    other: []
  }

  async fetchArticles(category: ArticleCategory, customUrl?: string): Promise<CrawledArticle[]> {
    const articles: CrawledArticle[] = []

    // 如果使用自定义URL
    if (customUrl) {
      try {
        const article = await this.fetchFromUrl(customUrl, category)
        if (article) {
          articles.push(article)
        } else {
          throw new Error('无法从该URL提取文章内容')
        }
      } catch (error) {
        console.error('Error fetching custom URL:', error)
        throw error
      }
      return articles
    }

    // 尝试多个源，直到成功
    const urls = this.sources[category]
    if (!urls || urls.length === 0) {
      throw new Error('该分类没有可用的文章源')
    }

    // 打乱URL顺序，尝试多个源
    const shuffledUrls = [...urls].sort(() => Math.random() - 0.5)
    let lastError: Error | null = null

    for (const url of shuffledUrls) {
      try {
        let article: CrawledArticle | null = null

        if (url.includes('gutenberg.org')) {
          article = await this.fetchGutenberg(url, category)
        } else if (url.includes('wikipedia.org')) {
          article = await this.fetchWikipedia(url, category)
        } else if (url.includes('bbc.co.uk')) {
          const bbcArticles = await this.fetchBBC(category)
          articles.push(...bbcArticles)
          return articles
        }

        if (article) {
          articles.push(article)
          // 记录成功使用的URL
          this.recentUrls[category].unshift(url)
          this.recentUrls[category] = this.recentUrls[category].slice(0, 3)
          return articles
        }
      } catch (error) {
        console.error(`Error fetching from ${url}:`, error)
        lastError = error instanceof Error ? error : new Error(String(error))
        // 继续尝试下一个URL
        continue
      }
    }

    // 所有URL都失败了
    if (lastError) {
      throw new Error(`爬取失败: ${lastError.message}`)
    } else {
      throw new Error('无法从任何源获取文章，请检查网络连接')
    }
  }

  private async fetchFromUrl(url: string, category: ArticleCategory): Promise<CrawledArticle | null> {
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      })

      const $ = cheerio.load(response.data)

      // 尝试提取标题
      const title = $('h1').first().text() ||
                  $('title').text() ||
                  'Untitled Article'
      
      // 尝试提取正文
      let content = ''
      
      // 尝试常见的文章内容选择器
      const contentSelectors = [
        'article',
        '.article-content',
        '.post-content',
        '.entry-content',
        '#content',
        'main',
        '.content',
        'p'
      ]

      for (const selector of contentSelectors) {
        const elements = $(selector)
        if (elements.length > 0) {
          if (selector === 'p') {
            content = elements.map((_, el) => $(el).text()).get().join(' ')
          } else {
            content = elements.text()
          }
          if (content.length > 500) break
        }
      }

      // 清理内容
      content = this.cleanContent(content)
      
      if (content.length < 100) {
        return null
      }

      // 截取适当长度
      content = content.substring(0, 2000)

      return {
        title: title.trim().substring(0, 200),
        content: content,
        category,
        wordCount: content.split(/\s+/).length,
        source: url,
        selected: false
      }
    } catch (error) {
      console.error('Fetch error:', error)
      return null
    }
  }

  private async fetchGutenberg(url: string, category: ArticleCategory): Promise<CrawledArticle | null> {
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        responseType: 'text'
      })

      const text = response.data as string
      
      // 提取标题（通常在文件开头）
      let title = 'Gutenberg Article'
      const titleMatch = text.match(/Title:\s*(.+)/i)
      if (titleMatch) {
        title = titleMatch[1].trim()
      }

      // 提取正文（跳过序言部分）
      let content = text
      const startIndex = text.indexOf('*** START OF')
      if (startIndex !== -1) {
        content = text.substring(startIndex + 100)
      }
      
      const endIndex = content.indexOf('*** END OF')
      if (endIndex !== -1) {
        content = content.substring(0, endIndex)
      }

      content = this.cleanContent(content)
      
      // 截取前2000字符
      content = content.substring(0, 2000)

      return {
        title,
        content,
        category,
        wordCount: content.split(/\s+/).length,
        source: 'Project Gutenberg',
        selected: false
      }
    } catch (error) {
      console.error('Gutenberg fetch error:', error)
      return null
    }
  }

  private async fetchWikipedia(url: string, category: ArticleCategory): Promise<CrawledArticle | null> {
    try {
      // 跳过维基百科特殊页面（如 Portal, Special, Help 等）
      if (url.includes('Portal:') || url.includes('Special:') || url.includes('Help:') || url.includes('Wikipedia:')) {
        console.log(`Skipping Wikipedia special page: ${url}`)
        return null
      }

      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      })

      const $ = cheerio.load(response.data)
      
      const title = $('#firstHeading').text() || 'Wikipedia Article'
      
      // 提取正文内容 - 只提取真正的段落文本
      let content = ''
      $('#mw-content-text p').each((_, el) => {
        // 获取纯文本，不包含 CSS 类名
        const text = $(el).text().trim()
        // 过滤掉只包含 CSS 类名或太短的内容
        if (text.length > 30 && !text.includes('.mw-parser-output') && !text.includes('.hlist')) {
          content += text + ' '
        }
      })

      content = this.cleanContent(content)
      
      if (content.length < 100) {
        return null
      }

      content = content.substring(0, 2000)

      return {
        title: title.trim(),
        content,
        category,
        wordCount: content.split(/\s+/).length,
        source: 'Wikipedia',
        selected: false
      }
    } catch (error) {
      console.error('Wikipedia fetch error:', error)
      return null
    }
  }

  private async fetchBBC(category: ArticleCategory): Promise<CrawledArticle[]> {
    // BBC RSS 需要特殊处理，这里简化处理
    // 实际使用可能需要 RSS 解析库
    return [{
      title: 'BBC News Sample',
      content: 'This is a sample BBC news article. In a real implementation, you would parse the RSS feed and extract individual news articles. Due to the complexity of RSS parsing and the changing nature of news content, this is simplified for demonstration purposes.',
      category,
      wordCount: 50,
      source: 'BBC News',
      selected: false
    }]
  }

  private cleanContent(content: string): string {
    return content
      .replace(/\r\n/g, ' ')
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      // 移除引用标记 [1], [2], 等
      .replace(/\[\d+\]/g, '')
      // 移除 CSS 类名和选择器（如 .mw-parser-output, .hlist dl, 等）
      .replace(/\.[a-zA-Z_-]+[a-zA-Z0-9_-]*\s*[.#\[\],>+~\s\w-]*/g, '')
      // 移除 HTML 标签残留
      .replace(/<[^>]+>/g, '')
      // 移除 URL
      .replace(/https?:\/\/[^\s]+/g, '')
      // 移除其他标记 { }
      .replace(/\{[^}]+\}/g, '')
      // 移除多余的空格
      .replace(/\s{2,}/g, ' ')
      .trim()
  }
}
