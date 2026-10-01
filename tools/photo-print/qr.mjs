#!/usr/bin/env node
import qrcode from 'qrcode-generator';
import { writeFile } from 'node:fs/promises';
const destination=process.argv[2] || 'https://www.project69hd.xyz/photo';
const url=new URL(destination);
if(url.protocol!=='https:' || url.hash || url.search)throw new Error('QR khách phải là URL HTTPS công khai không chứa token.');
const code=qrcode(0,'M');code.addData(url.href);code.make();
await writeFile(new URL('../../public/photo-qr.svg',import.meta.url),code.createSvgTag({cellSize:8,margin:32,scalable:true,alt:'Quét QR để chụp và gửi ảnh in tại tiệc cưới',title:destination}));
console.log('Đã tạo public/photo-qr.svg cho '+destination+'. Chỉ chia sẻ khi /photo đã deploy và trạm in được nghiệm thu.');
