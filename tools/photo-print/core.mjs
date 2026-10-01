import { mkdir, open, rename } from 'node:fs/promises';
import { dirname } from 'node:path';

export async function durableJSON(path, value) {
  await mkdir(dirname(path), { recursive:true,mode:0o700 });
  const tmp=`${path}.tmp`;
  const handle=await open(tmp,'w',0o600);
  try { await handle.writeFile(JSON.stringify(value,null,2)); await handle.sync(); } finally { await handle.close(); }
  await rename(tmp,path);
  const directory=await open(dirname(path),'r');
  try { await directory.sync(); } finally { await directory.close(); }
}
export function parseJobId(stdout) {
  const id=/request id is ([A-Za-z0-9_.-]+-\d+)/.exec(stdout)?.[1];
  if (!id) throw new Error('Không đọc được mã lệnh CUPS; kiểm tra máy in trước khi in lại.');
  return id;
}
export function lpArgs(config,job,file) {
  const orientation=job.orientation==='landscape'?'4':'3';
  const options={...config.options,'orientation-requested':orientation,'job-sheets':'none','sides':'one-sided'};
  return ['-d',config.printer,'-n','1','-t',`Wedding-${job.attempt_id}`, ...Object.entries(options).flatMap(([key,value])=>['-o',`${key}=${value}`]),'--',file];
}
/** Persist before every externally visible transition, especially the native spool call. */
export async function processJob(job,{save,report,download,spool}) {
  let record={...job,phase:'received'};
  await save(record);
  try {
    const file=await download(job);
    record={...record,phase:'beginning'}; await save(record);
    await report('begin',job);
    record={...record,phase:'spooling'}; await save(record);
    const cups_job_id=parseJobId(await spool(job,file));
    record={...record,phase:'submitted',cups_job_id}; await save(record);
  } catch(error) {
    record={...record,phase:'review',error:'Lệnh in chưa xác định kết quả. Kiểm tra nhật ký CUPS và ảnh giấy trước khi thao tác.'};
    await save(record);
    // Preserve the record if reporting fails; recovery will only report, never spool.
    await report('review',record);
    await save({...record,phase:'reviewed'});
    return {status:'review',error};
  }
  // An acknowledgement failure must NEVER route through spool again.
  await report('submitted',record);
  await save({...record,phase:'acknowledged'});
  return {status:'submitted'};
}
export async function recoverJob(record,{save,report}) {
  if (['acknowledged','reviewed','closed'].includes(record.phase)) return;
  try {
    if (record.phase==='submitted') {
      await report('submitted',record); await save({...record,phase:'acknowledged'});
    } else {
      const review={...record,phase:'review',error:record.error || 'Chương trình Mac đã dừng giữa một lệnh in. Cần kiểm tra trước khi in lại.'};
      await save(review); await report('review',review); await save({...review,phase:'reviewed'});
    }
  } catch(error) {
    // Server may already have been manually reconciled; stale reports cannot
    // mutate the new attempt. Retain the local history and do not resubmit.
    if (error.code==='STATE_CONFLICT' || error.code==='NOT_FOUND') await save({...record,phase:'closed'});
    else throw error;
  }
}
