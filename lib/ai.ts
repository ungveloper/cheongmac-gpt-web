import OpenAI from 'openai';
let singleton:OpenAI|null=null;
export function ai() {
  const key=process.env.OPENAI_API_KEY;
  if(!key || key.startsWith('YOUR_')) throw new Error('OpenAI API key missing');
  if(!singleton) singleton=new OpenAI({apiKey:key,maxRetries:1,timeout:30000});
  return singleton;
}
export function models(){return {chat:process.env.OPENAI_CHAT_MODEL||'gpt-4.1-mini',admin:process.env.OPENAI_ADMIN_MODEL||'gpt-4.1',embedding:process.env.OPENAI_EMBEDDING_MODEL||'text-embedding-3-small'};}
export async function embedding(text:string){
  const response=await ai().embeddings.create({model:models().embedding,input:text.slice(0,9000),dimensions:1536});
  return response.data[0].embedding;
}
