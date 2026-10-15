import {authorize,deny,limit} from '@/lib/api-auth';
import {chatSchema} from '@/lib/validation';
import {answer,searchKnowledge,sourceList} from '@/lib/search';
import {isConfigured} from '@/lib/config';
export const runtime='nodejs';
export async function POST(req:Request){
  if(!isConfigured()) return Response.json({error:{code:'NOT_CONFIGURED',message:'서비스 환경변수를 설정해야 합니다.'}},{status:503});
  const actor=await authorize(req); if(!actor) return deny();
  if(!await limit(actor)) return Response.json({error:{code:'RATE_LIMITED',message:'잠시 후 다시 시도해 주세요.'}},{status:429});
  const payload=chatSchema.safeParse(await req.json().catch(()=>null));
  if(!payload.success) return Response.json({error:{code:'BAD_REQUEST',message:'질문 형식을 확인해 주세요.'}},{status:400});
  if(payload.data.attachments.length) return Response.json({error:{code:'ATTACHMENTS_STREAM_ONLY',message:'파일 첨부는 스트리밍 채팅 API에서만 지원합니다.'}},{status:400});
  try {
    const hits=await searchKnowledge(payload.data.message,actor.scope);
    const text=await answer(payload.data.message,hits,payload.data.history);
    return Response.json({answer:text,sources:sourceList(hits),verified:hits.length>0},{headers:{'Cache-Control':'no-store'}});
  }catch(e){console.error('chat error',e);return Response.json({error:{code:'AI_UNAVAILABLE',message:'답변 생성에 실패했습니다.'}},{status:503});}
}
