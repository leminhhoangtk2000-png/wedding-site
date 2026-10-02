// Actual Next route handlers + embedded PostgreSQL; Storage/PostgREST HTTP
// adapter is test-only. Never contacts the configured production Supabase.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp,readFile,writeFile,mkdir,cp,symlink,rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import sharp from 'sharp';
import { PGlite } from '@electric-sql/pglite';

const preview=process.argv.includes('--preview');
const intakeOnly=process.argv.includes('--intake-only');
const project=process.cwd(),pg=new PGlite(),objects=new Map();
let filmQADraft;
await pg.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);");
await pg.exec(await readFile(join(project,'supabase/migrations/20261002_photo_printing.sql'),'utf8'));
await pg.exec(await readFile(join(project,'supabase/migrations/20261002_photo_film_presets.sql'),'utf8'));
const provider=createServer(async(req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','*');
  const chunks=[];for await(const chunk of req)chunks.push(chunk);const bytes=Buffer.concat(chunks);
  const url=new URL(req.url,'http://localhost');
  const json=(body,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(body));};
  try{
    if(url.pathname==='/film-qa')return json(filmQADraft);
    if(['/rest/v1/rpc/photo_print_command','/rest/v1/rpc/photo_print_film_command'].includes(url.pathname)){
      const body=JSON.parse(bytes);const {rows}=await pg.query(`select ${url.pathname.endsWith('photo_print_film_command')?'photo_print_film_command':'photo_print_command'}($1,$2::jsonb) result`,[body.p_action,JSON.stringify(body.p_payload)]);return json(rows[0].result);
    }
    const table=/^\/rest\/v1\/(photo_print_uploads|photo_print_requests)$/.exec(url.pathname)?.[1];
    if(table){
      if(req.method==='POST'){
        const body=JSON.parse(bytes);const keys=Object.keys(body);
        assert.ok(keys.every(k=>/^[a-z_]+$/.test(k)));
        const {rows}=await pg.query(`insert into ${table} (${keys.join(',')}) values (${keys.map((_,i)=>`$${i+1}`).join(',')}) returning *`,Object.values(body));
        return json(rows[0],201);
      }
      const conditions=[],values=[];
      for(const [key,value] of url.searchParams){
        if(key==='select')continue;
        assert.match(key,/^[a-z_]+$/);const op=value.startsWith('eq.')?'=':'>';
        values.push(value.slice(3));conditions.push(`${key} ${op} $${values.length}`);
      }
      const {rows}=await pg.query(`select * from ${table}${conditions.length?' where '+conditions.join(' and '):''}`,values);
      return json(rows[0] || null);
    }
    if(url.pathname.startsWith('/storage/v1/object/sign/')){
      const path=url.pathname.replace('/storage/v1/object/sign/','');
      if(!objects.has(path))return json({error:'not found'},404);
      if(req.method==='GET'){res.writeHead(200,{'Content-Type':'image/jpeg'});return res.end(objects.get(path));}
      return json({signedURL:`/object/sign/${path}?token=fixture`});
    }
    if(url.pathname==='/storage/v1/object/photo_print_private' && req.method==='DELETE'){
      for(const path of JSON.parse(bytes).prefixes)objects.delete(`photo_print_private/${path}`);return json([]);
    }
    if(url.pathname.startsWith('/storage/v1/object/')){
      const path=url.pathname.replace('/storage/v1/object/','');
      if(req.method==='POST'){objects.set(path,bytes);return json({Key:path});}
      if(!objects.has(path))return json({error:'not found'},404);
      res.writeHead(200,{'Content-Type':'image/jpeg'});return res.end(objects.get(path));
    }
    return json({error:'unknown fixture endpoint'},404);
  }catch(error){return json({message:error.message,code:error.code},400);}
});
provider.listen(0,'127.0.0.1');await once(provider,'listening');
const providerURL=`http://127.0.0.1:${provider.address().port}`;
const root=await mkdtemp(join(tmpdir(),'wedding-photo-api-'));
let next;
try{
  if(preview){await cp(join(project,'src'),join(root,'src'),{recursive:true});await symlink(join(project,'public'),join(root,'public'));}
  else await cp(join(project,'src/app/api'),join(root,'src/app/api'),{recursive:true});
  // Only new photo route handlers are exercised; preserve module aliases.
  await cp(join(project,'src/lib'),join(root,'src/lib'),{recursive:true});
  await cp(join(project,'package.json'),join(root,'package.json'));
  await cp(join(project,'jsconfig.json'),join(root,'jsconfig.json'));
  await symlink(join(project,'node_modules'),join(root,'node_modules'));
  await mkdir(join(root,'src/app'),{recursive:true});
  if(preview) {
    // Component QA surface exists only in the temporary preview checkout.
    // It exercises real React effects without requiring browser file access.
    await mkdir(join(root,'src/app/photo/qa'),{recursive:true});
    await writeFile(join(root,'src/app/photo/qa/page.js'),`'use client';
import {useState} from 'react';
import Link from 'next/link';
import PhotoCropper from '@/components/photo/PhotoCropper';
const picture='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1480"><rect width="1000" height="1480" fill="#dbb76e"/><rect width="500" height="740" fill="#658caa"/><rect x="500" y="740" width="500" height="740" fill="#efb5af"/></svg>');
export default function CropQA(){
const [crop,setCrop]=useState({x:0.25,y:0.25,width:0.5,height:0.5});
const [orientation,setOrientation]=useState('portrait');
const [locked,setLocked]=useState(true);
return <div style={{padding:24,background:'#0e1217',color:'white'}}><h1>Local crop component QA</h1>
<button onClick={()=>setLocked(!locked)}>{locked?'Unlock saved crop':'Lock crop'}</button>
<Link href="/photo">Open photobooth</Link>
<output aria-label="Normalized crop">{JSON.stringify(crop)}</output>
<PhotoCropper imageUrl={picture} imageWidth={1000} imageHeight={1480} orientation={orientation} onOrientationChange={setOrientation} crop={crop} onCropChange={setCrop} onChangePhoto={()=>{}} locked={locked}/></div>}
`);
  }
  if(!preview) await writeFile(join(root,'src/app/layout.js'),'export default function Layout({children}) {return <html><body>{children}</body></html>}');
  if(!preview) await writeFile(join(root,'src/app/page.js'),'export default function Page(){return <p>test fixture</p>}');
  if(preview) await writeFile(join(root,'next.config.mjs'),(await readFile(join(project,'next.config.mjs'),'utf8')).replace("output: 'standalone',",''));
  else await writeFile(join(root,'next.config.mjs'),'export default { serverExternalPackages: ["sharp", "heic-convert"] };');
  const portProbe=createServer();portProbe.listen(0,'127.0.0.1');await once(portProbe,'listening');const port=portProbe.address().port;await new Promise(r=>portProbe.close(r));
  const admin='test-admin-password',stationToken='test-station-token-at-least-32-characters';
  const testEnv={...process.env,NEXT_PUBLIC_SUPABASE_URL:providerURL,NEXT_PUBLIC_SUPABASE_ANON_KEY:'fixture-public',SUPABASE_SERVICE_ROLE_KEY:'fixture-service',ADMIN_PASSWORD:admin,PHOTO_PRINT_STATION_TOKEN:stationToken,PHOTO_PRINT_HARDWARE_VERIFIED:intakeOnly?'false':'true',PHOTO_PRINT_ACCEPT_WITHOUT_PRINTER:intakeOnly?'true':'false'};
  if(preview){
    await mkdir(join(root,'src/app/photo/film-qa'),{recursive:true});
    await writeFile(join(root,'src/app/photo/film-qa/page.js'),`'use client';
export default function FilmQA(){return <div style={{padding:40}}><h1>Film QA fixture</h1><button onClick={async()=>{const draft=await (await fetch('${providerURL}/film-qa')).json();sessionStorage.setItem('photo_print_draft_keys',JSON.stringify(draft));window.location.href='/photo';}}>Load uploaded fixture and choose film</button></div>}`);
    const builder=spawn(process.execPath,[join(project,'node_modules/next/dist/bin/next'),'build','--webpack'],{cwd:root,env:testEnv,stdio:['ignore','pipe','pipe']});
    let buildOutput='';builder.stdout.on('data',b=>{buildOutput+=b;});builder.stderr.on('data',b=>{buildOutput+=b;});
    const [code]=await once(builder,'exit');if(code!==0)throw new Error(buildOutput);console.log('Preview production build passed.');
  }
  next=spawn(process.execPath,[join(project,'node_modules/next/dist/bin/next'),...(preview?['start']:['dev','--webpack']),'--port',String(port)],{cwd:root,env:testEnv,stdio:['ignore','pipe','pipe']});
  let output='';next.stdout.on('data',b=>{output+=b;});next.stderr.on('data',b=>{output+=b;});
  const base=`http://127.0.0.1:${port}`;
  for(let i=0;i<100;i++){if(output.includes('Ready in'))break;if(next.exitCode!=null)throw new Error(output);await new Promise(r=>setTimeout(r,200));}
  const call=async(path,method='GET',body,headers={})=>{
    const response=await fetch(base+path,{method,headers:body instanceof FormData?headers:{'Content-Type':'application/json',...headers},body:body?body instanceof FormData?body:JSON.stringify(body):undefined});
    return {status:response.status,data:await response.json()};
  };
  assert.equal((await call('/api/photo/status')).data.session.accepting,false);
  assert.equal((await call('/api/admin/printing')).status,401);
  assert.equal((await call('/api/admin/printing','PATCH',{action:'resume'},{'x-admin-password':admin})).status,200);
  const bytes=await sharp({create:{width:1000,height:1480,channels:3,background:'#ff7777'}}).jpeg().toBuffer();
  const form=new FormData();form.append('file',new Blob([bytes],{type:'image/jpeg'}),'test.jpg');
  const uploadResult=await call('/api/photo/uploads','POST',form);assert.equal(uploadResult.status,200,JSON.stringify(uploadResult));
  const upload=uploadResult.data.upload;
  const presetConfig=(await call('/api/photo/status')).data.preset_config;
  assert.equal(presetConfig.presets.length,7);
  const body={filter:{config_version:presetConfig.version,preset_id:'soft_wedding',adjustments:{intensity:70,brightness:0,warmth:0},computed:{brightness:50}},upload_id:upload.id,upload_token:upload.token,request_key:randomUUID(),tracking_token:randomUUID(),guest_name:'API Test',orientation:'portrait',crop:{x:0,y:0,width:1,height:1}};
  const created=await call('/api/photo/requests','POST',body);assert.equal(created.status,200,JSON.stringify(created));
  const id=created.data.request.id;
  const snapshot=(await pg.query('select filter_snapshot,storage_path from photo_print_requests where id=$1',[id])).rows[0];
  assert.equal(snapshot.filter_snapshot.preset.id,'soft_wedding');
  assert.equal(snapshot.filter_snapshot.computed.brightness,1.4); // ignores forged client computed
  const originalPrint=objects.get('photo_print_private/'+snapshot.storage_path);
  const meta=await sharp(originalPrint).metadata();assert.equal(meta.width,1181);assert.equal(meta.height,1748);assert.equal(meta.density,300);
  const saveBody={action:'save_presets',operation_key:randomUUID(),expected_version:presetConfig.version,presets:structuredClone(presetConfig.presets)};
  saveBody.presets.find(p=>p.id==='soft_wedding').settings.brightness=20;
  assert.equal((await call('/api/admin/printing','PATCH',saveBody)).status,401);
  const updated=await call('/api/admin/printing','PATCH',saveBody,{'x-admin-password':admin});
  assert.equal(updated.status,200,JSON.stringify(updated));assert.equal(updated.data.preset_config.version,2);
  assert.equal((await call('/api/admin/printing','PATCH',saveBody,{'x-admin-password':admin})).data.preset_config.version,2);
  assert.equal((await call('/api/admin/printing','PATCH',{...saveBody,operation_key:randomUUID()},{'x-admin-password':admin})).data.code,'CONFIG_STALE');
  assert.equal((await call('/api/photo/status')).data.preset_config.version,2);
  assert.equal((await call('/api/photo/requests','POST',{...body,filter:{...body.filter,adjustments:{...body.filter.adjustments,intensity:35}}})).data.code,'IDEMPOTENCY_CONFLICT');
  assert.equal((await call('/api/photo/requests','POST',{...body,request_key:randomUUID(),filter:{...body.filter,adjustments:{...body.filter.adjustments,brightness:Infinity}}})).status,400);
  assert.equal((await call('/api/photo/requests','POST',{...body,request_key:randomUUID(),filter:{...body.filter,preset_id:'invented'}})).status,400);
  assert.equal((await call('/api/photo/requests','POST',{...body,request_key:randomUUID(),filter:{...body.filter,config_version:999}})).data.code,'CONFIG_NOT_FOUND');

  assert.equal((await call('/api/photo/requests','POST',body)).data.request.id,id);
  assert.equal((await call('/api/admin/printing','PATCH',{action:'pause'},{'x-admin-password':admin})).status,200);
  assert.equal((await call('/api/photo/requests','POST',body)).data.request.id,id);
  assert.equal((await call('/api/photo/status')).data.session.reserved,1);
  assert.equal((await call('/api/admin/printing','PATCH',{action:'resume'},{'x-admin-password':admin})).status,200);
  assert.equal((await call('/api/photo/requests','POST',{...body,guest_name:'Changed'})).status,409);
  assert.equal((await call(`/api/photo/requests?id=${id}`,'GET',undefined,{'x-photo-token':randomUUID()})).status,404);
  assert.equal((await call(`/api/photo/requests?id=${id}`,'GET',undefined,{'x-photo-token':body.tracking_token})).data.request.status,'pending');
  const state=await call('/api/admin/printing','GET',undefined,{'x-admin-password':admin});assert.equal(state.data.requests.length,1);assert.ok(state.data.requests[0].preview_url);assert.equal(state.data.requests[0].tracking_hash,undefined);assert.equal(state.data.requests[0].preset_name,'Soft Wedding');
  const adminMutation=action=>call('/api/admin/printing','PATCH',{action,id,operation_key:randomUUID()},{'x-admin-password':admin});
  if(intakeOnly){
    assert.equal((await call('/api/photo/status')).data.session.intake_only,true);
    for(const action of ['approve','reprint','ready']) assert.equal((await adminMutation(action)).data.code,'HARDWARE_NOT_VERIFIED');
    for(const action of ['claim','begin']) assert.equal((await call('/api/printing/station','POST',{action,station_id:randomUUID()},{Authorization:`Bearer ${stationToken}`})).data.code,'HARDWARE_NOT_VERIFIED');
    console.log('PASS: intake-only accepts uploads/requests, pause/resume work, printing/ready/reprint/claim/begin blocked until hardware verified.');
  }else{
  assert.equal((await adminMutation('approve')).status,200);
  const station_id=randomUUID(),station=payload=>call('/api/printing/station','POST',{station_id,...payload},{Authorization:`Bearer ${stationToken}`});
  assert.equal((await station({action:'heartbeat',printer:'CP1500'})).status,200);
  const claimed=await station({action:'claim'});assert.ok(claimed.data.job);const job=claimed.data.job;
  assert.deepEqual(Buffer.from(await (await fetch(job.image_url)).arrayBuffer()),originalPrint);
  assert.equal((await station({action:'claim'})).data.job,null);
  assert.equal((await station({...job,action:'begin'})).status,200);
  assert.equal((await station({...job,action:'submitted',cups_job_id:'CP1500-123'})).status,200);
  assert.equal((await adminMutation('ready')).status,200);
  assert.equal((await call(`/api/photo/requests?id=${id}`,'GET',undefined,{'x-photo-token':body.tracking_token})).data.request.status,'ready');
  assert.equal((await adminMutation('reprint')).status,200);
  assert.equal((await call('/api/photo/status')).data.session.reserved,2);
  assert.deepEqual(objects.get('photo_print_private/'+snapshot.storage_path),originalPrint);
  assert.deepEqual((await pg.query('select filter_snapshot from photo_print_requests where id=$1',[id])).rows[0].filter_snapshot,snapshot.filter_snapshot);
  if(!preview) {
    const oldBody={...body,request_key:randomUUID(),tracking_token:randomUUID()};delete oldBody.filter;
    const oldResult=await call('/api/photo/requests','POST',oldBody);assert.equal(oldResult.status,200);
    const oldRow=(await pg.query('select filter_snapshot,storage_path from photo_print_requests where id=$1',[oldResult.data.request.id])).rows[0];
    assert.equal(oldRow.filter_snapshot,null);
    const oldJPEG=objects.get('photo_print_private/'+oldRow.storage_path);
    const restoredLegacy={preset_id:'warm_film',config_version:0,adjustments:{intensity:100,brightness:0,warmth:0}};
    const recovered=await call('/api/photo/requests','POST',{...oldBody,filter:restoredLegacy});assert.equal(recovered.data.request.id,oldResult.data.request.id);
    assert.deepEqual(objects.get('photo_print_private/'+oldRow.storage_path),oldJPEG);
    assert.equal((await pg.query('select filter_snapshot from photo_print_requests where id=$1',[oldResult.data.request.id])).rows[0].filter_snapshot,null);
    const legacyCreated=await call('/api/photo/requests','POST',{...oldBody,request_key:randomUUID(),tracking_token:randomUUID(),filter:restoredLegacy});assert.equal(legacyCreated.status,200);
    assert.equal((await pg.query('select filter_snapshot from photo_print_requests where id=$1',[legacyCreated.data.request.id])).rows[0].filter_snapshot.preset.id,'warm_film');
  }
  if(preview){
    filmQADraft={upload_id:upload.id,upload_token:upload.token,preview_url:upload.preview_url,width:upload.width,height:upload.height,guest_name:'Film QA Guest',orientation:'portrait',crop:body.crop,preset_id:'soft_wedding',config_version:1,preset_config:presetConfig,adjustments:body.filter.adjustments,step:2,request_key:randomUUID(),tracking_token:randomUUID(),submitted:false};
    await writeFile('/tmp/wedding-photo-sample.jpg',bytes);
    await writeFile('/tmp/wedding-photo-preview.json',JSON.stringify({base,root,admin,tracking_url:created.data.tracking_url}));
    console.log(`PREVIEW fixture ready: ${base}/photo ; admin password: test-admin-password; metadata /tmp/wedding-photo-preview.json`);
    await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});
  }
  console.log('PASS: actual Next HTTP routes → PostgreSQL RPC → private Storage fixture → approval → station claim/report → ready/reprint; no real printer or production provider used.');
  }
}catch(error){console.error(error);process.exitCode=1;}
finally{
  if(next){next.kill('SIGTERM');await Promise.race([once(next,'exit'),new Promise(r=>setTimeout(r,5000))]);if(next.exitCode===null)next.kill('SIGKILL');}
  await new Promise(r=>provider.close(r));await pg.close();await rm(root,{recursive:true,force:true});
}
