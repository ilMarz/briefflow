import { Pool } from 'pg';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
let pool:Pool | undefined;
export function db(){if(!process.env.DATABASE_URL) throw new Error('database unavailable'); return pool ??= new Pool({connectionString:process.env.DATABASE_URL, max:5});}
export function saver(){if(!process.env.DATABASE_URL) throw new Error('database unavailable'); return PostgresSaver.fromConnString(process.env.DATABASE_URL);}
