import { randomUUID,createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { EventSchema, type RunState, type RunEvent, type RunSnapshot, type RunSummary, type ResumeInput } from '../shared/contracts';
import { db, saver } from './db';
import { createJev, type DecisionClient } from './jev';
import { createRunGraph, initialState, resumeCommand } from './graph';

function fingerprint(value:unknown):string {
  const canonical=(v:unknown):unknown=>Array.isArray(v)?v.map(canonical):v && typeof v==='object'?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,canonical(x)])):v;
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}
export async function snapshot(id:string, connection:PoolClient | ReturnType<typeof db> = db()):Promise<RunSnapshot|null>{
  const run=await connection.query('SELECT * FROM bf_runs WHERE id=$1',[id]);if(!run.rowCount)return null;
  const ev=await connection.query('SELECT event FROM bf_events WHERE run_id=$1 ORDER BY seq',[id]); const r=run.rows[0];
  return {id:r.id,status:r.status,state:r.state,events:ev.rows.map(x=>x.event),createdAt:r.created_at.toISOString(),updatedAt:r.updated_at.toISOString()};
}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Summaries of the given runs; in development also the latest runs of the whole database. Production never enumerates. */
export async function listRuns(ids:string[]):Promise<RunSummary[]>{
  const own=[...new Set(ids.filter(id=>UUID.test(id)))].slice(0,50);
  const all=process.env.NODE_ENV==='development';
  if(!all&&!own.length)return [];
  const result=await db().query(`SELECT id,status,created_at,updated_at,state FROM bf_runs ${all?'':'WHERE id=ANY($1::uuid[])'} ORDER BY updated_at DESC LIMIT ${all?30:50}`,all?[]:[own]);
  return result.rows.map(r=>({id:r.id,status:r.status,createdAt:r.created_at.toISOString(),updatedAt:r.updated_at.toISOString(),brief:String(r.state?.brief??'').slice(0,160),category:String(r.state?.category??''),compatibility:r.state?.card?.compatibility??null,nextAction:r.state?.card?.nextAction??null,clarificationRound:Number(r.state?.clarificationRound??0),jevCalls:Number(r.state?.calls??0),email:r.state?.contactEmail??null}));
}
export async function startRun(brief:string, profile:RunState['profile'], requestId:string, email?:string){
  const client=await db().connect();try {await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,1))',[requestId]);const existing=await client.query('SELECT run_id,request_hash FROM bf_requests WHERE request_id=$1',[requestId]);if(existing.rowCount){if(existing.rows[0].request_hash!==fingerprint({brief,profile,email})) throw new Error('duplicate');await client.query('ROLLBACK');return {id:existing.rows[0].run_id,duplicate:true};}const id=randomUUID();await client.query('INSERT INTO bf_runs(id,status,state) VALUES($1,$2,$3)',[id,'running',JSON.stringify(initialState(brief,profile,email))]);await client.query('INSERT INTO bf_requests(request_id,run_id,kind,request_hash) VALUES($1,$2,$3,$4)',[requestId,id,'start',fingerprint({brief,profile,email})]);await client.query('COMMIT');return {id,duplicate:false};}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
export async function reserve(id:string, input?:ResumeInput) {
  const connection=await db().connect();
  try {
    const lock=await connection.query('SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS ok',[id]);
    if(!lock.rows[0].ok) throw new Error('busy');
    const current=await snapshot(id,connection);if(!current) throw new Error('not found');
    if(input){
      const prior=await connection.query('SELECT run_id,request_hash FROM bf_requests WHERE request_id=$1',[input.requestId]);
      if(prior.rowCount){if(prior.rows[0].run_id!==id || prior.rows[0].request_hash!==fingerprint(input)) throw new Error('duplicate');if(current.status!=='running' && current.status!=='failed') return {connection,current,duplicate:true};return {connection,current,duplicate:false,recovery:true};}
      if(current.status!=='interrupted' && !(['failed','running'].includes(current.status) && input.retry)) throw new Error('invalid state');
      const last=current.events.filter(e=>e.type==='run_interrupted').at(-1);const kind=last?.payload.kind;
      if(current.status==='interrupted') {if(kind==='manual_review' && (!input.decision || input.answers || input.retry)) throw new Error('invalid input');if(kind==='answers' && (!input.answers || input.decision || input.retry || !current.state.questions.every(q=>input.answers?.[q]) || Object.keys(input.answers).some(q=>!current.state.questions.includes(q as never)))) throw new Error('invalid input');}
      await connection.query('INSERT INTO bf_requests(request_id,run_id,kind,request_hash) VALUES($1,$2,$3,$4)',[input.requestId,id,'resume',fingerprint(input)]);
    }
    return {connection,current,duplicate:false,recovery:current.status==='running'||current.status==='failed'};
  } catch(e) {try{await connection.query('SELECT pg_advisory_unlock(hashtextextended($1,0))',[id]);}finally{connection.release();}if(e && typeof e==='object' && 'code' in e && e.code==='23505')throw new Error('duplicate');throw e;}
}
export async function releaseReservation(id:string, connection:PoolClient) {try{await connection.query('SELECT pg_advisory_unlock(hashtextextended($1,0))',[id]);}finally{connection.release();}}
export async function execute(id:string, input:ResumeInput|undefined, send:(e:RunEvent)=>void, reservation:Awaited<ReturnType<typeof reserve>>, client:DecisionClient=createJev()){
  const {connection,current}=reservation; const cp=saver();
  try {
    await connection.query("UPDATE bf_runs SET status='running',updated_at=now() WHERE id=$1",[id]);
    let state=current.state; let seq=current.events.at(-1)?.seq ?? 0; let active: {node?:RunEvent["node"];visit?:string} = {};
    const emit=async(type:RunEvent['type'],payload:Record<string,unknown>,node?:RunEvent['node'],visit_id?:string)=>{if(type==='node_started') active={node,visit:visit_id}; if(type==='node_completed') active={}; const event=EventSchema.parse({id:randomUUID(),run_id:id,seq:++seq,timestamp:new Date().toISOString(),type,node,visit_id,payload});if(type==='state_updated') state={...state,...payload.patch as Partial<RunState>};await connection.query('BEGIN');try{await connection.query('INSERT INTO bf_events(run_id,seq,event) VALUES($1,$2,$3)',[id,seq,JSON.stringify(event)]);await connection.query('UPDATE bf_runs SET state=$2,updated_at=now() WHERE id=$1',[id,JSON.stringify(state)]);await connection.query('COMMIT');}catch(e){await connection.query('ROLLBACK');throw e;}send(event);};
    const cached=async <T>(node:string,round:number,fn:()=>Promise<T>):Promise<T>=>{
      const prior=await connection.query('SELECT result FROM bf_decisions WHERE run_id=$1 AND node=$2 AND round=$3',[id,node,round]);
      if(prior.rowCount) return prior.rows[0].result as T;
      const attempt=await connection.query('UPDATE bf_runs SET attempts=attempts+1 WHERE id=$1 AND attempts<5 RETURNING attempts',[id]);
      if(!attempt.rowCount) throw new Error('call budget exceeded');
      const result=await fn();
      await connection.query('INSERT INTO bf_decisions(run_id,node,round,result) VALUES($1,$2,$3,$4)',[id,node,round,JSON.stringify(result)]);
      return result;
    };
    const guarded:DecisionClient={classify:s=>cached('classify',0,()=>client.classify(s)),compatibility:s=>cached('compatibility',0,()=>client.compatibility(s)),completeness:s=>cached('completeness',s.clarificationRound,()=>client.completeness(s))};
    const graph=createRunGraph(guarded,cp,emit); const config={configurable:{thread_id:id}};
    try {
      const checkpoint=reservation.recovery ? await graph.getState(config) : undefined;
      const pendingInterrupt=checkpoint?.tasks.some(t=>(t.interrupts?.length ?? 0)>0);
      if(reservation.recovery && pendingInterrupt && checkpoint){
        state=(checkpoint.values as {data:RunState}).data ?? state;
        const intr=checkpoint.tasks.flatMap(t=>t.interrupts ?? [])[0];
        const node=checkpoint.next[0] as RunEvent['node'];
        const visit=randomUUID(); if(node) await emit('node_started',{input:state},node,visit);
        await emit('run_interrupted',(intr?.value ?? {kind:'manual_review'}) as Record<string,unknown>,node,visit);
        await connection.query("UPDATE bf_runs SET status='interrupted',state=$2,updated_at=now() WHERE id=$1",[id,JSON.stringify(state)]);
        return;
      }
      const hasCheckpoint=!!(checkpoint?.values as {data?:RunState} | undefined)?.data;
      const value=input ? reservation.recovery && !hasCheckpoint ? {data:state} : reservation.recovery && !pendingInterrupt ? null : input.retry ? null : resumeCommand(input) : {data:state};
      await graph.invoke(value as Parameters<typeof graph.invoke>[0],config);
      const saved=await graph.getState(config);state=(saved.values as {data:RunState}).data ?? state;
      if(saved.next.length){const intr=saved.tasks.flatMap(t=>t.interrupts ?? [])[0];await emit('run_interrupted',(intr?.value ?? {kind:'manual_review'}) as Record<string,unknown>,active.node,active.visit);await connection.query("UPDATE bf_runs SET status='interrupted',state=$2,updated_at=now() WHERE id=$1",[id,JSON.stringify(state)]);}
      else {await emit('run_completed',{card:state.card});await connection.query("UPDATE bf_runs SET status='completed',state=$2,updated_at=now() WHERE id=$1",[id,JSON.stringify(state)]);}
    } catch (cause) {const exhausted=cause instanceof Error && cause.message==='call budget exceeded';await emit('run_failed',{code:exhausted?'CALL_BUDGET_EXHAUSTED':'RUN_FAILED',message:exhausted?'Limite di valutazioni raggiunto.':'Esecuzione non riuscita. Puoi riprovare.',retryable:!exhausted},active.node,active.visit);await connection.query("UPDATE bf_runs SET status='failed',updated_at=now() WHERE id=$1",[id]);}
  } finally {await releaseReservation(id,connection);await cp.end();}
}

