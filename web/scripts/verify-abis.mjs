import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const dir=new URL('../src/abi/',import.meta.url);
const entries=JSON.parse(await fs.readFile(new URL('provenance.json',dir),'utf8'));
for(const e of entries){const bytes=await fs.readFile(new URL(`${e.name}.json`,dir));if(createHash('sha256').update(bytes).digest('hex')!==e.sha256)throw Error(`${e.name}: local ABI hash mismatch`);if(process.argv.includes('--online')){const response=await fetch(e.url,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error(`${e.name}: Sourcify HTTP ${response.status}`);const verified=await response.json();if(JSON.stringify(verified.abi)!==JSON.stringify(JSON.parse(bytes)))throw Error(`${e.name}: verified ABI differs`);}console.log(`${e.name}: verified provenance hash OK`);}
