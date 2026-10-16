import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file=p=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');

test('Knowledge proposal bodies expand naturally without nested scroll',()=>{
 const ui=file('components/workspace.tsx');
 const review=file('components/proposal-review.tsx');
 assert.match(ui,/<ProposalReview proposal=\{suggestion\}/);
 assert.match(review,/className="text-flow whitespace-pre-wrap text-base leading-7">\{change.body\}/);
 assert.doesNotMatch(review,/max-h-|overflow-y-auto|line-clamp/);
 assert.match(review,/선택 \{visible.length\}건 승인/);
 assert.match(review,/전체 거절/);
});
