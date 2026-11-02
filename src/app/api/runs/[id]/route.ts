import { jevLimitReached } from '../../../../server/limit';
import { snapshot } from '../../../../server/runs';
import { error } from '../../../../server/http';
import { NextResponse } from 'next/server';
export const runtime='nodejs';
export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){if(jevLimitReached())return error(503,'LIMIT_REACHED','Limite Jev raggiunto.');try{const {id}=await params;if(!/^[0-9a-f-]{36}$/i.test(id))return error(404,'NOT_FOUND','Esecuzione non trovata.');const s=await snapshot(id);return s?NextResponse.json(s):error(404,'NOT_FOUND','Esecuzione non trovata.');}catch{return error(503,'UNAVAILABLE','Servizio non disponibile.',true);}}
