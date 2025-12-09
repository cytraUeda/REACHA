#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
最小限のDify Chat Messagesクライアント（ループ処理対応）

- 単一のPythonファイル、追加ライブラリ不要（`requests`のみ使用）。
- API設定はコード内にハードコード（各自書き換えてください）。
- 固定の質問リストで会話を使い回します。
- 会社名はCLI経由で指定: --company "ACME"

使い方:
  python sample_dify_connect.py --company "ACME"
"""

import argparse
import json
import sys
import os
import time
from typing import Optional, Tuple

import requests
from requests.exceptions import RequestException

# =========================
# 設定（ハードコーディング可）
# =========================
API_KEY = "app-BfDFjZRyj3qBakTTxVZNOt1J"  # DifyのAPIキーをここに入力
API_ENDPOINT = "https://api.dify.ai/v1/chat-messages"
HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
}
USER_ID = "REACHA_agent"  # 利用ユーザー識別子（任意で変更）
# ストリーミング読み取りのタイムアウト（秒）: 長時間実行に合わせ延長（既定: 3時間）
TIMEOUT = 10800

# 実行制御（連続実行・失敗時の再試行）
MAX_RETRIES = 3
RETRY_BACKOFF_SECONDS = 10  # 再試行ごとに attempt * この秒数だけ待機
INTER_QUERY_DELAY_SECONDS = 8  # クエリ間の待機（Dify側の安定化用）

# 固定クエリリスト（必要に応じて編集可）
QUERIES = [
    "事業の全体像",
    "外部環境と市場評価",
    "競争優位と差別化要因",
    "直近のニュース取得",
    "世間の評価",
]


# =========================
# Marker helpers
# =========================
def _marker_paths(company: str) -> Tuple[str, str, str, str]:
    base_dir = os.path.join(os.path.dirname(__file__), "outputs", company)
    running = os.path.join(base_dir, ".running")
    heartbeat = os.path.join(base_dir, ".heartbeat")
    done = os.path.join(base_dir, ".done")
    aborted = os.path.join(base_dir, ".aborted")
    return running, heartbeat, done, aborted


def _touch(path: str) -> None:
    with open(path, "w", encoding="utf-8") as f:
        f.write(str(int(time.time())))


def _remove_silent(path: str) -> None:
    try:
        os.remove(path)
    except FileNotFoundError:
        pass
    except Exception:
        pass


def _init_markers(company: str) -> None:
    running, heartbeat, done, aborted = _marker_paths(company)
    _remove_silent(done)
    _remove_silent(aborted)
    _touch(running)
    _touch(heartbeat)


def _touch_heartbeat(company: str) -> None:
    _, heartbeat, _, _ = _marker_paths(company)
    _touch(heartbeat)


def _mark_done(company: str) -> None:
    running, heartbeat, done, _ = _marker_paths(company)
    _touch(done)
    _remove_silent(running)
    _remove_silent(heartbeat)


def _mark_aborted(company: str) -> None:
    running, heartbeat, _, aborted = _marker_paths(company)
    _touch(aborted)
    _remove_silent(running)
    _remove_silent(heartbeat)


def stream_once(company: str, query: str, conversation_id: Optional[str]) -> Tuple[Optional[str], str]:
    payload = {
        # アプリの入力変数
        "inputs": {"Company": company},
        # 一部のアプリではトップレベルのカスタムフィールドも受付可（含めても問題なし）
        # "Company": company,
        "query": query,
        "response_mode": "streaming",
        "conversation_id": conversation_id or "",
        "user": USER_ID,
        # "files": [...]  # このサンプルでは未使用
    }

    answer_parts = []
    new_conv_id = conversation_id

    try:
        with requests.post(
            API_ENDPOINT, headers=HEADERS, json=payload, stream=True, timeout=TIMEOUT
        ) as r:
            if r.status_code != 200:
                sys.stderr.write(f"HTTP {r.status_code}: {r.text}\n")
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

                # DifyからのSSEイベントの主なフィールド：event, answer, conversation_id など
                if not new_conv_id and isinstance(evt, dict) and evt.get("conversation_id"):
                    new_conv_id = evt["conversation_id"]

                if isinstance(evt, dict):
                    ans = evt.get("answer")
                    if ans:
                        print(ans, end="", flush=True)
                        answer_parts.append(ans)
                    elif evt.get("event") == "error" and evt.get("message"):
                        # エラーイベントは標準エラーに出力
                        sys.stderr.write(f"SSE error: {evt.get('message')}\n")

                # ハートビート更新（15秒間隔）
                now = time.time()
                if now - last_hb >= 15.0:
                    try:
                        _touch_heartbeat(company)
                    except Exception:
                        pass
                    last_hb = now
    except RequestException as e:
        sys.stderr.write(f"request error: {e}\n")

    print()  # 各クエリ後に改行
    return new_conv_id, "".join(answer_parts)


def main() -> None:
    global USER_ID, TIMEOUT, MAX_RETRIES, RETRY_BACKOFF_SECONDS, INTER_QUERY_DELAY_SECONDS
    ap = argparse.ArgumentParser(add_help=True)
    ap.add_argument("--company", "-c", required=True, help="Company 開始変数の値")
    ap.add_argument("--user", default=USER_ID, help="user 識別子 (任意)")
    # 実行時調整用オプション
    ap.add_argument("--timeout", type=int, default=TIMEOUT, help="SSE読み取りのタイムアウト秒 (既定: 10800)")
    ap.add_argument(
        "--retries", type=int, default=MAX_RETRIES, help="失敗時の最大リトライ回数 (既定: 3)"
    )
    ap.add_argument(
        "--retry-backoff", type=int, default=RETRY_BACKOFF_SECONDS, help="リトライ間隔の基準秒 (既定: 10)"
    )
    ap.add_argument(
        "--inter-delay", type=int, default=INTER_QUERY_DELAY_SECONDS, help="クエリ間待機秒 (既定: 8)"
    )
    ap.add_argument('--indices', default='', help='1始まりのカンマ区切り (例: 1,3,5)')
    args = ap.parse_args()
    USER_ID = args.user
    TIMEOUT = args.timeout
    MAX_RETRIES = args.retries
    RETRY_BACKOFF_SECONDS = args.retry_backoff
    INTER_QUERY_DELAY_SECONDS = args.inter_delay

    # 出力ディレクトリ準備 & マーカー初期化
    out_dir = os.path.join(os.path.dirname(__file__), "outputs", args.company)
    try:
        os.makedirs(out_dir, exist_ok=True)
    except Exception:
        sys.stderr.write(f"出力ディレクトリ作成に失敗しました: {out_dir}\n")

    _init_markers(args.company)
    # 実行対象のインデックス決定（デフォルトは全件）
    indices = list(range(1, len(QUERIES) + 1))
    if args.indices.strip():
        raw = [s.strip() for s in args.indices.split(',') if s.strip()]
        cand = sorted({int(s) for s in raw if s.isdigit()})
        indices = [i for i in cand if 1 <= i <= len(QUERIES)] or indices

    print(f"Company={args.company} で {len(indices)} 件を送信します。\n")

    conv_id: Optional[str] = None
    job_completed = False
    try:
        for idx, i in enumerate(indices, 1):
            q = QUERIES[i - 1]
            print(f"[{idx}/{len(indices)}] Q: {q}")
            print("A: ", end="")

            # ハートビート先出し
            try:
                _touch_heartbeat(args.company)
            except Exception:
                pass

            # 再試行つきで取得
            answer_text = ""
            new_conv_id: Optional[str] = conv_id
            for attempt in range(1, MAX_RETRIES + 1):
                new_conv_id, answer_text = stream_once(args.company, q, new_conv_id)
                if answer_text.strip():
                    break
                # 空応答やエラー時は指数バックオフ
                backoff = RETRY_BACKOFF_SECONDS * attempt
                sys.stderr.write(f"empty or failed response, retry in {backoff}s (attempt {attempt}/{MAX_RETRIES})\n")
                time.sleep(backoff)
            # 応答が得られた場合のみ会話IDを更新
            if answer_text.strip():
                conv_id = new_conv_id

            # ファイル保存: テキストとMarkdown
            base = f"{args.company}_{i}"
            txt_path = os.path.join(out_dir, f"{base}.txt")
            md_path = os.path.join(out_dir, f"{base}.md")
            try:
                with open(txt_path, "w", encoding="utf-8") as f_txt:
                    f_txt.write(answer_text)
            except Exception:
                sys.stderr.write(f"TXT保存に失敗しました: {txt_path}\n")
            try:
                with open(md_path, "w", encoding="utf-8") as f_md:
                    # シンプルにそのまま。必要ならここでMarkdown装飾を追加可能
                    f_md.write(answer_text)
            except Exception:
                sys.stderr.write(f"MD保存に失敗しました: {md_path}\n")

            # 次のクエリまで少し待機（連続実行を避ける）
            time.sleep(INTER_QUERY_DELAY_SECONDS)

        job_completed = True
    finally:
        try:
            if job_completed:
                _mark_done(args.company)
            else:
                _mark_aborted(args.company)
        except Exception:
            pass


if __name__ == "__main__":
    main()


# =========================
# Marker helpers
# =========================
def _marker_paths(company: str) -> Tuple[str, str, str, str]:
    base_dir = os.path.join(os.path.dirname(__file__), "outputs", company)
    running = os.path.join(base_dir, ".running")
    heartbeat = os.path.join(base_dir, ".heartbeat")
    done = os.path.join(base_dir, ".done")
    aborted = os.path.join(base_dir, ".aborted")
    return running, heartbeat, done, aborted


def _touch(path: str) -> None:
    with open(path, "w", encoding="utf-8") as f:
        f.write(str(int(time.time())))


def _remove_silent(path: str) -> None:
    try:
        os.remove(path)
    except FileNotFoundError:
        pass
    except Exception:
        pass


def _init_markers(company: str) -> None:
    running, heartbeat, done, aborted = _marker_paths(company)
    _remove_silent(done)
    _remove_silent(aborted)
    _touch(running)
    _touch(heartbeat)


def _touch_heartbeat(company: str) -> None:
    _, heartbeat, _, _ = _marker_paths(company)
    _touch(heartbeat)


def _mark_done(company: str) -> None:
    running, heartbeat, done, _ = _marker_paths(company)
    _touch(done)
    _remove_silent(running)
    _remove_silent(heartbeat)


def _mark_aborted(company: str) -> None:
    running, heartbeat, _, aborted = _marker_paths(company)
    _touch(aborted)
    _remove_silent(running)
    _remove_silent(heartbeat)

