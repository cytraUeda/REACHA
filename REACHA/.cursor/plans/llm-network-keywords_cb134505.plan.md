---
name: llm-network-keywords
overview: Difyの新しいKEY3アプリで提案JSONからキーフレーズを抽出し、Python側でnetworkxを使ってレイアウト計算したネットワークを既存の提案タブUIに統合する。
todos:
  - id: backend-llm-helper
    content: back/app/main.py に DIFY_API_KEY3 の読み込みと、inputs.data で Dify KEY3 ワークフローを呼び出すヘルパー関数 _call_dify_keywords を追加する
    status: completed
  - id: backend-networkx-layout
    content: /api/proposal/{company}/keywords エンドポイント内で LLM 応答からノードを構築し、networkx.spring_layout で座標を計算して x,y を含むJSONを返すようにする（ルールベースフォールバックも維持）
    status: completed
    dependencies:
      - backend-llm-helper
  - id: frontend-graph-coords
    content: ProposalKeywordGraph.tsx と Client.tsx の型と処理を拡張し、サーバーから渡された x,y 座標付きキーワードとエッジをそのまま描画する。座標が無い場合のみ従来の円形レイアウトを使う
    status: completed
    dependencies:
      - backend-networkx-layout
  - id: llm-network-test
    content: JCOM などで LLM ベースのキーフレーズとネットワーク表示を確認し、ノード・エッジの見やすさやフォールバック動作をチェックする
    status: completed
    dependencies:
      - frontend-graph-coords
---

## LLM＋networkx による提案キーフレーズネットワーク実装プラン

### 1. バックエンド設定と依存関係

- **環境変数の利用**
- `[back/app/main.py]` 冒頭の設定に `DIFY_API_KEY3 = os.getenv("DIFY_API_KEY3", "")` を追加し、キーフレーズ抽出用の Dify アプリキーを参照できるようにする。
- 既存の `DIFY_WORKFLOW_ENDPOINT`（`https://api.dify.ai/v1/workflows/run`）を **KEY3 でも使う前提** とし、KEY3 アプリでは `inputs.data` に提案JSONを渡す設計とする。
- **ライブラリ追加**
- `requirements.txt` に `networkx` を追加。
- `back/app/main.py` で `import networkx as nx` を追加し、ノード・エッジ定義とレイアウト計算に利用する。

### 2. Dify（KEY3）呼び出しヘルパー実装

- **ヘルパー関数追加**
- `[back/app/main.py]` に、キーフレーズ抽出専用の関数を追加:
    ```python
            def _call_dify_keywords(payload_json: Dict[str, Any]) -> Dict[str, Any]:
                """Dify KEY3 アプリを呼び出し、提案キーワード一覧のJSONを取得する。"""
    ```




- 処理内容:
    - `DIFY_API_KEY3` が未設定なら 500 を投げる。
    - `headers = {"Authorization": f"Bearer {DIFY_API_KEY3}", "Content-Type": "application/json"}`。
    - `json={"inputs": {"data": payload_json}, "response_mode": "blocking", "user": DIFY_USER_ID}` という形で `DIFY_WORKFLOW_ENDPOINT` に `requests.post`。
    - `status_code != 200` やタイムアウト・例外時にはログを出しつつ例外を投げる（呼び出し側でフォールバック）。
    - レスポンスJSON中の `outputs` あるいは `data.outputs` から、プロンプトで定義した `{"提案キーワード一覧": [...]}` をパースして返す。

### 3. /api/proposal/{company}/keywords の LLM 対応と networkx レイアウト

- **エンドポイントの設計方針**
- 既存の `/api/proposal/{company}/keywords` を拡張し、
    - **第一優先**: KEY3（LLM）で抽出した `提案キーワード一覧` を使ってノードを作る。
    - **フォールバック**: KEY3呼び出しorパース失敗時は、現状のルールベース（トークナイズ＋共起）で最小限のネットワークを返す。
- **LLM入力の作り方**
- 既に `get_proposal_keywords` 内で `runs: List[Dict[str, Any]] `と `runIndex` による `run` を特定しているので、
    - `payload_json = run` そのもの（または `{"提案テーマ一覧": run["提案テーマ一覧"], "提案全体の戦略サマリー": run.get("提案全体の戦略サマリー")} `のようにサブセット）を `inputs.data` に渡す。
- **LLM応答からノード化**
- `_call_dify_keywords(run_or_subset)` を呼び出し、返ってきた `提案キーワード一覧` を次のように変換:
    ```python
            nodes = [
              {
                "term": item["ラベル"],
                "score": float(item.get("重要度", 1.0)),
                "count": 0,  # count はルールベース or テキスト検索で補完（任意）
                "category": item.get("カテゴリ")
              }
              for item in 提案キーワード一覧
              if isinstance(item.get("ラベル"), str) and item["ラベル"].strip()
            ]
    ```




- `count` フィールドは、`json.dumps(run, ensure_ascii=False)` 内での単純な部分一致カウントでざっくり埋める程度でも良い（なくてもUIは成り立つ）。
- **エッジとレイアウトの構築（networkx）**
- `G = nx.Graph()` を作成し、上記ノードを `G.add_node(term, score=..., count=...)` で追加。
- エッジは次のどちらかの方式で構築:
    - 簡易版: 重要度上位 `N` 個のキーワードを完全グラフにし、重みを `(score_i + score_j)/2` などで付ける。
    - 既存の共起ロジックを流用し、「同じ文で共起しているLLMキーフレーズ同士」にだけエッジを張る（weightは共起回数ベース）。
- `pos = nx.spring_layout(G, k=0.6, iterations=50)` で 2D の `(x, y)` 座標を計算。
    - `x, y` はそのままでもよいが、フロントで扱いやすいよう `0〜1` に正規化して返す:
      ```python
                  xs = [p[0] for p in pos.values()]; ys = [p[1] for p in pos.values()]
                  ... 正規化して nodes に x, y フィールドとして埋め込む
      ```




- **レスポンス形式**
- 既存のレスポンスを拡張し、
    ```json
            {
              "keywords": [
                { "term": "OneID×CDPで世帯/個客ID統合", "score": 0.95, "count": 3, "x": 0.42, "y": 0.18, "category": "テーマ" },
                ...
              ],
              "edges": [
                { "source": "OneID×CDPで世帯/個客ID統合", "target": "J:COM BUSINESS向けB2Bデジタル獲得", "weight": 0.8 },
                ...
              ],
              "meta": { "runIndex": 0, "totalTerms": 10, "source": "llm" }
            }
    ```




- LLM失敗でルールベースにフォールバックした場合は `"source": "rule"` とし、フロント側で必要ならラベル表示に使えるようにする。

### 4. フロントエンドの座標対応（既存UIの活用）

- **型の拡張**
- `[flont/components/ProposalKeywordGraph.tsx]` の `ProposalKeyword` 型に `x?: number; y?: number; category?: string;` を追加。
- `ProposalKeywordResponse` 型（`Client.tsx`内）も同様に `x, y, category, source` を許容するように拡張。
- **レイアウトの利用方針**
- もし `keyword.x` / `keyword.y` が存在する場合は、
    - 現在の円形レイアウト計算はスキップし、受け取った座標でそのまま `cx, cy` を決定。
- `x, y` が無い場合にだけ、今までの簡易円形レイアウト（フォールバック）を使う。
- **UI 微調整**
- グラフカードのサブタイトルに、
    - 例: `LLM ベースの提案キーフレーズと関係性を可視化しています（source: llm / rule）`

を追加し、どちらのモードかが分かるようにする。

- テーブル側に `カテゴリ` 列（例: テーマ / ターゲット / アプローチ）を追加する余地を残しておく（最初はツールチップ内表示でも可）。

### 5. 動作確認とチューニング

- **確認手順**
- JCOM の提案タブで:
    - ネットワークが「business / oneid / キャンペ / cdpで…」といった断片ではなく、LLMが返した意味的なラベル（例: 「OneID×CDPで世帯/個客ID統合と解約抑止」など）で構成されるか確認。
    - ノードをドラッグした際のレイアウトの見やすさ（衝突や重なり）を目視で確認し、`spring_layout` の `k` や `iterations` を微調整。
- LLMが一時的にエラーを返した場合でも、ルールベースフォールバックで最低限のネットワークとテーブルが表示されることを確認。
- **追加チューニング余地**
- KEY3 のプロンプト側で、
    - ラベル数（例: 10件）、
    - カテゴリの定義（テーマ/ターゲット/アプローチ/価値）、