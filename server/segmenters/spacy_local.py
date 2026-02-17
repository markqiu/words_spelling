"""
spaCy 本地分词模块
"""
import spacy
from typing import List, Optional
import logging

logger = logging.getLogger(__name__)


class SpacySegmenter:
    def __init__(self, model_name: str = "en_core_web_sm"):
        """
        初始化 spaCy 分词器
        
        Args:
            model_name: spaCy 模型名称，默认 en_core_web_sm
        """
        self.model_name = model_name
        self.nlp: Optional[spacy.language.Language] = None
        
    def load_model(self) -> bool:
        """加载模型"""
        try:
            self.nlp = spacy.load(self.model_name)
            logger.info(f"Loaded spaCy model: {self.model_name}")
            return True
        except OSError:
            logger.warning(f"Model {self.model_name} not found, downloading...")
            try:
                from spacy.cli import download
                download(self.model_name)
                self.nlp = spacy.load(self.model_name)
                logger.info(f"Downloaded and loaded spaCy model: {self.model_name}")
                return True
            except Exception as e:
                logger.error(f"Failed to download model: {e}")
                return False
    
    def segment_words(self, text: str) -> List[str]:
        """
        按单词切分
        
        Args:
            text: 原始文本
            
        Returns:
            单词列表（去重、小写、只保留字母、单复数合并）
        """
        if not self.nlp:
            return []
        
        doc = self.nlp(text)
        words = []
        seen_lemmas = set()  # 使用词根去重，避免单复数重复
        
        for token in doc:
            # 只保留纯字母单词，过滤标点和数字
            if token.is_alpha and not token.is_stop:
                lemma = token.lemma_.lower()  # 获取词根（单数形式）
                
                # 如果词根未见过，添加词根形式
                if lemma not in seen_lemmas:
                    seen_lemmas.add(lemma)
                    words.append(lemma)
        
        return words
    
    def segment_phrases(self, text: str) -> List[str]:
        """
        按短语切分（从句、名词短语、介词短语、习惯用语等）
        
        Args:
            text: 原始文本
            
        Returns:
            短语列表
        """
        if not self.nlp:
            return []
        
        doc = self.nlp(text)
        phrases = []
        
        # 1. 提取名词短语
        for chunk in doc.noun_chunks:
            phrase = chunk.text.strip()
            if 3 <= len(phrase.split()) <= 10:  # 3-10个词
                phrases.append(phrase)
        
        # 2. 提取从句（通过依存句法）
        for token in doc:
            # 从句标记词
            if token.dep_ in ("ccomp", "xcomp", "advcl", "relcl", "acl"):
                # 获取从句的所有 token
                clause_tokens = [t for t in token.subtree]
                clause_text = " ".join(t.text for t in clause_tokens).strip()
                if 3 <= len(clause_tokens) <= 12:
                    phrases.append(clause_text)
        
        # 3. 提取介词短语
        for token in doc:
            if token.pos_ == "ADP":  # 介词
                pp_tokens = [t for t in token.subtree]
                pp_text = " ".join(t.text for t in pp_tokens).strip()
                if 2 <= len(pp_tokens) <= 8:
                    phrases.append(pp_text)
        
        # 去重并保持顺序
        seen = set()
        unique_phrases = []
        for p in phrases:
            p_lower = p.lower()
            if p_lower not in seen:
                seen.add(p_lower)
                unique_phrases.append(p)
        
        return unique_phrases
    
    def segment_sentences(self, text: str) -> List[str]:
        """
        按短句切分（以标点符号或换行符为标准）
        
        Args:
            text: 原始文本
            
        Returns:
            短句列表
        """
        if not self.nlp:
            return []
        
        doc = self.nlp(text)
        sentences = []
        
        for sent in doc.sents:
            sent_text = sent.text.strip()
            if sent_text:
                # 如果句子过长，尝试拆分
                if len(sent_text.split()) > 15:
                    split_sents = self._split_long_sentence(sent)
                    sentences.extend(split_sents)
                else:
                    sentences.append(sent_text)
        
        return sentences
    
    def _split_long_sentence(self, sent) -> List[str]:
        """
        拆分长句
        
        Args:
            sent: spaCy Span 对象
            
        Returns:
            拆分后的短句列表
        """
        # 尝试按从句拆分
        clauses = []
        current_clause = []
        
        for token in sent:
            current_clause.append(token)
            
            # 如果是从句边界或逗号
            if token.dep_ in ("ccomp", "xcomp", "advcl", "relcl") or token.text == ",":
                clause_text = " ".join(t.text for t in current_clause).strip()
                if len(current_clause) >= 3:
                    clauses.append(clause_text)
                    current_clause = []
        
        # 添加剩余部分
        if current_clause:
            clause_text = " ".join(t.text for t in current_clause).strip()
            if len(clause_text.split()) >= 3:
                clauses.append(clause_text)
        
        # 如果没有成功拆分，返回原句
        if not clauses:
            return [sent.text.strip()]
        
        return clauses
