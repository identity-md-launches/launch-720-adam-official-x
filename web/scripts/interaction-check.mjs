// All wallet and RPC responses in this test are fixtures. No real transaction is signed or sent.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {decodeFunctionData,encodeFunctionResult,encodeAbiParameters,encodeEventTopics} from 'viem';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const config=await fs.readFile(path.join(root,'web/src/config.ts'),'utf8');
const address=Object.fromEntries([...config.matchAll(/(\w+):'(0x[0-9a-fA-F]{40})'/g)].map(m=>[m[1],m[2]]));
const names=['token','oracle','staking','claim','treasury','hook','position','stateView','multicall','imdNft','pepeNft'];
const abis=Object.fromEntries(await Promise.all(names.map(async n=>[n,JSON.parse(await fs.readFile(path.join(root,`web/src/abi/${n}.json`),'utf8'))])));
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.woff2':'font/woff2','.txt':'text/plain','.mp4':'video/mp4','.webm':'video/webm'};
const server=http.createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname.replace(/^\/preview\//,'');const file=path.resolve(root,'dist',name||'index.html');if(!file.startsWith(path.join(root,'dist')+path.sep))throw Error();res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream'}).end(await fs.readFile(file));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1280,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
const now=Math.floor(Date.now()/1000),unit=10n**18n,zero='0x'+'0'.repeat(64),blockHash='0x'+'ab'.repeat(32);
const state={locked:false,allowance:0n,oracleValid:true,simulateFailure:false};const writes=[];const ownerCalls=new Set();
await page.addInitScript(({user})=>{let account,chain='0xaa36a7';const listeners={};window.fixtureWallet={sent:[],reject:false,change:(next)=>{account=next;listeners.accountsChanged?.forEach(fn=>fn(next?[next]:[]));}};window.ethereum={on:(event,fn)=>(listeners[event]??=[]).push(fn),removeListener:(event,fn)=>{listeners[event]=(listeners[event]??[]).filter(f=>f!==fn);},request:async({method,params})=>{if(method==='eth_accounts')return account?[account]:[];if(method==='eth_requestAccounts'){account=user;return [account];}if(method==='eth_chainId')return chain;if(method==='wallet_switchEthereumChain'){chain='0x1';listeners.chainChanged?.forEach(fn=>fn(chain));return null;}if(method==='eth_sendTransaction'){if(window.fixtureWallet.reject)throw {code:4001,message:'User rejected request'};window.fixtureWallet.sent.push(params[0]);return '0x'+window.fixtureWallet.sent.length.toString(16).padStart(64,'0');}throw Error('Unexpected wallet method: '+method);}};},{user:address.dead});
function call(to,data){const key=names.find(k=>address[k].toLowerCase()===to.toLowerCase())??'token';const abi=abis[key];const decoded=decodeFunctionData({abi,data});const fn=decoded.functionName,args=decoded.args??[];let value;
 if(fn==='aggregate3'){value=args[0].map(c=>({success:true,returnData:call(c.target,c.callData)}));}
 else if(fn==='currentSplit')value=[[3000,5000,2000],blockHash,'0x'+(213).toString(16).padStart(64,'0'),1];
 else if(fn==='getSlot0')value=[2n**96n,0,0,0];
 else if(fn==='ownerOf'){if(key==='position')value=address.dead;else{ownerCalls.add(`${key}:${args[0]}`);value=(key==='imdNft'&&[0n,1999n].includes(args[0]))||(key==='pepeNft'&&[1n,1178n].includes(args[0]))?address.dead:address.relayer;}}
 else if(fn==='launch')value=BigInt(now-86400*2);
 else if(fn==='deadline')value=BigInt(now+86400*30);
 else if(fn==='currentFeeBps')value=150n;
 else if(fn==='directDistribution')value=true;
 else if(fn==='maxEthPerClaim')value=unit;
 else if(fn==='decimals')value=18;
 else if(fn==='totalDistributed')value=15n*unit;
 else if(fn==='totalStaked')value=1000n*unit;
 else if(fn==='balanceOf')value=100n*unit;
 else if(fn==='stakedBalance')value=50n*unit;
 else if(fn==='unlockTime')value=BigInt(state.locked?now+86400:now-1);
 else if(fn==='earned')value=args[1].toLowerCase()===address.zero.toLowerCase()?unit/10n:2n*unit;
 else if(fn==='allowance')value=state.allowance;
 else if(fn==='keeperOwed')value=unit/100n;
 else if(fn==='unsplitEth')value=unit;
 else if(fn==='lastProcessed')value=BigInt(now-10000);
 else if(fn==='cooldown')value=600;
 else if(fn==='share')value=50000n*unit;
 else if(fn==='claimed')value=5000n*unit;
 else if(fn==='claimable')value=10000n*unit;
 else if(fn==='claimIMDSTR')value=12345n*unit;
 else if(fn==='submit')value=state.oracleValid;
 else if(['approve','stake','unstake','exit','claimReward','claim','claimAndStake','process','claimKeeper'].includes(fn)){if(state.simulateFailure)throw Error('Simulation rejected');value=fn==='approve'?true:undefined;}
 else throw Error('Unimplemented fixture '+key+'.'+fn);
 return encodeFunctionResult({abi,functionName:fn,result:value});
}
const block={number:'0x18c28c0',hash:blockHash,parentHash:zero,timestamp:'0x'+now.toString(16),gasLimit:'0x1c9c380',gasUsed:'0x0',baseFeePerGas:'0x1',difficulty:'0x0',totalDifficulty:'0x0',size:'0x0',nonce:'0x0000000000000000',miner:address.zero,extraData:'0x',transactions:[],uncles:[],logsBloom:'0x'+'0'.repeat(512),sha3Uncles:zero,stateRoot:zero,transactionsRoot:zero,receiptsRoot:zero,mixHash:zero};
await page.route(/^https:\/\//,async route=>{const req=route.request();if(req.url().includes('dexscreener')){await route.fulfill({json:{pairs:[{chainId:'ethereum',pairAddress:config.match(/POOL_ID: Hex = '(.*?)'/)[1],baseToken:{address:address.token},priceUsd:'0.001',liquidity:{usd:50000}}]}});return;}
 if(req.url().includes('/attestation')){const id=req.url().split('/').at(-2);const payload={requestId:id,message:{requestId:'0x'+id.replaceAll('-','').padEnd(64,'0'),chainId:1,questionHash:blockHash,answerType:'uint256',answer:encodeAbiParameters([{type:'uint256'}],[213n]),figure:'213',fromBlock:1,toBlock:2,blockHash,panelJobId:blockHash,panelSize:5,quorum:4,agreed:4,issuedAt:now-10,expiresAt:now+1000},signature:'0x'+'22'.repeat(65)};await route.fulfill({json:payload});return;}
 const payload=req.postDataJSON();const handle=async q=>{let result;try{if(q.method==='eth_call')result=call(q.params[0].to,q.params[0].data);else if(q.method==='eth_chainId')result='0x1';else if(q.method==='eth_blockNumber')result=block.number;else if(q.method==='eth_getBlockByNumber')result=block;else if(q.method==='eth_getLogs')result=[];else if(q.method==='eth_getTransactionReceipt'){const sent=await page.evaluate(()=>window.fixtureWallet.sent);const tx=sent[Number(BigInt(q.params[0]))-1];const key=names.find(k=>address[k].toLowerCase()===tx?.to.toLowerCase());const decoded=decodeFunctionData({abi:abis[key],data:tx.data});if(!writes.some(w=>w.hash===q.params[0]))writes.push({hash:q.params[0],contract:key,fn:decoded.functionName,args:decoded.args});const logs=key==='oracle'?[{address:address.oracle,topics:encodeEventTopics({abi:abis.oracle,eventName:'SplitUpdated'}),data:encodeAbiParameters([{type:'uint16'},{type:'uint16'},{type:'uint16'},{type:'uint16'},{type:'bytes32'},{type:'bytes32'},{type:'uint8'}].filter((_,i)=>i!==3),[3000,5000,2000,blockHash,blockHash,1]),blockHash,blockNumber:block.number,logIndex:'0x0',transactionIndex:'0x0',transactionHash:q.params[0],removed:false}]:[];result={transactionHash:q.params[0],transactionIndex:'0x0',blockHash,blockNumber:block.number,from:address.dead,to:tx.to,cumulativeGasUsed:'0x100',gasUsed:'0x100',effectiveGasPrice:'0x1',contractAddress:null,status:'0x1',logs,logsBloom:'0x'+'0'.repeat(512),type:'0x2'};}else throw Error('Unhandled RPC '+q.method);return {jsonrpc:'2.0',id:q.id,result};}catch(e){return {jsonrpc:'2.0',id:q.id,error:{code:-32000,message:e.message}};}};
 await route.fulfill({json:Array.isArray(payload)?await Promise.all(payload.map(handle)):await handle(payload)});
});
const checks=[];async function confirmed(label){await page.getByText(`${label}: confirmed.`,{exact:true}).waitFor({timeout:15000});await page.getByRole('button',{name:'Dismiss transaction status'}).click();}
try{
 await page.goto(`http://127.0.0.1:${server.address().port}/preview/index.html`,{waitUntil:'domcontentloaded'});await page.getByText(/Mainnet block/).waitFor();
 await page.getByRole('button',{name:'Connect wallet',exact:true}).first().click();await page.getByRole('button',{name:'Switch to Ethereum'}).click();await page.getByRole('button',{name:'Approve & Stake',exact:true}).waitFor();checks.push('Injected wallet connection and explicit chain switch');
 await page.locator('#stake-amount').fill('0');await page.getByRole('button',{name:'Approve & Stake',exact:true}).click();await page.getByText('Enter an amount greater than zero.').waitFor();assert.equal(writes.length,0);checks.push('Invalid stake amount never prompts wallet');
 assert.equal(await page.evaluate(()=>document.activeElement.id),'stake-amount');await page.keyboard.press('ControlOrMeta+A');await page.keyboard.type('2');await page.keyboard.press('Tab');assert.match(await page.evaluate(()=>document.activeElement.textContent),/Approve & Stake/);await page.keyboard.press('Enter');await confirmed('Stake ADAM');assert.deepEqual(writes.slice(-2).map(w=>w.fn),['approve','stake']);assert.equal(writes.at(-2).args[1],2n*unit);checks.push('Keyboard stake flow: field error focus, exact approval, receipt wait, then stake');
 await page.getByRole('button',{name:'Unstake',exact:true}).click();await confirmed('Unstake ADAM');await page.getByRole('button',{name:'Exit all',exact:true}).click();await confirmed('Exit stake');checks.push('Unstake and exit verified payloads');
 for(const symbol of ['IMD','PNKSTR']){await page.getByRole('button',{name:`Claim ${symbol}`,exact:true}).click();await confirmed(`Claim ${symbol}`);}checks.push('Independent IMD and PNKSTR reward claims');
 await page.getByLabel('ETH budget to spend').fill('0.01');await page.getByRole('button',{name:'Get quote',exact:true}).click();await page.getByText(/Quote: 12,345 IMDSTR/).waitFor();await page.getByRole('button',{name:'Claim IMDSTR',exact:true}).last().click();await confirmed('Claim IMDSTR');assert.equal(writes.at(-1).fn,'claimIMDSTR');assert.equal(writes.at(-1).args[0],unit/100n);assert.equal(writes.at(-1).args[1],1222155n*unit/100n);checks.push('IMDSTR quote, 1% minimum output and deadline');
 await page.getByRole('button',{name:'Process fees',exact:true}).click();await confirmed('Process Treasury');await page.getByRole('button',{name:'Claim keeper bounty',exact:true}).click();await confirmed('Claim keeper bounty');assert.equal(writes.at(-1).args[0].toLowerCase(),address.dead.toLowerCase());checks.push('Keeper process and recipient-bound deferred claim');
 await page.getByRole('button',{name:'Find my NFTs',exact:true}).click();await page.getByText('40,000 ADAM',{exact:true}).waitFor({timeout:90000});assert.equal(ownerCalls.size,3178);assert(ownerCalls.has('imdNft:0')&&ownerCalls.has('imdNft:1999')&&ownerCalls.has('pepeNft:1')&&ownerCalls.has('pepeNft:1178'));checks.push('Complete Multicall ownership range and per-NFT entitlements');
 await page.getByRole('button',{name:'Claim & Stake',exact:true}).click();await confirmed('Claim & Stake NFTs');assert.deepEqual(writes.slice(-2).map(w=>[w.fn,w.args[0],w.args[1]]),[['claimAndStake',0,[0n,1999n]],['claimAndStake',1,[1n,1178n]]]);checks.push('Claim & Stake batches use correct collection enum and IDs');
 await page.getByRole('button',{name:'Claim selected',exact:true}).click();await confirmed('Claim NFTs');assert(writes.slice(-2).every(w=>w.fn==='claim'));checks.push('Ordinary batched NFT claim');
 state.locked=true;await page.getByRole('button',{name:/Refresh stats/}).click();await page.getByText(/Stake lock: 23h|Stake lock: 24h/).waitFor();assert(await page.getByRole('button',{name:'Unstake',exact:true}).isDisabled());assert(await page.getByRole('button',{name:'Exit all',exact:true}).isDisabled());checks.push('Stake lock disables principal withdrawal');
 await page.evaluate(()=>window.fixtureWallet.reject=true);await page.getByRole('button',{name:'Claim IMD',exact:true}).click();await page.getByText(/Request declined in your wallet/).waitFor();await page.getByRole('button',{name:'Dismiss transaction status'}).click();await page.evaluate(()=>window.fixtureWallet.reject=false);checks.push('Wallet rejection is recoverable');
 await page.evaluate(a=>window.fixtureWallet.change(a),address.relayer);await page.locator('#relayer').waitFor();await page.locator('#request-id').fill('4dd47615-7358-4dd5-aee8-c56225fc6cce');await page.getByRole('button',{name:'Fetch & validate',exact:true}).click();await page.getByText(/Valid: deployed oracle simulation accepts/).waitFor();await page.getByRole('button',{name:'Submit report',exact:true}).click();await confirmed('Submit oracle report');assert.equal(writes.at(-1).fn,'submit');assert.equal(writes.at(-1).args.length,2);assert.equal(writes.at(-1).args[0].answerType,3);checks.push('Relayer gate, API mapping, validation, two-argument submit and acceptance log');
 state.oracleValid=false;await page.getByRole('button',{name:'Fetch & validate',exact:true}).click();await page.getByText(/Oracle simulation rejected this report/).waitFor();assert(await page.getByRole('button',{name:'Submit report',exact:true}).isDisabled());checks.push('Oracle false result prevents report submission');
 await page.evaluate(a=>window.fixtureWallet.change(a),address.dead);await page.locator('#relayer').waitFor({state:'detached'});assert.equal(await page.locator('.nft-row').count(),0);checks.push('Account changes clear NFTs and hide relayer controls');
 assert.equal(errors.length,0);checks.push('No uncaught errors during wallet flows');
 console.log(JSON.stringify({checks,errors,writes:writes.map(w=>w.fn)},null,2));
}finally{await fs.mkdir(path.join(root,'docs/website'),{recursive:true});await fs.writeFile(path.join(root,'docs/website/interaction-validation.json'),JSON.stringify({mode:'Mock injected wallet, mock RPC; zero broadcasts',checks,errors,writes},(_,v)=>typeof v==='bigint'?v.toString():v,2)+'\n');await browser.close();await new Promise(r=>server.close(r));}
