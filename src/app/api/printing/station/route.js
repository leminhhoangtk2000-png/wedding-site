import { db, requireAuth, command, respond, errorResponse, fail, requireUUID, jsonBody, signedPreview } from '@/lib/photo/server';
export const runtime = 'nodejs';
export async function POST(request) {
  try {
    requireAuth(request,true); const body=await jsonBody(request);requireUUID(body.station_id);
    if (!['heartbeat','claim','begin','submitted','review'].includes(body.action)) fail('INVALID_INPUT');
    if (body.action==='heartbeat' && (typeof body.printer!=='string' || !body.printer.trim() || (body.error!=null && typeof body.error!=='string'))) fail('INVALID_INPUT');
    if (['begin','submitted','review'].includes(body.action)) { requireUUID(body.attempt_id);requireUUID(body.claim_token); }
    const client=db(), result=await command(client,body.action,body);
    if (body.action==='claim') {
      if (!result) return respond({job:null});
      const url=await signedPreview(client,result.storage_path);
      const job = { ...result }; delete job.storage_path;
      return respond({job:{...job,image_url:url}});
    }
    return respond({});
  } catch(error) { return errorResponse(error); }
}
