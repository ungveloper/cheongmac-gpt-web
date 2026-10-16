import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
test('Drag and drop covers whole workspace and does not remain on max width chat container',()=>{
 const s=file('components/workspace.tsx');
 assert.match(s,/min-h-screen bg-\[#f6f8fb\].*onDragEnter=\{tab==='chat'\?onChatDragEnter/);
 assert.match(s,/pointer-events-none fixed inset-0 z-\[100\]/);
 assert.doesNotMatch(s,/max-w-4xl.*onDragEnter=\{onChatDragEnter\}/);
});
test('Loading assistant bubble is content-sized and not full width',()=>{
 const s=file('components/workspace.tsx');
 assert.match(s,/isWaiting\?'inline-flex w-fit max-w-max/);
 assert.doesNotMatch(s,/'bubble-ai w-full'/);
});
test('History has accessible copy action',()=>{
 const s=file('components/workspace.tsx');
 assert.match(s,/navigator\.clipboard\.writeText\(content\)/);
 assert.match(s,/메시지 복사/);
 assert.match(s,/<Copy size=\{15\}/);
});
test('PDF learning always takes server side text extraction; ownership validated',()=>{
 const s=file('app/api/admin/assist/route.ts');
 assert.match(s,/await loadChatFiles\(attachments,member\.member\.id\)/);
 assert.match(s,/await extractLearningPdfText\(pdfs\)/);
 assert.match(s,/parts=otherFiles\.length\?await makeFileParts\(otherFiles\)/);
 const p=file('lib/learning-pdf.ts');
 assert.match(p,/await pdfParse\(bytes\)/);
 assert.match(p,/hasExpectedFileSignature/);
 assert.match(p,/MAX_LEARNING_CHARS/);
 assert.match(p,/PDF_NO_TEXT/);
});
test('PDF parsing dependency is pinned and type-shim provided',()=>{
 const pkg=JSON.parse(file('package.json'));
 assert.equal(pkg.dependencies['pdf-parse'],'1.1.1');
 assert.match(file('types/pdf-parse.d.ts'),/declare module 'pdf-parse\/lib\/pdf-parse\.js'/);
});
test('Text-based PDF fixture is parsable by installed pdf-parse', async()=>{
 const {default:pdfParse}=await import('pdf-parse/lib/pdf-parse.js');
 const fixture=readFileSync(new URL('./fixtures/macgpt-pdf-smoke.pdf',import.meta.url));
 const parsed=await pdfParse(fixture);
 assert.equal(parsed.numpages,1);
 assert.match(parsed.text,/MacGPT PDF extraction smoke test/);
});

test('Model markdown is rendered as safe rich text',()=>{
 const ui=file('components/workspace.tsx');
 assert.match(ui,/import Markdown from 'react-markdown'/);
 assert.match(ui,/remarkPlugins=\{\[remarkGfm\]\}/);
 assert.match(file('app/globals.css'),/\.chat-markdown pre/);
});

test('Assistive loading label uses the narrowed non-idle phase safely',()=>{
 const s=file('components/workspace.tsx');
 assert.match(s,/aria-label=\{phaseLabel\[phase\]\}/);
 assert.doesNotMatch(s,/phase==='idle'\?'writing':phase/);
});
