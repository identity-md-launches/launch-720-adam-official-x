import {snapshot,read,marketData,feeTotal,client} from '../src/api';
import {mapAttestation} from '../src/logic';
import {addresses,links} from '../src/config';
import {abis} from '../src/contracts';
const data=await snapshot();
console.log(JSON.stringify({snapshot:data,market:await marketData().catch(e=>({error:e.message})),relayer:await read('oracle','relayer'),fees:await feeTotal(data.block,()=>{})},(_,v)=>typeof v==='bigint'?v.toString():v,2));
const requestId=process.argv[2];
if(requestId){if(!/^[a-fA-F0-9-]{36}$/.test(requestId))throw Error('Use a request UUID.');const response=await fetch(`${links.api}/${requestId}/attestation`);if(!response.ok)throw Error(`HTTP ${response.status}`);const report=mapAttestation(await response.json());const simulation=await client.simulateContract({account:addresses.relayer,address:addresses.oracle,abi:abis.oracle,functionName:'submit',args:[report.a,report.signature]});console.log({code:report.code,weights:report.weights,domain:await read('oracle','domainVerifyingContract'),accepted:simulation.result});}
