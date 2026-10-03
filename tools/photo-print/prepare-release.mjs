import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {buildPhotoReleaseSQL} from './migrations.mjs';
const output=new URL('../../docs/photo-runtime-release.sql',import.meta.url);
await writeFile(output,await buildPhotoReleaseSQL());
console.log(`Prepared ${fileURLToPath(output)}. Apply to the correct Supabase project before deploying the matching source.`);
