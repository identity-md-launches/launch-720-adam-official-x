import { parseUnits, formatUnits, type Hex } from 'viem';
export function amountInput(value:string, decimals=18) {
 if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value) || (value.split('.')[1]?.length ?? 0)>decimals) throw Error(`Enter a positive amount with at most ${decimals} decimals.`);
 const amount=parseUnits(value,decimals); if(amount<=0n) throw Error('Enter an amount greater than zero.'); return amount;
}
export function fmt(value:bigint|undefined,decimals=18,digits=4) { if(value===undefined)return '—';const n=Number(formatUnits(value,decimals));return n>0&&n<10**-digits?`< ${10**-digits}`:n.toLocaleString('en-US',{maximumFractionDigits:digits}); }
export function short(value:string) {return `${value.slice(0,6)}…${value.slice(-4)}`;}
export function rankWeights(code:number) { if(![123,132,213,231,312,321].includes(code)) throw Error('Rank code must be one of 123, 132, 213, 231, 312, 321.');return String(code).split('').map(n=>({1:5000,2:3000,3:2000})[Number(n) as 1|2|3]); }
export function minimumOut(out:bigint,slippage:string) {if(!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(slippage))throw Error('Use slippage from 0.1% to 10%, with at most two decimals.');const bps=parseUnits(slippage,2);if(bps<10n||bps>1000n)throw Error('Use slippage from 0.1% to 10%, with at most two decimals.');const min=out*(10000n-bps)/10000n;if(min===0n)throw Error('Quote is too small. Increase the amount.');return min;}
export function nextUnlock(launch:number,deadline:number,now:number) { if(now>=deadline)return 'Claim window closed'; if(now<launch)return new Date(launch*1000).toLocaleString(); const step=Math.floor((now-launch)/86400)+1;return step>=10?'Fully unlocked':new Date((launch+step*86400)*1000).toLocaleString(); }
export function countdown(unlock:number,now:number) {const sec=Math.max(0,unlock-now);return sec?`${Math.floor(sec/3600)}h ${Math.floor(sec%3600/60)}m ${sec%60}s`:'Unlocked';}
function record(value:unknown):Record<string,unknown> {if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Attestation response must be an object.');return value as Record<string,unknown>;}
export function mapAttestation(payload:unknown) {
 const root=record(payload),m=record(root.message??root.attestation);
 const hex=(v:unknown,bytes:number,label:string):Hex=>{if(typeof v!=='string'||!new RegExp(`^0x[0-9a-fA-F]{${bytes*2}}$`).test(v))throw Error(`Invalid ${label}.`);return v as Hex;};
 const integer=(name:string,bits=256)=>{const v=m[name];if((typeof v!=='string'&&typeof v!=='number')||!/^[0-9]+$/.test(String(v))||(typeof v==='number'&&!Number.isSafeInteger(v)))throw Error(`Invalid ${name}.`);const n=BigInt(v);if(n>=1n<<BigInt(bits))throw Error(`${name} exceeds uint${bits}.`);return n;};
 if(m.answerType!=='uint256'&&m.answerType!==3&&m.answerType!=='3')throw Error('The deployed oracle requires answerType uint256 (3).');
 const a={requestId:hex(m.requestId,32,'request ID'),chainId:integer('chainId'),questionHash:hex(m.questionHash,32,'question hash'),answerType:3,answer:hex(m.answer,32,'ABI-encoded answer'),figure:integer('figure'),fromBlock:integer('fromBlock',64),toBlock:integer('toBlock',64),blockHash:hex(m.blockHash,32,'block hash'),panelJobId:hex(m.panelJobId,32,'panel job ID'),panelSize:Number(integer('panelSize',16)),quorum:Number(integer('quorum',16)),agreed:Number(integer('agreed',16)),issuedAt:integer('issuedAt',64),expiresAt:integer('expiresAt',64)};
 if(a.chainId!==1n)throw Error('This report is not for Ethereum mainnet.');
 if(a.fromBlock>a.toBlock||a.panelSize<5||a.quorum<4||a.agreed<a.quorum||a.agreed>a.panelSize)throw Error('Report window or panel consensus is invalid.');
 const code=Number(BigInt(a.answer));const weights=rankWeights(code);
 return {a,signature:hex(root.signature,65,'signature'),code,weights};
}
export function explain(error:unknown) {const e=error as {shortMessage?:string;message?:string;code?:number};if(e?.code===4001||/user rejected|user denied/i.test(e?.message??''))return 'Request declined in your wallet. No new transaction was sent.';return (e?.shortMessage??e?.message??'Request failed. Check your connection and retry.').slice(0,500);}
