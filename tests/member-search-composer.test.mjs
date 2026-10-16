import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file=(p)=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');

test('Member search input and icon share a flex row without overlapping absolute positioning',()=>{
 const ui=file('components/workspace.tsx');
 assert.match(ui,/member-search-field flex min-w-48 flex-1 items-center gap-2/);
 assert.ok(ui.includes('<Search size={16} className="shrink-0 text-slate-400"/>'));
 assert.match(ui,/className="member-search-textbox min-w-0 flex-1 bg-transparent text-sm"/);
 assert.doesNotMatch(ui,/<input className="input pl-10" aria-label="회원 검색"/);
 const css=file('app/globals.css');
 assert.match(css,/\.member-search-textbox:focus\{border:0;box-shadow:none/);
 assert.match(css,/\.member-search-field:focus-within/);
});

test('Chat composer uses one-line auto-resizing textarea bounded at six lines',()=>{
 const ui=file('components/workspace.tsx');
 assert.match(ui,/useLayoutEffect\(\(\)=>\{/);
 assert.match(ui,/const field=composerRef\.current/);
 assert.match(ui,/field\.style\.height='auto'/);
 assert.match(ui,/field\.scrollHeight/);
 assert.match(ui,/Math\.min\(naturalHeight,160\)/);
 assert.match(ui,/naturalHeight>160\?'auto':'hidden'/);
 assert.ok(ui.includes('<textarea ref={composerRef} className="chat-composer-textarea'));
 assert.ok(ui.includes('rows={1} value={draft}'));
 assert.match(ui,/className="panel p-2 shadow-sm"/);
 assert.doesNotMatch(ui,/max-h-40 min-h-12 flex-1 resize-none/);
 const css=file('app/globals.css');
 assert.match(css,/\.chat-composer-textarea:focus\{border:0;box-shadow:none/);
});

test('Message sending, keyboard shortcuts and chat file support are preserved',()=>{
 const ui=file('components/workspace.tsx');
 assert.match(ui,/e\.key==='Enter'&&!e\.shiftKey/);
 assert.match(ui,/void send\(\)/);
 assert.ok(ui.includes('ref={fileInput} type="file"'));
 assert.match(ui,/disabled={busy\|\|\(!draft\.trim\(\)/);
});
