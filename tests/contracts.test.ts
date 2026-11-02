import {it,expect} from 'vitest';
import {EventSchema,ResumeSchema} from '../src/shared/contracts';
const base={id:'event-1',run_id:'run-1',seq:1,timestamp:'2026-11-01T10:00:00.000Z'};
it('validates payload and rejects invented routes and missing visits',()=>{
 expect(EventSchema.safeParse({...base,type:'route_selected',payload:{source:'validate',target:'compose'}}).success).toBe(false);
 expect(EventSchema.safeParse({...base,type:'node_completed',node:'validate',payload:{output:{},duration_ms:1}}).success).toBe(false);
 expect(EventSchema.safeParse({...base,type:'node_completed',node:'validate',visit_id:'v1',payload:{output:{},duration_ms:-1}}).success).toBe(false);
 expect(EventSchema.safeParse({...base,type:'route_selected',payload:{source:'validate',target:'classify'}}).success).toBe(true);
});
it('accepts subset questionnaire fields and rejects unknown fields',()=>{
 const requestId='01c04126-d657-4375-9c65-d174780d025b';
 expect(ResumeSchema.safeParse({requestId,answers:{budget:'20.000 – 50.000 €'}}).success).toBe(true);
 expect(ResumeSchema.safeParse({requestId,answers:{budget:'50.000'}}).success).toBe(false);
 expect(ResumeSchema.safeParse({requestId,answers:{integrations:'Odoo'}}).success).toBe(true);
 expect(ResumeSchema.safeParse({requestId,answers:{integrations:'x'.repeat(81)}}).success).toBe(false);
 expect(ResumeSchema.safeParse({requestId,answers:{password:'private'}}).success).toBe(false);
});
