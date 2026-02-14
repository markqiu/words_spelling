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
