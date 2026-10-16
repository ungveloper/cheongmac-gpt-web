import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('ChatGPT-inspired blank chat centers a headline, composer, and compact suggestions',()=>{
 const ui=read('components/workspace.tsx');
 const css=read('app/globals.css');
 assert.match(ui,/chat-layout--empty/);
 assert.match(ui,/chat-feed--empty/);
 assert.match(ui,/chat-welcome/);
 assert.match(ui,/chat-prompts/);
 assert.match(ui,/chat-prompt-item/);
 assert.match(ui,/composerRef\.current\?\.focus\(\)/);
 assert.match(css,/\.chat-layout--empty\{justify-content:center/);
 assert.match(css,/\.chat-layout--thread \.chat-composer-region/);
 assert.match(css,/\[data-chat-composer\]\{border-radius:28px/);
});

test('Messages retain Markdown, actions and streaming semantics in a scrollable thread',()=>{
 const ui=read('components/workspace.tsx');
 assert.match(ui,/role="log" aria-live="polite"/);
 assert.match(ui,/chat-feed--thread/);
 assert.match(ui,/<Markdown remarkPlugins=\{\[remarkGfm\]\}>/);
 assert.match(ui,/phaseLabel\[phase\]/);
 assert.match(ui,/copyMessage\(m\.content,i\)/);
 assert.match(ui,/<ProposalReview proposal=\{suggestion\}/);
});

test('Composer retains Enter to send, attachments, autosize, and learning flow',()=>{
 const ui=read('components/workspace.tsx');
 assert.match(ui,/Math\.min\(naturalHeight,160\)/);
 assert.match(ui,/className="panel p-2 shadow-sm" data-chat-composer="true"/);
 assert.match(ui,/onClick=\{\(\)=>fileInput\.current\?\.click\(\)\}/);
 assert.match(ui,/e\.key==='Enter'&&!e\.shiftKey/);
 assert.match(ui,/post\('\/api\/admin\/learning-intent'/);
 assert.match(ui,/setChatFiles\(\[\]\)/);
 assert.match(ui,/chat-send-button/);
});

test('Other workspace pages and brand color remain unaffected',()=>{
 const ui=read('components/workspace.tsx');
 const css=read('app/globals.css');
 assert.match(ui,/tab==='members'/);
 assert.match(ui,/tab==='proposals'/);
 assert.match(ui,/checkedAtomicIds/);
 assert.match(css,/--blue:#14669e/);
 assert.match(css,/\.member-role-select/);
});
