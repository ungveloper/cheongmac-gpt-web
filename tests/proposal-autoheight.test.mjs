import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../components/workspace.tsx', import.meta.url), 'utf8');

test('Knowledge proposal bodies are fully visible without an inner scroll or fixed height', () => {
  const panel = source.slice(source.indexOf('{suggestion&&'), source.indexOf('<div ref={endRef}/>'));
  assert.ok(panel.includes('suggestion.changes.map'), 'Proposal items must still render');
  assert.match(panel, /className="text-flow text-sm leading-7">\{c\.body\}/);
  assert.doesNotMatch(panel, /max-h-|overflow-y-auto|line-clamp/);
  assert.match(panel, /변경 승인/);
  assert.match(panel, /거절/);
});
