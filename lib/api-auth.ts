import { createHash, randomBytes } from 'node:crypto';
import { adminDb } from './supabase';
import { memberFromBearer, requireMember, type Member } from './auth';
export type Scope='public'|'internal'|'restricted';
export type ApiActor={ scope:Scope; actorId:string; member?:Member; clientId?:string };
export function hashKey(key:string){return createHash('sha256').update(key).digest('hex');}
export function generateKey(){return 'macgpt_'+randomBytes(32).toString('base64url');}

export async function authorize(req:Request):Promise<ApiActor|null> {
  const supplied = req.headers.get('x-macgpt-key');
  if(supplied) {
    if(supplied.length>150 || !supplied.startsWith('macgpt_')) return null;
    const {data}=await adminDb().from('api_clients').select('id,scope,disabled,expires_at').eq('key_hash',hashKey(supplied)).maybeSingle();
    if(!data || data.disabled || (data.expires_at && Date.parse(data.expires_at)<Date.now())) return null;
    if(data.scope==='public') return {scope:'public',actorId:`app:${data.id}`,clientId:data.id};
    // Server app identity alone is insufficient for staff-only data.
    const token = req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
    if(!token) return null;
    const identity = await memberFromBearer(token);
    return identity ? {scope:'internal',actorId:identity.member.id,member:identity.member,clientId:data.id} : null;
  }
  const bearer = req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  const identity = bearer ? await memberFromBearer(bearer) : await requireMember();
  if(!identity) return null;
  return {scope:identity.member.role==='staff'?'internal':'restricted',actorId:identity.member.id,member:identity.member};
}
export function allowedScopes(scope:Scope){return scope==='restricted'?['public','internal','restricted']:scope==='internal'?['public','internal']:['public'];}
export function deny(){return Response.json({error:{code:'UNAUTHORIZED',message:'인증 또는 접근 권한을 확인해 주세요.'}},{status:401,headers:{'Cache-Control':'no-store'}});}
export async function limit(actor:ApiActor):Promise<boolean>{
  // DB-backed shared limit across Vercel instances; fail closed if unavailable.
  const max = actor.clientId ? 30 : 60;
  const {data,error}=await adminDb().rpc('consume_api_quota',{p_identity:actor.actorId,p_limit:max});
  return !error && data===true;
}
