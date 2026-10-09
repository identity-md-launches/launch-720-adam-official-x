import type { Address, AbiEvent, PublicClient } from 'viem';
import { addresses, RPC_URLS, POOL_ID, LP_ID, collections, rewards, HOOK_DEPLOY_BLOCK, links } from './config';
import { abis, type Contract } from './contracts';
// viem and the mainnet chain definition load lazily so the first paint does not wait for the EVM bundle. Same RPC fallbacks and batching as before.
let lib:Promise<typeof import('viem')>|undefined;export const viem=()=>lib??=import('viem');
let clientPromise:Promise<PublicClient>|undefined;
export const getClient=()=>clientPromise??=(async()=>{const {createPublicClient,fallback,http}=await viem();const {mainnet}=await import('viem/chains');return createPublicClient({chain:mainnet,transport:fallback(RPC_URLS.map(url=>http(url,{timeout:12000,retryCount:1})),{rank:false}),batch:{multicall:{batchSize:8192}}}) as PublicClient;})();
export async function read<T>(contract:Contract,fn:string,args:readonly unknown[]=[],blockNumber?:bigint):Promise<T> {const client=await getClient();return await client.readContract({address:addresses[contract],abi:abis[contract],functionName:fn,args,blockNumber}) as T;}
export type Snapshot={block:bigint;time:number;split:[number[],string,string,number];staked:bigint;owner:Address;launch:number;deadline:number;fee:number;direct:boolean;maxClaim:bigint;distributed:bigint[];decimals:number[];budgetDistributed:bigint;priceEth:number;unsplit:bigint;availableAt:number};
export async function snapshot():Promise<Snapshot> {
 const client=await getClient();
 if(await client.getChainId()!==1)throw Error('RPC chain mismatch. Expected Ethereum mainnet.');
 const block=await client.getBlock();const b=block.number;
 const r=<T>(c:Contract,f:string,a:readonly unknown[]=[])=>read<T>(c,f,a,b);
 const [split,staked,owner,launch,deadline,fee,direct,maxClaim,distributed,decimals,budgetDistributed,slot,unsplit,last,cooldown]=await Promise.all([
 r<Snapshot['split']>('oracle','currentSplit'),r<bigint>('staking','totalStaked'),r<Address>('position','ownerOf',[LP_ID]),r<bigint>('claim','launch'),r<bigint>('claim','deadline'),r<bigint>('hook','currentFeeBps'),r<boolean>('staking','directDistribution'),r<bigint>('staking','maxEthPerClaim'),Promise.all(rewards.map(t=>r<bigint>('staking','totalDistributed',[t.address]))),Promise.all(rewards.map(t=>client.readContract({address:t.address,abi:abis.token,functionName:'decimals',blockNumber:b}) as Promise<number>)),r<bigint>('staking','totalDistributed',[addresses.zero]),r<[bigint,number,number,number]>('stateView','getSlot0',[POOL_ID]),r<bigint>('treasury','unsplitEth'),r<bigint>('treasury','lastProcessed'),r<number>('treasury','cooldown')]);
 return {block:b,time:Number(block.timestamp),split,staked,owner,launch:Number(launch),deadline:Number(deadline),fee:Number(fee),direct,maxClaim,distributed,decimals,budgetDistributed,priceEth:slot[0]>0n?1/(Number(slot[0])/2**96)**2:0,unsplit,availableAt:Number(last)+Number(cooldown)};
}
export type WalletData={balance:bigint;staked:bigint;unlock:number;earned:bigint[];budget:bigint;keeper:bigint;account:Address};
export async function walletData(account:Address):Promise<WalletData> {const [balance,staked,unlock,earned,budget,keeper]=await Promise.all([read<bigint>('token','balanceOf',[account]),read<bigint>('staking','stakedBalance',[account]),read<bigint>('staking','unlockTime',[account]),Promise.all(rewards.map(t=>read<bigint>('staking','earned',[account,t.address]))),read<bigint>('staking','earned',[account,addresses.zero]),read<bigint>('treasury','keeperOwed',[account])]);return {balance,staked,unlock:Number(unlock),earned,budget,keeper,account};}
export type Nft={collection:number;id:number;share:bigint;claimed:bigint;claimable:bigint};
export async function scanNfts(account:Address,progress:(n:number)=>void,signal:AbortSignal):Promise<Nft[]> {
 const client=await getClient();const {encodeFunctionData,decodeFunctionResult}=await viem();
 const owned:{collection:number;id:number}[]=[];let done=0;const blockNumber=await client.getBlockNumber();
 for(const collection of collections){
  for(let start=collection.first;start<collection.first+collection.count;start+=80){
   if(signal.aborted)throw Error('Scan cancelled.');
   const ids=Array.from({length:Math.min(80,collection.first+collection.count-start)},(_,i)=>start+i);
   const calls=ids.map(id=>({target:collection.address,allowFailure:true,callData:encodeFunctionData({abi:abis[collection.key],functionName:'ownerOf',args:[BigInt(id)]})}));
   // Transport/aggregate failures throw. Only ownerOf reverts are treated as absent NFTs.
   const result=await read<{success:boolean;returnData:`0x${string}`}[]>('multicall','aggregate3',[calls],blockNumber);
   result.forEach((r,i)=>{if(r.success){const owner=decodeFunctionResult({abi:abis[collection.key],functionName:'ownerOf',data:r.returnData}) as string;if(owner.toLowerCase()===account.toLowerCase())owned.push({collection:collection.id,id:ids[i]});}});
   done+=ids.length;progress(done);
  }
 }
 const result:Nft[]=[];
 for(let start=0;start<owned.length;start+=30){if(signal.aborted)throw Error('Scan cancelled.');const chunk=await Promise.all(owned.slice(start,start+30).map(async n=>{const args=[n.collection,BigInt(n.id)];const [share,claimed,claimable]=await Promise.all(['share','claimed','claimable'].map(fn=>read<bigint>('claim',fn,args)));return {...n,share,claimed,claimable};}));result.push(...chunk);}
 return result;
}
export async function marketData(){const response=await fetch(links.market,{signal:AbortSignal.timeout(12000)});if(!response.ok)throw Error('Market data unavailable.');const data=await response.json();const pair=data.pairs?.find((p:{chainId:string;pairAddress:string;baseToken:{address:string}})=>p.chainId==='ethereum'&&p.pairAddress.toLowerCase()===POOL_ID.toLowerCase()&&p.baseToken.address.toLowerCase()===addresses.token.toLowerCase());if(!pair)throw Error('This hooked pool is not indexed by DexScreener yet.');return {usd:pair.priceUsd?Number(pair.priceUsd):undefined,liquidity:pair.liquidity?.usd as number|undefined};}
export async function feeTotal(toBlock:bigint,progress:(n:string)=>void){const client=await getClient();const event=abis.hook.find(x=>x.type==='event'&&x.name==='FeeTaken') as AbiEvent;let total=0n;for(let start=HOOK_DEPLOY_BLOCK;start<=toBlock;start+=2000n){const end=start+1999n>toBlock?toBlock:start+1999n;const logs=await client.getLogs({address:addresses.hook,event,fromBlock:start,toBlock:end,strict:true});for(const log of logs)total+=(log.args as unknown as {fee:bigint}).fee;progress(`${end} / ${toBlock}`);}return total;}
export async function claimProgress(progress:(n:number)=>void){const client=await getClient();let total=0n;const b=await client.getBlockNumber();let done=0;for(const c of collections){for(let start=c.first;start<c.first+c.count;start+=100){const ids=Array.from({length:Math.min(100,c.first+c.count-start)},(_,i)=>start+i);const result=await client.multicall({contracts:ids.map(id=>({address:addresses.claim,abi:abis.claim,functionName:'claimed',args:[c.id,BigInt(id)]})),blockNumber:b,allowFailure:false});for(const value of result)total+=value as bigint;done+=ids.length;progress(done);}}return {total,block:b};}
