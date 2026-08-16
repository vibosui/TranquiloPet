alter table public.chat_messages
  add column if not exists pet_id uuid;

alter table public.chat_messages
  drop constraint if exists chat_messages_type_check;

alter table public.chat_messages
  add constraint chat_messages_type_check
  check (message_type = any (array[
    'text'::text,
    'system'::text,
    'task_completed'::text,
    'photo_evidence'::text,
    'event_status'::text,
    'preset_question'::text,
    'preset_answer'::text,
    'photo_request'::text,
    'incident_reported'::text,
    'incident_update'::text
  ]));

create table if not exists public.incident_presets (
  key text primary key,
  category text not null check (category in ('digestive', 'behavior', 'health', 'safety', 'medication')),
  label text not null,
  severity text not null check (severity in ('attention', 'urgent')),
  sort_order integer not null default 0,
  active boolean not null default true
);

create table if not exists public.incident_response_presets (
  key text primary key,
  sender_role text not null check (sender_role in ('tutor', 'caregiver', 'both')),
  body text not null,
  closes_incident boolean not null default false,
  sort_order integer not null default 0,
  active boolean not null default true
);

alter table public.incident_presets enable row level security;
alter table public.incident_response_presets enable row level security;

drop policy if exists incident_presets_authenticated_read on public.incident_presets;
create policy incident_presets_authenticated_read
on public.incident_presets for select to authenticated
using (active);

drop policy if exists incident_response_presets_authenticated_read on public.incident_response_presets;
create policy incident_response_presets_authenticated_read
on public.incident_response_presets for select to authenticated
using (active);

grant select on public.incident_presets to authenticated;
grant select on public.incident_response_presets to authenticated;

insert into public.incident_presets(key, category, label, severity, sort_order, active) values
  ('vomited', 'digestive', 'Vomitou', 'attention', 10, true),
  ('diarrhea', 'digestive', 'Teve diarreia', 'attention', 20, true),
  ('refused_food', 'digestive', 'Recusou alimentação', 'attention', 30, true),
  ('unusual_behavior', 'behavior', 'Apresentou comportamento atípico', 'attention', 40, true),
  ('aggression', 'behavior', 'Apresentou agressividade', 'urgent', 50, true),
  ('escape_attempt', 'safety', 'Tentou fugir ou escapar', 'urgent', 60, true),
  ('injury_bleeding', 'health', 'Apresentou ferimento ou sangramento', 'urgent', 70, true),
  ('allergic_reaction', 'health', 'Apresentou possível reação alérgica', 'urgent', 80, true),
  ('breathing_difficulty', 'health', 'Apresentou dificuldade para respirar', 'urgent', 90, true),
  ('tremor_seizure', 'health', 'Apresentou tremores ou convulsão', 'urgent', 100, true),
  ('suspected_poisoning', 'health', 'Há suspeita de intoxicação', 'urgent', 110, true),
  ('excessive_lethargy', 'health', 'Está excessivamente apático ou sonolento', 'attention', 120, true),
  ('medication_problem', 'medication', 'Houve problema com a medicação', 'attention', 130, true),
  ('other_health_signal', 'health', 'Outro sinal de saúde que exige atenção', 'attention', 140, true),
  ('other_behavior_signal', 'behavior', 'Outro comportamento preocupante', 'attention', 150, true)
on conflict (key) do update set
  category = excluded.category,
  label = excluded.label,
  severity = excluded.severity,
  sort_order = excluded.sort_order,
  active = excluded.active;

insert into public.incident_response_presets(key, sender_role, body, closes_incident, sort_order, active) values
  ('tutor_ack_monitor', 'tutor', 'Ciente. Continue monitorando o pet.', false, 10, true),
  ('tutor_follow_emergency_plan', 'tutor', 'Siga o plano de emergência cadastrado para o pet.', false, 20, true),
  ('tutor_seek_vet', 'tutor', 'Procure atendimento veterinário conforme o plano de emergência.', false, 30, true),
  ('caregiver_stable', 'caregiver', 'O pet está estável neste momento.', false, 40, true),
  ('caregiver_not_repeated', 'caregiver', 'O sinal não voltou a ocorrer.', false, 50, true),
  ('caregiver_repeated', 'caregiver', 'O sinal voltou a ocorrer.', false, 60, true),
  ('caregiver_worse', 'caregiver', 'A situação piorou.', false, 70, true),
  ('caregiver_vet_started', 'caregiver', 'Atendimento veterinário foi iniciado.', false, 80, true),
  ('caregiver_resolved', 'caregiver', 'Ocorrência encerrada; o pet está estável.', true, 90, true)
on conflict (key) do update set
  sender_role = excluded.sender_role,
  body = excluded.body,
  closes_incident = excluded.closes_incident,
  sort_order = excluded.sort_order,
  active = excluded.active;

create or replace function public.report_hosting_incident(
  p_event_id uuid,
  p_pet_id uuid,
  p_incident_key text
)
returns public.chat_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  event_row public.hosting_events;
  preset public.incident_presets;
  pet_name text;
  created_message public.chat_messages;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  select * into event_row
  from public.hosting_events
  where id = p_event_id;

  if event_row.id is null or event_row.caregiver_id <> actor or event_row.status <> 'in_progress' then
    raise exception 'Only the caregiver can report incidents during an active hosting event';
  end if;

  select * into preset
  from public.incident_presets
  where key = p_incident_key and active = true;

  if preset.key is null then
    raise exception 'Incident preset not found';
  end if;

  select coalesce(nullif(hep.pet_snapshot->>'name', ''), 'Pet') into pet_name
  from public.hosting_event_pets hep
  where hep.event_id = p_event_id and hep.pet_id = p_pet_id;

  if pet_name is null then
    raise exception 'Pet not found in hosting event';
  end if;

  insert into public.chat_messages(
    event_id, sender_id, message_type, body, preset_key, pet_id
  ) values (
    p_event_id,
    actor,
    'incident_reported',
    (case when preset.severity = 'urgent' then '🚨 ' else '⚠️ ' end) || pet_name || ': ' || preset.label,
    preset.key,
    p_pet_id
  )
  returning * into created_message;

  return created_message;
end;
$$;

create or replace function public.respond_to_hosting_incident(
  p_incident_message_id uuid,
  p_response_key text
)
returns public.chat_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  incident public.chat_messages;
  event_row public.hosting_events;
  response_preset public.incident_response_presets;
  actor_role text;
  created_message public.chat_messages;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  select * into incident
  from public.chat_messages
  where id = p_incident_message_id and message_type = 'incident_reported';

  if incident.id is null then
    raise exception 'Incident not found';
  end if;

  select * into event_row
  from public.hosting_events
  where id = incident.event_id;

  if event_row.id is null or event_row.status <> 'in_progress' then
    raise exception 'Incident updates require an active hosting event';
  end if;

  actor_role := case
    when event_row.tutor_id = actor then 'tutor'
    when event_row.caregiver_id = actor then 'caregiver'
    else null
  end;

  if actor_role is null then
    raise exception 'Not allowed';
  end if;

  if exists (
    select 1
    from public.chat_messages update_message
    join public.incident_response_presets closing_preset
      on closing_preset.key = update_message.preset_key
     and closing_preset.closes_incident = true
    where update_message.reply_to_message_id = incident.id
      and update_message.message_type = 'incident_update'
  ) then
    raise exception 'Incident already closed';
  end if;

  select * into response_preset
  from public.incident_response_presets
  where key = p_response_key
    and active = true
    and sender_role in (actor_role, 'both');

  if response_preset.key is null then
    raise exception 'Response preset not allowed';
  end if;

  insert into public.chat_messages(
    event_id, sender_id, message_type, body, preset_key, reply_to_message_id, pet_id
  ) values (
    incident.event_id,
    actor,
    'incident_update',
    response_preset.body,
    response_preset.key,
    incident.id,
    incident.pet_id
  )
  returning * into created_message;

  return created_message;
end;
$$;

revoke all on function public.report_hosting_incident(uuid, uuid, text) from public;
revoke all on function public.respond_to_hosting_incident(uuid, text) from public;
grant execute on function public.report_hosting_incident(uuid, uuid, text) to authenticated;
grant execute on function public.respond_to_hosting_incident(uuid, text) to authenticated;
