import {redirect} from 'next/navigation';
import {currentMember} from '@/lib/auth';
import {isConfigured} from '@/lib/config';
import {Workspace} from '@/components/workspace';
export type WorkspaceSection='chat'|'knowledge'|'proposals'|'files'|'members'|'api';
export async function renderWorkspaceRoute(section:WorkspaceSection){
 if(!isConfigured())redirect('/');
 const identity=await currentMember();
 if(!identity?.member.approved||!identity.member.active)redirect('/');
 const role=identity.member.role;
 if((section==='proposals'||section==='files')&&role==='staff')redirect('/chat');
 if((section==='members'||section==='api')&&role!=='super_admin')redirect('/chat');
 return <Workspace key={section} member={identity.member} initialTab={section}/>;
}
