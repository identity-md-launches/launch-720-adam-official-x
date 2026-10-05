import { useEffect, useRef, useState } from 'react';
import { createWalletClient, custom, decodeEventLog, type Address, type EIP1193Provider, type Hex } from 'viem';
import { mainnet } from 'viem/chains';
import { addresses } from './config';
import { abis, type Contract } from './contracts';
import { client } from './api';
import { explain } from './logic';
type Provider = EIP1193Provider;
declare global {interface Window {ethereum?:Provider;}}
export function useWallet(onReceipt:()=>void){
 const [account,setAccount]=useState<Address>();const [chain,setChain]=useState<number>();const [busy,setBusy]=useState(false);const [status,setStatus]=useState('');const [hash,setHash]=useState<Hex>();const [error,setError]=useState('');const mutex=useRef(false);
 useEffect(()=>{const p=window.ethereum;if(!p)return;let active=true;const accounts=(v:unknown)=>{if(active)setAccount((v as Address[])[0]);};const chains=(v:unknown)=>{if(active)setChain(Number(v));};p.request({method:'eth_accounts'}).then(accounts).catch(()=>{});p.request({method:'eth_chainId'}).then(chains).catch(()=>{});p.on?.('accountsChanged',accounts);p.on?.('chainChanged',chains);return()=>{active=false;p.removeListener?.('accountsChanged',accounts);p.removeListener?.('chainChanged',chains);};},[]);
 async function connect(){setError('');try{const p=window.ethereum;if(!p)throw Error('No injected wallet found. Open this site in your wallet browser, or install an Ethereum browser wallet, then reload.');setAccount((await p.request({method:'eth_requestAccounts'}))[0]);setChain(Number(await p.request({method:'eth_chainId'})));}catch(e){setError(explain(e));}}
 async function switchChain(){try{await window.ethereum?.request({method:'wallet_switchEthereumChain',params:[{chainId:'0x1'}]});setChain(1);}catch(e){setError(explain(e));}}
 async function run(label:string,action:(send:(c:Contract,fn:string,args?:readonly unknown[])=>Promise<void>,account:Address)=>Promise<void>){
 if(mutex.current)return;mutex.current=true;setBusy(true);setError('');setHash(undefined);setStatus(`${label}: preparing…`);
 try{const p=window.ethereum;if(!p||!account)throw Error('Connect your wallet first.');const acting=account;const ensure=async()=>{const [accounts,id]=await Promise.all([p.request({method:'eth_accounts'}),p.request({method:'eth_chainId'})]);if(Number(id)!==1)throw Error('Switch your wallet to Ethereum mainnet and retry.');if(accounts[0]?.toLowerCase()!==acting.toLowerCase())throw Error('Wallet account changed. Review your balances and retry.');};
 const wallet=createWalletClient({chain:mainnet,transport:custom(p)});
 await ensure();const send=async(c:Contract,fn:string,args:readonly unknown[]=[])=>{await ensure();setStatus(`${label}: checking ${fn}…`);const simulation=await client.simulateContract({account:acting,address:addresses[c],abi:abis[c],functionName:fn,args});if(c==='oracle'&&fn==='submit'&&simulation.result!==true)throw Error('The oracle rejected this report during simulation. It may be stale, already used, or signed for a different domain. Fetch a fresh report.');await ensure();setStatus(`${label}: confirm ${fn} in your wallet`);const tx=await wallet.writeContract(simulation.request);setHash(tx);setStatus(`${label}: waiting for confirmation…`);let replacementReason:string|undefined;const receipt=await client.waitForTransactionReceipt({hash:tx,confirmations:1,timeout:180000,onReplaced:r=>{setHash(r.transaction.hash);if(r.reason!=='repriced')replacementReason=r.reason;}});if(replacementReason)throw Error('Transaction was cancelled or replaced with a different action. Review it on Etherscan before retrying.');if(receipt.status!=='success')throw Error('Transaction reverted. Review the transaction on Etherscan before retrying.');if(c==='oracle'&&!receipt.logs.some(log=>{if(log.address.toLowerCase()!==addresses.oracle.toLowerCase())return false;try{return decodeEventLog({abi:abis.oracle,data:log.data,topics:log.topics}).eventName==='SplitUpdated';}catch{return false;}}))throw Error('Transaction confirmed, but the oracle did not accept the report. Check ReportRejected on Etherscan.');onReceipt();};
 await action(send,acting);setStatus(`${label}: confirmed.`);
 }catch(e){setError(explain(e));setStatus(`${label}: stopped. If a transaction link is shown, check its status before retrying.`);}finally{mutex.current=false;setBusy(false);onReceipt();}
 }
 const dismiss=()=>{if(!mutex.current){setError('');setStatus('');setHash(undefined);}};
 return {account,chain,busy,status,hash,error,connect,switchChain,run,setError,dismiss};
}
