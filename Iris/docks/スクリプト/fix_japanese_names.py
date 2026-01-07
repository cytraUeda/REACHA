# -*- coding: utf-8 -*-
"""
Windowsで確実に表示される日本語名に修正するスクリプト
"""
import os
import shutil

# 既にdocksディレクトリ内にいる場合は何もしない
if os.path.basename(os.getcwd()) != 'docks':
    os.chdir('docks')

# 文字化けしている可能性のあるディレクトリ名の修正マッピング
# 現在の名前（文字化けしている可能性） -> 正しい日本語名
DIR_FIXES = {
    # 最上位ディレクトリ
    '繝・・繧ｿ': 'データ',
    '繝｡繝｢': 'メモ',
    '繧ｹ繧ｯ繝ｪ繝励ヨ': 'スクリプト',
    '繧ｿ繧ｹ繧ｯ': 'タスク',
    '莨∵･ｭ諠・ｱ': '企業情報',
    '謚陦捺､懆ｨｼ': '技術検証',
}

# サブディレクトリの修正
SUBDIR_FIXES = {
    # 企業情報配下
    os.path.join('企業情報', 'iris_ohyama'): os.path.join('企業情報', 'アイリスオーヤマ'),
}

def fix_directory_names():
    """文字化けしているディレクトリ名を修正"""
    # 最上位ディレクトリの修正
    for old_name, new_name in DIR_FIXES.items():
        old_path = old_name
        new_path = new_name
        
        if os.path.exists(old_path) and not os.path.exists(new_path):
            print(f"Fix: {old_name} -> {new_name}")
            try:
                os.rename(old_path, new_path)
            except Exception as e:
                print(f"  Error: {e}")
        elif os.path.exists(old_path) and os.path.exists(new_path):
            # 既に正しい名前が存在する場合、中身を移動
            print(f"Move contents: {old_name} -> {new_name}")
            try:
                for item in os.listdir(old_path):
                    src = os.path.join(old_path, item)
                    dst = os.path.join(new_path, item)
                    if os.path.exists(dst):
                        print(f"  Skip (exists): {item}")
                    else:
                        shutil.move(src, dst)
                os.rmdir(old_path)
            except Exception as e:
                print(f"  Error: {e}")
    
    # サブディレクトリの修正
    for old_path, new_path in SUBDIR_FIXES.items():
        if os.path.exists(old_path) and not os.path.exists(new_path):
            print(f"Fix subdir: {old_path} -> {new_path}")
            try:
                os.rename(old_path, new_path)
            except Exception as e:
                print(f"  Error: {e}")

if __name__ == '__main__':
    fix_directory_names()
    print("Done fixing directory names")

