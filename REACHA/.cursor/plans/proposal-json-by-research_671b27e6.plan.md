---
name: proposal-json-by-research
overview: リサーチ結果ごとに提案JSONを生成し、UI上もクエリ名ベースで整合するようにする。
todos:
  - id: backend-proposal-per-query
    content: "`create_proposal` を各リサーチ結果（QUERIES 1〜5）のテキスト単位でワークフローに投げ、`source_query_index` / `source_query_label` を含む提案JSONブロックを5本連結して保存するように変更する。"
    status: completed
  - id: frontend-tabs-query-label
    content: "`ProposalRunTabs` と `Client.tsx` の見出し・ラベルを「第N回」ではなく、提案JSON内の `source_query_label`（なければ固定QUERIES配列）に基づく表示に変更する。"
    status: completed
  - id: tabs-loading-guard
    content: "`loading === true` の間は `ProposalRunTabs` とホバープレビューを描画せず、提案ロード完了後にのみタブUIを表示するようにする。"
    status: completed
---

# 提案JSONをリサーチ単位に分割し、UIをクエリ名ベースに揃えるプラン

### 1. 提案生成フローの再設計（バックエンド）

- **create_proposal のインプット単位を見直す**
- 現状は `create_proposal` が `company_1.txt`〜`company_5.txt` を順に読み、**1本の提案テキスト（あるいはJSON列）として連結**している前提になっているため、どのリサーチ結果に基づく提案か区別しづらい。
- これを「各リサーチ結果（QUERIES の 1〜5）ごとに 1 回ずつ Dify ワークフローを回し、その都度 **1つの提案JSONブロック** を受け取る」形に改める。
- **リサーチ結果→提案JSONの1対1対応**
- ループ内で `research_files` を `(idx, content)` の形で持っているので、各 `idx` に対応する `QUERIES[idx-1] `を取得し、ワークフロー入力に「この提案はどのリサーチ結果に基づくものか」を明示するフィールド（例: `source_query_index`, `source_query_label`）を追加する。
- Dify 側のワークフロー出力も JSON で返ってくる前提とし、その JSON に上記メタ情報をそのまま含めるか、サーバー側でラップして保存する（`{"source": {...}, "proposal": {...}}` など）。
- **保存形式の整理**
- `company_proposal.txt` / `.md` の中身を、**複数の JSON オブジェクトが連結されたテキスト**（今の `parseProposalRuns` が前提にしている形式）で統一する。
- 各ブロックには必ず `source_query_index` および `source_query_label`（例: "事業の全体像"）を入れておき、あとでフロントから「どのリサーチ由来か」を確実に判別できるようにする。

### 2. 提案タブUIとヘッダの整合性（フロント）

- **タブラベルを「第N回」からクエリ名ベースに変更**
- `ProposalRunTabs.tsx` で、現在 `第{idx + 1}回` と表示している部分を、提案JSONに含めた `source_query_label`（なければバックアップとして `QUERIES[idx]` 相当の固定配列）で表示する。
    - 例: `事業の全体像に基づく提案`, `外部環境と市場評価に基づく提案` など。
- サブタイトルはこれまで通り、ランク1位のテーマタイトルや課題仮説の先頭を使い、クエリ名＋サマリで「どの観点の提案か」が一目で分かるようにする。
- **見出しの文言も合わせる**
- `Client.tsx` 内の見出し `提案テーマ一覧（第{activeRunIndex + 1}回）` を、対応するクエリ名を使った表現に変更（例: `提案テーマ一覧（事業の全体像に基づく提案）`）。
- 同様に、比較ビューやデバッグパネルで run を列挙する場合も、インデックスではなくクエリ名をベースに説明をつける。

### 3. ホバー時のチラつき抑制（ローディングカバー）

- **loading フラグと ProposalRunTabs の出し分け**
- `Client.tsx` で `loading === true` の間は、`ProposalRunTabs` とそれに紐づくホバープレビューを一切描画せず、既存のスピナー＋進捗表示だけにする。
- これにより、「JSONの `_raw` がまだない状態で hover→Markdown プレビューカードが一瞬出て崩れる」現象を防ぐ。
- **ホバープレビューのシンプル化（必要なら）**
- それでもホバー中の UI が気になる場合は、`ProposalRunTabs` のホバープレビューを
    - 即座に Markdown を描画せず、「プレビュー表示中…」だけの軽いカードにする、または
    - 機能自体をオフにし、タブは単に切り替えのみのシンプルなものにする

のどちらかに寄せて、チラつき要因を減らす。

### 4. 既存キーワードネットワークとの整合

- **キーワード側は「全提案回を合算」方針を維持**