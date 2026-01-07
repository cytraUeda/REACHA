---
name: docksディレクトリ整理
overview: docksディレクトリ内のファイルを内容に基づいて適切なディレクトリに再配置し、ファイル名を統一します。ファイル内容は変更せず、ディレクトリ構成とファイル名のみを整理します。
todos:
  - id: create_structure
    content: 新しいディレクトリ構造を作成（proposals, research, technical_verification, company, data, scripts, memos, tasks, archive）
    status: completed
  - id: move_proposals
    content: PPT_raw内の提案資料をproposals/に移動・整理（バージョン管理、アーカイブ分離）
    status: completed
    dependencies:
      - create_structure
  - id: move_research
    content: reports/research内の調査資料をresearch/に移動・整理
    status: completed
    dependencies:
      - create_structure
  - id: move_technical_verification
    content: reports/technical_verificationをtechnical_verification/に移動
    status: completed
    dependencies:
      - create_structure
  - id: move_data_scripts
    content: reports直下のデータファイルとスクリプトをdata/とscripts/に移動
    status: completed
    dependencies:
      - create_structure
  - id: consolidate_memos
    content: memo/とreports/security/memo_01.mdをmemos/に統合
    status: completed
    dependencies:
      - create_structure
  - id: rename_directories
    content: mycorp→company/iris_ohyama、task→tasksにリネーム
    status: completed
    dependencies:
      - create_structure
  - id: archive_old_files
    content: 古いバージョンのPPTXファイルをarchive/に移動
    status: completed
    dependencies:
      - move_proposals
  - id: cleanup_empty
    content: 空になったディレクトリ（PPT_raw、reports等）を削除
    status: completed
    dependencies:
      - move_proposals
      - move_research
      - move_technical_verification
      - move_data_scripts
      - consolidate_memos
---

#docksディレクトリ整理計画

## 現状の問題点

1. **PPT_rawディレクトリ**: 多数のバージョン管理されていないPPTXファイルと派生版ファイルが混在
2. **reportsディレクトリ**: データファイル（CSV、XLSX）とスクリプトが直下に混在
3. **メモファイルの分散**: `memo/`と`reports/security/memo_01.md`が分離
4. **ディレクトリ名の不明確さ**: `mycorp`、`未来を描く`など
5. **ファイル名の不統一**: 日付形式、バージョン番号、整理版などの表記が混在

## 新しいディレクトリ構成

```javascript
docks/
├── proposals/              # 提案資料（PPT_rawから移行）
│   ├── iris_ai_strategy/   # アイリスAI戦略関連
│   │   ├── v01/            # バージョン管理
│   │   └── archive/        # 古いバージョン
│   └── vision/              # 未来を描く関連（旧PPT_raw/未来を描く）
├── research/               # 調査・研究資料（reports/researchから移行）
│   ├── role_division/      # 役割分担調査
│   ├── secretariat/        # 事務局リソース調査
│   └── copilot_cases/      # Copilot事例調査
├── technical_verification/ # 技術検証（reports/technical_verificationから移行）
├── company/                # 企業情報（mycorpからリネーム）
│   └── iris_ohyama/        # アイリスオーヤマ関連
├── data/                   # データファイル（reports直下から移行）
├── scripts/                # スクリプト（reports直下から移行）
├── memos/                  # メモファイル（memoからリネーム、reports/security/memo_01.mdも統合）
├── tasks/                  # タスクファイル（taskからリネーム）
└── archive/                # アーカイブ（古いバージョン、不要なファイル）
```



## 実施内容

### 1. 提案資料の整理（[docks/PPT_raw](docks/PPT_raw)）

- **メインファイル**: `20260105_アイリス提案資料_v01.md` → `proposals/iris_ai_strategy/v01/iris_ai_strategy_v01.md`
- **派生版ファイル**: P2整理版、P5整理版、P6P7スライド構成、P7アクション整理など → `proposals/iris_ai_strategy/v01/`配下に整理
- **PPTXファイル**: 最新版のみ保持、古いバージョンは`proposals/iris_ai_strategy/archive/`へ
- **未来を描く**: `PPT_raw/未来を描く/` → `proposals/vision/`

### 2. 調査資料の整理（[docks/reports/research](docks/reports/research)）

- `reports/research/` → `research/`に移行
- 役割分担調査: `research/role_division/`に整理
- 事務局リソース調査: `research/secretariat/`に整理
- Copilot事例関連: `research/copilot_cases/`に整理

### 3. 技術検証の整理（[docks/reports/technical_verification](docks/reports/technical_verification)）

- `reports/technical_verification/` → `technical_verification/`に移行

### 4. 提案資料の整理（[docks/reports/proposal](docks/reports/proposal)）

- `reports/proposal/01_utilization_proposal.md` → `proposals/copilot_utilization/`に移行

### 5. データファイルの整理（[docks/reports](docks/reports)）

- CSV、XLSXファイル → `data/`に移行
- `create_excel_from_csv.py` → `scripts/`に移行

### 6. メモファイルの統合

- `memo/` → `memos/`にリネーム
- `reports/security/memo_01.md` → `memos/security_01.md`に移行

### 7. 企業情報の整理（[docks/mycorp](docks/mycorp)）

- `mycorp/` → `company/iris_ohyama/`にリネーム・移行

### 8. タスクファイルの整理（[docks/task](docks/task)）

- `task/` → `tasks/`にリネーム

### 9. ファイル名の統一

- 日付形式: `YYYYMMDD_`プレフィックスを統一
- バージョン番号: `_v01`形式を統一
- 整理版などの表記: サフィックスを統一（`_整理版`、`_クリスタライズ版`など）

## ファイル移動マッピング