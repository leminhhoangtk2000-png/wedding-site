import { db, command, respond, errorResponse } from '@/lib/photo/server';
export const runtime = 'nodejs';
export async function GET() {
  try { return respond({ session: await command(db(), 'session') }); }
  catch (error) { return errorResponse(error); }
}
