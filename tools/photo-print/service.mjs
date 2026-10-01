#!/usr/bin/env node
import { copyFile, mkdir, readFile, writeFile, chmod, rm } from 'node:fs/promises';
import { join,dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const label='xyz.project69hd.photo-print';
const destination=join(homedir(),'Library/Application Support/WeddingPhotoPrint');
const plist=join(homedir(),'Library/LaunchAgents',`${label}.plist`);
const domain=`gui/${process.getuid()}`;
const xml=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const action=process.argv[2];
if(process.platform!=='darwin')throw new Error('Chỉ dùng trên Mac.');
if(action==='install'){
  await mkdir(destination,{recursive:true,mode:0o700});
  await readFile(join(destination,'config.json'),'utf8'); // operator config required
  const source=dirname(fileURLToPath(import.meta.url));
  for(const file of ['station.mjs','core.mjs'])await copyFile(join(source,file),join(destination,file));
  await chmod(join(destination,'config.json'),0o600);
  await mkdir(dirname(plist),{recursive:true});
  const args=[process.execPath,join(destination,'station.mjs')].map(s=>`<string>${xml(s)}</string>`).join('');
  await writeFile(plist,`<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>Label</key><string>${label}</string><key>ProgramArguments</key><array>${args}</array><key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>ThrottleInterval</key><integer>30</integer><key>StandardOutPath</key><string>${xml(join(destination,'station.log'))}</string><key>StandardErrorPath</key><string>${xml(join(destination,'station-error.log'))}</string></dict></plist>`,{mode:0o600});
  console.log('Đã tạo LaunchAgent; chạy service.mjs start sau khi in thử.');
}else if(action==='start')execFileSync('/bin/launchctl',['bootstrap',domain,plist],{stdio:'inherit'});
else if(action==='stop')execFileSync('/bin/launchctl',['bootout',`${domain}/${label}`],{stdio:'inherit'});
else if(action==='uninstall'){
  try{execFileSync('/bin/launchctl',['bootout',`${domain}/${label}`],{stdio:'ignore'});}catch{}
  await rm(plist,{force:true});console.log('Đã gỡ LaunchAgent. Giữ config và nhật ký để đối chiếu.');
}else throw new Error('Dùng install | start | stop | uninstall.');
