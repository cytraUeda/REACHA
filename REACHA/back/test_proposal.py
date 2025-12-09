#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Test script for proposal creation API
"""

import os
import sys
import requests
import json
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

DIFY_API_KEY2 = os.getenv("DIFY_API_KEY2")
DIFY_USER_ID = os.getenv("DIFY_USER_ID", "REACHA_agent")
DIFY_TIMEOUT = int(os.getenv("DIFY_TIMEOUT", "10800"))
DIFY_WORKFLOW_ENDPOINT = "https://api.dify.ai/v1/workflows/run"

if not DIFY_API_KEY2:
    print("ERROR: DIFY_API_KEY2 is not set in .env file")
    sys.exit(1)

# Test data (sample research output)
test_research_out = """
これはテスト用のリサーチデータです。
会社の事業概要、市場評価、競争優位性などの情報が含まれています。
"""

print(f"Testing Dify Workflow API with API_KEY2: {DIFY_API_KEY2[:20]}...")
print(f"Endpoint: {DIFY_WORKFLOW_ENDPOINT}")
print(f"User ID: {DIFY_USER_ID}")
print(f"Timeout: {DIFY_TIMEOUT}s")
print("-" * 60)

headers = {
    "Authorization": f"Bearer {DIFY_API_KEY2}",
    "Content-Type": "application/json",
}

payload = {
    "inputs": {"research_out": test_research_out},
    "response_mode": "streaming",
    "user": DIFY_USER_ID,
}

print("Sending request...")
print(f"Payload: {json.dumps(payload, ensure_ascii=False, indent=2)}")
print("-" * 60)

try:
    with requests.post(
        DIFY_WORKFLOW_ENDPOINT, headers=headers, json=payload, stream=True, timeout=DIFY_TIMEOUT
    ) as r:
        print(f"Status Code: {r.status_code}")
        
        if r.status_code != 200:
            print(f"ERROR: {r.text}")
            sys.exit(1)
        
        print("\nStreaming response:")
        print("-" * 60)
        
        proposal_parts = []
        event_count = 0
        
        for raw in r.iter_lines(decode_unicode=True):
            if not raw:
                continue
            if not raw.startswith("data:"):
                print(f"[RAW] {raw[:100]}")
                continue
            
            data = raw[5:].strip()
            if data == "[DONE]":
                print("\n[DONE] signal received")
                break
            
            try:
                evt = json.loads(data)
                event_count += 1
                event_type = evt.get("event", "unknown")
                print(f"\n[Event #{event_count}] type={event_type}")
                
                if isinstance(evt, dict):
                    # Handle workflow_finished
                    if event_type == "workflow_finished":
                        print("  -> workflow_finished detected")
                        data_obj = evt.get("data")
                        if isinstance(data_obj, dict):
                            outputs = data_obj.get("outputs")
                            if isinstance(outputs, dict):
                                print(f"  -> outputs keys: {list(outputs.keys())}")
                                for key in ("text", "answer", "output", "result"):
                                    value = outputs.get(key)
                                    if isinstance(value, str) and value.strip():
                                        print(f"  -> Found {key}: {value[:100]}...")
                                        proposal_parts.append(value)
                                        break
                    
                    # Handle text_chunk events
                    elif event_type == "text_chunk":
                        text = evt.get("text")
                        if isinstance(text, str) and text:
                            print(f"  -> text_chunk: {text[:50]}...")
                            proposal_parts.append(text)
                    
                    # Handle streaming answer
                    elif "answer" in evt:
                        ans = evt["answer"]
                        print(f"  -> answer chunk: {ans[:50]}...")
                        proposal_parts.append(ans)
                    elif "output" in evt:
                        out = evt["output"]
                        print(f"  -> output chunk: {out[:50]}...")
                        proposal_parts.append(out)
                    
                    # Show event structure for debugging
                    if event_count <= 3:  # Show first 3 events in detail
                        print(f"  -> Full event: {json.dumps(evt, ensure_ascii=False, indent=4)}")
                
            except json.JSONDecodeError as e:
                print(f"[JSON Error] {e}: {data[:100]}")
            except Exception as e:
                print(f"[Error] {e}: {data[:100]}")
        
        print("\n" + "=" * 60)
        print("FINAL RESULT:")
        print("=" * 60)
        proposal_text = "".join(proposal_parts)
        
        if proposal_text.strip():
            print(f"Success! Proposal length: {len(proposal_text)} characters")
            print(f"\nProposal preview (first 500 chars):")
            print("-" * 60)
            print(proposal_text[:500])
            if len(proposal_text) > 500:
                print(f"\n... (truncated, total {len(proposal_text)} chars)")
        else:
            print("WARNING: Empty proposal received!")
            print("This might indicate:")
            print("  1. The workflow API response format is different than expected")
            print("  2. The workflow is not configured correctly")
            print("  3. The API key might be incorrect")

except requests.exceptions.RequestException as e:
    print(f"ERROR: Request failed: {e}")
    sys.exit(1)
except KeyboardInterrupt:
    print("\n\nInterrupted by user")
    sys.exit(1)

