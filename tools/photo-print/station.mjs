#!/usr/bin/env node
import { readFile, readdir, mkdir, open, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { durableJSON,lpArgs,processJob,recoverJob } from './core.mjs';
import { preparePrintFile, safePrintLayout } from './prepare-print.mjs';

const exec=promisify(execFile);
const configPath=process.env.PHOTO_PRINT_CONFIG || join(homedir(),'Library/Application Support/WeddingPhotoPrint/config.json');
const root=resolve(join(configPath,'..'));
const env={...process.env,LC_ALL:'C',LANG:'C'};
const native=async (file,args) => (await exec(file,args,{env,timeout:20000,maxBuffer:1024*1024})).stdout;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function validateConfig(c) {
  safePrintLayout(1181,1748,'portrait',c.safe_margin_mm ?? 4);
  const url=new URL(c.server_url);
  if (url.protocol!=='https:' && !(c.allow_local_http===true && ['localhost','127.0.0.1'].includes(url.hostname) && url.protocol==='http:')) throw new Error('server_url phải dùng HTTPS.');
  if (url.username || url.password || url.search || url.hash || url.pathname!=='/') throw new Error('server_url phải là origin, không chứa token/path.');
  if (!/^[A-Za-z0-9_.-]+$/.test(c.printer) || c.printer.startsWith('-')) throw new Error('Tên máy in không hợp lệ.');
  if (!/^[0-9a-f-]{36}$/i.test(c.station_id) || typeof c.token!=='string' || c.token.length<32) throw new Error('Thiếu station_id/token.');
  if (!c.options || typeof c.options!=='object' || Array.isArray(c.options) || !Object.keys(c.options).length) throw new Error('Cần cấu hình khổ giấy sau khi in thử.');
  for (const [k,v] of Object.entries(c.options)) if (!/^[a-zA-Z][a-zA-Z0-9-]*$/.test(k) || typeof v!=='string' || !/^[a-zA-Z0-9_.-]+$/.test(v)) throw new Error('Tùy chọn CUPS không hợp lệ.');
  if (c.hardware_verified!==true) throw new Error('Chưa xác nhận in thử trên máy thật.');
  return c;
}
async function main() {
  if (process.argv.includes('--list-printers')) { console.log(await native('/usr/bin/lpstat',['-p','-d']));return; }
  const config=JSON.parse(await readFile(configPath,'utf8'));
  if (process.argv.includes('--check')) {
    console.log(await native('/usr/bin/lpstat',['-p',config.printer]));
    console.log(await native('/usr/bin/lpoptions',['-p',config.printer,'-l']));
    console.log('Chỉ kiểm tra cấu hình; chưa gửi lệnh in.');return;
  }
  validateConfig(config);
  if (process.platform!=='darwin') throw new Error('Trạm in này dành cho macOS.');
  await mkdir(root,{recursive:true,mode:0o700});
  // OS process singleton: live PID prevents duplicate workers; stale lock can be
  // reclaimed only if the previous process is no longer running.
  const lock=join(root,'station.lock');
  try { const f=await open(lock,'wx',0o600);await f.writeFile(String(process.pid));await f.close(); }
  catch(error) {
    if(error.code!=='EEXIST') throw error;
    const pid=Number(await readFile(lock,'utf8'));
    if (!Number.isInteger(pid) || pid<1) throw new Error('Khóa trạm lỗi; cần kiểm tra thủ công.');
    try { process.kill(pid,0);throw new Error('Trạm in đã chạy.'); } catch(e) { if(e.code!=='ESRCH') throw e; }
    await unlink(lock);const f=await open(lock,'wx',0o600);await f.writeFile(String(process.pid));await f.close();
  }
  const jobsDir=join(root,'jobs');await mkdir(jobsDir,{recursive:true,mode:0o700});
  let stopping=false;
  process.on('SIGTERM',()=>{stopping=true;});process.on('SIGINT',()=>{stopping=true;});
  const request=async payload=>{
    const response=await fetch(new URL('/api/printing/station',config.server_url),{
      method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${config.token}`},
      body:JSON.stringify({station_id:config.station_id,...payload}),signal:AbortSignal.timeout(15000),redirect:'error',
    });
    const data=await response.json();
    if(!response.ok || !data.success) {const error=new Error(data.error || 'Không kết nối được máy chủ.');error.code=data.code;throw error;}
    return data;
  };
  const save=record=>durableJSON(join(jobsDir,`${record.attempt_id}.json`),record);
  const report=(action,record)=>request({action,attempt_id:record.attempt_id,claim_token:record.claim_token,cups_job_id:record.cups_job_id,error:record.error});
  const download=async job=>{
    const url=new URL(job.image_url);
    if (url.protocol!=='https:') throw new Error('Đường dẫn ảnh không bảo mật.');
    const response=await fetch(url,{signal:AbortSignal.timeout(20000),redirect:'error'});
    if(!response.ok) throw new Error('Không tải được bản ảnh in.');
    const bytes=Buffer.from(await response.arrayBuffer());
    if(bytes.length>12*1024*1024 || bytes[0]!==0xff || bytes[1]!==0xd8) throw new Error('Bản ảnh in không hợp lệ.');
    const path=join(jobsDir,`${job.attempt_id}.jpg`);const f=await open(path,'w',0o600);try{await f.writeFile(bytes);await f.sync();}finally{await f.close();}
    return preparePrintFile(path,join(jobsDir,`${job.attempt_id}.print.jpg`),job.orientation,config);
  };
  let printerError=null;
  let heartbeatBusy=false;
  const heartbeat=async()=>{
    if(heartbeatBusy)return;heartbeatBusy=true;
    try{await request({action:'heartbeat',printer:config.printer,error:printerError});}
    catch {console.error('Không gửi được heartbeat; trạm sẽ hiển thị offline.');}
    finally{heartbeatBusy=false;}
  };
  const timer=setInterval(heartbeat,5000);await heartbeat();
  try {
    while(!stopping) {
      try {
        // Replay acknowledgements, NEVER the native lp call.
        for(const name of await readdir(jobsDir)) if(name.endsWith('.json')) await recoverJob(JSON.parse(await readFile(join(jobsDir,name),'utf8')),{save,report});
        const printerState=await native('/usr/bin/lpstat',['-p',config.printer]);
        if(/disabled|paused|offline|not connected|out of paper|filter failed|unavailable/i.test(printerState)) throw new Error('Máy in tạm dừng hoặc mất kết nối; kiểm tra CUPS.');
        printerError=null;
        await heartbeat();
        // Even after premature human confirmation, do not stack another native
        // job while the configured printer still has an unfinished job.
        const active=await native('/usr/bin/lpstat',['-W','not-completed','-o',config.printer]);
        if(!active.trim()) {
          const {job}=await request({action:'claim'});
          if(job) {
            if(!/^[0-9a-f-]{36}$/i.test(job.attempt_id)) throw new Error('Mã lệnh không hợp lệ.');
            const result=await processJob(job,{save,report,download,spool:(job,file)=>native('/usr/bin/lp',lpArgs(config,job,file))});
            if(result.status==='review') printerError='Một lệnh in cần kiểm tra thủ công.';
          }
        }
      } catch {
        // Do not log request bodies, signed URLs, tokens, guest data or raw native
        // error strings (execFile embeds filenames/arguments).
        printerError='Trạm in gặp lỗi. Kiểm tra kết nối, giấy/mực và danh sách CUPS; không tự in lại.';
        console.error(printerError);
      }
      await sleep(3000);
    }
  } finally {clearInterval(timer);await unlink(lock);}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
