import {requireMember} from '@/lib/auth';
import {redirect} from 'next/navigation';
import Link from 'next/link';
import {SwaggerViewer} from '@/components/swagger-viewer';
export const dynamic='force-dynamic';
export default async function ApiDocs(){const member=await requireMember('admin');if(!member)redirect('/');return <main className="min-h-screen bg-white"><header className="flex items-center justify-between border-b px-6 py-4"><h1 className="text-lg font-bold">MacGPT API · Swagger</h1><Link className="text-sm text-sky-700" href="/">← MacGPT 돌아가기</Link></header><SwaggerViewer/></main>;}
