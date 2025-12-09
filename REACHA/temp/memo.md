ビルド・起動手順:* フロント: **cd REACHA/flont && npm ci && npm run build**

* バック: **cd REACHA/back && uvicorn app.main:app --host** **0.0.0.0 --port 8000**

---

# ① 最短：クイックトンネル（アカウント不要）

> すぐURLが欲しいだけならコレ。`trycloudflare.com` のランダムURLが発行されます（セッション継続中のみ有効）。

### インストール

* **Windows (PowerShell)**
  ```powershell
  winget install Cloudflare.cloudflared
  ```
* **macOS (Homebrew)**
  ```bash
  brew install cloudflared
  ```
* **Ubuntu/Debian** （どれでもOK）

```bash
  sudo apt-get update && sudo apt-get install cloudflared
```

### 起動（FastAPIがローカルで動いている前提：`http://localhost:8000`）

```bash
cloudflared tunnel --url http://localhost:8000
```

→ コンソールに `https://<ランダム>.trycloudflare.com` が表示されます。

そのURLを相手に共有すれば、 **静的フロント（FastAPIが配信）も /api も全部見られます** 。

※このコマンドを実行している間だけ有効。ターミナルを閉じると切れます。

---

# ② 安定運用：固定の自分のドメインで公開（無料アカウント＋DNS登録）

> 固定URL（例：`https://app.yourdomain.com`）で常時公開したい場合。

### 準備

1. [Cloudflare](https://dash.cloudflare.com/) 無料アカウント作成
2. 自分のドメインをCloudflareのDNSに追加（既存ドメインを移管／ネームサーバ変更）

   ※ドメインが無ければ取得→Cloudflareに追加

### ログイン & トンネル作成

```bash
cloudflared tunnel login               # ブラウザが開く → 認可
cloudflared tunnel create my-app       # トンネル作成（IDとcredentialsが発行）
```

### ルーティング（サブドメインをトンネルへ割当）

```bash
cloudflared tunnel route dns my-app app.yourdomain.com
```

### 設定ファイル（`~/.cloudflared/config.yml`）

```yaml
tunnel: my-app
credentials-file: /home/<you>/.cloudflared/<my-app-uuid>.json

ingress:
  - hostname: app.yourdomain.com
    service: http://localhost:8000
  - service: http_status:404
```

### 起動

```bash
cloudflared tunnel run my-app
```

> これで **[https://app.yourdomain.com](https://app.yourdomain.com/)** から
>
> FastAPIが配信する静的HTML（Next.jsの `out/`）＋ `/api/...` にアクセス可能。

（常駐させたいなら）

* **Linux/systemd** : `cloudflared service install`
* **Windows** : 予定タスクやサービス化ツールで常駐起動

---

## FastAPI 側の確認点（静的配信＋APIの同居）

* 静的を `/` にマウント、APIは `/api` で先に定義しておく（競合回避）
* フロントの `fetch` は **相対パス** に（`fetch('/api/run')` など）。CORSは原則不要（同一オリジン）。

```python
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path

app = FastAPI()

@app.post("/api/run")
def run_job():
    # data/ に書く既存ロジック
    return {"ok": True}

@app.get("/api/files/{name}")
def get_file(name: str):
    return FileResponse(Path("data")/name)

app.mount("/", StaticFiles(directory="out", html=True), name="static")
```

---

## よくある躓きと対処

* **502 Bad Gateway** : `uvicorn` が起動していない / ポート番号が違う
* **相対パス漏れ** : フロントが `http://localhost:8000` を参照している → `fetch('/api/...')` に修正
* **権限/パス** : `data/` の実体パスを `Path(__file__).parent` 起点で絶対化しておくと安全
* **常時公開** : クイックトンネルはセッション閉じると切れます。固定URLが欲しいなら②で運用

---

## これで完了！

* まずは **①クイックトンネル**で疎通確認
* 本番／継続共有なら **②固定ドメイン運用**へ

必要なら、あなたのOSに合わせて

* `config.yml` の実ファイルパス
* `cloudflared service install` のコマンド
* `uvicorn` の起動スクリプト（Windows/PowerShell版）

  までピンポイントで書き出します。どの環境で回します？（Windows / macOS / Linux）
