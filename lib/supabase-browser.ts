'use client';
import {createBrowserClient} from '@supabase/ssr';
import {getSupabaseConfig} from './config';
export function browserDb(){
 const cfg=getSupabaseConfig();
 if(!cfg)throw new Error('Supabase browser configuration missing');
 return createBrowserClient(cfg.url,cfg.key);
}
