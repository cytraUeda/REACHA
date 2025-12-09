# Azure環境へのアップデート手順（outputs保持版・Git使用）

ローカルで開発・動作確認したコードをGit経由でAzure環境にアップデートする際、既存の`outputs`配下のデータを保持したまま更新する手順です。

## 前提条件

- Gitリポジトリが設定済み（GitHub、GitLab、Bitbucketなど）
- ローカルとAzure環境の両方でGitリポジトリにアクセスできること
- Azure VMにSSH接続できること
- ローカルで動作確認済みであること

## Gitの基本用語（初心者向け）

- **コミット（commit）**：変更内容を記録すること
- **プッシュ（push）**：ローカルの変更をリモート（GitHubなど）に送信すること
- **プル（pull）**：リモートの変更をローカルに取得すること
- **ブランチ（branch）**：通常は`main`または`master`を使用

## 基本手順

### ステップ1: ローカルでの変更をGitにコミット・プッシュ

ローカルで開発・動作確認が完了したら、変更をGitに送信します。

#### 1-1. 変更内容を確認

**ローカル（PowerShell）で実行**：

```powershell
cd C:\Users\UedaRyota\dev\Cytra\REACHA
git status
```

**表示例**：
```
On branch main
Changes not staged for commit:
  modified:   back/app/main.py
  modified:   flont/components/CompanyForm.tsx
```

**意味**：`git status`は、どのファイルが変更されたかを表示します。

#### 1-2. 変更をステージング（コミット準備）

変更したファイルを「コミットする」とマークします：

```powershell
# すべての変更をステージング
git add .

# または、特定のファイルだけをステージング
git add back/app/main.py
git add flont/components/CompanyForm.tsx
```

**意味**：`git add`は、変更を「コミットする準備ができた」とマークします。

#### 1-3. コミット（変更を記録）

```powershell
git commit -m "機能追加: 会社検索機能を改善"
```

**意味**：`git commit`は、変更内容を記録します。`-m`の後は変更内容の説明を書きます。

**コミットメッセージの例**：
- `"バグ修正: APIエラーハンドリングを改善"`
- `"機能追加: 実行結果の表示を改善"`
- `"リファクタリング: コード整理"`

#### 1-4. リモートにプッシュ（GitHubなどに送信）

```powershell
git push origin main
```

**意味**：`git push`は、ローカルの変更をリモート（GitHubなど）に送信します。

**注意**：
- 初回プッシュ時は、リモートリポジトリのURLを設定する必要がある場合があります
- 認証が必要な場合は、ユーザー名とパスワード（またはトークン）を入力します

**エラーが出た場合**：
```
error: failed to push some refs to 'origin'
hint: Updates were rejected because the remote contains work that you do
hint: not have locally.
```

この場合は、先にリモートの変更を取得する必要があります：

```powershell
git pull origin main
# 競合がなければ自動的にマージされます
# 競合がある場合は手動で解決が必要です
git push origin main
```

#### 1-5. プッシュの確認

GitHubなどのWebサイトで、変更が反映されているか確認してください。

### ステップ2: フロントエンドの静的ビルド（変更がある場合）

フロントエンド（`flont`）に変更がある場合は、静的ファイルをビルドします。

**ローカル（PowerShell）で実行**：

```powershell
cd REACHA/flont
npm ci
npm run build
```

**確認**：`out/`ディレクトリが生成されていることを確認

```powershell
ls out
```

**注意**：`out/`ディレクトリは`.gitignore`で除外されているため、Gitには含まれません。Azure環境で再ビルドするか、別途転送する必要があります（後述）。

### ステップ3: Azure VMへの接続とサービス停止

Azure VMにSSH接続します。

**ローカル（PowerShell）で実行**：

```powershell
ssh azureuser@your-azure-vm-ip-or-hostname
```

**接続後、Azure VM上で実行**：

サービスを停止します：

```bash
sudo systemctl stop myapp.service
```

**確認**：サービスが停止したことを確認

```bash
sudo systemctl status myapp.service
```

**表示例**：
```
● myapp.service - FastAPI (Uvicorn) - myapp
   Loaded: loaded (/etc/systemd/system/myapp.service; enabled; vendor preset: enabled)
   Active: inactive (dead) since ...
```

`Active: inactive (dead)` と表示されればOKです。

### ステップ4: outputsのバックアップ

**Azure VM上で実行**：

```bash
cd /home/azureuser/back
cp -r outputs outputs_backup_$(date +%Y%m%d_%H%M%S)
```

**意味**：
- `cp -r`：ディレクトリをコピー（`-r`は再帰的にコピー）
- `outputs_backup_$(date +%Y%m%d_%H%M%S)`：日時を含むバックアップ名（例：`outputs_backup_20250115_143022`）

**確認**：バックアップが作成されたことを確認

```bash
ls -la | grep outputs_backup
```

**表示例**：
```
drwxr-xr-x 3 azureuser azureuser 4096 Jan 15 14:30 outputs_backup_20250115_143022
```

### ステップ5: Gitから最新のコードを取得（プル）

**Azure VM上で実行**：

#### 5-1. 現在のブランチと状態を確認

```bash
cd /home/azureuser/back
git status
```

**表示例**：
```
On branch main
Your branch is up to date with 'origin/main'.
nothing to commit, working tree clean
```

**意味**：現在の状態を確認します。変更がないことを確認してください。

#### 5-2. リモートの最新情報を取得

```bash
git fetch origin
```

**意味**：`git fetch`は、リモートの変更情報を取得します（まだファイルは更新されません）。

#### 5-3. 最新のコードを取得（プル）

```bash
git pull origin main
```

**意味**：`git pull`は、リモートの変更を取得して、ローカルのファイルを更新します。

**表示例**：
```
remote: Enumerating objects: 15, done.
remote: Counting objects: 100% (15/15), done.
remote: Compressing objects: 100% (8/8), done.
remote: Total 8 (delta 3), reused 0 (delta 0), pack-reused 0
Unpacking objects: 100% (8/8), done.
From https://github.com/your-username/your-repo
   abc1234..def5678  main       -> origin/main
Updating abc1234..def5678
Fast-forward
 back/app/main.py        | 10 +++++-----
 flont/components/CompanyForm.tsx |  5 +++++
 2 files changed, 8 insertions(+), 5 deletions(-)
```

**エラーが出た場合**：

**エラー1: ローカルの変更がある場合**
```
error: Your local changes to the following files would be overwritten by merge:
        back/app/main.py
Please commit your changes or stash them before you merge.
```

**対処法**：ローカルの変更を一時保存（stash）してからプル：

```bash
git stash
git pull origin main
git stash pop  # 必要に応じて変更を復元
```

**エラー2: 認証エラー**
```
fatal: Authentication failed
```

**対処法**：Gitの認証情報を設定するか、SSH鍵を使用してください。

#### 5-4. プルの確認

```bash
git log --oneline -5
```

**表示例**：
```
def5678 機能追加: 会社検索機能を改善
abc1234 バグ修正: APIエラーハンドリングを改善
...
```

最新のコミットが表示されればOKです。

### ステップ6: フロントエンドの静的ファイルをビルド（Azure環境で）

フロントエンドの変更がある場合、Azure環境で再ビルドします。

**Azure VM上で実行**：

```bash
cd /home/azureuser/back
# フロントエンドのディレクトリに移動（リポジトリ構造による）
# 例: リポジトリのルートが /home/azureuser/reacha の場合
cd /home/azureuser/reacha/flont
npm ci
npm run build
```

**注意**：リポジトリの構造によってパスが異なります。適宜調整してください。

**確認**：`out/`ディレクトリが生成されていることを確認

```bash
ls -la out/
```

### ステップ7: outputsの復元

Git pullで`outputs`ディレクトリが空になったり、削除されたりする可能性があるため、バックアップから復元します。

**Azure VM上で実行**：

```bash
cd /home/azureuser/back

# 現在のoutputsの状態を確認
ls -la outputs/

# バックアップ名を確認
ls -la | grep outputs_backup

# 新しいコードで作成された空のoutputsディレクトリを削除
rm -rf outputs

# バックアップから復元（最新のバックアップ名を使用）
# 例: outputs_backup_20250115_143022
mv outputs_backup_20250115_143022 outputs
```

**確認**：outputsが正しく復元されたことを確認

```bash
ls -la outputs/
# 会社名のディレクトリが表示されればOK
```

**表示例**：
```
drwxr-xr-x 3 azureuser azureuser 4096 Jan 15 10:00 ANA
drwxr-xr-x 3 azureuser azureuser 4096 Jan 15 11:00 セブンイレブン
...
```

### 5. outputsの復元

```bash
cd /home/azureuser/back

# 新しいコードで作成された空のoutputsディレクトリを削除
rm -rf outputs

# バックアップから復元（最新のバックアップを使用）
# バックアップ名を確認してから実行
ls -la | grep outputs_backup
mv outputs_backup_YYYYMMDD_HHMMSS outputs
```

**確認**：outputsが正しく復元されたことを確認

```bash
ls -la outputs/
# 会社名のディレクトリが表示されればOK
```

### ステップ8: 依存関係の更新

`requirements.txt`に新しいパッケージが追加されている可能性があるため、依存関係を更新します。

**Azure VM上で実行**：

```bash
cd /home/azureuser/back
source venv/bin/activate
pip install -r requirements.txt
```

**意味**：
- `source venv/bin/activate`：仮想環境を有効化
- `pip install -r requirements.txt`：必要なパッケージをインストール

**確認**：エラーがないことを確認

**表示例**：
```
Requirement already satisfied: fastapi==0.104.1 in ./venv/lib/python3.10/site-packages
Collecting new-package==1.0.0
  Downloading new-package-1.0.0-py3-none-any.whl
Installing collected packages: new-package
Successfully installed new-package-1.0.0
```

エラーが表示されなければOKです。

### ステップ9: サービス再起動と動作確認

**Azure VM上で実行**：

```bash
sudo systemctl start myapp.service
sudo systemctl status myapp.service
```

**確認**：
- `Active: active (running)` と表示されればOK

**表示例**：
```
● myapp.service - FastAPI (Uvicorn) - myapp
   Loaded: loaded (/etc/systemd/system/myapp.service; enabled; vendor preset: enabled)
   Active: active (running) since ...
```

**エラーログの確認**：

```bash
sudo journalctl -u myapp.service -n 50 --no-pager
```

エラーメッセージが表示されていないか確認してください。

### ステップ10: ブラウザで動作確認

Azure VMの公開URLにアクセスして、以下を確認：

- [ ] トップページが表示される
- [ ] 既存の会社名が補完表示される
- [ ] 既存の結果が表示される
- [ ] 新規実行が可能である

問題がなければ、アップデート完了です！

## やり直し方法（ロールバック）

アップデート後に問題が発生した場合のロールバック手順です。

### 手順1: サービス停止

**Azure VM上で実行**：

```bash
sudo systemctl stop myapp.service
```

### 手順2: コードを前のバージョンに戻す（Git）

**Azure VM上で実行**：

#### 2-1. コミット履歴を確認

```bash
cd /home/azureuser/back
git log --oneline -10
```

**表示例**：
```
def5678 機能追加: 会社検索機能を改善  ← 最新（問題がある）
abc1234 バグ修正: APIエラーハンドリングを改善  ← これに戻したい
xyz9876 初期実装
...
```

#### 2-2. 前のバージョンに戻す

戻したいコミットのハッシュ（例：`abc1234`）をコピーして実行：

```bash
git checkout abc1234
```

**意味**：`git checkout`は、指定したコミットの状態に戻します。

**注意**：この状態は「detached HEAD」と呼ばれます。通常の作業に戻すには：

```bash
git checkout main
```

#### 2-3. より安全な方法：新しいブランチを作成して戻す

```bash
# 現在のmainブランチをバックアップ
git branch main_backup

# mainブランチに戻る
git checkout main

# 前のコミットにリセット（変更を破棄）
git reset --hard abc1234
```

**警告**：`git reset --hard`は変更を完全に削除します。実行前に必ずバックアップを取ってください。

### 手順3: outputsの確認

```bash
cd /home/azureuser/back
ls -la outputs/
```

outputsが正しく存在することを確認。もし破損している場合は、バックアップから復元：

```bash
rm -rf outputs
mv outputs_backup_YYYYMMDD_HHMMSS outputs
```

### 手順4: サービス再起動

```bash
sudo systemctl start myapp.service
sudo systemctl status myapp.service
```

## よくあるミスと対処法

### ミス1: outputsを上書きしてしまった

**症状**：既存の実行結果が消えた

**対処法**：
1. バックアップから復元：

```bash
cd /home/azureuser/back
rm -rf outputs
mv outputs_backup_YYYYMMDD_HHMMSS outputs
```

2. バックアップがない場合、Azure VMのスナップショットやバックアップから復元を試みる

**予防策**：必ず手順3でバックアップを取ってからデプロイする

### ミス2: サービスが起動しない

**症状**：`sudo systemctl status myapp.service`でエラーが表示される

**対処法**：
1. エラーログを確認：

```bash
sudo journalctl -u myapp.service -n 100 --no-pager
```

2. よくある原因と対処：
   - **Pythonのインポートエラー**：`pip install -r requirements.txt`を再実行
   - **パスの問題**：`WorkingDirectory`と`ExecStart`のパスを確認
   - **権限の問題**：`sudo chown -R azureuser:azureuser /home/azureuser/back`

3. 手動で起動してエラーを確認：

```bash
cd /home/azureuser/back
source venv/bin/activate
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### ミス3: outputsディレクトリが空になった

**症状**：`ls outputs/`で何も表示されない

**対処法**：
1. バックアップを確認：

```bash
ls -la | grep outputs_backup
```

2. 最新のバックアップから復元：

```bash
rm -rf outputs
mv outputs_backup_YYYYMMDD_HHMMSS outputs
```

3. 権限を確認：

```bash
ls -la outputs/
sudo chown -R azureuser:azureuser outputs/
```

### ミス4: フロントエンドが表示されない

**症状**：ブラウザでアクセスしても404エラー

**対処法**：
1. `out/`ディレクトリが正しく配置されているか確認：

```bash
ls -la /home/azureuser/back/out/
```

2. `main.py`の静的ファイル設定を確認（`StaticFiles`の`directory`パスが正しいか）

3. フロントエンドを再ビルド：

```bash
# Azure VM上で
cd /home/azureuser/reacha/flont  # リポジトリ構造に応じて調整
npm ci
npm run build

# outディレクトリをbackディレクトリにコピー
cp -r out /home/azureuser/back/
```

または、ローカルから転送：

```powershell
# ローカル（PowerShell）で
cd REACHA/flont
npm run build
scp -r out azureuser@your-azure-vm-ip:/home/azureuser/back/
```

### ミス5: 依存関係のエラー

**症状**：`ModuleNotFoundError`などが発生

**対処法**：
1. venvが正しくアクティベートされているか確認：

```bash
which python
# /home/azureuser/back/venv/bin/python と表示されればOK
```

2. requirements.txtを再インストール：

```bash
cd /home/azureuser/back
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### ミス6: 実行中のジョブがある状態でアップデートした

**症状**：実行中のジョブが中断された

**対処法**：
1. 実行状態を確認：

```bash
cd /home/azureuser/back/outputs/<会社名>
ls -la
# .running, .heartbeat などのマーカーファイルを確認
```

2. 中断されたジョブは再実行が必要
3. **予防策**：アップデート前に実行中のジョブがないことを確認：

```bash
# APIで確認するか、マーカーファイルを確認
find /home/azureuser/back/outputs -name ".running" -o -name ".heartbeat"
```

### ミス7: Git pullで競合（conflict）が発生した

**症状**：`git pull`で以下のエラーが表示される

```
Auto-merging back/app/main.py
CONFLICT (content): Merge conflict in back/app/main.py
Automatic merge failed; fix conflicts and then commit the result.
```

**対処法**：
1. 競合しているファイルを確認：

```bash
git status
```

2. 競合ファイルを開いて、競合箇所を解決：

```bash
# 競合ファイルを編集
nano back/app/main.py
# または
vim back/app/main.py
```

競合箇所は以下のように表示されます：

```
<<<<<<< HEAD
# Azure側の変更
=======
# リモートの変更
>>>>>>> origin/main
```

必要な変更を残して、`<<<<<<<`、`=======`、`>>>>>>>`の行を削除します。

3. 解決後、コミット：

```bash
git add back/app/main.py
git commit -m "競合を解決"
```

4. 再度プル（通常は不要ですが、念のため）：

```bash
git pull origin main
```

### ミス8: Git認証エラー

**症状**：`git push`や`git pull`で認証エラー

```
fatal: Authentication failed
```

**対処法**：
1. **HTTPSを使用している場合**：パスワードの代わりにPersonal Access Token（PAT）を使用
   - GitHub: Settings > Developer settings > Personal access tokens
   - トークンを生成して、パスワードの代わりに入力

2. **SSHを使用する場合**：SSH鍵を設定

```bash
# SSH鍵を生成（まだない場合）
ssh-keygen -t ed25519 -C "your_email@example.com"

# 公開鍵を表示
cat ~/.ssh/id_ed25519.pub
```

この公開鍵をGitHubなどのリポジトリに登録します。

3. **リモートURLをSSHに変更**：

```bash
git remote set-url origin git@github.com:your-username/your-repo.git
```

## チェックリスト

アップデート前に確認：

- [ ] ローカルで動作確認済み
- [ ] フロントエンドをビルド済み（変更がある場合）
- [ ] Azure VMにSSH接続できる
- [ ] 実行中のジョブがない

アップデート中：

- [ ] サービスを停止した
- [ ] outputsをバックアップした
- [ ] 新しいコードをデプロイした
- [ ] outputsを復元した
- [ ] 依存関係を更新した
- [ ] サービスを再起動した

アップデート後：

- [ ] サービスが正常に起動している
- [ ] ブラウザでアクセスできる
- [ ] 既存の結果が表示される
- [ ] 新規実行が可能である

## 注意事項

1. **実行中のジョブ**：アップデート前に実行中のジョブがないことを確認してください。実行中にアップデートするとジョブが中断されます。

2. **バックアップの保持**：`outputs_backup_*`ディレクトリは、動作確認が完了するまで削除しないでください。最低でも1週間は保持することを推奨します。

3. **ディスク容量**：`outputs`のバックアップで一時的にディスク容量が2倍になります。容量に余裕があることを確認してください。

4. **権限**：`outputs`ディレクトリの所有者が`azureuser`であることを確認してください。サービスが正常にファイルを読み書きできない場合があります。

5. **環境変数**：`.env`ファイルや環境変数（`DIFY_API_KEY`など）が正しく設定されていることを確認してください。

## トラブルシューティング

### サービスログの確認

```bash
# リアルタイムでログを確認
sudo journalctl -u myapp.service -f

# 直近100行を確認
sudo journalctl -u myapp.service -n 100 --no-pager

# エラーのみを確認
sudo journalctl -u myapp.service -p err -n 50 --no-pager
```

### プロセスの確認

```bash
# uvicornプロセスが動いているか確認
ps aux | grep uvicorn

# ポート8000が使用されているか確認
sudo netstat -tlnp | grep 8000
# または
sudo ss -tlnp | grep 8000
```

### ディレクトリ構造の確認

```bash
cd /home/azureuser/back
tree -L 2 -a
# treeコマンドがない場合
find . -maxdepth 2 -type d
```

