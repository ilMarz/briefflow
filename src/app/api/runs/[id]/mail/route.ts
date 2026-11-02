import { z } from 'zod';
import { NextResponse } from 'next/server';
import { error } from '../../../../../server/http';
import { jevLimitReached } from '../../../../../server/limit';
import { mailConfigured } from '../../../../../server/mail';
import { MailError, sendRunMail } from '../../../../../server/mailer';
export const runtime='nodejs';

// The recipient is never taken from the request: it is the email stored with the run.
const Body=z.object({kind:z.enum(['summary','contact']),note:z.string().trim().max(500).optional()});

export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
  if(jevLimitReached())return error(503,'LIMIT_REACHED','Limite Jev raggiunto.');
  if(!process.env.DATABASE_URL)return error(503,'UNAVAILABLE','Servizio non disponibile.',true);
  if(!mailConfigured())return error(503,'MAIL_NOT_CONFIGURED','Servizio email non configurato.');
  const {id}=await params;
  if(!/^[0-9a-f-]{36}$/i.test(id))return error(404,'NOT_FOUND','Richiesta non trovata.');
  let body;try{body=Body.safeParse(await req.json());}catch{return error(400,'INVALID_REQUEST','Richiesta non valida.');}
  if(!body.success)return error(400,'INVALID_REQUEST','Richiesta non valida.');
  try{
    const {to}=await sendRunMail(id,body.data.kind,body.data.note);
    return NextResponse.json({sent:true,to});
  }catch(e){
    if(e instanceof MailError){
      if(e.code==='NOT_FOUND')return error(404,'NOT_FOUND','Richiesta non trovata.');
      if(e.code==='NO_EMAIL')return error(409,'NO_EMAIL','Email non presente.');
      if(e.code==='RATE_LIMIT')return error(429,'RATE_LIMIT','Troppi messaggi inviati a questo indirizzo. Riprova più tardi.');
      if(e.code==='NOT_CONFIGURED')return error(503,'MAIL_NOT_CONFIGURED','Servizio email non configurato.');
      return error(502,'MAIL_FAILED','Invio non riuscito. Riprova.',true);
    }
    return error(503,'UNAVAILABLE','Servizio non disponibile.',true);
  }
}
