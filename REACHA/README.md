# REACHA – Research & Enrichment AI Companion for Humans & Agents

FastAPI で長時間の Dify 実行をバックグラウンド起動し、Next.js を静的エクスポートして同一オリジンで配信します。フロントは FastAPI が `out/` をそのまま配信するため、起動は `uvicorn` のみで完結します。

- バックエンド: `REACHA/back` (FastAPI + Dify統合)
- フロントエンド: `REACHA/flont` (Next.js 14, 静的エクスポート)
- 出力保存先: `REACHA/back/outputs/{Company}/` に `{Company}_{1..5}.txt/.md`
- 提案保存先: `REACHA/back/outputs/{Company}/` に `{Company}_proposal.txt/.md`

## ディレクトリ構成

```
REACHA/
  back/
    app/
      main.py              # FastAPI (/api配下 + 静的配信 + ジョブ管理 + Dify統合)
      __init__.py
    outputs/               # 実行結果 (会社名ごとのサブフォルダ)
    .env                   # 環境変数（APIキー等）
    requirements.txt
  flont/
    app/                   # Next.js App Router ページ
      company/[company]/   # 会社別結果ページ
        proposal/          # 提案作成ページ
    components/            # UI コンポーネント
    lib/                   # API クライアント（相対fetch）
    package.json
    next.config.js         # output: 'export'
    tsconfig.json
    next-env.d.ts
    app/globals.css
```

## クイックスタート (Windows PowerShell)

1) フロントを静的ビルド

```
cd REACHA/flont
npm ci
npm run build   # out/ が生成される
```

2) 環境変数の設定

`REACHA/back/.env` ファイルを作成し、以下の環境変数を設定してください：

```
DIFY_API_KEY1=your_chat_flow_api_key
DIFY_API_KEY2=your_workflow_api_key
DIFY_USER_ID=REACHA_agent
DIFY_TIMEOUT=10800
DIFY_MAX_RETRIES=3
DIFY_RETRY_BACKOFF_SECONDS=10
DIFY_INTER_QUERY_DELAY_SECONDS=8
```

- `DIFY_API_KEY1`: チャットフローAPI用（リサーチ実行）
- `DIFY_API_KEY2`: ワークフローAPI用（提案作成）
- `DIFY_USER_ID`: Difyユーザー識別子（デフォルト: "REACHA_agent"）
- `DIFY_TIMEOUT`: タイムアウト秒数（デフォルト: 10800 = 3時間）
- `DIFY_MAX_RETRIES`: 最大リトライ回数（デフォルト: 3）
- `DIFY_RETRY_BACKOFF_SECONDS`: リトライ待機時間（デフォルト: 10秒）
- `DIFY_INTER_QUERY_DELAY_SECONDS`: クエリ間の待機時間（デフォルト: 8秒）

3) バックエンド起動（フロントも同一オリジンで配信）

```
cd REACHA/back
python -m venv venv
./venv/Scripts/Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

- ブラウザで `http://localhost:8000/` を開きます。
- 会社名を入力し、必要なら［オプション］から実行対象のクエリを選択して実行。
- 結果はタブ（最大5件）でMarkdown表示します。
- 結果が完了したら「提案を作成」ボタンから提案を生成できます。

## 利用フロー

### リサーチ実行

1. 会社名入力（既存会社は補完表示）
2. 実行ボタンで `/api/run` に POST（約30〜40分）。画面は10秒毎に `/api/results/{company}` をポーリング
3. 既存結果が5件すべて揃っている場合のみ新規実行はスキップして結果表示
4. 部分的に既存がある場合：
   - サブセット指定（例: 3〜5を選択）なら指定分を上書き保存
   - 全件選択または未指定（デフォルト）なら未完了分のみ実行

### 提案作成

1. リサーチ結果が完了した会社ページで「提案を作成」ボタンをクリック
2. 各リサーチファイル（`_1.txt` 〜 `_5.txt`）を順次処理してDifyワークフローAPIに送信
3. 進捗表示（1/5, 2/5, ...）を確認しながら待機
4. 完了後、提案内容がMarkdown形式で表示される
5. 2回目以降は保存された提案を即座に表示（再実行しない）

クエリ候補（デフォルト全選択）:

- 事業の全体像
- 外部環境と市場評価
- 競争優位と差別化要因
- 直近のニュース取得
- 世間の評価

## バックエンドAPI（要約, すべて `/api` 配下）

### リサーチ実行関連

- `GET /api/companies` 既存会社一覧
- `GET /api/results/{company}` 結果+進捗（itemsにtxt/md）
- `POST /api/run` { company, queries?: string[] } 実行開始（並行1件に制限、実行中は409）
  - queries 省略 or 全件指定時は未完了分のみ実行
  - サブセット指定時は指定分を上書き保存
- `GET /api/run/status?company=...` 実行状態と簡易進捗
- `DELETE /api/results/{company}` 会社の結果を削除

### 提案作成関連

- `POST /api/proposal/{company}` 提案を作成
  - 各リサーチファイル（`_1.txt` 〜 `_5.txt`）を順次処理
  - URLを除去してからDifyワークフローAPIに送信
  - 結果を `{company}_proposal.txt/.md` として保存
  - 既に提案が存在する場合は保存された内容を返す（再実行しない）
- `GET /api/proposal/{company}/progress` 提案作成の進捗状況（current/total）

詳細は `REACHA/back/app/main.py` を参照。

## 注意事項

- リサーチ実行: 1件あたり30〜40分。ブラウザを閉じてもバックエンドで継続。
- 提案作成: 5ファイルを順次処理するため、合計で10〜20分程度かかる場合があります。
- 並列実行は禁止（FastAPI側のロック）。
- Dify APIキーは `.env` ファイルで管理（`DIFY_API_KEY1`: チャットフロー、`DIFY_API_KEY2`: ワークフロー）。
- 提案作成時は、リサーチファイル内のURLが自動的に除去されます。
- 提案結果はキャッシュされ、2回目以降は即座に表示されます。
- 同一オリジン配信のため CORS 設定は基本不要（既存設定が残っていても問題なし）。

### 長時間実行時の起動フラグ（推奨）

1) 自動リロードなし（安定）

```
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

2) 自動リロードを使う場合は監視対象を絞る

```
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --reload-dir app --reload-exclude "outputs/*"
```

### 実行状態の保持（ディスクマーカー + ハートビート）

- ランナーは `outputs/{Company}/` に以下のマーカーを出力します。
  - `.running` 起動時に作成
  - `.heartbeat` 15秒毎に更新
  - `.done` 正常終了時に作成
  - `.aborted` 異常終了時に作成
- APIはメモリ上のプロセス状態に加えて、直近の `.heartbeat` が一定時間内で、開始から規定時間内であれば「running」を維持します。
- しきい値は環境変数で調整可能：
  - `MAX_RUN_SECONDS`（既定 10800 = 3時間）
  - `HEARTBEAT_STALE_SECONDS`（既定 60秒）

## 簡易デプロイ手順（PowerShell / Windows）

1) フロントの静的ビルド

```
cd REACHA/flont
npm ci
npm run build
```

2) 環境変数の設定

`REACHA/back/.env` ファイルを作成し、Dify APIキー等を設定してください（上記「クイックスタート」の2)を参照）。

3) FastAPI の起動（同一オリジンでフロント配信）

```
cd ../back
python -m venv venv
./venv/Scripts/Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

ローカル確認: `http://localhost:8000/`

4) 一時公開（Cloudflare Tunnel）
   別ターミナルで実行:

```
cloudflared tunnel --url http://localhost:8000
```

表示された `https://xxxx.trycloudflare.com/` にアクセス（反映に数十秒かかる場合あり）。

5) 停止

- Cloudflared の停止: ターミナルで `Ctrl + C`
- Uvicorn の停止: ターミナルで `Ctrl + C`

## オプション: 簡易認証（Basic / Token）

環境変数を設定すると、全エンドポイントに簡易認証がかかります（いずれか設定で有効化）。

- Basic 認証:
  - `BASIC_USER`, `BASIC_PASS` を設定
  - 例 (PowerShell):

```
$env:BASIC_USER = "cytra"
$env:BASIC_PASS = "test01"
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

- ブラウザ/クライアントで Basic 認証を入力
- トークン認証:

  - `AUTH_TOKEN` を設定
  - 例 (PowerShell):

```
$env:AUTH_TOKEN = "mytoken123"
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

- リクエストヘッダにいずれかを付与
  - `Authorization: Bearer mytoken123`
  - `X-API-Token: mytoken123`

注意: Basic/Token を同時設定した場合、どちらでも通過可能です。必要に応じて一方のみ設定してください。
