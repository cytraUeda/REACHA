#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
動画ファイル（MP4など）をGIFに自動変換するスクリプト
3〜10秒の短い動画に最適化されています
"""

import os
import sys
from pathlib import Path
from moviepy.editor import VideoFileClip


def convert_video_to_gif(input_path, output_path=None, fps=10, resize=None):
    """
    動画ファイルをGIFに変換
    
    Args:
        input_path: 入力動画ファイルのパス
        output_path: 出力GIFファイルのパス（指定しない場合は自動生成）
        fps: GIFのフレームレート（デフォルト: 10）
        resize: リサイズサイズ (width, height) または None（デフォルト: None）
    """
    input_path = Path(input_path)
    
    if not input_path.exists():
        print(f"エラー: ファイルが見つかりません: {input_path}")
        return False
    
    # 出力パスが指定されていない場合は自動生成
    if output_path is None:
        output_path = input_path.with_suffix('.gif')
    else:
        output_path = Path(output_path)
    
    try:
        print(f"変換中: {input_path.name} -> {output_path.name}")
        
        # 動画を読み込む
        clip = VideoFileClip(str(input_path))
        
        # リサイズが必要な場合
        if resize:
            clip = clip.resize(resize)
        
        # GIFに変換（fpsを指定してファイルサイズを最適化）
        clip.write_gif(
            str(output_path),
            fps=fps,
            program='ffmpeg',  # ffmpegを使用（より高品質）
            opt='optimizeplus'  # 最適化オプション
        )
        
        clip.close()
        
        # ファイルサイズを表示
        input_size = input_path.stat().st_size / (1024 * 1024)  # MB
        output_size = output_path.stat().st_size / (1024 * 1024)  # MB
        print("変換完了!")
        print(f"  元のサイズ: {input_size:.2f} MB")
        print(f"  GIFサイズ: {output_size:.2f} MB")
        print(f"  出力先: {output_path}")
        
        return True
        
    except Exception as e:
        print(f"エラー: 変換に失敗しました: {e}")
        return False


def batch_convert(input_dir, output_dir=None, fps=10, resize=None):
    """
    ディレクトリ内のすべての動画ファイルを一括変換
    
    Args:
        input_dir: 入力ディレクトリのパス
        output_dir: 出力ディレクトリのパス（指定しない場合は入力ディレクトリと同じ）
        fps: GIFのフレームレート
        resize: リサイズサイズ
    """
    input_dir = Path(input_dir)
    
    if not input_dir.exists():
        print(f"エラー: ディレクトリが見つかりません: {input_dir}")
        return
    
    if output_dir is None:
        output_dir = input_dir
    else:
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
    
    # 対応する動画形式
    video_extensions = ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv']
    
    # 動画ファイルを検索
    video_files = []
    for ext in video_extensions:
        video_files.extend(input_dir.glob(f'*{ext}'))
        video_files.extend(input_dir.glob(f'*{ext.upper()}'))
    
    if not video_files:
        print(f"動画ファイルが見つかりませんでした: {input_dir}")
        return
    
    print(f"{len(video_files)}個の動画ファイルが見つかりました")
    print("-" * 50)
    
    success_count = 0
    for video_file in video_files:
        output_file = output_dir / video_file.with_suffix('.gif').name
        if convert_video_to_gif(video_file, output_file, fps, resize):
            success_count += 1
        print()
    
    print("-" * 50)
    print(f"変換完了: {success_count}/{len(video_files)}個のファイル")


def main():
    """メイン関数"""
    if len(sys.argv) < 2:
        print("使用方法:")
        print("  1. 単一ファイルの変換:")
        print("     python video_to_gif.py <動画ファイルのパス> [出力パス]")
        print()
        print("  2. ディレクトリ内の全ファイルを一括変換:")
        print("     python video_to_gif.py <ディレクトリのパス> --batch")
        print()
        print("オプション:")
        print("  --fps <数値>      : GIFのフレームレート（デフォルト: 10）")
        print("  --resize <幅x高さ>: リサイズサイズ（例: 640x480）")
        print("  --batch           : ディレクトリ内の全ファイルを一括変換")
        print()
        print("例:")
        print("  python video_to_gif.py video.mp4")
        print("  python video_to_gif.py video.mp4 output.gif")
        print("  python video_to_gif.py video/ --batch")
        print("  python video_to_gif.py video.mp4 --fps 15 --resize 640x480")
        sys.exit(1)
    
    # 引数の解析
    input_path = sys.argv[1]
    output_path = None
    fps = 10
    resize = None
    batch_mode = False
    
    i = 2
    while i < len(sys.argv):
        arg = sys.argv[i]
        if arg == '--batch':
            batch_mode = True
        elif arg == '--fps' and i + 1 < len(sys.argv):
            fps = int(sys.argv[i + 1])
            i += 1
        elif arg == '--resize' and i + 1 < len(sys.argv):
            size_str = sys.argv[i + 1]
            try:
                width, height = map(int, size_str.split('x'))
                resize = (width, height)
            except ValueError:
                print(f"エラー: 無効なリサイズサイズ: {size_str}")
                sys.exit(1)
            i += 1
        elif not arg.startswith('--'):
            output_path = arg
        i += 1
    
    # 実行
    if batch_mode:
        batch_convert(input_path, output_path, fps, resize)
    else:
        convert_video_to_gif(input_path, output_path, fps, resize)


if __name__ == '__main__':
    main()

