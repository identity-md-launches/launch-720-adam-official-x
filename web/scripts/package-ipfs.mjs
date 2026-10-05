// Run with tooling installed separately as described in README. This creates a CAR; it does not pin it.
import {pathToFileURL,fileURLToPath} from 'node:url';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const tooling=process.env.IPFS_TOOLS_DIR;
if(!tooling)throw Error('Set IPFS_TOOLS_DIR to the directory containing the IPFS packaging dependencies.');
const load=async name=>{const dir=path.join(path.resolve(tooling),'node_modules',name);const pkg=JSON.parse(await fs.readFile(path.join(dir,'package.json'),'utf8'));const target=pkg.exports['.'].import;return import(pathToFileURL(path.join(dir,typeof target==='string'?target:target.default)).href);};
const {importer}=await load('ipfs-unixfs-importer');
const {CarWriter,CarReader}=await load('@ipld/car');
const {exporter}=await load('ipfs-unixfs-exporter');
const blocks=new Map();const store={put:async(cid,bytes)=>{blocks.set(cid.toString(),{cid,bytes});return cid;}};
const files=[];
async function walk(dir,prefix=''){for(const ent of (await fs.readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name,'en'))){if(ent.isSymbolicLink())throw Error('Symlinks are not allowed in the export.');const relative=prefix+ent.name;if(ent.isDirectory())await walk(path.join(dir,ent.name),relative+'/');else files.push({path:relative,content:await fs.readFile(path.join(dir,ent.name))});}}
await walk(path.join(root,'dist'));let entry;
for await(const next of importer(files,store,{cidVersion:1,rawLeaves:true,wrapWithDirectory:true}))entry=next;
const cid=entry.cid.toString();const {writer,out}=CarWriter.create([entry.cid]);const chunks=[];
const consuming=(async()=>{for await(const bytes of out)chunks.push(bytes);})();
for(const b of blocks.values())await writer.put(b);await writer.close();await consuming;
const bytes=Buffer.concat(chunks);const reader=await CarReader.fromBytes(bytes);const roots=await reader.getRoots();if(roots[0].toString()!==cid)throw Error('CAR root mismatch');let count=0;for await(const b of reader.blocks()){const digest=createHash('sha256').update(b.bytes).digest();if(!digest.equals(Buffer.from(b.cid.multihash.digest)))throw Error('Block digest mismatch');count++;}if(count!==blocks.size)throw Error('Missing CAR blocks');
const readStore={get:async function*(cid){yield (await reader.get(cid)).bytes;}};for(const file of files){const item=await exporter(`${cid}/${file.path}`,readStore);const parts=[];for await(const part of item.content())parts.push(part);if(!Buffer.concat(parts).equals(file.content))throw Error(`Re-import mismatch: ${file.path}`);}
await fs.mkdir(path.join(root,'docs/website'),{recursive:true});await fs.writeFile(path.join(root,'docs/website/adam-site.car'),bytes);
const manifest={cid,ipfsUrl:`ipfs://${cid}/`,gatewayUrl:`https://ipfs.io/ipfs/${cid}/`,status:'prepared_not_pinned',hosting:'No IPFS publisher, persistent node, or pinning credentials were provided. This address is not claimed to be publicly available.',car:'docs/website/adam-site.car',carBytes:bytes.length,carSha256:createHash('sha256').update(bytes).digest('hex'),blocks:count,reimportedFiles:files.length,format:'UnixFS directory, CIDv1, SHA-256, raw leaves, default balanced layout and 262144-byte chunks',tools:{'ipfs-unixfs-importer':'16.1.4','@ipld/car':'5.4.2','ipfs-unixfs-exporter':'15.0.4'},files:files.map(f=>({path:f.path,bytes:f.content.length,sha256:createHash('sha256').update(f.content).digest('hex')}))};
await fs.writeFile(path.join(root,'docs/website/ipfs.json'),JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({cid,carBytes:bytes.length,blocks:count,status:manifest.status}));
