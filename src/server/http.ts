import { NextResponse } from 'next/server';
export const error=(status:number,code:string,message:string,retryable=false)=>NextResponse.json({error:{code,message,retryable}},{status});
export function stream(run:(send:(e:unknown)=>void)=>Promise<void>){const encoder=new TextEncoder();return new Response(new ReadableStream({async start(controller){let closed=false;try{await run(e=>{if(!closed) try{controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));}catch{closed=true;}});}catch{}finally{if(!closed)try{controller.close();}catch{}}},cancel(){}}),{headers:{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','X-Accel-Buffering':'no'}});}

