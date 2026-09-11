import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const migrationPath = new URL('../supabase/migrations/0001_initial_schema.sql', import.meta.url);

async function readMigration(): Promise<string> {
  return readFile(migrationPath, 'utf8');
}

describe('initial Supabase schema', () => {
  it('defines the protected profile, event, and vote tables', async () => {
    const migration = await readMigration();

    expect(migration).toMatch(/create table.*profiles/i);
    expect(migration).toMatch(/create table.*road_events/i);
    expect(migration).toMatch(/create table.*event_votes/i);
    expect(migration).toMatch(/profiles\s*\(\s*id\s+uuid\s+primary key\s+references\s+auth\.users/i);
    expect(migration).toMatch(/unique\s*\(\s*event_id\s*,\s*user_id\s*\)/i);
  });

  it('constrains event, vote, coordinate, and lifecycle values', async () => {
    const migration = await readMigration();

    expect(migration).toMatch(/road_check.*accident.*road_hazard.*road_closure/is);
    expect(migration).toMatch(/active.*stale.*removed.*expired/is);
    expect(migration).toMatch(/confirm.*gone/is);
    expect(migration).toMatch(/latitude\s+between\s+-90\s+and\s+90/i);
    expect(migration).toMatch(/longitude\s+between\s+-180\s+and\s+180/i);
    expect(migration).toMatch(/expires_at\s+timestamptz\s+not null/i);
    expect(migration).toMatch(/create index.*road_events.*status.*expires_at/is);
    expect(migration).toMatch(/create index.*event_votes.*user_id.*event_id/is);
  });

it('enables RLS and protects mutations from banned users and derived-field writes', async () => {
  const migration = await readMigration();

  expect(migration).toMatch(/alter table\s+(?:public\.)?profiles\s+enable row level security/i);
  expect(migration).toMatch(/alter table\s+(?:public\.)?road_events\s+enable row level security/i);
  expect(migration).toMatch(/alter table\s+(?:public\.)?event_votes\s+enable row level security/i);

  expect(migration).toMatch(/status\s*=\s*'active'/i);
  expect(migration).toMatch(/not\s+exists\s*\(\s*select\s+1\s+from\s+public\.profiles/is);
  expect(migration).toMatch(/auth\.uid\(\)\s*=\s*reporter_id/i);
  expect(migration).toMatch(/auth\.uid\(\)\s*=\s*user_id/i);
  expect(migration).toMatch(/revoke\s+update\s*\([^)]*(confidence|confirmation_count|gone_count|status)/is);
});
});
