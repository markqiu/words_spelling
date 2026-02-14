"""
FastAPI 服务端入口
"""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.config import HOST, PORT, SPACY_MODEL
from app.models import SegmentRequest, SegmentResponse, HealthResponse
from segmenters import SpacySegmenter, APISegmenter

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# 全局分词器实例
spacy_segmenter: SpacySegmenter = None
api_segmenter: APISegmenter = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    global spacy_segmenter, api_segmenter
    
    # 启动时初始化
    logger.info("Initializing segmenters...")
    
    spacy_segmenter = SpacySegmenter(SPACY_MODEL)
    spacy_loaded = spacy_segmenter.load_model()
    logger.info(f"spaCy segmenter loaded: {spacy_loaded}")
    
    api_segmenter = APISegmenter()
    api_initialized = api_segmenter.initialize()
    logger.info(f"API segmenter initialized: {api_initialized}")
    
    yield
    
    # 关闭时清理
    logger.info("Shutting down...")


app = FastAPI(
    title="Text Segmentation Service",
    description="文本分词服务 - 支持单词、短语、短句三种模式",
    version="1.0.0",
    lifespan=lifespan
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境应该限制
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    """健康检查"""
    return HealthResponse(
        status="ok",
        spacy_loaded=spacy_segmenter.nlp is not None
    )


@app.post("/api/segment", response_model=SegmentResponse)
async def segment_text(request: SegmentRequest):
    """
    文本分词接口
    
    - **text**: 原始文本
    - **mode**: 分词模式 - "word"(单词) | "phrase"(短语) | "sentence"(短句)
    - **engine**: 分词引擎 - "spacy"(本地) | "api"(在线)
    """
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    
    if request.mode not in ("word", "phrase", "sentence"):
        raise HTTPException(status_code=400, detail="Invalid mode. Must be 'word', 'phrase', or 'sentence'")
    
    engine_used = request.engine or "spacy"
    
    try:
        if engine_used == "api":
            # 使用 API 分词
            if not api_segmenter.client:
                # 回退到 spaCy
                logger.warning("API not available, falling back to spaCy")
                engine_used = "spacy"
                segments = _segment_with_spacy(request.text, request.mode)
            else:
                segments = api_segmenter.segment(request.text, request.mode)
        else:
            # 使用 spaCy 本地分词
            segments = _segment_with_spacy(request.text, request.mode)
        
        return SegmentResponse(
            segments=segments,
            engine_used=engine_used,
            success=True,
            metadata={"count": len(segments)}
        )
        
    except Exception as e:
        logger.error(f"Segmentation failed: {e}")
        return SegmentResponse(
            segments=[],
            engine_used=engine_used,
            success=False,
            error=str(e)
        )


def _segment_with_spacy(text: str, mode: str) -> list[str]:
    """使用 spaCy 进行分词"""
    if mode == "word":
        return spacy_segmenter.segment_words(text)
    elif mode == "phrase":
        return spacy_segmenter.segment_phrases(text)
    else:  # sentence
        return spacy_segmenter.segment_sentences(text)


def run_server():
    """启动服务器（供 uv run 调用）"""
    import uvicorn
    uvicorn.run(app, host=HOST, port=PORT)


if __name__ == "__main__":
    run_server()
