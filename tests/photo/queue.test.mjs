import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

async function database() {
  const pg=new PGlite();
  await pg.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`);
  await pg.exec(await readFile(new URL('../../supabase/migrations/20261002_photo_printing.sql',import.meta.url),'utf8'));
  return pg;
}
const cmd=async(pg,action,payload={})=>(await pg.query('select public.photo_print_command($1,$2::jsonb) result',[action,JSON.stringify(payload)])).rows[0].result;
async function create(pg,key=randomUUID()) {
  const id=randomUUID();
  await pg.query('insert into photo_print_uploads(id,token_hash,storage_path,width,height) values($1,$2,$3,1000,1480)',[id,'uploadhash',`uploads/${id}.jpg`]);
  const payload={upload_id:id,upload_hash:'uploadhash',request_key:key,tracking_hash:'trackinghash',fingerprint:'fingerprint',guest_name:'Khách',orientation:'portrait',storage_path:`prints/${id}.jpg`};
  return {request:await cmd(pg,'create',payload),payload};
}
const mutate=(pg,action,id,key=randomUUID())=>cmd(pg,action,{id,operation_key:key});

test('schema blocks anonymous access and RPC execution',async()=>{
  const pg=await database();
  try {
    assert.equal((await cmd(pg,'session')).accepting,false);
    for(const role of ['anon','authenticated']){
      await pg.exec(`set role ${role}`);
      await assert.rejects(pg.query('select * from photo_print_requests'),/permission denied/);
      await assert.rejects(cmd(pg,'resume'),/permission denied/);
      await pg.exec('reset role');
    }
    await pg.exec('set role service_role');
    assert.equal((await cmd(pg,'session')).capacity,100);
  }finally{await pg.close();}
});
test('100 simultaneous requests, idempotency, pause and rejection quota',async()=>{
  const pg=await database();
  try{
    await assert.rejects(create(pg),/PAUSED/);
    await cmd(pg,'resume');
    const entries=await Promise.all(Array.from({length:100},()=>create(pg)));
    assert.equal((await cmd(pg,'session')).reserved,100);
    await assert.rejects(create(pg),/FULL/);
    const {request,payload}=entries[0];
    assert.equal((await cmd(pg,'create',payload)).id,request.id);
    await assert.rejects(cmd(pg,'create',{...payload,tracking_hash:'other'}),/IDEMPOTENCY_CONFLICT/);
    const key=randomUUID();await mutate(pg,'reject',request.id,key);await mutate(pg,'reject',request.id,key);
    assert.equal((await cmd(pg,'session')).reserved,99);
    await assert.rejects(mutate(pg,'approve',request.id,key),/IDEMPOTENCY_CONFLICT/);
    await create(pg);assert.equal((await cmd(pg,'session')).reserved,100);
  }finally{await pg.close();}
});
test('one claim, uncertain expiry, late acknowledgements and reprint accounting',async()=>{
  const pg=await database();
  try{
    await cmd(pg,'resume');const one=await create(pg),two=await create(pg);
    const key=randomUUID();await mutate(pg,'approve',one.request.id,key);await mutate(pg,'approve',one.request.id,key);
    await mutate(pg,'approve',two.request.id);
    const station_id=randomUUID();await cmd(pg,'heartbeat',{station_id,printer:'CP1500',error:null});
    const claim=await cmd(pg,'claim',{station_id});assert.equal(claim.request_id,one.request.id);
    assert.equal(await cmd(pg,'claim',{station_id}),null);
    await assert.rejects(mutate(pg,'reject',one.request.id),/STATE_CONFLICT/);
    await cmd(pg,'begin',{...claim,station_id});
    await pg.query("update photo_print_attempts set lease_until=now()-interval '1 second' where id=$1",[claim.attempt_id]);
    await cmd(pg,'session');
    assert.equal((await cmd(pg,'admin_list')).requests.find(r=>r.id===one.request.id)?.status,'review');
    assert.equal(await cmd(pg,'claim',{station_id}),null);
    await mutate(pg,'reprint',one.request.id);
    assert.equal((await cmd(pg,'session')).reserved,3);
    await assert.rejects(cmd(pg,'submitted',{...claim,station_id,cups_job_id:'CP1500-123'}),/STATE_CONFLICT/);
    const next=await cmd(pg,'claim',{station_id});assert.ok(next);
    await cmd(pg,'begin',{...next,station_id});
    await cmd(pg,'submitted',{...next,station_id,cups_job_id:'CP1500-124'});
    await cmd(pg,'submitted',{...next,station_id,cups_job_id:'CP1500-124'});
    assert.equal(await cmd(pg,'claim',{station_id}),null);
    await mutate(pg,'ready',next.request_id);
    assert.ok(await cmd(pg,'claim',{station_id}));
  }finally{await pg.close();}
});
test('unauthorized claim token, active station collision and rejected queued attempt',async()=>{
  const pg=await database();
  try{
    await cmd(pg,'resume');const one=await create(pg);await mutate(pg,'approve',one.request.id);
    const station_id=randomUUID();await cmd(pg,'heartbeat',{station_id,printer:'CP1500'});
    await assert.rejects(cmd(pg,'heartbeat',{station_id:randomUUID(),printer:'Another'}),/STATION_BUSY/);
    const job=await cmd(pg,'claim',{station_id});
    await assert.rejects(cmd(pg,'begin',{...job,station_id,claim_token:randomUUID()}),/NOT_FOUND/);
    const two=await create(pg);await mutate(pg,'approve',two.request.id);await mutate(pg,'reject',two.request.id);
    assert.equal((await pg.query('select status from photo_print_attempts where request_id=$1',[two.request.id])).rows[0].status,'canceled');
  }finally{await pg.close();}
});
