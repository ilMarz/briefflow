import { z } from 'zod';

export const NODE_IDS = ['validate','classify','compatibility','manual_review','completeness','select_questions','await_answers','update_state','compose'] as const;
export type NodeId = typeof NODE_IDS[number];
export const TOPOLOGY: {source: NodeId; target: NodeId; label?: string}[] = [
  {source:'validate',target:'classify'},{source:'classify',target:'compatibility'},
  {source:'compatibility',target:'manual_review',label:'Da verificare / fuori ambito'},
  {source:'compatibility',target:'completeness',label:'In linea'},
  {source:'manual_review',target:'compose',label:'Chiudi'},
  {source:'manual_review',target:'completeness',label:'Prosegui'},
  {source:'completeness',target:'compose',label:'Completa / limite raggiunto'},
  {source:'completeness',target:'select_questions',label:'Informazioni mancanti'},
  {source:'select_questions',target:'await_answers'},
  {source:'await_answers',target:'update_state'},
  {source:'update_state',target:'completeness'}
];
export const NODE_LABELS: Record<NodeId,string> = {validate:'Valida input',classify:'Classifica richiesta',compatibility:'Valuta compatibilità',manual_review:'Revisione manuale',completeness:'Verifica completezza',select_questions:'Seleziona domande',await_answers:'Attendi risposte',update_state:'Aggiorna stato',compose:'Componi scheda'};
export const FieldSchema = z.enum(['budget','users','deadline','integrations']);
export type FieldId = z.infer<typeof FieldSchema>;
export const QUESTIONS: Record<FieldId,string> = {budget:'Qual è la fascia di budget?',users:'Quante persone useranno il servizio?',deadline:'Qual è la scadenza prevista?',integrations:'Quale gestionale o sistema deve essere integrato?'};
/** Closed answers for each clarification question; `default` is preselected in the form. */
export const CUSTOM_ANSWER_MAX = 80;
export const FIELD_OPTIONS: Record<FieldId,{options:readonly string[];default:string;custom?:{button:string;placeholder:string}}> = {
  budget:{options:['Fino a 20.000 €','20.000 – 50.000 €','50.000 – 100.000 €','Oltre 100.000 €','Da definire'],default:'20.000 – 50.000 €'},
  users:{options:['Fino a 10 persone','11 – 50 persone','51 – 200 persone','Oltre 200 persone'],default:'11 – 50 persone'},
  deadline:{options:['Entro 1 mese','1 – 3 mesi','3 – 6 mesi','Oltre 6 mesi','Nessuna scadenza'],default:'3 – 6 mesi'},
  integrations:{options:['SAP','Salesforce','Microsoft Dynamics','Zucchetti','Altro gestionale','Nessuna integrazione'],default:'Altro gestionale',custom:{button:'Aggiungi gestionale',placeholder:'Nome del gestionale'}},
};
export const ProfileSchema =z.object({id:z.string().default('consulting'),version:z.number().int().positive().default(1),name:z.string().min(1).max(120),services:z.array(z.string().min(1).max(160)).min(1).max(12),categories:z.array(z.string().min(1).max(100)).min(2).max(12),categoryHints:z.record(z.string(),z.string().max(300)).optional(),criteria:z.string().min(1).max(2000),requiredFields:z.array(FieldSchema).min(1).max(4),confidenceThreshold:z.number().min(0).max(1),presenceThreshold:z.number().min(0).max(1)});
export type CompanyProfile = z.infer<typeof ProfileSchema>;
export const DEFAULT_PROFILE: CompanyProfile = {id:'consulting',version:1,name:'ACME IT',services:['Applicazioni aziendali','Portali web','Integrazioni software'],categories:['Applicazione aziendale','Portale web','Integrazione software','Altro'],categoryHints:{'Applicazione aziendale':'strumento interno per processi, dipendenti o tecnici, anche con funzioni mobili/offline e gestionali','Portale web':'sito o portale pubblico per clienti, utenti esterni o contenuti online','Integrazione software':'collegamento di sistemi esistenti tramite API o sincronizzazione dati, senza una nuova interfaccia','Altro':'richiesta non di sviluppo software, per esempio marketing, hardware o edilizia'},criteria:'Realizziamo software su misura e integrazioni per aziende. Non vendiamo hardware, campagne marketing o servizi di edilizia.',requiredFields:['budget','users','deadline','integrations'],confidenceThreshold:0.65,presenceThreshold:0.7};
export type Compatibility = 'in_scope'|'out_of_scope'|'uncertain';
export interface FinalCard {category:string;compatibility:Compatibility;missing:FieldId[];constraints:string[];ambiguities:string[];answers:Partial<Record<FieldId,string>>;nextAction:'request_clarifications'|'manual_review'|'ready_for_review'|'closed_out_of_scope';summary:string;profileVersion:number;model:string;clarificationRound:number;brief?:string;profileName?:string;requiredFields?:FieldId[];jevCalls?:number}
export interface RunState {brief:string;profile:CompanyProfile;category:string;compatibility:Compatibility;missing:FieldId[];constraints:string[];ambiguities:string[];answers:Partial<Record<FieldId,string>>;questions:FieldId[];clarificationRound:number;manualDecision?:'continue'|'close';card?:FinalCard;model:string;calls:number;contactEmail?:string}
export const EventTypeSchema=z.enum(['node_started','node_completed','state_updated','route_selected','run_interrupted','run_completed','run_failed']);
const eventPayloads = {
  node_started:z.object({input:z.record(z.string(),z.unknown())}),
  node_completed:z.object({output:z.record(z.string(),z.unknown()),duration_ms:z.number().finite().nonnegative()}),
  state_updated:z.object({patch:z.record(z.string(),z.unknown())}),
  route_selected:z.object({source:z.enum(NODE_IDS),target:z.enum(NODE_IDS)}),
  run_interrupted:z.object({kind:z.enum(['answers','manual_review']),questions:z.array(FieldSchema).optional()}),
  run_completed:z.object({card:z.object({category:z.string(),compatibility:z.enum(['in_scope','out_of_scope','uncertain']),missing:z.array(FieldSchema),constraints:z.array(z.string()),ambiguities:z.array(z.string()),answers:z.partialRecord(FieldSchema,z.string()),nextAction:z.enum(['request_clarifications','manual_review','ready_for_review','closed_out_of_scope']),summary:z.string(),profileVersion:z.number().int().positive(),model:z.string(),clarificationRound:z.number().int().min(0).max(2),brief:z.string().optional(),profileName:z.string().optional(),requiredFields:z.array(FieldSchema).optional(),jevCalls:z.number().int().nonnegative().optional()})}),
  run_failed:z.object({code:z.string(),message:z.string(),retryable:z.boolean()})
};
export const EventSchema=z.object({id:z.string().min(1),run_id:z.string().min(1),seq:z.number().int().positive(),timestamp:z.iso.datetime(),type:EventTypeSchema,node:z.enum(NODE_IDS).optional(),visit_id:z.string().optional(),payload:z.record(z.string(),z.unknown())}).superRefine((event,context)=>{
  const result=eventPayloads[event.type].safeParse(event.payload);
  if(!result.success)context.addIssue({code:'custom',path:['payload'],message:'Payload non valido per il tipo di evento.'});
  if(['node_started','node_completed','state_updated'].includes(event.type)&&(!event.node||!event.visit_id))context.addIssue({code:'custom',path:['node'],message:'Nodo e visita obbligatori.'});
  if(event.type==='route_selected'&&!TOPOLOGY.some(edge=>edge.source===event.payload.source&&edge.target===event.payload.target))context.addIssue({code:'custom',path:['payload'],message:'Percorso non presente nella topologia.'});
});
export type RunEvent=z.infer<typeof EventSchema>;
export type RunStatus='running'|'interrupted'|'completed'|'failed';
export interface RunSummary {id:string;status:RunStatus;createdAt:string;updatedAt:string;brief:string;category:string;compatibility:Compatibility|null;nextAction:FinalCard['nextAction']|null;clarificationRound:number;jevCalls:number;email:string|null}
export interface RunSnapshot {id:string;status:RunStatus;state:RunState;events:RunEvent[];createdAt:string;updatedAt:string}
export const StartSchema=z.object({brief:z.string().trim().min(15).max(12000),profile:ProfileSchema.default(DEFAULT_PROFILE),requestId:z.string().uuid(),email:z.string().trim().max(254).pipe(z.email())});
export const ResumeSchema=z.object({requestId:z.string().uuid(),answers:z.partialRecord(FieldSchema,z.string().trim().min(1).max(500)).optional(),decision:z.enum(['continue','close']).optional(),retry:z.boolean().optional()}).superRefine((input,context)=>{
  for(const [field,value] of Object.entries(input.answers??{}) as [FieldId,string][])
    if(!FIELD_OPTIONS[field].options.includes(value)&&!(FIELD_OPTIONS[field].custom&&value.length<=CUSTOM_ANSWER_MAX))context.addIssue({code:'custom',path:['answers',field],message:'Risposta non tra le opzioni previste.'});
});
export type ResumeInput=z.infer<typeof ResumeSchema>;
export interface ApiError {error:{code:string;message:string;retryable:boolean}}
