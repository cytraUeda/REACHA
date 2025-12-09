# AGENTS: バックグラウンド実行と並列制御設計

## 目的
- Dify の長時間実行（30〜40分）を FastAPI からバックグラウンドで起動し、状態と成果物(出力ファイル)をフロントへ提供します。
- 同時並列実行は避け、1件ずつ安全に処理します。
- Next.js を静的エクスポートし、FastAPI がフロント(静的)と API を同一オリジンで配信します。

## 構成概要
- ランナー: `REACHA/back/sample_dify_connect.py`
  - `--company {Company}` を受け取り、SSEで受信しながら `outputs/{Company}/{Company}_{i}.txt/.md` を保存。
- API: `REACHA/back/app/main.py`
  - すべて `/api` プレフィックス配下。
    - `POST /api/run` でサブプロセスとしてランナーを `subprocess.Popen` で起動。
    - `GET /api/results/{company}` で保存済みファイルを集約して返却。
    - `GET /api/companies` で既存会社一覧。
    - `GET /api/run/status?company=...` で現在の実行状態を返却。
  - 静的配信: `flont/out` を `/` にマウント（`StaticFiles(..., html=True)`）。

## 並列制御
- モジュール内グローバル変数 + `threading.Lock()` で実行中プロセスを1件に制限。
- 実行中に再度 `/api/run` が来た場合は `409 Conflict` を返却。
- バックグラウンドスレッドで `proc.wait()` を監視し、終了時に状態を解放。

## 状態と進捗の判定
- `GET /api/results/{company}` で `{completed, total}` を計算。
  - `completed` は存在するファイル数で概算（テキスト or Markdown が存在すれば1件完了とみなす）。
  - 実行中かどうかはロック下の `running_process` と `running_company` で判定。

## フロント連携
- フロントは `/api/run` を叩いた後、 `/api/results/{company}` を 10 秒間隔でポーリング。
- 既存結果がある会社は入力補完として `/api/companies` から提示。
- タブUI（最大5件）でトピック別に Markdown を表示。
- オプションUI（初期は閉じる）で、実行対象クエリをチェックボックスで選択。デフォルトは全選択。

## 設定
- 同一オリジン配信のため CORS 設定は原則不要（既存設定が残っていても問題なし）。
- 出力先: `REACHA/back/outputs/{Company}/`。

## 実行スキップと上書きルール
- すべてのトピック(1..5)が既存で内容がある場合のみ、新規実行をスキップして結果を返却。
- サブセット指定（`queries` で一部選択）の場合は、選択分を上書き保存。
- 全件選択または未指定（デフォルト）では、未完了分のみを実行対象に絞り込みます。

## 今後の拡張案
- 複数ジョブのキューイング（FIFO）
- 実行履歴とログ保存
- 認証（社内利用時）
- Dify APIキーの安全な注入（環境変数）
