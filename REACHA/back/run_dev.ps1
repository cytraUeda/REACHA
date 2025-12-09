# PowerShell dev runner for FastAPI (reload only app/, exclude runner & outputs)

$env:FRONT_ORIGIN = $env:FRONT_ORIGIN -ne $null ? $env:FRONT_ORIGIN : "http://localhost:3000"

uvicorn app.main:app `
  --host 0.0.0.0 `
  --port 8000 `
  --reload `
  --reload-dir app `
  --reload-exclude sample_dify_connect.py `
  --reload-exclude outputs/*

