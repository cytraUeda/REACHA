---
name: proposal_json_comparison_ui
overview: 提案タブで、複数回実行された提案JSONを横比較できるUI/UXを設計・実装し、既存Markdown形式との後方互換も維持する。
todos:
  - id: parse-json-runs
    content: 提案テキストから複数JSON実行分を安全に抽出するパーサ関数を実装
    status: completed
  - id: proposal-run-tabs
    content: 実行回タブおよび単一回表示レイアウトを実装
    status: completed
    dependencies:
      - parse-json-runs
  - id: proposal-compare-table
    content: 複数実行の提案テーマ・戦略サマリ比較テーブルを実装
    status: completed
    dependencies:
      - parse-json-runs
  - id: proposal-fallback-markdown
    content: JSONとして解釈できない場合のMarkdownフォールバック表示を実装
    status: completed
    dependencies:
      - parse-json-runs
  - id: proposal-error-handling
    content: パース失敗時の警告表示とデバッグ用JSON表示パネルを実装
    status: completed
    dependencies:
      - parse-json-runs
  - id: proposal-style-tuning
    content: 提案タブ全体のスタイル・レスポンシブ対応を調整し、ブラウザで確認
    status: completed
    dependencies:
      - proposal-run-tabs
      - proposal-compare-table
---

# 提案タブのJSON比較UI実装プラン

## 目的

- 提案タブで、**複数回実行された提案結果（JSON形式）を横比較しやすいUI/UX**に刷新する。
- 既存のMarkdown一括テキスト形式も、**JSONとして認識できない場合のフォールバック表示**として維持する。
- JSONは「1ファイル内に複数回分のJSONテキストが連結された文字列」で保存される前提とし、**JSON構造が壊れているケースも安全に扱うエラーハンドリング**を実装する。

## 対象ファイル

- フロント
- `flont/app/company/[company]/proposal/Client.tsx`（提案ページのロジック・UI）
- `flont/components/Markdown.tsx`（既存Markdown表示コンポーネント）
- 新規コンポーネント案
    - `flont/components/ProposalRunTabs.tsx`（実行回タブ切り替え）
    - `flont/components/ProposalComparisonTable.tsx`（各回の提案テーマ・戦略サマリの横比較テーブル）
    - `flont/components/ProposalJsonDebugPanel.tsx`（パースエラー時や生データ確認用の折りたたみ表示）
- `flont/app/globals.css`（比較テーブルやタブのスタイル追加）
- バックエンドは**変更しない**（`/api/proposal/{company}` の返却する `proposal` 文字列だけがJSON寄りになる想定）。

## データ構造とパース戦略

### 1. 提案JSONの想定構造

- 各実行1回分は、ユーザー提示の形に近いオブジェクト：
- `提案テーマ一覧`: テーマごとの配列（`順位`, `タイトル`, `課題仮説`, `解決アプローチ`, `期待効果.{定量効果,定性効果}`, `提案メッセージ案.{経営層向け,現場担当者向け}`, `参考実績_裏付け`）
- `提案全体の戦略サマリー`: `この企業における勝ち筋` など
- `評価ロジック`, `注意点`
- 実際には **キー名の揺れ・値がnull・配列長不足** などを許容する前提で扱う。

### 2. 連結文字列から複数JSONを抜き出すアルゴリズム

`Client.tsx` 内で、`proposal` 文字列に対して次を順に試みる:

1. **シンプルなJSON判定**

- `proposal.trim().startsWith('{') && proposal.trim().endsWith('}')` かつ `JSON.parse` が成功 →
    - これは「単一実行」JSONと見なし、`[parsed]` という1要素配列として扱う。

2. **複数JSON連結のパース**

- `{` と `}` のバランスをカウントしながら走査し、
    - バランスが 0 に戻るたびに、その区間を1つのJSON文字列候補として取り出す。
- 各候補に対して `JSON.parse` を試し、**成功したものだけを実行回として採用**。
- 失敗した候補は「パース失敗」としてログ・デバッグ表示に回す。

3. **JSONとして1件も成功しなかった場合**

- これは「従来通りのMarkdownテキスト」と判断し、現在と同じ `Markdown` 表示コンポーネントへフォールバックする。

### 3. パースエラーハンドリング方針

- `JSON.parse` 失敗時:
- そのブロックは「破損したJSON」として無視し、**画面上部に警告アラート**を表示。
- 折りたたみ式の `ProposalJsonDebugPanel` にて、該当生テキストをそのまま閲覧できるようにする（デバッグ用途）。
- 実行回が1件もパースできなかった場合:
- エラーではなく**自動的にMarkdown表示に切り替え**（ユーザーには「JSONとして解釈できなかったためMarkdown表示に切り替えた」旨の小さなメッセージを表示）。

## UI/UX設計

### 1. 画面全体レイアウト（提案ページ）

- ヘッダー部分（現状維持）
- 会社名 + 「← 戻る」ボタン
- 本文部分
- **JSONモード**の場合：

    1. 上部に「実行回タブ（ProposalRunTabs）」

    - 「1回目 / 2回目 / 3回目 ...」などのタブ。
    - 右側に「全回比較」タブを追加し、クリックで比較テーブル表示へ切り替え。

    1. タブの下に、選択中モードを表示：

    - 単一回モード：
        - 左：その回の `提案テーマ一覧` を縦にカード表示（順位とタイトルを強調）。
        - 右：`提案全体の戦略サマリー` と `注意点` をボックス表示。
    - 全回比較モード：
        - `ProposalComparisonTable` を表示（下記参照）。

    1. 画面下部 or ヘッダー近くに、`ProposalJsonDebugPanel` へのリンク（「生JSONを確認」）。

- **Markdownモード（フォールバック）**の場合：
    - 現在と同様に、1つのカード内に `Markdown` コンポーネントで全文表示。
    - ただし上部に「形式: Markdown（旧形式）」などのバッジを表示して、将来のJSON化との区別がつくようにする。

### 2. ProposalRunTabs（実行回タブ）

- 機能
- 各実行回ごとに `Run #1 / Run #2 / ...` などのラベル（日本語なら「1回目」「2回目」）。
- 最右に「全回比較」タブ。
- 振る舞い
- クリックで `activeRunIndex` または `mode: 'single' | 'compare'` を切り替え。
- 実行回数が多くてもスクロール可能なタブバー（CSSで横スクロール許可）。

### 3. ProposalComparisonTable（比較テーブル）

- 横軸：実行回（1回目、2回目、...）。
- 縦軸：比較したい項目。
- 例：
    - 行1: 「提案テーマ（上位1位）」
    - 行2: 「提案テーマ（上位2位）」
    - 行3: 「この企業における勝ち筋」
    - 行4: 「最優先で接触すべき部門_キーパーソン像」
    - 行5: 「潜在リスクと打ち手」
- 各セルには Markdown もしくはリッチテキストとして `Markdown` コンポーネントで表示（改行・箇条書き対応）。
- 値が `null` または空の場合は「(未記載)」と薄いテキストで表示。
- 行ヘッダーは左固定（CSSで `position: sticky` を活用）し、横スクロールで実行回を比較しやすくする。

### 4. ProposalJsonDebugPanel（デバッグ表示）

- 折りたたみコンポーネント：
- ヘッダー：「生JSONを確認（開発者向け）」
- 開くと：
    - パースに成功したブロック一覧（indexと冒頭数十文字）。
    - 破損JSONブロックもテキストエリアで確認可能。
- 開発・検証時に便利だが、本番利用者には邪魔にならないようデフォルトは閉じる。

## 実装ステップ

1. **データパースロジック実装**（`Client.tsx`）

- `parseProposalRuns(proposalText: string): { runs: ParsedRun[]; rawBlocks: string[]; parseErrors: string[] }` ヘルパー関数を実装。
- 上記アルゴリズムに基づき、文字列から複数JSONオブジェクトを抽出。
- `ParsedRun` 型を定義（必要なキーをオプショナルで持たせる）。
- 「0件ならMarkdown」「1件以上ならJSONモード」という分岐を行う。

2. **JSONモードのUI土台作成**

- `ProposalRunTabs` を作成し、`activeRunIndex` と `mode` を管理する。
- 単一回表示用のレイアウト（左: テーマ一覧 / 右: 戦略サマリなど）を仮実装。

3. **比較テーブルの実装**

- `ProposalComparisonTable` を作成。
- 縦軸項目を定義し、各 `ParsedRun` から対応するフィールドを取り出して表示。
- スクロール・固定ヘッダ・レスポンシブCSSを調整。

4. **フォールバック（Markdown）分岐の統合**

- `Client.tsx` で `if (runs.length === 0)` の場合に、現行の `Markdown` 表示にフォールバックするように統合。
- UI上部に「形式: JSON / Markdown」のバッジ表示を追加。

5. **エラーハンドリングとデバッグパネル**

- パース中の例外をキャッチし、`parseErrors` に格納。
- 画面上部に「一部のJSONブロックを読み込めませんでした」のような警告を表示。
- `ProposalJsonDebugPanel` を実装して、`rawBlocks` や失敗ブロックを確認できるようにする。

6. **スタイル調整とブラウザ確認**

- `globals.css` にタブ・比較テーブル・モーダル系のスタイルを追加/調整。
- ローカルで複数パターンをテスト：
    - 完全なJSONが1件だけ
    - 正しいJSONが複数件連結
    - 一部壊れたJSONを含む