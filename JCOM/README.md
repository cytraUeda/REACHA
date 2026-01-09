# 動画をGIFに変換するスクリプト

MP4などの動画ファイルを自動的にGIFに変換するPythonスクリプトです。
3〜10秒の短い動画に最適化されています。

## セットアップ

1. 必要なライブラリをインストール:
```bash
pip install -r requirements.txt
```

2. FFmpegがインストールされていることを確認してください。
   - Windows: [FFmpeg公式サイト](https://ffmpeg.org/download.html)からダウンロード
   - macOS: `brew install ffmpeg`
   - Linux: `sudo apt-get install ffmpeg` または `sudo yum install ffmpeg`

## 使用方法

### 1. 単一ファイルの変換

```bash
python video_to_gif.py video.mp4
```

出力ファイル名を指定する場合:
```bash
python video_to_gif.py video.mp4 output.gif
```

### 2. ディレクトリ内の全ファイルを一括変換

```bash
python video_to_gif.py video/ --batch
```

### 3. オプション付きの変換

フレームレートを指定:
```bash
python video_to_gif.py video.mp4 --fps 15
```

リサイズを指定（ファイルサイズを小さくする場合）:
```bash
python video_to_gif.py video.mp4 --resize 640x480
```

複数のオプションを組み合わせ:
```bash
python video_to_gif.py video.mp4 --fps 12 --resize 800x600
```

## オプション

- `--fps <数値>`: GIFのフレームレート（デフォルト: 10）
  - 低い値（8-10）: ファイルサイズが小さくなる
  - 高い値（15-20）: より滑らかな動画になるがファイルサイズが大きくなる

- `--resize <幅x高さ>`: リサイズサイズ（例: 640x480）
  - ファイルサイズを小さくしたい場合に使用

- `--batch`: ディレクトリ内のすべての動画ファイルを一括変換

## 対応形式

入力: MP4, AVI, MOV, MKV, WebM, FLV
出力: GIF

## 注意事項

- 長い動画を変換する場合、ファイルサイズが非常に大きくなる可能性があります
- 3〜10秒の短い動画に最適化されています
- ファイルサイズを抑えるため、デフォルトのfpsは10に設定されています

