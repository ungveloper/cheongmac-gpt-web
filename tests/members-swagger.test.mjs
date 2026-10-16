import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const file=(p)=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
test('Member pagination remains server-side and is restricted to super admin',()=>{
 const source=file('app/api/admin/members/route.ts');
 assert.match(source,/requireMember\('super_admin'\)/);
 assert.match(source,/PAGE_SIZE=10/);
 assert.match(source,/\.range\(offset,offset\+PAGE_SIZE-1\)/);
 assert.match(source,/\.or\(`/);
 assert.match(source,/sortKey in sorts/);
});
test('Sidebar counts are protected and sourced from pending records',()=>{
 const api=file('app/api/admin/pending-counts/route.ts');
 assert.match(api,/requireMember\('admin'\)/);
 assert.match(api,/status','pending'/);
 assert.match(api,/approved',false/);
 const ui=file('components/workspace.tsx');
 assert.match(ui,/pendingCounts\.proposals/);
 assert.match(ui,/pendingCounts\.members/);
 assert.match(ui,/MemberPager/);
 assert.match(ui,/member-status pending/);
});
test('Swagger UI avoids importing React Swagger ESM through Turbopack',()=>{
 const ui=file('components/swagger-viewer.tsx');
 assert.doesNotMatch(ui,/from ['"]swagger-ui-react/);
 assert.match(ui,/swagger-ui-bundle\.js/);
 assert.match(ui,/SwaggerUIBundle/);
 assert.ok(existsSync(new URL('../scripts/copy-swagger-assets.mjs',import.meta.url)));
 const config=JSON.parse(file('package.json'));
 assert.equal(config.scripts.postinstall,'node scripts/copy-swagger-assets.mjs');
 assert.equal(config.dependencies['swagger-ui-dist'],'5.33.0');
});
test('App branding and management icons use lucide-react',()=>{
 const ui=file('components/workspace.tsx');
 assert.match(ui,/<Sparkles size=/);
 assert.match(ui,/<Search size=/);
 assert.doesNotMatch(ui,/>✳<\/div>/);
});

test('Composer action buttons preserve accessible alignment with the new round send button',()=>{
 const ui=file('components/workspace.tsx');
 const css=file('app/globals.css');
 assert.match(ui,/flex items-center gap-2[^>]*><input ref=\{fileInput\}/);
 assert.match(ui,/aria-pressed=\{forceEdit\}/);
 assert.match(ui,/<PencilLine size=\{16\}\/>/);
 // The previous regression expected an old rectangular button class; the new
 // layout intentionally adds chat-send-button while retaining type and alignment.
 assert.match(ui,/<button type="submit"[^>]*aria-label="메시지 보내기" className="btn btn-primary chat-send-button self-center"/);
 assert.match(css,/\[data-chat-composer\] \.chat-send-button\{[^}]*border-radius:50%/);
 assert.doesNotMatch(ui,/전체 지식 접근/);
 assert.doesNotMatch(ui,/의학적 판단은 의료진과 확인하세요/);
 assert.doesNotMatch(ui,/지식 변경 모드 \(필요 시 선택\)/);
});

// Regression coverage for the previously failed October 16 patch.
test('Pending-count effect schedules its initial fetch without a synchronous state update',()=>{
 const ui=file('components/workspace.tsx');
 assert.doesNotMatch(ui,/if\(!isAdmin\)return;\s*void updatePendingCounts\(\);/);
 assert.match(ui,/const initialRefresh=window\.setTimeout\(onFocus,0\)/);
 assert.match(ui,/window\.clearTimeout\(initialRefresh\)/);
});
test('ESLint ignores copied Swagger minified assets without disabling lint for application code',()=>{
 const config=file('eslint.config.mjs');
 assert.match(config,/public\/vendor\/swagger\/\*\*/);
 assert.match(config,/nextVitals/);
 assert.match(config,/nextTs/);
});
test('Swagger CSS uses a managed link, not the Next.js no-css-tags JSX anti-pattern',()=>{
 const ui=file('components/swagger-viewer.tsx');
 assert.match(ui,/document\.createElement\('link'\)/);
 assert.match(ui,/stylesheet\.remove\(\)/);
 assert.doesNotMatch(ui,/<link rel=/);
});
