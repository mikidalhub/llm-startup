import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const indexPath = new URL('../../public/index.html', import.meta.url);

test('index page includes title', async () => {
  const html = await readFile(indexPath, 'utf-8');
  assert.ok(html.includes('<h1>LLM Startup</h1>'));
});
