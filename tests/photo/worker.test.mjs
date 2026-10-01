import test from 'node:test';
import assert from 'node:assert/strict';
import { processJob,recoverJob,lpArgs } from '../../tools/photo-print/core.mjs';
const job={attempt_id:'test-attempt',claim_token:'claim',orientation:'portrait'};
test('lost submitted ACK is retried without another native print',async()=>{
  let record,spools=0,reports=0;
  const save=async r=>{record=r;};
  await assert.rejects(processJob(job,{save,download:async()=>'/photo.jpg',spool:async()=>{spools++;return 'request id is CP1500-123 (1 file(s))';},report:async action=>{if(action==='submitted')throw new Error('network');}}),/network/);
  assert.equal(record.phase,'submitted');
  await recoverJob(record,{save,report:async action=>{assert.equal(action,'submitted');reports++;}});
  assert.equal(spools,1);assert.equal(reports,1);assert.equal(record.phase,'acknowledged');
});
test('restart during spooling and begin acknowledgement loss require manual review',async()=>{
  for(const phase of ['received','beginning','spooling','review']){
    let saved;await recoverJob({...job,phase},{save:async r=>{saved=r;},report:async action=>assert.equal(action,'review')});
    assert.equal(saved.phase,'reviewed');
  }
  let spools=0,saved;
  await processJob(job,{save:async r=>{saved=r;},download:async()=>'/photo.jpg',spool:async()=>{spools++;},report:async action=>{if(action==='begin')throw new Error('lost begin ACK');}});
  assert.equal(spools,0);assert.equal(saved.phase,'reviewed');
});
test('unparseable CUPS response cannot be automatically resubmitted',async()=>{
  let saved,spools=0;
  await processJob(job,{save:async r=>{saved=r;},download:async()=>'/photo.jpg',spool:async()=>{spools++;return 'unknown spool response';},report:async()=>{}});
  assert.equal(saved.phase,'reviewed');assert.equal(spools,1);
});
test('lp arguments enforce one copy and never invoke a shell',()=>{
  const args=lpArgs({printer:'CP1500',options:{media:'Postcard'}},job,'/photo.jpg');
  assert.deepEqual(args.slice(0,4),['-d','CP1500','-n','1']);
  assert.ok(args.includes('orientation-requested=3'));assert.ok(args.includes('job-sheets=none'));
  assert.deepEqual(args.slice(-2),['--','/photo.jpg']);
});
