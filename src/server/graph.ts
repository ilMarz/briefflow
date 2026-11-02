import { Annotation, StateGraph, START, END, interrupt, Command, type BaseCheckpointSaver } from '@langchain/langgraph';
import { randomUUID } from 'node:crypto';
import { TOPOLOGY, type RunState, type NodeId, type RunEvent, type ResumeInput } from '../shared/contracts';
import type { DecisionClient } from './jev';

const State = Annotation.Root({data:Annotation<RunState>()});
export type Emit = (type:RunEvent['type'], payload:Record<string,unknown>, node?:NodeId, visit?:string)=>Promise<void>;
export function createRunGraph(client:DecisionClient, checkpointer:BaseCheckpointSaver, emit:Emit, beforeCall?:()=>Promise<void>) {
  const wrap=(node:NodeId, fn:(s:RunState)=>Promise<Partial<RunState>>|Partial<RunState>)=>async ({data}: {data:RunState})=>{
    const visit=randomUUID(), start=Date.now();
    const input:Partial<RunState>={...data};delete input.contactEmail;await emit('node_started',{input},node,visit);
    const patch=await fn(data);
    const next={...data,...patch};
    await emit('node_completed',{output:patch,duration_ms:Date.now()-start},node,visit);
    await emit('state_updated',{patch},node,visit);
    const linear:Partial<Record<NodeId,NodeId>>={validate:'classify',classify:'compatibility',select_questions:'await_answers',await_answers:'update_state',update_state:'completeness'};
    if(linear[node]) await emit('route_selected',{source:node,target:linear[node]});
    return {data:next};
  };
  const route=async (source:NodeId,target:NodeId)=>{const edge=TOPOLOGY.find(e=>e.source===source&&e.target===target); await emit('route_selected',{source,target,...(edge?.label?{label:edge.label}:{})}); return target;};
  const call=async <T>(s:RunState, fn:()=>Promise<T>)=>{if(s.calls>=5) throw new Error('call budget exceeded'); if(beforeCall) await beforeCall(); return fn();};
  const graph=new StateGraph(State)
    .addNode('validate',wrap('validate',s=>({brief:s.brief.trim()})))
    .addNode('classify',wrap('classify',async s=>({...await call(s,()=>client.classify(s)),calls:s.calls+1})))
    .addNode('compatibility',wrap('compatibility',async s=>{const result=await call(s,()=>client.compatibility(s));return {...result,compatibility:s.category==='Da verificare'?'uncertain':result.compatibility,calls:s.calls+1};}))
    .addNode('manual_review',wrap('manual_review',()=>({manualDecision:interrupt({kind:'manual_review'}) as 'continue'|'close'})))
    .addNode('completeness',wrap('completeness',async s=>({...await call(s,()=>client.completeness(s)),calls:s.calls+1})))
    .addNode('select_questions',wrap('select_questions',s=>({questions:s.missing})))
    .addNode('await_answers',wrap('await_answers',s=>({answers:{...s.answers,...interrupt({kind:'answers',questions:s.questions}) as Record<string,string>}})))
    .addNode('update_state',wrap('update_state',s=>({clarificationRound:s.clarificationRound+1,questions:[]})))
    .addNode('compose',wrap('compose',s=>({card:{category:s.category,compatibility:s.compatibility,missing:s.missing,constraints:s.constraints,ambiguities:s.ambiguities,answers:s.answers,nextAction:s.manualDecision==='close'?'closed_out_of_scope':s.missing.length?'request_clarifications':'ready_for_review',summary:s.manualDecision==='close'?'Richiesta chiusa dopo revisione manuale.':s.missing.length?'Restano informazioni da chiarire.':'Informazioni pronte per la revisione.',profileVersion:s.profile.version,model:s.model,clarificationRound:s.clarificationRound,brief:s.brief.slice(0,800),profileName:s.profile.name,requiredFields:s.profile.requiredFields,jevCalls:s.calls}})))
    .addEdge(START,'validate').addEdge('validate','classify').addEdge('classify','compatibility')
    .addConditionalEdges('compatibility',({data})=>route('compatibility',data.compatibility==='in_scope'?'completeness':'manual_review'),['completeness','manual_review'])
    .addConditionalEdges('manual_review',({data})=>route('manual_review',data.manualDecision==='close'?'compose':'completeness'),['compose','completeness'])
    .addConditionalEdges('completeness',({data})=>route('completeness',data.missing.length && data.clarificationRound<2?'select_questions':'compose'),['select_questions','compose'])
    .addEdge('select_questions','await_answers').addEdge('await_answers','update_state').addEdge('update_state','completeness').addEdge('compose',END);
  return graph.compile({checkpointer});
}
export function initialState(brief:string,profile:RunState['profile'],contactEmail?:string):RunState {return {brief,profile,...(contactEmail?{contactEmail}:{}),category:'',compatibility:'uncertain',missing:[],constraints:[],ambiguities:[],answers:{},questions:[],clarificationRound:0,model:'jev-latest',calls:0};}
export function resumeCommand(input:ResumeInput) {return new Command({resume:input.decision ?? input.answers});}

