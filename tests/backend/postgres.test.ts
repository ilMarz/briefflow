import { describe,it,expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { DEFAULT_PROFILE,type RunEvent } from '../../src/shared/contracts';
import type { DecisionClient } from '../../src/server/jev';

describe.skipIf(!process.env.TEST_DATABASE_URL)('Postgres persistence',()=>{
 it('persists interrupts, rejects concurrent execution, and resumes once',async()=>{
  process.env.DATABASE_URL=process.env.TEST_DATABASE_URL;
  const {db,saver}=await import('../../src/server/db');const {startRun,reserve,execute,snapshot,releaseReservation}=await import('../../src/server/runs');
  await db().query(await readFile('migrations/001_initial.sql','utf8'));const cp=saver();await cp.setup();
  let calls=0;const fake:DecisionClient={async classify(){calls++;return {category:'Portale web'};},async compatibility(){calls++;return {compatibility:'in_scope',constraints:[],ambiguities:[]};},async completeness(s){calls++;return {missing:s.answers.budget?[]:['budget']};}};
  const {id}=await startRun('Un brief sintetico sufficientemente lungo',DEFAULT_PROFILE,randomUUID());
  try {const events:RunEvent[]=[];const lock=await reserve(id);await expect(reserve(id)).rejects.toThrow('busy');await execute(id,undefined,e=>events.push(e),lock,fake);expect((await snapshot(id))?.status).toBe('interrupted');expect(calls).toBe(3);
   const requestId=randomUUID(),input={requestId,answers:{budget:'50000'}};const resumed=await reserve(id,input);await execute(id,input,e=>events.push(e),resumed,fake);expect((await snapshot(id))?.status).toBe('completed');expect(calls).toBe(4);const duplicate=await reserve(id,input);expect(duplicate.duplicate).toBe(true);await releaseReservation(id,duplicate.connection);const persisted=await snapshot(id);expect(persisted?.events.map(e=>e.seq)).toEqual(persisted?.events.map((_,i)=>i+1));
  } finally {await cp.deleteThread(id);await cp.end();await db().query('DELETE FROM bf_decisions WHERE run_id=$1',[id]);await db().query('DELETE FROM bf_events WHERE run_id=$1',[id]);await db().query('DELETE FROM bf_requests WHERE run_id=$1',[id]);await db().query('DELETE FROM bf_runs WHERE id=$1',[id]);await db().end();}
 });
});
