/** Partition PDF-derived text without sending a large document in one model call.
 * No content is silently dropped; over-limit documents require a narrower request.
 */
export function splitLearningContext(input,{maxChars=8000,maxChunks=6}={}){
 if(typeof input!=='string'||!input.trim())return [];
 if(!Number.isSafeInteger(maxChars)||maxChars<256||!Number.isSafeInteger(maxChunks)||maxChunks<1)throw new Error('Invalid learning chunk configuration');
 let remaining=input.trim();
 const chunks=[];
 while(remaining){
  if(chunks.length>=maxChunks)throw new Error('LEARNING_DOCUMENT_TOO_LONG');
  if(remaining.length<=maxChars){chunks.push(remaining);break;}
  let split=remaining.lastIndexOf('\n',maxChars);
  if(split<Math.floor(maxChars*.55))split=maxChars;
  const chunk=remaining.slice(0,split).trim();
  chunks.push(chunk);
  remaining=remaining.slice(split).trimStart();
 }
 return chunks;
}
