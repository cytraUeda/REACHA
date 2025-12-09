#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
FastAPI backend for orchestrating long-running Dify runs and serving outputs
"""

import os
import sys
import uuid
import threading
import time
import subprocess
import json
import logging
import re
from typing import List, Optional, Dict, Any, Tuple
import base64
import binascii

from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from starlette.responses import FileResponse
import shutil
import requests
from requests.exceptions import RequestException, Timeout, ConnectionError as RequestsConnectionError
from dotenv import load_dotenv
import traceback

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables from .env file
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

port = int(os.getenv("PORT", 8000))


# ----------------------
# Configuration
# ----------------------
BACK_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# OUTPUTS_ROOT can be overridden by environment variable for flexibility
OUTPUTS_ROOT = os.getenv("OUTPUTS_ROOT", os.path.join(BACK_DIR, "outputs"))

FRONT_ORIGIN = os.getenv("FRONT_ORIGIN", "http://localhost:3000")

# Dify API Configuration (from environment variables)
DIFY_API_KEY1 = os.getenv("DIFY_API_KEY1", "")  # Chat flow API (existing)
DIFY_API_KEY2 = os.getenv("DIFY_API_KEY2", "")  # Workflow API (new)
DIFY_USER_ID = os.getenv("DIFY_USER_ID", "REACHA_agent")
DIFY_TIMEOUT = int(os.getenv("DIFY_TIMEOUT", "10800"))
DIFY_MAX_RETRIES = int(os.getenv("DIFY_MAX_RETRIES", "3"))
DIFY_RETRY_BACKOFF_SECONDS = int(os.getenv("DIFY_RETRY_BACKOFF_SECONDS", "10"))
DIFY_INTER_QUERY_DELAY_SECONDS = int(os.getenv("DIFY_INTER_QUERY_DELAY_SECONDS", "8"))

# Dify API Endpoints
DIFY_CHAT_ENDPOINT = "https://api.dify.ai/v1/chat-messages"
DIFY_WORKFLOW_ENDPOINT = "https://api.dify.ai/v1/workflows/run"

QUERIES: List[str] = [
    "事業の全体像",
    "外部環境と市場評価",
    "競争優位と差別化要因",
    "直近のニュース取得",
    "世間の評価",
]


# ----------------------
# Long-run tuning
# ----------------------
MAX_RUN_SECONDS = int(os.getenv("MAX_RUN_SECONDS", str(3 * 60 * 60)))  # 3h
HEARTBEAT_STALE_SECONDS = int(os.getenv("HEARTBEAT_STALE_SECONDS", "60"))  # 1m


# ----------------------
# Process state
# ----------------------
state_lock = threading.Lock()
running_process: Optional[Any] = None  # Can be subprocess.Popen or DummyProcess
running_thread: Optional[threading.Thread] = None
running_company: Optional[str] = None
running_job_id: Optional[str] = None


def ensure_outputs_root() -> None:
    os.makedirs(OUTPUTS_ROOT, exist_ok=True)


def company_dir(company: str) -> str:
    return os.path.join(OUTPUTS_ROOT, company)


def remove_urls_from_text(text: str) -> str:
    """Remove URLs from text content."""
    # Pattern to match various URL formats found in the text files:
    # - ([www.example.com](https://example.com/path#:~:text=...))
    # - ([www.example.com](https://example.com/path))
    # - (https://example.com/path)
    # - [text](https://example.com/path)
    # - https://example.com/path
    
    # Remove nested Markdown links in parentheses: ([www.example.com](https://...))
    text = re.sub(r'\(\[www\.[^\]]+\]\(https?://[^\)]+\)\)', '', text)
    
    # Remove Markdown links: [text](url) - keep the text, remove the URL
    text = re.sub(r'\[([^\]]+)\]\(https?://[^\)]+\)', r'\1', text)
    
    # Remove URLs in parentheses: (https://...) or (www....)
    text = re.sub(r'\(https?://[^\)]+\)', '', text)
    text = re.sub(r'\(www\.[^\)]+\)', '', text)
    
    # Remove URLs in square brackets: [https://...] or [www....]
    text = re.sub(r'\[https?://[^\]]+\]', '', text)
    text = re.sub(r'\[www\.[^\]]+\]', '', text)
    
    # Remove standalone URLs (http://, https://) with optional fragments
    text = re.sub(r'https?://[^\s\)\]\(]+(?:#:~:text=[^\s\)\]\(]+)?', '', text)
    
    # Remove standalone www. URLs
    text = re.sub(r'\bwww\.[^\s\)\]\(]+', '', text)
    
    # Clean up multiple spaces and punctuation issues
    text = re.sub(r'\s+', ' ', text)
    text = re.sub(r'\s+\.', '.', text)
    text = re.sub(r'\s+,', ',', text)
    text = re.sub(r'\s+\)', ')', text)
    text = re.sub(r'\(\s+', '(', text)
    text = re.sub(r'\s+\)', ')', text)
    
    return text.strip()


def list_companies() -> List[str]:
    ensure_outputs_root()
    try:
        return [
            name
            for name in os.listdir(OUTPUTS_ROOT)
            if os.path.isdir(os.path.join(OUTPUTS_ROOT, name))
        ]
    except FileNotFoundError:
        return []


def read_results(company: str) -> Dict[str, Any]:
    """Read up to len(QUERIES) result pairs from disk and compute status/progress."""
    dir_path = company_dir(company)
    items = []
    completed_count = 0
    total = len(QUERIES)

    for i in range(1, total + 1):
        base = f"{company}_{i}"
        txt_path = os.path.join(dir_path, f"{base}.txt")
        md_path = os.path.join(dir_path, f"{base}.md")
        text = ""
        md = ""
        if os.path.exists(txt_path):
            try:
                with open(txt_path, "r", encoding="utf-8") as f:
                    text = f.read()
            except Exception:
                text = ""
        if os.path.exists(md_path):
            try:
                with open(md_path, "r", encoding="utf-8") as f:
                    md = f.read()
            except Exception:
                md = ""

        has_any = bool(text) or bool(md)
        if has_any:
            completed_count += 1

        items.append(
            {
                "index": i,
                "title": QUERIES[i - 1],
                "text": text,
                "markdown": md,
            }
        )

    # Determine running state from memory first, then fall back to disk markers
    with state_lock:
        if running_company == company and running_process is not None:
            poll_result = running_process.poll()
            mem_running = poll_result is None
        else:
            mem_running = False

    disk = _read_disk_state(company)
    is_running = mem_running or (
        disk.get("running", False)
        and not disk.get("done", False)
        and not disk.get("aborted", False)
        and disk.get("hb_recent", False)
        and disk.get("run_age_ok", False)
    )

    status = "running" if is_running else ("completed" if completed_count > 0 or disk.get("done", False) else "not_found")
    progress = {"completed": completed_count, "total": total}
    
    # Check if proposal file exists
    proposal_txt_path = os.path.join(dir_path, f"{company}_proposal.txt")
    has_proposal = os.path.exists(proposal_txt_path) and os.path.getsize(proposal_txt_path) > 0
    
    return {
        "company": company,
        "status": status,
        "queries": QUERIES,
        "progress": progress,
        "items": items,
        "hasProposal": has_proposal,
    }


class RunRequest(BaseModel):
    company: str
    queries: Optional[List[str]] = None


class RunResponse(BaseModel):
    jobId: str
    company: str
    status: str


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONT_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ----------------------
# Global Exception Handlers
# ----------------------
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions with proper logging."""
    logger.warning(f"HTTP exception: {exc.status_code} - {exc.detail} - Path: {request.url.path}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch-all exception handler to prevent server crashes."""
    error_msg = str(exc)
    error_trace = traceback.format_exc()
    logger.error(f"Unhandled exception: {error_msg}\n{error_trace}\nPath: {request.url.path}")
    
    # Don't expose internal error details in production
    return JSONResponse(
        status_code=500,
        content={"detail": "内部エラーが発生しました。ログを確認してください。"}
    )


# ----------------------
# Simple Auth (optional)
# ----------------------
BASIC_USER = os.getenv("BASIC_USER")
BASIC_PASS = os.getenv("BASIC_PASS")
AUTH_TOKEN = os.getenv("AUTH_TOKEN")  # Bearer or X-API-Token

AUTH_ENABLED = (bool(BASIC_USER and BASIC_PASS) or bool(AUTH_TOKEN))

@app.middleware("http")
async def simple_auth_middleware(request, call_next):
    if not AUTH_ENABLED:
        return await call_next(request)

    authorized = False
    auth_header = request.headers.get("authorization")
    token_header = request.headers.get("x-api-token")

    # Bearer token (Authorization: Bearer <token>)
    if AUTH_TOKEN and auth_header and auth_header.lower().startswith("bearer "):
        bearer = auth_header.split(" ", 1)[1].strip()
        if bearer == AUTH_TOKEN:
            authorized = True

    # X-API-Token header
    if AUTH_TOKEN and token_header and token_header == AUTH_TOKEN:
        authorized = True

    # Basic auth (Authorization: Basic base64(user:pass))
    if not authorized and BASIC_USER and BASIC_PASS and auth_header and auth_header.lower().startswith("basic "):
        b64 = auth_header.split(" ", 1)[1].strip()
        try:
            decoded = base64.b64decode(b64).decode("utf-8", errors="ignore")
            if ":" in decoded:
                user, pwd = decoded.split(":", 1)
                if user == BASIC_USER and pwd == BASIC_PASS:
                    authorized = True
        except (binascii.Error, ValueError):
            authorized = False

    if not authorized:
        # Prefer Basic challenge if Basic is configured, else 401 JSON
        from starlette.responses import Response, JSONResponse
        if BASIC_USER and BASIC_PASS:
            return Response(status_code=401, headers={"WWW-Authenticate": "Basic realm=REACHA"})
        return JSONResponse({"detail": "Unauthorized"}, status_code=401)

    return await call_next(request)


@app.get("/api/companies")
def get_companies() -> Dict[str, Any]:
    """Get list of all companies."""
    try:
        companies = list_companies()
        return {"companies": companies}
    except Exception as e:
        logger.error(f"Error getting companies list: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="企業一覧の取得に失敗しました")


@app.get("/api/results/{company}")
def get_results(company: str) -> Dict[str, Any]:
    """Get results for a specific company."""
    try:
        return read_results(company)
    except Exception as e:
        logger.error(f"Error getting results for company {company}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"結果の取得に失敗しました: {str(e)}")


@app.delete("/api/results/{company}")
def delete_results(company: str) -> Dict[str, Any]:
    """Delete results for a specific company."""
    try:
        # 競合中断: 実行中は削除させない
        with state_lock:
            if running_process is not None:
                try:
                    poll_result = running_process.poll()
                    alive = poll_result is None
                except Exception as e:
                    logger.warning(f"Error checking process status: {e}")
                    alive = False
            else:
                alive = False
            if alive and running_company == company:
                raise HTTPException(status_code=409, detail="この企業のジョブが実行中です")

        target_dir = company_dir(company)
        if os.path.isdir(target_dir):
            try:
                shutil.rmtree(target_dir)
                logger.info(f"Deleted results for company: {company}")
            except PermissionError as e:
                logger.error(f"Permission denied when deleting {target_dir}: {e}")
                raise HTTPException(status_code=500, detail="ファイルの削除権限がありません")
            except Exception as e:
                logger.error(f"Error deleting directory {target_dir}: {e}", exc_info=True)
                raise HTTPException(status_code=500, detail=f"削除に失敗しました: {str(e)}")
        else:
            logger.warning(f"Directory not found for deletion: {target_dir}")

        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error deleting results for {company}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="削除処理中にエラーが発生しました")


def _monitor_process(job_id: str, company: str, proc: Any, thread: Optional[threading.Thread] = None) -> None:
    """Monitor a process or thread and clean up state when done."""
    global running_process, running_company, running_job_id, running_thread
    try:
        if thread is not None:
            # Thread-based execution
            thread.join()
        else:
            # Subprocess-based execution (legacy, not used anymore)
            proc.wait()
    finally:
        with state_lock:
            # Clear only if the same job is still recorded
            if running_job_id == job_id:
                running_process = None
                running_thread = None
                running_company = None
                running_job_id = None


@app.post("/api/run", response_model=RunResponse)
def post_run(req: RunRequest) -> RunResponse:
    """Start a background job to run Dify queries for a company."""
    global running_process, running_company, running_job_id
    
    try:
        company = req.company.strip()
        if not company:
            raise HTTPException(status_code=400, detail="company is required")

        # 選択クエリから実行インデックスを決定（デフォルトは全件）
        selected = req.queries or QUERIES
        selected_set = set(selected)
        indices = [i + 1 for i, q in enumerate(QUERIES) if q in selected_set]
        if not indices:
            indices = list(range(1, len(QUERIES) + 1))

        # 全件存在している場合のみスキップ（結果返す）
        def _all_exist(company_name: str) -> bool:
            d = company_dir(company_name)
            for i in range(1, len(QUERIES) + 1):
                base = f"{company_name}_{i}"
                txt_path = os.path.join(d, f"{base}.txt")
                md_path = os.path.join(d, f"{base}.md")
                if not (os.path.exists(txt_path) or os.path.exists(md_path)):
                    return False
            return True

        # 競合実行の制御と起動
        with state_lock:
            if running_process is not None:
                try:
                    poll_result = running_process.poll()
                    alive = poll_result is None
                except Exception as e:
                    logger.warning(f"Error checking process status in post_run: {e}")
                    alive = False
            else:
                alive = False
            
            if alive:
                raise HTTPException(status_code=409, detail="別のジョブが実行中です")

            try:
                ensure_outputs_root()
                os.makedirs(company_dir(company), exist_ok=True)
            except OSError as e:
                logger.error(f"Error creating directories for {company}: {e}")
                raise HTTPException(status_code=500, detail=f"ディレクトリの作成に失敗しました: {str(e)}")

            if _all_exist(company):
                return RunResponse(jobId="", company=company, status="completed")

            # 実行対象の最終決定：
            # - 明示的サブセット選択(queries が既定より少ない)なら選択通り実行（既存も上書き許容）
            # - 全件選択(queries が全件 or 未指定=フォールバック)の場合は、未完了のものだけ実行
            def _has_any(company_name: str, idx: int) -> bool:
                try:
                    d = company_dir(company_name)
                    base = f"{company_name}_{idx}"
                    return os.path.exists(os.path.join(d, f"{base}.txt")) or os.path.exists(os.path.join(d, f"{base}.md"))
                except Exception:
                    return False

            is_full_selection = len(selected_set) >= len(QUERIES)
            if is_full_selection:
                run_indices = [i for i in indices if not _has_any(company, i)]
            else:
                run_indices = indices

            if not run_indices:
                # すべて既に存在しており実行不要
                return RunResponse(jobId="", company=company, status="completed")

            job_id = str(uuid.uuid4())

            def _run_job():
                """Run Dify queries in background thread."""
                try:
                    _run_dify_queries(company, run_indices)
                except Exception as e:
                    # Log error but don't raise (process monitoring will handle cleanup)
                    logger.error(f"Error in background job for {company}: {str(e)}", exc_info=True)
                    try:
                        _dify_mark_aborted(company)
                    except Exception:
                        pass

            running_company = company
            running_job_id = job_id

            try:
                t = threading.Thread(target=_run_job, daemon=True)
                t.start()
            except Exception as e:
                logger.error(f"Failed to start background thread for {company}: {e}", exc_info=True)
                running_company = None
                running_job_id = None
                raise HTTPException(status_code=500, detail="バックグラウンドジョブの開始に失敗しました")

            # Create a dummy process object for compatibility with existing monitoring code
            class DummyProcess:
                def __init__(self, thread: threading.Thread):
                    self.thread = thread

                def poll(self):
                    try:
                        return 0 if not self.thread.is_alive() else None
                    except Exception:
                        return 0

            running_process = DummyProcess(t)
            running_thread = t

            try:
                monitor_thread = threading.Thread(target=_monitor_process, args=(job_id, company, running_process, t), daemon=True)
                monitor_thread.start()
            except Exception as e:
                logger.warning(f"Failed to start monitor thread for {company}: {e}")
                # Don't fail if monitor thread fails to start

        return RunResponse(jobId=job_id, company=company, status="running")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in post_run for {company}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"ジョブの開始中にエラーが発生しました: {str(e)}")


@app.get("/api/run/status")
def get_run_status(company: Optional[str] = None) -> Dict[str, Any]:
    """Get status of running jobs."""
    try:
        with state_lock:
            if running_process is not None:
                try:
                    poll_result = running_process.poll()
                    alive = poll_result is None
                except Exception as e:
                    logger.warning(f"Error checking process status in get_run_status: {e}")
                    alive = False
            else:
                alive = False
            is_target = company is None or running_company == company
            mem_running = alive and is_target
            job_id = running_job_id if mem_running else None
        
        disk_running = False
        if company:
            try:
                disk = _read_disk_state(company)
                disk_running = (
                    disk.get("running", False)
                    and not disk.get("done", False)
                    and not disk.get("aborted", False)
                    and disk.get("hb_recent", False)
                    and disk.get("run_age_ok", False)
                )
            except Exception as e:
                logger.warning(f"Error reading disk state for {company}: {e}")

        status_running = mem_running or disk_running
        status = "running" if status_running else "idle"

        progress = None
        if company:
            try:
                res = read_results(company)
                progress = res.get("progress")
            except Exception as e:
                logger.warning(f"Error getting progress for {company}: {e}")

        return {"status": status, "company": running_company if mem_running else company, "jobId": job_id, "progress": progress}
    except Exception as e:
        logger.error(f"Unexpected error in get_run_status: {str(e)}", exc_info=True)
        # Return safe default instead of raising exception
        return {"status": "error", "company": company, "jobId": None, "progress": None}


@app.get("/api/proposal/{company}/progress")
def get_proposal_progress(company: str) -> Dict[str, Any]:
    """Get progress of proposal creation."""
    try:
        dir_path = company_dir(company)
        if not os.path.isdir(dir_path):
            return {"current": 0, "total": 0, "status": "not_started"}
        
        progress_file = os.path.join(dir_path, f"{company}_proposal_progress.json")
        proposal_txt_path = os.path.join(dir_path, f"{company}_proposal.txt")
        
        # If proposal file exists, creation is complete
        if os.path.exists(proposal_txt_path) and os.path.getsize(proposal_txt_path) > 0:
            # Clean up progress file if it still exists
            try:
                if os.path.exists(progress_file):
                    os.remove(progress_file)
            except Exception:
                pass
            return {"current": 0, "total": 0, "status": "completed"}
        
        if os.path.exists(progress_file):
            try:
                with open(progress_file, "r", encoding="utf-8") as f:
                    progress_data = json.load(f)
                    # Ensure status is set
                    if "status" not in progress_data:
                        progress_data["status"] = "processing"
                    return progress_data
            except json.JSONDecodeError as e:
                logger.warning(f"Invalid JSON in progress file {progress_file}: {e}")
            except Exception as e:
                logger.warning(f"Error reading progress file {progress_file}: {e}")
        
        return {"current": 0, "total": 0, "status": "not_started"}
    except Exception as e:
        logger.error(f"Error getting proposal progress for {company}: {str(e)}", exc_info=True)
        # Return default progress instead of raising exception
        return {"current": 0, "total": 0, "status": "error"}


@app.post("/api/proposal/{company}")
def create_proposal(company: str) -> Dict[str, Any]:
    """Create a proposal by processing each .txt file sequentially and calling Dify workflow API."""
    try:
        logger.info(f"Proposal creation request received for company: {company}")
        
        if not DIFY_API_KEY2:
            logger.error("DIFY_API_KEY2 is not configured")
            raise HTTPException(status_code=500, detail="DIFY_API_KEY2 is not configured")

        # Check if proposal already exists
        dir_path = company_dir(company)
        if not os.path.isdir(dir_path):
            raise HTTPException(status_code=404, detail=f"Company '{company}' not found")
        
        proposal_txt_path = os.path.join(dir_path, f"{company}_proposal.txt")
        proposal_md_path = os.path.join(dir_path, f"{company}_proposal.md")
        progress_file = os.path.join(dir_path, f"{company}_proposal_progress.json")
        
        # If proposal already exists, return it
        if os.path.exists(proposal_txt_path):
            try:
                with open(proposal_txt_path, "r", encoding="utf-8") as f:
                    existing_proposal = f.read().strip()
                if existing_proposal:
                    logger.info(f"Returning cached proposal for {company}")
                    # Clean up progress file if exists
                    try:
                        if os.path.exists(progress_file):
                            os.remove(progress_file)
                    except Exception:
                        pass
                    return {"proposal": existing_proposal}
            except Exception as e:
                logger.warning(f"Failed to read cached proposal: {e}")

        # Collect all .txt file contents (1-5)
        research_files = []
        for i in range(1, len(QUERIES) + 1):
            txt_path = os.path.join(dir_path, f"{company}_{i}.txt")
            if os.path.exists(txt_path):
                try:
                    with open(txt_path, "r", encoding="utf-8") as f:
                        content = f.read().strip()
                        if content:
                            research_files.append((i, content))
                            logger.debug(f"Read file {i}: {txt_path}, size: {len(content)} chars")
                except Exception as e:
                    logger.warning(f"Failed to read file {txt_path}: {e}")

        if not research_files:
            raise HTTPException(status_code=400, detail=f"No research data found for company '{company}'")

        # Process each file sequentially
        headers = {
            "Authorization": f"Bearer {DIFY_API_KEY2}",
            "Content-Type": "application/json",
        }
        
        all_proposal_parts = []
        total_files = len(research_files)
        
        # Initialize progress file
        try:
            with open(progress_file, "w", encoding="utf-8") as f:
                json.dump({"current": 0, "total": total_files, "status": "processing"}, f)
        except Exception as e:
            logger.warning(f"Failed to create progress file: {e}")

        for file_idx, (query_idx, research_content) in enumerate(research_files, 1):
            logger.info(f"Processing file {query_idx}/{len(research_files)} for {company}")
            
            # Update progress
            try:
                with open(progress_file, "w", encoding="utf-8") as f:
                    json.dump({"current": file_idx, "total": total_files, "status": "processing"}, f)
            except Exception:
                pass
            
            # Remove URLs from content
            research_content_cleaned = remove_urls_from_text(research_content)
            logger.info(f"File {query_idx}: Original length: {len(research_content)}, After URL removal: {len(research_content_cleaned)} chars")
            
            # Call Dify Workflow API for this file
            payload = {
                "inputs": {"research_out": research_content_cleaned},
                "response_mode": "streaming",
                "user": DIFY_USER_ID,
            }
            
            proposal_parts = []
            max_retries = 3
            retry_delay = 5  # seconds
            
            for attempt in range(1, max_retries + 1):
                try:
                    logger.info(f"Sending request {file_idx}/{len(research_files)} to Dify Workflow API (attempt {attempt}/{max_retries})")
                    try:
                        with requests.post(
                            DIFY_WORKFLOW_ENDPOINT, headers=headers, json=payload, stream=True, timeout=DIFY_TIMEOUT
                        ) as r:
                            logger.info(f"Dify API response status for file {query_idx}: {r.status_code}")
                            
                            # Handle non-200 status codes
                            if r.status_code == 429:  # Rate limit
                                if attempt < max_retries:
                                    wait_time = retry_delay * attempt
                                    logger.warning(f"Rate limited, waiting {wait_time}s before retry {attempt + 1}/{max_retries}")
                                    time.sleep(wait_time)
                                    continue
                                else:
                                    error_text = r.text[:500] if r.text else "Rate limit exceeded"
                                    logger.error(f"Dify API rate limit error for file {query_idx}")
                                    raise HTTPException(status_code=429, detail=f"リクエスト制限に達しました。しばらく待ってから再試行してください。")
                            
                            if r.status_code in (500, 502, 503, 504):  # Server errors - retry
                                if attempt < max_retries:
                                    wait_time = retry_delay * attempt
                                    logger.warning(f"Server error {r.status_code}, waiting {wait_time}s before retry {attempt + 1}/{max_retries}")
                                    time.sleep(wait_time)
                                    continue
                                else:
                                    error_text = r.text[:500] if r.text else "Server error"
                                    logger.error(f"Dify API server error for file {query_idx}: {r.status_code} - {error_text}")
                                    raise HTTPException(status_code=500, detail=f"Dify APIサーバーエラー ({r.status_code})。しばらく待ってから再試行してください。")
                            
                            if r.status_code != 200:
                                error_text = r.text[:500] if r.text else "No error message"
                                logger.error(f"Dify API error for file {query_idx}: {r.status_code} - {error_text}")
                                raise HTTPException(status_code=500, detail=f"Dify API error ({r.status_code}) for file {query_idx}: {error_text}")

                            # Process streaming response
                            for raw in r.iter_lines(decode_unicode=True):
                                if not raw:
                                    continue
                                if not raw.startswith("data:"):
                                    continue
                                data = raw[5:].strip()
                                if data == "[DONE]":
                                    break
                                try:
                                    evt = json.loads(data)
                                except json.JSONDecodeError:
                                    logger.debug(f"Failed to parse JSON from stream: {data[:100]}")
                                    continue
                                except Exception as e:
                                    logger.debug(f"Error parsing stream data: {e}")
                                    continue

                                if isinstance(evt, dict):
                                    event_type = evt.get("event")
                                    
                                    # Handle workflow_finished event (final output)
                                    if event_type == "workflow_finished":
                                        data_obj = evt.get("data")
                                        if isinstance(data_obj, dict):
                                            outputs = data_obj.get("outputs")
                                            if isinstance(outputs, dict):
                                                # Prefer text-like fields from outputs
                                                for key in ("text", "answer", "output", "result"):
                                                    value = outputs.get(key)
                                                    if isinstance(value, str) and value.strip():
                                                        proposal_parts.append(value)
                                                        break
                                                # If no standard field found, use first string value
                                                if not any(isinstance(outputs.get(k), str) and outputs.get(k).strip() for k in ("text", "answer", "output", "result")):
                                                    for value in outputs.values():
                                                        if isinstance(value, str) and value.strip():
                                                            proposal_parts.append(value)
                                                            break
                                    
                                    # Handle text_chunk events (streaming chunks during execution)
                                    elif event_type == "text_chunk":
                                        text = evt.get("text")
                                        if isinstance(text, str) and text:
                                            proposal_parts.append(text)
                                    
                                    # Handle streaming answer during execution
                                    elif "answer" in evt:
                                        proposal_parts.append(evt["answer"])
                                    elif "text" in evt:
                                        proposal_parts.append(evt["text"])
                                    elif "output" in evt:
                                        proposal_parts.append(evt["output"])
                                    elif "data" in evt and isinstance(evt["data"], dict):
                                        if "answer" in evt["data"]:
                                            proposal_parts.append(evt["data"]["answer"])
                                        elif "text" in evt["data"]:
                                            proposal_parts.append(evt["data"]["text"])
                                        elif "output" in evt["data"]:
                                            proposal_parts.append(evt["data"]["output"])
                                    
                                    # Handle errors
                                    elif event_type == "error" and evt.get("message"):
                                        error_msg = evt.get("message", "Unknown error")
                                        logger.error(f"Dify workflow error event for file {query_idx}: {error_msg}")
                                        if attempt < max_retries:
                                            wait_time = retry_delay * attempt
                                            logger.warning(f"Workflow error, waiting {wait_time}s before retry {attempt + 1}/{max_retries}")
                                            time.sleep(wait_time)
                                            proposal_parts = []  # Reset for retry
                                            break  # Break from inner loop to retry
                                        else:
                                            raise HTTPException(status_code=500, detail=f"Dify workflow error for file {query_idx}: {error_msg}")
                            
                            # If we got here, the request was successful
                            break
                        
                    except Timeout as e:
                        logger.warning(f"Timeout when calling Dify workflow API for file {query_idx} (attempt {attempt}/{max_retries}): {str(e)}")
                        if attempt < max_retries:
                            wait_time = retry_delay * attempt
                            logger.info(f"Retrying after {wait_time}s...")
                            time.sleep(wait_time)
                            continue
                        else:
                            logger.error(f"Timeout after {max_retries} attempts for file {query_idx}")
                            raise HTTPException(status_code=504, detail=f"Dify APIへのリクエストがタイムアウトしました (ファイル{query_idx})。時間がかかりすぎています。")
                    
                    except RequestsConnectionError as e:
                        logger.warning(f"Connection error when calling Dify workflow API for file {query_idx} (attempt {attempt}/{max_retries}): {str(e)}")
                        if attempt < max_retries:
                            wait_time = retry_delay * attempt
                            logger.info(f"Retrying after {wait_time}s...")
                            time.sleep(wait_time)
                            continue
                        else:
                            logger.error(f"Connection error after {max_retries} attempts for file {query_idx}")
                            raise HTTPException(status_code=503, detail=f"Dify APIへの接続に失敗しました (ファイル{query_idx})。ネットワークを確認してください。")
                    
                except HTTPException:
                    raise  # Re-raise HTTP exceptions immediately
                except RequestException as e:
                    logger.warning(f"Request exception when calling Dify workflow API for file {query_idx} (attempt {attempt}/{max_retries}): {str(e)}")
                    if attempt < max_retries:
                        wait_time = retry_delay * attempt
                        logger.info(f"Retrying after {wait_time}s...")
                        time.sleep(wait_time)
                        continue
                    else:
                        logger.error(f"Request exception after {max_retries} attempts for file {query_idx}: {str(e)}")
                        raise HTTPException(status_code=500, detail=f"Dify APIへのリクエストに失敗しました (ファイル{query_idx}): {str(e)}")
                except Exception as e:
                    logger.error(f"Unexpected error in proposal creation for file {query_idx} (attempt {attempt}/{max_retries}): {str(e)}", exc_info=True)
                    if attempt < max_retries:
                        wait_time = retry_delay * attempt
                        logger.info(f"Retrying after {wait_time}s...")
                        time.sleep(wait_time)
                        continue
                    else:
                        raise HTTPException(status_code=500, detail=f"予期しないエラーが発生しました (ファイル{query_idx}): {str(e)}")
        
            # If we exhausted all retries without success
            if not proposal_parts:
                logger.error(f"Failed to get proposal parts for file {query_idx} after {max_retries} attempts")
                # Continue to next file instead of failing completely
                logger.warning(f"Skipping file {query_idx} and continuing with remaining files")
            else:
                file_proposal = "".join(proposal_parts)
                if file_proposal.strip():
                    all_proposal_parts.append(file_proposal)
                    logger.info(f"File {query_idx} processed successfully. Proposal length: {len(file_proposal)} chars")
                else:
                    logger.warning(f"File {query_idx} returned empty proposal")

        # Combine all proposal parts
        proposal_text = "\n\n".join(all_proposal_parts)
        logger.info(f"Proposal creation completed. Total files processed: {len(all_proposal_parts)}/{total_files}, Total length: {len(proposal_text)} chars")

        if not proposal_text.strip():
            logger.error("Empty response from all Dify workflow API calls")
            # Update progress to show error
            try:
                with open(progress_file, "w", encoding="utf-8") as f:
                    json.dump({"current": total_files, "total": total_files, "status": "error", "message": "すべてのファイル処理が失敗しました"}, f)
            except Exception:
                pass
            raise HTTPException(status_code=500, detail="DifyワークフローAPIから空のレスポンスが返されました。すべてのファイル処理に失敗した可能性があります。")

        # Save proposal to files
        try:
            with open(proposal_txt_path, "w", encoding="utf-8") as f:
                f.write(proposal_text)
            logger.info(f"Proposal saved to {proposal_txt_path}")
        except PermissionError as e:
            logger.error(f"Permission denied when saving proposal to {proposal_txt_path}: {e}")
            raise HTTPException(status_code=500, detail="提案ファイルの保存に失敗しました（権限エラー）")
        except OSError as e:
            logger.error(f"OS error when saving proposal to {proposal_txt_path}: {e}")
            raise HTTPException(status_code=500, detail=f"提案ファイルの保存に失敗しました: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error saving proposal to {proposal_txt_path}: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"提案ファイルの保存中にエラーが発生しました: {str(e)}")
        
        try:
            with open(proposal_md_path, "w", encoding="utf-8") as f:
                f.write(proposal_text)
            logger.info(f"Proposal saved to {proposal_md_path}")
        except Exception as e:
            logger.warning(f"Failed to save markdown proposal file {proposal_md_path}: {e}")
            # Don't fail if markdown file save fails, txt file is more important
        
        # Clean up progress file
        try:
            if os.path.exists(progress_file):
                os.remove(progress_file)
        except Exception as e:
            logger.warning(f"Failed to remove progress file {progress_file}: {e}")

        return {"proposal": proposal_text}
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        logger.error(f"Unexpected error in create_proposal for {company}: {str(e)}", exc_info=True)
        # Clean up progress file on error
        try:
            progress_file = os.path.join(company_dir(company), f"{company}_proposal_progress.json")
            if os.path.exists(progress_file):
                with open(progress_file, "w", encoding="utf-8") as f:
                    json.dump({"current": 0, "total": 0, "status": "error", "message": str(e)}, f)
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"提案作成中に予期しないエラーが発生しました: {str(e)}")


# ----------------------
# Disk state helpers
# ----------------------
def _marker_paths(company: str) -> Dict[str, str]:
    d = company_dir(company)
    return {
        "running": os.path.join(d, ".running"),
        "heartbeat": os.path.join(d, ".heartbeat"),
        "done": os.path.join(d, ".done"),
        "aborted": os.path.join(d, ".aborted"),
    }


def _mtime(path: str) -> Optional[float]:
    try:
        return os.path.getmtime(path)
    except Exception:
        return None


def _read_disk_state(company: str) -> Dict[str, Any]:
    paths = _marker_paths(company)
    ts_running = _mtime(paths["running"]) or 0.0
    ts_hb = _mtime(paths["heartbeat"]) or 0.0
    ts_done = _mtime(paths["done"]) or 0.0
    ts_aborted = _mtime(paths["aborted"]) or 0.0

    now = time.time()
    run_age = now - ts_running if ts_running else None
    hb_age = now - ts_hb if ts_hb else None

    return {
        "running": bool(ts_running),
        "done": bool(ts_done),
        "aborted": bool(ts_aborted),
        "hb_recent": hb_age is not None and hb_age <= HEARTBEAT_STALE_SECONDS,
        "run_age_ok": run_age is not None and run_age <= MAX_RUN_SECONDS,
        "ts": {"running": ts_running, "heartbeat": ts_hb, "done": ts_done, "aborted": ts_aborted},
    }


# ----------------------
# Dify Integration Functions (from sample_dify_connect.py)
# ----------------------

def _dify_marker_paths(company: str) -> Tuple[str, str, str, str]:
    """Get marker file paths for a company."""
    base_dir = company_dir(company)
    running = os.path.join(base_dir, ".running")
    heartbeat = os.path.join(base_dir, ".heartbeat")
    done = os.path.join(base_dir, ".done")
    aborted = os.path.join(base_dir, ".aborted")
    return running, heartbeat, done, aborted


def _dify_touch(path: str) -> None:
    """Create or update a marker file with current timestamp."""
    try:
        with open(path, "w", encoding="utf-8") as f:
            f.write(str(int(time.time())))
    except Exception:
        pass


def _dify_remove_silent(path: str) -> None:
    """Remove a file silently if it exists."""
    try:
        os.remove(path)
    except Exception:
        pass


def _dify_init_markers(company: str) -> None:
    """Initialize marker files for a running job."""
    running, heartbeat, done, aborted = _dify_marker_paths(company)
    _dify_remove_silent(done)
    _dify_remove_silent(aborted)
    _dify_touch(running)
    _dify_touch(heartbeat)


def _dify_touch_heartbeat(company: str) -> None:
    """Update heartbeat marker file."""
    _, heartbeat, _, _ = _dify_marker_paths(company)
    _dify_touch(heartbeat)


def _dify_mark_done(company: str) -> None:
    """Mark job as done."""
    running, heartbeat, done, _ = _dify_marker_paths(company)
    _dify_touch(done)
    _dify_remove_silent(running)
    _dify_remove_silent(heartbeat)


def _dify_mark_aborted(company: str) -> None:
    """Mark job as aborted."""
    running, heartbeat, _, aborted = _dify_marker_paths(company)
    _dify_touch(aborted)
    _dify_remove_silent(running)
    _dify_remove_silent(heartbeat)


def _dify_stream_once(company: str, query: str, conversation_id: Optional[str]) -> Tuple[Optional[str], str]:
    """Stream a single query to Dify chat API and return conversation_id and answer."""
    if not DIFY_API_KEY1:
        raise ValueError("DIFY_API_KEY1 is not set")

    headers = {
        "Authorization": f"Bearer {DIFY_API_KEY1}",
        "Content-Type": "application/json",
    }

    payload = {
        "inputs": {"Company": company},
        "query": query,
        "response_mode": "streaming",
        "conversation_id": conversation_id or "",
        "user": DIFY_USER_ID,
    }

    answer_parts = []
    new_conv_id = conversation_id

    try:
        with requests.post(
            DIFY_CHAT_ENDPOINT, headers=headers, json=payload, stream=True, timeout=DIFY_TIMEOUT
        ) as r:
            if r.status_code != 200:
                return conversation_id, ""

            last_hb = 0.0
            for raw in r.iter_lines(decode_unicode=True):
                if not raw:
                    continue
                if not raw.startswith("data:"):
                    continue
                data = raw[5:].strip()
                if data == "[DONE]":
                    break
                try:
                    evt = json.loads(data)
                except Exception:
                    continue

                if not new_conv_id and isinstance(evt, dict) and evt.get("conversation_id"):
                    new_conv_id = evt["conversation_id"]

                if isinstance(evt, dict):
                    ans = evt.get("answer")
                    if ans:
                        answer_parts.append(ans)
                    elif evt.get("event") == "error" and evt.get("message"):
                        pass  # Error handling can be added here if needed

                # Update heartbeat every 15 seconds
                now = time.time()
                if now - last_hb >= 15.0:
                    try:
                        _dify_touch_heartbeat(company)
                    except Exception:
                        pass
                    last_hb = now
    except RequestException:
        return conversation_id, ""

    return new_conv_id, "".join(answer_parts)


def _run_dify_queries(company: str, indices: List[int]) -> None:
    """Run Dify queries for specified indices and save results."""
    out_dir = company_dir(company)
    os.makedirs(out_dir, exist_ok=True)

    _dify_init_markers(company)

    conv_id: Optional[str] = None
    job_completed = False

    try:
        for idx, i in enumerate(indices, 1):
            q = QUERIES[i - 1]

            # Update heartbeat
            try:
                _dify_touch_heartbeat(company)
            except Exception:
                pass

            # Retry logic
            answer_text = ""
            new_conv_id: Optional[str] = conv_id
            for attempt in range(1, DIFY_MAX_RETRIES + 1):
                new_conv_id, answer_text = _dify_stream_once(company, q, new_conv_id)
                if answer_text.strip():
                    break
                # Exponential backoff on failure
                backoff = DIFY_RETRY_BACKOFF_SECONDS * attempt
                time.sleep(backoff)

            if answer_text.strip():
                conv_id = new_conv_id

            # Save files
            base = f"{company}_{i}"
            txt_path = os.path.join(out_dir, f"{base}.txt")
            md_path = os.path.join(out_dir, f"{base}.md")
            try:
                with open(txt_path, "w", encoding="utf-8") as f_txt:
                    f_txt.write(answer_text)
            except Exception:
                pass
            try:
                with open(md_path, "w", encoding="utf-8") as f_md:
                    f_md.write(answer_text)
            except Exception:
                pass

            # Delay between queries
            time.sleep(DIFY_INTER_QUERY_DELAY_SECONDS)

        job_completed = True
    finally:
        try:
            if job_completed:
                _dify_mark_done(company)
            else:
                _dify_mark_aborted(company)
        except Exception:
            pass


# ----------------------
# Static files mount (last - serves all static files including /company/* routes)
# ----------------------
FRONT_OUT_DIR = os.path.join(os.path.dirname(BACK_DIR), 'flont', 'out')
if os.path.isdir(FRONT_OUT_DIR):
    app.mount("/", StaticFiles(directory=FRONT_OUT_DIR, html=True), name="static")

