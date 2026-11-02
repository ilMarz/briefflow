import { loadEnvConfig } from '@next/env';
import { readdir, readFile } from 'node:fs/promises';
import { db,saver } from '../src/server/db';
async function main(){loadEnvConfig(process.cwd());const files=(await readdir('migrations')).filter(f=>f.endsWith('.sql')).sort();for(const file of files)await db().query(await readFile(`migrations/${file}`,'utf8'));const cp=saver();await cp.setup();await cp.end();await db().end();}
main().catch(()=>{console.error('Migration failed.');process.exitCode=1;});