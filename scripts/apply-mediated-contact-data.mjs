import { readFile, writeFile } from 'node:fs/promises';

async function patchFile(path, replacements) {
  let source = await readFile(path, 'utf8');
  for (const { oldValue, newValue, label } of replacements) {
    const first = source.indexOf(oldValue);
    if (first === -1) throw new Error(`${path}: patch target not found: ${label}`);
    if (source.indexOf(oldValue, first + oldValue.length) !== -1) {
      throw new Error(`${path}: patch target is ambiguous: ${label}`);
    }
    source = source.replace(oldValue, newValue);
  }
  await writeFile(path, source, 'utf8');
}

await patchFile('apps/mobile/src/app/(app)/hosting/[eventId].tsx', [
  {
    label: 'event pets query',
    oldValue: `      supabase\n        .from('hosting_event_pets')\n        .select('event_id, pet_id, pet_snapshot, handoff_snapshot')\n        .eq('event_id', eventId),`,
    newValue: `      supabase.rpc('get_event_pets', { p_event_id: eventId }),`,
  },
  {
    label: 'event participant profiles query',
    oldValue: `    const profileResult = await supabase\n      .from('profiles')\n      .select('id, public_code, full_name, phone, avatar_path, tutor_enabled, caregiver_enabled, created_at, updated_at')\n      .in('id', [nextEvent.tutor_id, nextEvent.caregiver_id]);`,
    newValue: `    const profileResult = await supabase.rpc('get_event_participant_profiles', {\n      p_event_id: eventId,\n    });`,
  },
]);

await patchFile('apps/mobile/src/app/(app)/hosting/[eventId]/handoff.tsx', [
  {
    label: 'handoff event pets query',
    oldValue: `      supabase\n        .from('hosting_event_pets')\n        .select('event_id, pet_id, pet_snapshot, handoff_snapshot')\n        .eq('event_id', eventId),`,
    newValue: `      supabase.rpc('get_event_pets', { p_event_id: eventId }),`,
  },
]);

await patchFile('apps/mobile/src/app/(app)/contacts/index.tsx', [
  {
    label: 'safe connection profiles query',
    oldValue: `      const { data: profiles, error: profileError } = await supabase\n        .from('profiles')\n        .select(\n          'id, public_code, full_name, phone, avatar_path, tutor_enabled, caregiver_enabled, created_at, updated_at',\n        )\n        .in('id', otherIds);`,
    newValue: `      const { data: profiles, error: profileError } = await supabase.rpc(\n        'list_my_safe_connection_profiles',\n      );`,
  },
]);

await patchFile('apps/mobile/src/app/(app)/hosting/new.tsx', [
  {
    label: 'safe caregiver profile query',
    oldValue: `    const { data: caregiverData, error: caregiverError } = await supabase\n      .from('profiles')\n      .select(\n        'id, public_code, full_name, phone, avatar_path, tutor_enabled, caregiver_enabled, created_at, updated_at',\n      )\n      .eq('id', otherUserId)\n      .single();`,
    newValue: `    const { data: caregiverData, error: caregiverError } = await supabase\n      .rpc('get_safe_connected_profile', { p_profile_id: otherUserId })\n      .single();`,
  },
]);

console.log('Mediated contact data patch applied successfully.');
