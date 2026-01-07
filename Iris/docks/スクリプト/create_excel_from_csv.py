#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CSVファイルをExcel形式に変換するスクリプト
"""

import csv
import sys
import os

try:
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from openpyxl.utils import get_column_letter
except ImportError:
    print("openpyxlがインストールされていません。")
    print("インストールするには: pip install openpyxl")
    sys.exit(1)

def csv_to_excel(csv_file, excel_file):
    """CSVファイルをExcel形式に変換"""
    
    # ワークブックとワークシートを作成
    wb = Workbook()
    ws = wb.active
    ws.title = "AI活用ユースケース具体事例"
    
    # スタイル定義
    header_fill = PatternFill(start_color="E8E8E8", end_color="E8E8E8", fill_type="solid")
    header_font = Font(bold=True, size=12, color="333333")
    border = Border(
        left=Side(style='thin', color='CCCCCC'),
        right=Side(style='thin', color='CCCCCC'),
        top=Side(style='thin', color='CCCCCC'),
        bottom=Side(style='thin', color='CCCCCC')
    )
    
    # CSVファイルを読み込んでExcelに書き込む
    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        
        for row_idx, row in enumerate(reader, start=1):
            for col_idx, value in enumerate(row, start=1):
                cell = ws.cell(row=row_idx, column=col_idx, value=value)
                cell.border = border
                cell.alignment = Alignment(vertical='center', wrap_text=True)
                
                # ヘッダー行のスタイル
                if row_idx == 1:
                    cell.fill = header_fill
                    cell.font = header_font
                    cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
                else:
                    # URL列（6列目）のフォントを青色に
                    if col_idx == 6 and value.startswith('http'):
                        cell.font = Font(color="0000FF", underline="single")
                        cell.hyperlink = value
    
    # 列幅の自動調整
    column_widths = {
        'A': 15,  # カテゴリー
        'B': 30,  # 事例名
        'C': 50,  # AIがしていること
        'D': 30,  # 適用業務・シーン
        'E': 30,  # 期待効果
        'F': 60,  # URL
        'G': 40,  # 出典・備考
    }
    
    for col, width in column_widths.items():
        ws.column_dimensions[col].width = width
    
    # 行の高さ調整（ヘッダー行）
    ws.row_dimensions[1].height = 40
    
    # フィルターの追加
    ws.auto_filter.ref = ws.dimensions
    
    # Excelファイルを保存
    wb.save(excel_file)
    print(f"Excelファイルを作成しました: {excel_file}")

if __name__ == "__main__":
    csv_file = "AI活用ユースケース具体事例一覧.csv"
    excel_file = "AI活用ユースケース具体事例一覧.xlsx"
    
    # 現在のディレクトリを確認
    current_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(current_dir, csv_file)
    excel_path = os.path.join(current_dir, excel_file)
    
    if not os.path.exists(csv_path):
        print(f"エラー: CSVファイルが見つかりません: {csv_path}")
        sys.exit(1)
    
    csv_to_excel(csv_path, excel_path)

