import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const requiredHeadings = {
  'PRODUCT.md': [
    'Product purpose',
    'Target user',
    'MVP scope',
    'Core user flow',
    'Event types',
    'Out of scope',
    'UX principles',
    'Abuse prevention principles',
    'MVP success criteria'
  ],
  'ARCHITECTURE.md': [
    'Feature-oriented structure',
    'Map provider abstraction',
    'Supabase and data access',
    'Event lifecycle',
    'Verification boundaries'
  ],
  'AGENTS.md': [
    'Always read PRODUCT.md and ARCHITECTURE.md',
    'Do not bypass Supabase RLS',
    'Prevent duplicate votes',
    'Run typecheck, lint and tests before claiming a task is complete'
  ]
} as const;

describe('project documentation', () => {
  it.each(Object.entries(requiredHeadings))('%s contains required guidance', async (file, headings) => {
    const content = await readFile(file, 'utf8');

    for (const heading of headings) {
      expect(content).toContain(heading);
    }
  });
});
