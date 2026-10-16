import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

test('PDF test fixtures are binary for Git staged whitespace validation', () => {
  const result = execFileSync('git', ['check-attr', 'binary', '--', 'tests/fixtures/macgpt-pdf-smoke.pdf'], {encoding: 'utf8'});
  assert.match(result, /: binary: set\s*$/);
});
