import {copyFileSync,existsSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const pkg=path.join(root,'node_modules','swagger-ui-dist');
const out=path.join(root,'public','vendor','swagger');
if(!existsSync(pkg)){
 console.error('swagger-ui-dist 패키지를 찾지 못했습니다. npm install을 실행해 주세요.');
 process.exit(1);
}
mkdirSync(out,{recursive:true});
for(const filename of ['swagger-ui.css','swagger-ui-bundle.js']){
 const from=path.join(pkg,filename);
 if(!existsSync(from))throw new Error(`Swagger asset missing: ${filename}`);
 copyFileSync(from,path.join(out,filename));
}
console.log('Swagger UI browser assets prepared (Turbopack ESM bypass).');
