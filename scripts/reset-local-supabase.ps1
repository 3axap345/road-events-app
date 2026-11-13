$ErrorActionPreference = "Stop"

Set-Location (Split-Path -Parent $PSScriptRoot)

Write-Host "Resetting LOCAL Supabase to migration 0003..."
npx supabase db reset --version 0003 --no-seed
if ($LASTEXITCODE -ne 0) { throw "Local reset failed" }

Write-Host "Enabling local pg_cron..."
docker exec supabase_db_ProjectMVP psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;"
if ($LASTEXITCODE -ne 0) { throw "pg_cron setup failed" }

Write-Host "Applying remaining local migrations..."
npx supabase migration up
if ($LASTEXITCODE -ne 0) { throw "Migration failed" }

Write-Host "Local database setup completed."
