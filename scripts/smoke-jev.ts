import { loadEnvConfig } from '@next/env';
import { createJev } from '../src/server/jev';
import { initialState } from '../src/server/graph';
import { DEFAULT_PROFILE } from '../src/shared/contracts';
async function main(){loadEnvConfig(process.cwd());
if(!process.env.TYPESAFE_API_KEY) throw new Error('TYPESAFE_API_KEY is required');
const result=await createJev().classify(initialState('Un portale aziendale per gestire interventi dei tecnici.',DEFAULT_PROFILE));
console.log(JSON.stringify(result));

}
main().catch(()=>{console.error('Jev smoke test failed.');process.exitCode=1;});

