import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.woff2':'font/woff2','.txt':'text/plain'};
const server=http.createServer(async(req,res)=>{try{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/preview\//,'');const file=path.resolve(root,'dist',name||'index.html');if(!file.startsWith(path.join(root,'dist')+path.sep))throw Error();const bytes=await fs.readFile(file);res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream'});res.end(bytes);}catch{res.writeHead(404).end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox']});
const out=path.join(root,'docs/website');await fs.mkdir(out,{recursive:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},colorScheme:'light',permissions:['clipboard-read','clipboard-write']});const errors=[],failed=[];
page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>failed.push({url:r.url(),error:r.failure()?.errorText}));
// Node fetch uses the environment proxy where the browser cannot. No credentials are read or logged.
await page.route(/^https:\/\//,async route=>{try{const req=route.request();const response=await fetch(req.url(),{method:req.method(),headers:{'content-type':'application/json'},body:req.method()==='POST'?req.postData():undefined,signal:AbortSignal.timeout(20000)});await route.fulfill({status:response.status,body:Buffer.from(await response.arrayBuffer()),headers:{'content-type':response.headers.get('content-type')||'application/json','access-control-allow-origin':'*'}});}catch{await route.abort();}});
const results={mode:'Production export; live read-only RPC, no wallet',checks:[],errors,failed};
try{
 await page.goto(`http://127.0.0.1:${server.address().port}/preview/index.html`,{waitUntil:'domcontentloaded'});
 await page.getByText(/Mainnet block/).waitFor({timeout:90000});results.checks.push('Live mainnet snapshot rendered');
 await page.evaluate(()=>document.fonts.ready);assert(await page.evaluate(()=>document.fonts.check('16px Archivo')));results.checks.push('Bundled Archivo font loaded');
 for(const width of [1440,820,390,320]){await page.setViewportSize({width,height:1000});await page.getByRole('heading',{name:'Parents of ADAM.'}).scrollIntoViewIfNeeded();await page.waitForFunction(()=>Array.from(document.images).every(i=>i.complete&&i.naturalWidth>0));await page.evaluate(()=>scrollTo(0,0));const overflow=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,inner:innerWidth}));assert(overflow.scroll<=overflow.inner,`Overflow at ${width}: ${JSON.stringify(overflow)}`);results.checks.push(`No page overflow at ${width}px`);if(width===1440||width===390)await page.screenshot({path:path.join(out,width===1440?'desktop.jpg':'mobile.jpg'),type:'jpeg',quality:78,fullPage:width===390});}
 await page.getByRole('link',{name:'NFT claim',exact:true}).click();assert.equal(new URL(page.url()).hash,'#claim');results.checks.push('Hash navigation at IPFS-style subpath');
 await page.getByRole('button',{name:'Connect wallet',exact:true}).first().click();await page.getByText(/No injected wallet found/).waitFor();results.checks.push('Missing wallet recovery message');
 await page.getByRole('button',{name:'Dismiss transaction status'}).click();await page.getByRole('button',{name:'Use dark mode'}).click();assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(out,'dark.jpg'),type:'jpeg',quality:78});
 await page.reload({waitUntil:'domcontentloaded'});await page.getByText(/Mainnet block/).waitFor({timeout:90000});assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');results.checks.push('Theme switch and persisted theme');
 await page.getByRole('button',{name:'Use light mode'}).click();
 await page.locator('body').click({position:{x:5,y:5}});await page.keyboard.press('Tab');await page.keyboard.press('Tab');await page.screenshot({path:path.join(out,'keyboard-focus.jpg'),type:'jpeg',quality:78});results.focus=await page.evaluate(()=>({tag:document.activeElement.tagName,text:document.activeElement.textContent,outline:getComputedStyle(document.activeElement).outlineStyle}));
 await page.getByRole('button',{name:'Load cumulative totals'}).click();await page.getByText(/Fee history complete/).waitFor({timeout:120000});results.checks.push('Complete fee history and all 3,178 NFT claimed mappings loaded');
 results.totals=await page.getByText(/Fee history complete/).textContent();await page.getByRole('button',{name:'Copy address',exact:false}).click();await page.getByRole('button',{name:'Copied',exact:false}).waitFor();results.checks.push('Copy contract address feedback');
 results.contrast=await page.evaluate(()=>{const parse=c=>c.match(/[\d.]+/g).slice(0,3).map(Number);const lum=c=>parse(c).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);return ['body','.hero p','.primary','.split-card','.muted'].map(sel=>{const e=document.querySelector(sel),s=getComputedStyle(e);let bg=s.backgroundColor,p=e;while(bg==='rgba(0, 0, 0, 0)'&&p.parentElement){p=p.parentElement;bg=getComputedStyle(p).backgroundColor;}return {selector:sel,foreground:s.color,background:bg,ratio:(Math.max(lum(s.color),lum(bg))+.05)/(Math.min(lum(s.color),lum(bg))+.05)};});});
 for(const v of results.contrast)assert(v.ratio>=4.5,`Contrast ${v.selector}: ${v.ratio}`);await page.getByRole('button',{name:'Use dark mode'}).click();results.darkColors=await page.evaluate(()=>['body','.hero p','.primary','.muted'].map(sel=>{const e=document.querySelector(sel),s=getComputedStyle(e);let p=e,bg=s.backgroundColor;while(bg==='rgba(0, 0, 0, 0)'&&p.parentElement){p=p.parentElement;bg=getComputedStyle(p).backgroundColor;}return {selector:sel,foreground:s.color,background:bg};}));
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('button').first().evaluate(e=>getComputedStyle(e).transitionDuration),'0s');results.checks.push('Reduced motion disables button transforms');
 assert.equal(errors.length,0);results.checks.push('No uncaught application errors');
 console.log(JSON.stringify(results,null,2));
}finally{await fs.writeFile(path.join(out,'browser-validation.json'),JSON.stringify(results,null,2)+'\n');await browser.close();await new Promise(resolve=>server.close(resolve));}
