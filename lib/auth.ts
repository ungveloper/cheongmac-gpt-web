import { adminDb, sessionDb } from './supabase';
import type { User } from '@supabase/supabase-js';
export type Role = 'staff' | 'admin' | 'super_admin';
export type Member = { id:string; email:string; display_name:string|null; role:Role; approved:boolean; active:boolean };

export async function currentMember(): Promise<{ user:User; member:Member } | null> {
  const client = await sessionDb();
  if (!client) return null;
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return null;
  const { data } = await adminDb().from('members').select('id,email,display_name,role,approved,active').eq('id', user.id).maybeSingle();
  if (!data) return null;
  return { user, member: data as Member };
}
export async function requireMember(role: 'staff'|'admin'|'super_admin' = 'staff') {
  const identity = await currentMember();
  if (!identity?.member.approved || !identity.member.active) return null;
  const hierarchy: Record<Role,number> = { staff:1, admin:2, super_admin:3 };
  return hierarchy[identity.member.role] >= hierarchy[role] ? identity : null;
}
export async function memberFromBearer(token:string) {
  const { data:{user},error } = await adminDb().auth.getUser(token);
  if(error || !user) return null;
  const {data} = await adminDb().from('members').select('id,email,display_name,role,approved,active').eq('id',user.id).maybeSingle();
  if(!data?.approved || !data?.active) return null;
  return {user,member:data as Member};
}
