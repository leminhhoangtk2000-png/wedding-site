import {readFile} from 'node:fs/promises';

// Legacy full-function admin migration is superseded by the safe wrapper.
// Explicit ordering avoids ambiguous same-date filenames and tests the same release.
export const PHOTO_MIGRATIONS = [
  '20261002_photo_printing.sql',
  '20261002_remove_photo_quota_limit.sql',
  '20261002_photo_film_presets.sql',
  '20261002_photo_film_looks_v2.sql',
  '20261002_photo_film_stocks_v3.sql',
  '20261002180000_photo_admin_edit_safe.sql',
  '20261003010000_photo_runtime.sql',
  '20261003020000_photo_thumbnails.sql',
];

export async function applyPhotoMigrations(database) {
  for(const file of PHOTO_MIGRATIONS)
    await database.exec(await readFile(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8'));
}

// One transaction for an existing or empty schema. Never toggles intake or hardware.
export async function buildPhotoReleaseSQL() {
  const guards=[
    "to_regclass('public.photo_print_session') is null",
    "exists(select 1 from information_schema.columns where table_schema='public' and table_name='photo_print_session' and column_name='capacity' and is_nullable='NO')",
    "to_regclass('public.photo_print_preset_versions') is null",
    "not exists(select 1 from public.photo_print_preset_versions v, jsonb_array_elements(v.presets) p where p->>'profile'='astia_v2')",
    "not exists(select 1 from public.photo_print_preset_versions v, jsonb_array_elements(v.presets) p where p->>'profile'='velvia_v3')",
    "not exists(select 1 from public.photo_print_release_steps where name='safe_edit')",
    'true','true',
  ];
  const chunks=["begin;\ncreate table if not exists public.photo_print_release_steps(name text primary key,applied_at timestamptz not null default now());\nalter table public.photo_print_release_steps enable row level security;\nrevoke all on public.photo_print_release_steps from public,anon,authenticated;\ngrant all on public.photo_print_release_steps to service_role;\n"];
  for(let i=0;i<PHOTO_MIGRATIONS.length;i++) {
    const sql=(await readFile(new URL('../../supabase/migrations/'+PHOTO_MIGRATIONS[i],import.meta.url),'utf8'))
      .replace(/^\s*(begin|commit);\s*$/gmi,'');
    const tag=`photo_migration_${i}`;
    chunks.push(`-- ${PHOTO_MIGRATIONS[i]}\ndo $release$ begin\n if ${guards[i]} then\n execute $${tag}$${sql}$${tag}$;\n end if;\n end $release$;\n`);
    if(i===2) {
      const film=(await readFile(new URL('../../supabase/migrations/20261002_photo_film_presets.sql',import.meta.url),'utf8'));
      const rpc=film.slice(film.indexOf('create function public.photo_print_film_command')).replace('create function','create or replace function').replace(/^commit;\s*$/gmi,'');
      chunks.push("alter table public.photo_print_requests add column if not exists filter_snapshot jsonb;\n"+rpc);
    }
    if(i===5)chunks.push("insert into public.photo_print_release_steps(name) values('safe_edit') on conflict do nothing;\n");
  }
  chunks.push("notify pgrst, 'reload schema';\ncommit;\n");
  return chunks.join('\n');
}
