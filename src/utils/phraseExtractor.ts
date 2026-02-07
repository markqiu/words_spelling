/**
 * 英文短句/短语提取工具
 * 使用 compromise NLP 库进行智能短语提取
 */

import nlp from 'compromise'

export interface Phrase {
  text: string
  type: 'phrase' | 'sentence' | 'clause' | 'chunk'
}

/**
 * 清理文本：去除多余空格换行
 */
function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 智能分割长句 - 使用 compromise 的从句功能
 */
function splitLongSentence(sentence: string, maxLength: number): string[] {
  const doc = nlp(sentence)
  const results: string[] = []

  // 1. 先按从句分割
  const clauseList = doc.clauses().out('array') as string[]

  if (clauseList.length > 1) {
    let current = ''
    for (const clause of clauseList) {
      const trimmed = clause.trim()
      if (!trimmed) continue

      if (!current) {
        current = trimmed
      } else {
        const combined = current + ' ' + trimmed
        if (combined.length <= maxLength) {
          current = combined
        } else {
          if (current.length >= 5) results.push(current)
          current = trimmed
        }
      }
    }
    if (current && current.length >= 5) results.push(current)
  }

  // 2. 从句分割没效果, 按逗号/分号分割
  if (results.length <= 1) {
    results.length = 0
    const parts = sentence.split(/[,;]\s+/)
    let current = ''

    for (const part of parts) {
      const trimmed = part.trim()
      if (!trimmed) continue

      if (!current) {
        current = trimmed
      } else {
        const combined = current + ', ' + trimmed
        if (combined.length <= maxLength) {
          current = combined
        } else {
          if (current.length >= 5) results.push(current)
          current = trimmed
        }
      }
    }
    if (current && current.length >= 5) results.push(current)
  }

  // 3. 仍然只有一段且严重超长, 则按词数强制切
  if (results.length === 1 && results[0].length > maxLength * 1.5) {
    const words = results[0].split(/\s+/)
    const maxWords = Math.floor(maxLength / 6) // 假设平均 6 字符/词
    results.length = 0
    for (let i = 0; i < words.length; i += maxWords) {
      const chunk = words.slice(i, i + maxWords).join(' ')
      if (chunk.length >= 5) results.push(chunk)
    }
  }

  return results.filter(r => r.length >= 5)
}

/**
 * 提取用于短语听写的练习项
 * 短语模式 — 较短的从句级别片段
 */
export function extractPracticeItems(text: string, maxItems: number = 50): string[] {
  if (!text || text.trim().length === 0) return []

  const cleaned = cleanText(text)
  const doc = nlp(cleaned)
  const items: string[] = []
  const seen = new Set<string>()

  const addItem = (t: string) => {
    const trimmed = t.trim()
      .replace(/^[,;:\s]+/, '')
      .replace(/[,;:\s]+$/, '')
    if (trimmed.length < 5 || trimmed.length > 50) return
    if (trimmed.split(/\s+/).length > 10) return // 最多 10 个词
    const key = trimmed.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    items.push(trimmed)
  }

  /**
   * 将超长片段进一步拆分成 ≤50字符 的小段
   */
  const splitShort = (t: string) => {
    if (t.length <= 50) { addItem(t); return }
    // 按逗号/分号拆
    const parts = t.split(/[,;]\s+/)
    if (parts.length > 1) {
      for (const p of parts) addItem(p)
      return
    }
    // 按 because/that/which/when/where/and/but/or/so 拆
    const subParts = t.split(/\s+(?:because|that|which|when|where|while|and|but|or|so|if|although|though|since|until|unless|before|after)\s+/i)
    if (subParts.length > 1) {
      for (const p of subParts) addItem(p)
      return
    }
    // 强制按词数拆（每段 ~6词）
    const words = t.split(/\s+/)
    for (let i = 0; i < words.length; i += 6) {
      const chunk = words.slice(i, i + 6).join(' ')
      addItem(chunk)
    }
  }

  // 1. 从句（clause）— 最佳粒度
  const clauseList = doc.clauses().out('array') as string[]
  for (const clause of clauseList) {
    const t = clause.trim()
    if (t.length >= 8 && t.length <= 50) {
      addItem(t)
    } else if (t.length > 50) {
      splitShort(t)
    }
  }

  // 2. 如果从句不够，补充短句（仅短句）
  if (items.length < 10) {
    const sentList = doc.sentences().out('array') as string[]
    for (const sent of sentList) {
      const t = sent.trim()
      if (t.length >= 8 && t.length <= 50) {
        addItem(t)
      } else if (t.length > 50) {
        const chunks = splitLongSentence(t, 40)
        for (const c of chunks) addItem(c)
      }
    }
  }

  // 3. 如果还不够，补充名词短语
  if (items.length < 10) {
    const nounList = doc.nouns().out('array') as string[]
    for (const noun of nounList) {
      const t = noun.trim()
      if (t.split(/\s+/).length >= 2 && t.length <= 40) {
        addItem(t)
      }
    }
  }

  return items.slice(0, maxItems)
}

/**
 * 将长文本分割成适合听写的短句（句子模式）
 * 每段尽量 ≤ maxChunkLength 字符
 */
export function splitIntoChunks(text: string, maxChunkLength: number = 50): string[] {
  if (!text || text.trim().length === 0) return []

  const cleaned = cleanText(text)
  const doc = nlp(cleaned)
  const chunks: string[] = []

  const sentList = doc.sentences().out('array') as string[]

  for (const sent of sentList) {
    const trimmed = sent.trim()
    if (!trimmed || trimmed.length < 5) continue

    if (trimmed.length <= maxChunkLength) {
      chunks.push(trimmed)
    } else {
      const subChunks = splitLongSentence(trimmed, maxChunkLength)
      chunks.push(...subChunks)
    }
  }

  return chunks.filter(c => c.length >= 5)
}

/**
 * 提取所有短语和短句（综合）
 */
export function extractPhrases(text: string): Phrase[] {
  if (!text || text.trim().length === 0) return []

  const cleaned = cleanText(text)
  const doc = nlp(cleaned)
  const results: Phrase[] = []
  const seen = new Set<string>()

  const addPhrase = (t: string, type: Phrase['type']) => {
    const trimmed = t.trim()
    if (trimmed.length < 5) return
    const key = trimmed.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    results.push({ text: trimmed, type })
  }

  // 句子
  const sentList = doc.sentences().out('array') as string[]
  for (const s of sentList) addPhrase(s, 'sentence')

  // 从句
  const clauseList = doc.clauses().out('array') as string[]
  for (const c of clauseList) addPhrase(c, 'clause')

  // 名词短语
  const nounList = doc.nouns().out('array') as string[]
  for (const n of nounList) {
    if (n.trim().split(/\s+/).length >= 2) addPhrase(n, 'phrase')
  }

  return results
}

export default {
  extractPhrases,
  extractPracticeItems,
  splitIntoChunks,
}
