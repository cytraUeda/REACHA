# -*- coding: utf-8 -*-
"""
エンコーディング問題を解決して、正しい日本語名に修正
WindowsのファイルシステムはUTF-16を使うので、直接os.renameを使う
"""
import os
import sys

# 既にdocksディレクトリ内にいる場合は何もしない
if os.path.basename(os.getcwd()) != 'docks':
    os.chdir('docks')

# 標準出力のエンコーディングを設定
if sys.stdout.encoding != 'utf-8':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

print("=== 現在のディレクトリ一覧（バイト表現） ===")
dirs = [d for d in os.listdir('.') if os.path.isdir(d)]
for d in sorted(dirs):
    try:
        # UTF-8でエンコードしてから表示
        print(f"  {d.encode('utf-8', errors='replace').decode('utf-8', errors='replace')}")
    except:
        print(f"  {repr(d)}")

# 正しい日本語名のマッピング（実際のディレクトリ名を確認してから修正）
# まず、既存の正しい名前のディレクトリを確認
correct_names = {
    'アーカイブ': 'アーカイブ',
    '提案': '提案',
    '調査': '調査',
    'データ': 'データ',
    'メモ': 'メモ',
    'スクリプト': 'スクリプト',
    'タスク': 'タスク',
    '企業情報': '企業情報',
    '技術検証': '技術検証',
}

print("\n=== 修正が必要なディレクトリを検出 ===")
# 各ディレクトリをチェック
for d in dirs:
    # 正しい名前かチェック
    is_correct = False
    for correct in correct_names.values():
        try:
            if d == correct or d.encode('utf-8') == correct.encode('utf-8'):
                is_correct = True
                break
        except:
            pass
    
    if not is_correct:
        # 文字化けしている可能性がある
        # ディレクトリの中身で判断
        try:
            files = os.listdir(d)
            # 中身から推測
            if any('csv' in f.lower() or 'xlsx' in f.lower() for f in files):
                target = 'データ'
            elif any('memo' in f.lower() for f in files):
                target = 'メモ'
            elif any('py' in f.lower() for f in files):
                target = 'スクリプト'
            elif any('01.md' in f for f in files if f.endswith('.md')):
                target = 'タスク'
            elif any('iris' in f.lower() for f in files):
                target = '企業情報'
            elif any('verification' in f.lower() or 'copilot' in f.lower() for f in files):
                target = '技術検証'
            else:
                target = None
            
            if target and not os.path.exists(target):
                print(f"Rename: {repr(d[:50])} -> {target}")
                try:
                    os.rename(d, target)
                    print(f"  Success!")
                except Exception as e:
                    print(f"  Error: {e}")
        except Exception as e:
            print(f"  Cannot check {repr(d[:50])}: {e}")

# 企業情報配下のiris_ohyamaも確認
if os.path.exists('企業情報'):
    iris_path = os.path.join('企業情報', 'iris_ohyama')
    new_iris_path = os.path.join('企業情報', 'アイリスオーヤマ')
    if os.path.exists(iris_path) and not os.path.exists(new_iris_path):
        print(f"\nRename subdir: iris_ohyama -> アイリスオーヤマ")
        try:
            os.rename(iris_path, new_iris_path)
            print(f"  Success!")
        except Exception as e:
            print(f"  Error: {e}")

print("\n=== 最終確認 ===")
dirs = [d for d in os.listdir('.') if os.path.isdir(d)]
for d in sorted(dirs):
    print(f"  {d}")

