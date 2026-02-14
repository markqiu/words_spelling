"""
外部 API 分词模块（使用 OpenAI 或其他 LLM）
"""
import os
from typing import List, Optional
import logging
from openai import OpenAI

from app.config import OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL

logger = logging.getLogger(__name__)


class APISegmenter:
    def __init__(self):
        """初始化 API 分词器"""
        self.client: Optional[OpenAI] = None
        
    def initialize(self) -> bool:
        """初始化 OpenAI 客户端"""
        if not OPENAI_API_KEY:
            logger.warning("OPENAI_API_KEY not set")
            return False
        
        try:
            self.client = OpenAI(
                api_key=OPENAI_API_KEY,
                base_url=OPENAI_BASE_URL
            )
            logger.info("OpenAI client initialized")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize OpenAI client: {e}")
            return False
    
    def segment(self, text: str, mode: str) -> List[str]:
        """
        使用 API 进行分词
        
        Args:
            text: 原始文本
            mode: 分词模式 ("word" | "phrase" | "sentence")
            
        Returns:
            分词结果列表
        """
        if not self.client:
            return []
        
        prompts = {
            "word": """You are an English vocabulary expert. Extract all unique English words from the given text.
Rules:
1. Only include real English words (no names, no numbers, no abbreviations)
2. Convert to lowercase
3. Remove duplicates
4. Filter out very common words (a, an, the, is, are, was, were, etc.)
5. Return ONLY a JSON array of words, nothing else

Text:
{text}

JSON array:""",
            
            "phrase": """You are an English language expert. Extract meaningful phrases from the given text.
Phrases include: clauses, prepositional phrases, idioms, collocations, and common expressions.
Rules:
1. Each phrase should be 2-10 words
2. Each phrase should have complete meaning
3. Remove duplicates
4. Return ONLY a JSON array of phrases, nothing else

Text:
{text}

JSON array:""",
            
            "sentence": """You are an English teacher. Split the given text into short sentences or sentence fragments.
Rules:
1. Split at punctuation marks (periods, commas, semicolons) or line breaks
2. Each fragment should be 3-15 words
3. Keep the original text as much as possible
4. Return ONLY a JSON array of sentence fragments, nothing else

Text:
{text}

JSON array:"""
        }
        
        prompt = prompts.get(mode, prompts["word"]).format(text=text[:2000])  # 限制文本长度
        
        try:
            response = self.client.chat.completions.create(
                model=OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": "You are a helpful assistant that returns only valid JSON arrays."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=2000,
                temperature=0.3
            )
            
            content = response.choices[0].message.content.strip()
            
            # 尝试解析 JSON
            import json
            
            # 移除可能的 markdown 代码块标记
            if content.startswith("```"):
                content = content.split("\n", 1)[1] if "\n" in content else content[3:]
            if content.endswith("```"):
                content = content.rsplit("```", 1)[0]
            
            segments = json.loads(content)
            
            if isinstance(segments, list):
                return [str(s).strip() for s in segments if s]
            
            return []
            
        except Exception as e:
            logger.error(f"API segmentation failed: {e}")
            return []
