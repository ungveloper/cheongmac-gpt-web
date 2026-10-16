'use client';
import {useEffect,useState} from 'react';

type SwaggerGlobal=Window & {SwaggerUIBundle?: ((config:Record<string,unknown>)=>unknown)&{presets?:{apis:unknown}}};
export function SwaggerViewer(){
 const [error,setError]=useState('');
 useEffect(()=>{
  let active=true;
  const stylesheet=document.createElement('link');
  stylesheet.rel='stylesheet';
  stylesheet.href='/vendor/swagger/swagger-ui.css';
  document.head.appendChild(stylesheet);
  const load=()=>{
   if(!active)return;
   const factory=(window as SwaggerGlobal).SwaggerUIBundle;
   if(!factory){setError('Swagger UI 로딩을 완료하지 못했습니다. 정적 자산을 확인하세요.');return;}
   try{
    factory({url:'/api/openapi.json',dom_id:'#macgpt-swagger-ui',deepLinking:true,
     presets:factory.presets?[factory.presets.apis]:undefined,layout:'BaseLayout',
     tryItOutEnabled:false});
   }catch(e){console.error('Swagger UI initialization failed',e);setError('Swagger UI 초기화에 실패했습니다. 개발자 도구의 콘솔을 확인해 주세요.');}
  };
  if((window as SwaggerGlobal).SwaggerUIBundle){load();return()=>{active=false;stylesheet.remove();};}
  const script=document.createElement('script');
  script.src='/vendor/swagger/swagger-ui-bundle.js';script.async=true;
  script.onload=load;script.onerror=()=>{if(active)setError('Swagger UI 파일을 불러오지 못했습니다. npm install을 다시 실행해 주세요.');};
  document.body.appendChild(script);
  return()=>{active=false;script.remove();stylesheet.remove();};
 },[]);
 return <>
  {error&&<div role="alert" className="mx-6 my-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
  <div id="macgpt-swagger-ui" className="min-h-[60vh]"/></>;
}
