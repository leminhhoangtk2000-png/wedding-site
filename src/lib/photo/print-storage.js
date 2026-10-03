import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { BUCKET, fail } from './server.js';

export async function uploadPrint(client, bytes) {
  const id=randomUUID(), storage_path=`prints/${id}.jpg`, thumbnail_path=`thumbnails/${id}.jpg`;
  const thumb=await sharp(bytes).resize({width:320,height:320,fit:'inside',withoutEnlargement:true})
    .jpeg({quality:75}).toBuffer();
  const store=client.storage.from(BUCKET);
  const {error}=await store.upload(storage_path,bytes,{contentType:'image/jpeg',upsert:false});
  if (error) fail('DATABASE_UNAVAILABLE',503);
  const {error: thumbError}=await store.upload(thumbnail_path,thumb,{contentType:'image/jpeg',upsert:false});
  if (thumbError) { await store.remove([storage_path,thumbnail_path]); fail('DATABASE_UNAVAILABLE',503); }
  return {storage_path,thumbnail_path};
}
