import {requireMember} from '@/lib/auth';
import {openapi} from '@/lib/openapi';
export const runtime='nodejs';
export async function GET(){const m=await requireMember('admin');if(!m)return Response.json({error:'FORBIDDEN'},{status:403});return Response.json(openapi,{headers:{'Cache-Control':'no-store'}});}
