/**
 * Tauri API 封装
 * 提供与后端 Rust 代码通信的接口
 */
import { invoke } from '@tauri-apps/api/core';

// ========== 类型定义 ==========

export interface Article {
  id: number;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface Segment {
  id: number;
  article_id: number;
  segment_type: 'word' | 'phrase' | 'sentence';
  content: string;
  order_index: number;
}

export interface PracticeProgress {
  user_name: string;
  article_id: number;
  segment_type: string;
  current_index: number;
  words_list: string;  // JSON string
  correct_count: number;
  incorrect_count: number;
}

export interface Mistake {
  id: number;
  user_name: string;
  segment_id: number;
  segment_content: string;
  segment_type: string;
  error_count: number;
  last_error_at: string;
}

export interface LeaderboardRecord {
  id: number;
  user_name: string;
  article_id: number;
  article_title: string;
  segment_type: string;
  score: number;
  accuracy: number;
  wpm: number;
  completed_at: string;
}

export interface SegmentResponse {
  segments: string[];
  success: boolean;
  error?: string;
}

// ========== 智能复习（SM-2）类型 ==========

export interface WordMastery {
  user_name: string;
  segment_id: number;
  segment_content: string;
  segment_type: string;
  mastery_level: number;      // 0-5, 0=新词, 5=完全掌握
  ease_factor: number;        // 难度因子, 默认 2.5
  interval_days: number;      // 复习间隔(天)
  next_review_at: string;     // 下次复习时间
  last_review_at: string;    // 上次复习时间
  review_count: number;      // 复习次数
}

export interface ScheduledWord {
  segment_id: number;
  content: string;
  segment_type: string;
  mastery_level: number;
  is_new: boolean;
}

export interface ScheduledWordsResponse {
  words: ScheduledWord[];
  new_words_count: number;
  review_words_count: number;
}

// ========== 文章管理 ==========

export async function getArticles(): Promise<Article[]> {
  return invoke('get_articles');
}

export async function getArticle(id: number): Promise<Article | null> {
  return invoke('get_article', { id });
}

export async function createArticle(title: string, content: string): Promise<number> {
  return invoke('create_article', { 
    request: { title, content } 
  });
}

export async function updateArticle(id: number, title?: string, content?: string): Promise<boolean> {
  return invoke('update_article', { 
    id, 
    request: { title, content } 
  });
}

export async function deleteArticle(id: number): Promise<boolean> {
  return invoke('delete_article', { id });
}

// ========== 分词管理 ==========

export async function saveSegments(articleId: number, segmentType: string, segments: string[]): Promise<void> {
  return invoke('save_segments', { 
    request: { 
      article_id: articleId, 
      segment_type: segmentType, 
      segments 
    } 
  });
}

export async function getSegments(articleId: number, segmentType: string): Promise<Segment[]> {
  return invoke('get_segments', { 
    articleId, 
    segmentType 
  });
}

// ========== 分词服务 ==========

export async function segmentText(
  text: string, 
  mode: 'word' | 'phrase' | 'sentence',
  serverUrl?: string
): Promise<SegmentResponse> {
  return invoke('segment_text', { 
    request: { 
      text, 
      mode,
      server_url: serverUrl
    } 
  });
}

// ========== 练习进度 ==========

export async function saveProgress(
  userName: string,
  articleId: number,
  segmentType: string,
  currentIndex: number,
  wordsList: string[],
  correctCount: number,
  incorrectCount: number
): Promise<void> {
  return invoke('save_progress', { 
    request: {
      user_name: userName,
      article_id: articleId,
      segment_type: segmentType,
      current_index: currentIndex,
      words_list: wordsList,
      correct_count: correctCount,
      incorrect_count: incorrectCount
    }
  });
}

export async function getProgress(
  userName: string,
  articleId: number,
  segmentType: string
): Promise<PracticeProgress | null> {
  return invoke('get_progress', { 
    userName, 
    articleId, 
    segmentType 
  });
}

export async function clearProgress(
  userName: string,
  articleId: number,
  segmentType: string
): Promise<void> {
  return invoke('clear_progress', { 
    userName, 
    articleId, 
    segmentType 
  });
}

// ========== 错词/错句管理 ==========

export async function addMistake(
  userName: string,
  segmentId: number,
  segmentContent: string,
  segmentType: string
): Promise<void> {
  return invoke('add_mistake', { 
    userName, 
    segmentId, 
    segmentContent, 
    segmentType 
  });
}

export async function removeMistake(userName: string, segmentId: number): Promise<void> {
  return invoke('remove_mistake', { 
    userName, 
    segmentId 
  });
}

export async function getMistakes(userName: string, segmentType?: string): Promise<Mistake[]> {
  return invoke('get_mistakes', { 
    userName, 
    segmentType 
  });
}

// ========== 排行榜 ==========

export async function saveRecord(
  userName: string,
  articleId: number,
  segmentType: string,
  score: number,
  accuracy: number,
  wpm: number
): Promise<void> {
  return invoke('save_record', { 
    request: {
      user_name: userName,
      article_id: articleId,
      segment_type: segmentType,
      score,
      accuracy,
      wpm
    }
  });
}

export async function getLeaderboard(
  articleId?: number,
  segmentType?: string,
  limit?: number
): Promise<LeaderboardRecord[]> {
  return invoke('get_leaderboard', { 
    articleId, 
    segmentType, 
    limit 
  });
}

// ========== TTS ==========

export async function speak(text: string, rate?: number): Promise<void> {
  return invoke('speak', { text, rate });
}

export async function stopSpeaking(): Promise<void> {
  return invoke('stop_speaking');
}

// ========== 智能复习（SM-2）==========

/**
 * 获取需要复习的单词（基于记忆曲线）
 */
export async function getScheduledWords(
  userName: string,
  articleId: number,
  segmentType: string,
  limit: number
): Promise<ScheduledWordsResponse> {
  return invoke('get_scheduled_words', { 
    userName, 
    articleId, 
    segmentType, 
    limit 
  });
}

/**
 * 更新单词熟练度（SM-2 算法）
 */
export async function updateWordMastery(
  userName: string,
  segmentId: number,
  segmentContent: string,
  segmentType: string,
  correct: boolean
): Promise<WordMastery> {
  return invoke('update_word_mastery', { 
    userName, 
    segmentId, 
    segmentContent, 
    segmentType, 
    correct 
  });
}

/**
 * 获取单词熟练度列表
 */
export async function getWordMasteries(
  userName: string,
  segmentType?: string
): Promise<WordMastery[]> {
  return invoke('get_word_masteries', { 
    userName, 
    segmentType 
  });
}

// ========== 练习历史记录 ==========

export interface PracticeHistory {
  id: number;
  user_name: string;
  article_id: number;
  article_title: string;
  segment_type: string;
  correct_count: number;
  incorrect_count: number;
  total_count: number;
  accuracy: number;
  wpm: number;
  duration_seconds: number;
  completed_at: string;
}

export interface UserStatistics {
  user_name: string;
  total_practices: number;
  total_correct: number;
  total_incorrect: number;
  total_words: number;
  avg_accuracy: number;
  avg_wpm: number;
  best_accuracy: number;
  best_wpm: number;
  total_duration_minutes: number;
  recent_histories: PracticeHistory[];
}

/**
 * 保存练习历史
 */
export async function savePracticeHistory(
  userName: string,
  articleId: number,
  segmentType: string,
  correctCount: number,
  incorrectCount: number,
  durationSeconds: number
): Promise<void> {
  return invoke('save_practice_history', { 
    request: {
      user_name: userName,
      article_id: articleId,
      segment_type: segmentType,
      correct_count: correctCount,
      incorrect_count: incorrectCount,
      duration_seconds: durationSeconds
    }
  });
}

/**
 * 获取练习历史
 */
export async function getPracticeHistory(
  userName: string,
  limit?: number
): Promise<PracticeHistory[]> {
  return invoke('get_practice_history', { 
    userName, 
    limit 
  });
}

/**
 * 获取用户统计信息
 */
export async function getUserStatistics(userName: string): Promise<UserStatistics> {
  return invoke('get_user_statistics', { 
    userName 
  });
}
