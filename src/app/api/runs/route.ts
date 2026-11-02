import { jevLimitReached } from '../../../server/limit';
import { StartSchema } from '../../../shared/contracts';
import { startRun,execute,snapshot,reserve,listRuns } from '../../../server/runs';
import { NextResponse } from 'next/server';
import { error,stream } from '../../../server/http';
import { notifyIfNeeded } from '../../../server/mailer';
export const runtime='nodejs';
export const maxDuration=120;
export async function GET(req:Request){if(jevLimitReached())return error(503,'LIMIT_REACHED','Limite Jev raggiunto.');if(!process.env.DATABASE_URL)return NextResponse.json({runs:[]});try{const ids=(new URL(req.url).searchParams.get('ids')??'').split(',').filter(Boolean);return NextResponse.json({runs:await listRuns(ids)});}catch{return error(503,'UNAVAILABLE','Servizio non disponibile.',true);}}
export async function POST(req:Request){if(jevLimitReached())return error(503,'LIMIT_REACHED','Limite Jev raggiunto.');if(!process.env.DATABASE_URL||!process.env.TYPESAFE_API_KEY)return error(503,'UNAVAILABLE','Modalità live non disponibile.',true);let body;try{body=StartSchema.safeParse(await req.json());}catch{return error(400,'INVALID_REQUEST','Richiesta non valida.');}if(!body.success)return error(400,'INVALID_REQUEST','Richiesta non valida.');try{const {id,duplicate}=await startRun(body.data.brief,body.data.profile,body.data.requestId,body.data.email);if(duplicate){const s=await snapshot(id);return stream(async send=>{for(const e of s?.events ?? [])send(e);});}const reservation=await reserve(id);return stream(async send=>{await execute(id,undefined,send,reservation);await notifyIfNeeded(id);});}catch(e){if(e instanceof Error && e.message==='duplicate')return error(409,'CONFLICT','Identificativo richiesta già utilizzato.');return error(503,'UNAVAILABLE','Servizio non disponibile.',true);}}
