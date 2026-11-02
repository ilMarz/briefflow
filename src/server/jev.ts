import { choice, noul, score, TypeSafeClient } from '@typesafe-ai/sdk';
import type { RunState, FieldId, Compatibility } from '../shared/contracts';

export interface DecisionClient {
  classify(s: RunState): Promise<{category:string;model?:string}>;
  compatibility(s: RunState): Promise<{compatibility:Compatibility; constraints:string[]; ambiguities:string[]}>;
  completeness(s: RunState): Promise<{missing:FieldId[]}>;
}
const context = (s:RunState) => JSON.stringify({brief:s.brief, answers:s.answers, profile:s.profile});
export function createJev(): DecisionClient {
  const client = new TypeSafeClient({defaultModel:'jev-latest',retry:{maxRetries:0},timeout:15000,logLevel:'error'});
  return {
    async classify(s) {
      const criteria = Object.fromEntries(s.profile.categories.map((v,i)=>[`c${i}`,s.profile.categoryHints?.[v] ? `${v}: ${s.profile.categoryHints[v]}` : v]));
      const r = await client.systemOne({state:context(s), questions:{category:choice('Select the best matching configured project category',criteria)}});
      const a = r.answers.category;
      const index = Number(a.choice?.slice(1));
      return {model:r.model,category: a.confidence >= s.profile.confidenceThreshold && Number.isInteger(index) && s.profile.categories[index] ? s.profile.categories[index] : 'Da verificare'};
    },
    async compatibility(s) {
      const r = await client.systemOne({model:s.model,state:context(s),questions:{fit:choice('Evaluate fit against the company criteria', {in_scope:'Clearly fits the services and criteria',out_of_scope:'Clearly outside the services and criteria',uncertain:'Insufficient information or ambiguous fit'}),offline:noul('The request explicitly requires offline operation'),ambiguous:score('Assess ambiguity against the company criteria',['Clear request and criteria','Some material ambiguity','Highly ambiguous request or criteria'])}});
      const a=r.answers.fit;
      return {compatibility: a.confidence >= s.profile.confidenceThreshold && ['in_scope','out_of_scope','uncertain'].includes(a.choice) ? a.choice as Compatibility : 'uncertain', constraints:r.answers.offline.noul >= s.profile.presenceThreshold ? ['Lavoro offline'] : [], ambiguities:r.answers.ambiguous.score >= 1 && r.answers.ambiguous.confidence >= s.profile.confidenceThreshold ? ['Criteri da approfondire'] : []};
    },
    async completeness(s) {
      const r=await client.systemOne({model:s.model,state:context(s),questions:{budget:noul('A budget amount or range is explicitly specified'),users:noul('The number of users is explicitly specified'),deadline:noul('A project deadline is explicitly specified'),integrations:noul('The specific integration system is explicitly identified')}});
      return {missing:s.profile.requiredFields.filter(f=>!s.answers[f] && !(r.answers[f].noul >= s.profile.presenceThreshold))};
    }
  };
}


