import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const ui=readFileSync(new URL('../components/workspace.tsx',import.meta.url),'utf8');
const send=ui.slice(ui.indexOf(' async function send(){'),ui.indexOf(' async function decide('));

test('Successful answers consume only the sent attachments and retain historical file names',()=>{
 assert.match(send,/fileNames:selectedNames/);
 assert.match(send,/await stream\(text,history,attachmentIds\);\s*completed=true/);
 assert.match(send,/if\(completed\)\{[\s\S]*setPendingFiles\(\[\]\);[\s\S]*setChatFiles\(\[\]\)/);
 assert.match(send,/await post\('\/api\/chat\/attachments\/delete',\{ids:usedFileIds\}\)/);
 assert.match(send,/usedFileIds=attachmentIds/);
});

test('Approved learning proposal response also consumes attachments only after AI finishes',()=>{
 const block=send.slice(send.indexOf("if(outcome.kind==='proposal')"),send.indexOf('if(attachmentIds.length)'));
 assert.match(block,/setSuggestion\(outcome.proposal\)/);
 assert.match(block,/completed=true;\s*return/);
});

test('Failed upload or response keeps attachments available for retry',()=>{
 assert.match(send,/let completed=false/);
 assert.match(send,/setChatFiles\(all\);setPendingFiles\(\[\]\)/);
 assert.match(send,/updateAssistant\(\{content:`요청을 완료하지 못했습니다[\s\S]*failed:true\}\);/);
 assert.match(send,/\}finally\{\s*if\(completed\)/);
 const failedPath=send.slice(send.indexOf('  }catch(e){'),send.indexOf('  }finally{'));
 assert.doesNotMatch(failedPath,/setChatFiles\(\[\]\)/);
});

test('Temporary deletion API remains authorization and ownership protected',()=>{
 const api=readFileSync(new URL('../app/api/chat/attachments/delete/route.ts',import.meta.url),'utf8');
 assert.match(api,/requireMember\(\)/);
 assert.match(api,/\.eq\('owner_id', actor.member.id\)/);
 assert.match(api,/storage\.from\(bucket\)\.remove\(/);
});
