import {authorize,deny,limit} from '@/lib/api-auth';
import {chatSchema} from '@/lib/validation';
import {searchKnowledge,instructions,sourceList} from '@/lib/search';
import {ai,models} from '@/lib/ai';
import {isConfigured} from '@/lib/config';
export const runtime='nodejs';
const frame=(event:string,data:unknown)=>`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
export async function POST(req:Request){
  if(!isConfigured()) return Response.json({error:{code:'NOT_CONFIGURED'}},{status:503});
  const actor=await authorize(req);if(!actor) return deny();
  if(!await limit(actor)) return Response.json({error:{code:'RATE_LIMITED'}},{status:429});
  const input=chatSchema.safeParse(await req.json().catch(()=>null));
  if(!input.success) return Response.json({error:{code:'BAD_REQUEST'}},{status:400});
  let hits;
  try {hits=await searchKnowledge(input.data.message,actor.scope);}catch(e){console.error(e);return Response.json({error:{code:'SEARCH_UNAVAILABLE'}},{status:503});}
  const encoder=new TextEncoder();
  const stream=new ReadableStream<Uint8Array>({
    async start(controller){
      const send=(name:string,data:unknown)=>controller.enqueue(encoder.encode(frame(name,data)));
      let closed=false;
      try{
        send('sources',{sources:sourceList(hits)});
        const result=await ai().responses.create({model:models().chat,instructions:instructions(hits),input:[...input.data.history,{role:'user',content:input.data.message}],stream:true});
        for await(const event of result){
          if(req.signal.aborted){closed=true;break;}
          if(event.type==='response.output_text.delta') send('delta',{text:event.delta});
          if(event.type==='response.failed') throw new Error('Upstream response failed');
        }
        if(!closed) send('done',{verified:hits.length>0});
      }catch(e){console.error('stream error',e);if(!closed)send('error',{code:'AI_UNAVAILABLE',message:'답변 생성 중 오류가 발생했습니다.'});}
      finally{controller.close();}
    },
  });
  return new Response(stream,{headers:{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no','X-Content-Type-Options':'nosniff'}});
}
