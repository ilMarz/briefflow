import {describe,it,expect,afterEach} from 'vitest';
import {jevLimitReached} from '../../src/server/limit';
import {GET as config} from '../../src/app/api/config/route';
import {POST as start,GET as listRuns} from '../../src/app/api/runs/route';
import {GET as getRun} from '../../src/app/api/runs/[id]/route';
import {POST as resume} from '../../src/app/api/runs/[id]/resume/route';
afterEach(()=>{delete process.env.JEV_LIMIT_REACHED;});
describe('Jev limit switch',()=>{
 it('is off unless explicitly true',()=>{expect(jevLimitReached()).toBe(false);process.env.JEV_LIMIT_REACHED='false';expect(jevLimitReached()).toBe(false);process.env.JEV_LIMIT_REACHED=' TRUE ';expect(jevLimitReached()).toBe(true);process.env.JEV_LIMIT_REACHED='1';expect(jevLimitReached()).toBe(true);});
 it('blocks every live endpoint before any database or Jev access',async()=>{
  process.env.JEV_LIMIT_REACHED='true';
  const params=Promise.resolve({id:'12345678-1234-1234-1234-123456789012'});
  expect((await start(new Request('http://localhost',{method:'POST'}))).status).toBe(503);
  expect((await listRuns(new Request('http://localhost/api/runs'))).status).toBe(503);
  expect((await getRun(new Request('http://localhost'),{params})).status).toBe(503);
  expect((await resume(new Request('http://localhost',{method:'POST'}),{params})).status).toBe(503);
  expect(await (await config()).json()).toEqual({liveAvailable:false,limitReached:true,mailAvailable:false});
 });
});
