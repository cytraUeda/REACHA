# -*- coding: utf-8 -*-
"""
実際のディレクトリ名を確認して、正しい日本語名に修正
"""
import os
import shutil

# 既にdocksディレクトリ内にいる場合は何もしない
if os.path.basename(os.getcwd()) != 'docks':
    os.chdir('docks')

print("=== 現在のディレクトリ一覧 ===")
dirs = [d for d in os.listdir('.') if os.path.isdir(d)]
for d in sorted(dirs):
    print(f"  {repr(d)} -> {d}")

print("\n=== 修正マッピング ===")
# 実際のディレクトリ名を確認して修正
fixes = {}

for d in dirs:
    # 文字化けしている可能性のあるパターンをチェック
    if '繝' in d or '繧' in d or '莨' in d or '謚' in d or 'チE' in d or '' in d:
        # 正しい日本語名を推測
        if 'データ' in d or 'data' in d.lower() or '繝・・繧ｿ' in d:
            fixes[d] = 'データ'
        elif 'メモ' in d or 'memo' in d.lower() or '繝｡繝｢' in d:
            fixes[d] = 'メモ'
        elif 'スクリプト' in d or 'script' in d.lower() or '繧ｹ繧ｯ繝ｪ繝励ヨ' in d:
            fixes[d] = 'スクリプト'
        elif 'タスク' in d or 'task' in d.lower() or '繧ｿ繧ｹ繧ｯ' in d:
            fixes[d] = 'タスク'
        elif '企業' in d or 'company' in d.lower() or '莨' in d:
            fixes[d] = '企業情報'
        elif '技術' in d or 'technical' in d.lower() or '謚' in d:
            fixes[d] = '技術検証'

# 既に正しい名前のディレクトリがあるかチェック
for old_name, new_name in list(fixes.items()):
    if os.path.exists(new_name):
        print(f"既に存在: {new_name} (元: {old_name})")
        # 中身を移動
        if os.path.exists(old_name):
            print(f"  中身を移動: {old_name} -> {new_name}")
            try:
                for item in os.listdir(old_name):
                    src = os.path.join(old_name, item)
                    dst = os.path.join(new_name, item)
                    if not os.path.exists(dst):
                        shutil.move(src, dst)
                        print(f"    Moved: {item}")
                os.rmdir(old_name)
                print(f"  削除: {old_name}")
            except Exception as e:
                print(f"  Error: {e}")
        del fixes[old_name]

# 残りの修正を実行
print("\n=== 実行する修正 ===")
for old_name, new_name in fixes.items():
    if os.path.exists(old_name) and not os.path.exists(new_name):
        print(f"Rename: {repr(old_name)} -> {new_name}")
        try:
            os.rename(old_name, new_name)
        except Exception as e:
            print(f"  Error: {e}")

# 企業情報配下のiris_ohyamaも確認
if os.path.exists('企業情報'):
    iris_path = os.path.join('企業情報', 'iris_ohyama')
    new_iris_path = os.path.join('企業情報', 'アイリスオーヤマ')
    if os.path.exists(iris_path) and not os.path.exists(new_iris_path):
        print(f"Rename subdir: {iris_path} -> {new_iris_path}")
        try:
            os.rename(iris_path, new_iris_path)
        except Exception as e:
            print(f"  Error: {e}")

print("\n=== 修正後のディレクトリ一覧 ===")
dirs = [d for d in os.listdir('.') if os.path.isdir(d)]
for d in sorted(dirs):
    print(f"  {d}")

