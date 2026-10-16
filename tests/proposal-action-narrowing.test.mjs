import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const route=readFileSync(new URL('../app/api/admin/proposals/approve/route.ts',import.meta.url),'utf8');
test('Approve branch narrows the selected_indices discriminated union using the action directly',()=>{
 assert.match(route,/const \{data,error\}=input\.data\.action==='approve'\?/);
 assert.match(route,/p_selected:input\.data\.selected_indices/);
 assert.doesNotMatch(route,/const \{data,error\}=isApproval\?/);
 assert.match(route,/if\(!isApproval\)return Response\.json\(\{status:'rejected'\}\)/);
});
