import { db, command, respond, errorResponse } from '@/lib/photo/server';
import { getPresetConfig } from '@/lib/photo/config-server';
export const runtime = 'nodejs';
export async function GET() {
  try {
    const client = db();
    const session = await command(client, 'session');
    return respond({
      session: {
        ...session,
        capacity: null,
        remaining: null,
        intake_only: process.env.PHOTO_PRINT_HARDWARE_VERIFIED !== 'true',
      },
      preset_config: await getPresetConfig(client),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
