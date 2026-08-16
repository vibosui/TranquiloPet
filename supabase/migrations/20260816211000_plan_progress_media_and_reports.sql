create or replace function public.register_event_plan_media(
  p_event_id uuid,
  p_pet_id uuid,
  p_media_type text,
  p_storage_path text,
  p_duration_seconds numeric default null
)
returns public.event_plan_media
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  event_row public.hosting_events;
  event_pet public.hosting_event_pets;
  period_row public.event_plan_periods;
  created public.event_plan_media;
  max_seconds integer;
  min_videos integer;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  select * into event_row from public.hosting_events where id = p_event_id;
  if event_row.id is null or event_row.caregiver_id <> actor or event_row.status <> 'in_progress' then
    raise exception 'Only the active caregiver can add plan media';
  end if;
  select * into event_pet from public.hosting_event_pets where event_id = p_event_id and pet_id = p_pet_id;
  if event_pet.pet_id is null then raise exception 'Pet is not part of this event'; end if;
  if p_media_type not in ('photo','video') then raise exception 'Invalid media type'; end if;
  if p_storage_path not like actor::text || '/' || p_event_id::text || '/' || p_pet_id::text || '/%' then
    raise exception 'Invalid storage path';
  end if;

  select * into period_row from public.event_plan_periods
  where event_id = p_event_id and pet_id = p_pet_id and now() >= starts_at and now() <= ends_at
  order by sequence_no limit 1;
  if period_row.id is null then
    select * into period_row from public.event_plan_periods
    where event_id = p_event_id and pet_id = p_pet_id
    order by case when now() < starts_at then starts_at - now() else now() - ends_at end asc
    limit 1;
  end if;
  if period_row.id is null then raise exception 'Plan period not found'; end if;

  max_seconds := coalesce((event_pet.plan_snapshot->>'video_max_seconds')::integer, 15);
  min_videos := coalesce((event_pet.plan_snapshot->>'min_videos_per_day')::integer, 0);
  if p_media_type = 'video' then
    if min_videos <= 0 then raise exception 'Selected plan does not include routine videos'; end if;
    if p_duration_seconds is null or p_duration_seconds <= 0 or p_duration_seconds > max_seconds + 0.25 then
      raise exception 'Video exceeds plan duration limit';
    end if;
  else
    p_duration_seconds := null;
  end if;

  insert into public.event_plan_media(event_id, pet_id, plan_period_id, uploaded_by, media_type, storage_path, duration_seconds)
  values(p_event_id, p_pet_id, period_row.id, actor, p_media_type, p_storage_path, p_duration_seconds)
  returning * into created;
  return created;
end;
$$;

create or replace function public.get_event_plan_progress(p_event_id uuid)
returns table(
  pet_id uuid,
  pet_name text,
  plan_code text,
  plan_name text,
  period_id uuid,
  sequence_no integer,
  starts_at timestamptz,
  ends_at timestamptz,
  min_photos integer,
  photos_done bigint,
  min_videos integer,
  videos_done bigint,
  activity_required boolean,
  activity_done boolean,
  daily_report boolean,
  video_max_seconds integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    pp.pet_id,
    coalesce(nullif(hep.pet_snapshot->>'name',''), 'Pet'),
    hep.plan_code,
    coalesce(hep.plan_snapshot->>'name', cp.name),
    pp.id,
    pp.sequence_no,
    pp.starts_at,
    pp.ends_at,
    coalesce((hep.plan_snapshot->>'min_photos_per_day')::integer, cp.min_photos_per_day),
    (
      select count(*) from (
        select e.id from public.task_evidence e
        join public.event_tasks t on t.id = e.task_id
        where t.event_id = pp.event_id and t.pet_id = pp.pet_id
          and e.created_at >= pp.starts_at and e.created_at <= pp.ends_at
        union all
        select m.id from public.event_plan_media m
        where m.plan_period_id = pp.id and m.media_type = 'photo'
      ) evidence_rows
    ),
    coalesce((hep.plan_snapshot->>'min_videos_per_day')::integer, cp.min_videos_per_day),
    (select count(*) from public.event_plan_media m where m.plan_period_id = pp.id and m.media_type = 'video'),
    coalesce((hep.plan_snapshot->>'activity_required')::boolean, cp.activity_required),
    exists(
      select 1 from public.event_tasks t
      where t.plan_period_id = pp.id and t.source = 'plan_activity' and t.completed_at is not null
    ),
    coalesce((hep.plan_snapshot->>'daily_report')::boolean, cp.daily_report),
    coalesce((hep.plan_snapshot->>'video_max_seconds')::integer, cp.video_max_seconds)
  from public.event_plan_periods pp
  join public.hosting_event_pets hep on hep.event_id = pp.event_id and hep.pet_id = pp.pet_id
  join public.care_plans cp on cp.code = hep.plan_code
  join public.hosting_events he on he.id = pp.event_id
  where pp.event_id = p_event_id
    and auth.uid() is not null
    and auth.uid() in (he.tutor_id, he.caregiver_id)
  order by pp.sequence_no, pet_name;
$$;

create or replace function public.request_pet_photo(p_event_id uuid, p_pet_id uuid)
returns public.chat_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  event_row public.hosting_events;
  event_pet public.hosting_event_pets;
  task_row public.event_tasks;
  created public.chat_messages;
  period_row public.event_plan_periods;
  pet_name text;
  next_sort integer;
  required_photos integer;
  actual_photos bigint;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  select * into event_row from public.hosting_events where id = p_event_id;
  if event_row.id is null or actor <> event_row.tutor_id then raise exception 'Only the tutor can request a photo'; end if;
  if event_row.status <> 'in_progress' then raise exception 'Photos can only be requested during an active hosting event'; end if;
  select * into event_pet from public.hosting_event_pets where event_id = p_event_id and pet_id = p_pet_id;
  if event_pet.pet_id is null then raise exception 'Pet is not part of this hosting event'; end if;

  if exists (
    select 1 from public.chat_messages m
    join public.event_tasks t on t.id = m.task_id
    where m.event_id = p_event_id and m.message_type = 'photo_request'
      and t.pet_id = p_pet_id and t.completed_at is null
  ) then raise exception 'There is already a pending photo request for this pet'; end if;

  select * into period_row from public.event_plan_periods
  where event_id = p_event_id and pet_id = p_pet_id and now() >= starts_at and now() <= ends_at
  order by sequence_no limit 1;

  if period_row.id is not null then
    required_photos := coalesce((event_pet.plan_snapshot->>'min_photos_per_day')::integer, 1);
    select count(*) into actual_photos from (
      select e.id from public.task_evidence e
      join public.event_tasks t on t.id = e.task_id
      where t.event_id = p_event_id and t.pet_id = p_pet_id
        and e.created_at >= period_row.starts_at and e.created_at <= period_row.ends_at
      union all
      select m.id from public.event_plan_media m
      where m.plan_period_id = period_row.id and m.media_type = 'photo'
    ) x;
    if actual_photos >= required_photos then
      raise exception 'The guaranteed photo quota for this period is already fulfilled';
    end if;
  end if;

  pet_name := coalesce(nullif(event_pet.pet_snapshot->>'name', ''), 'pet');
  select coalesce(max(sort_order), -1) + 1 into next_sort from public.event_tasks where event_id = p_event_id;
  insert into public.event_tasks(
    event_id, pet_id, created_by, category, title, instructions, due_at, requires_photo, sort_order, source, plan_period_id
  ) values(
    p_event_id, p_pet_id, actor, 'photo', 'Foto solicitada: ' || pet_name,
    'Responder pelo Hospeda Patas com uma foto atual capturada pela câmera.',
    null, true, next_sort, 'photo_request', period_row.id
  ) returning * into task_row;

  insert into public.chat_messages(event_id, sender_id, message_type, body, task_id, preset_key, pet_id)
  values(
    p_event_id, actor, 'photo_request', 'Pode enviar uma foto atual de ' || pet_name || '?',
    task_row.id, 'photo_request', p_pet_id
  ) returning * into created;
  return created;
end;
$$;

drop function if exists public.get_event_pets(uuid);
create function public.get_event_pets(p_event_id uuid)
returns table(event_id uuid, pet_id uuid, pet_snapshot jsonb, handoff_snapshot jsonb, plan_code text, plan_snapshot jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select
    ep.event_id,
    ep.pet_id,
    case when auth.uid() = he.caregiver_id then private.sanitize_pet_snapshot(ep.pet_snapshot) else ep.pet_snapshot end,
    ep.handoff_snapshot,
    ep.plan_code,
    ep.plan_snapshot
  from public.hosting_event_pets ep
  join public.hosting_events he on he.id = ep.event_id
  where ep.event_id = p_event_id
    and auth.uid() is not null
    and auth.uid() in (he.tutor_id, he.caregiver_id);
$$;

create or replace function public.get_event_report_entries(p_event_id uuid)
returns table(
  entry_type text,
  happened_at timestamptz,
  pet_id uuid,
  title text,
  body text,
  storage_bucket text,
  storage_path text,
  media_type text,
  duration_seconds numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select x.entry_type, x.happened_at, x.pet_id, x.title, x.body, x.storage_bucket, x.storage_path, x.media_type, x.duration_seconds
  from (
    select
      'message'::text,
      m.created_at,
      m.pet_id,
      case m.message_type
        when 'preset_question' then 'Pergunta do tutor/cuidador'
        when 'preset_answer' then 'Resposta'
        when 'photo_request' then 'Solicitação de foto'
        when 'incident_reported' then 'Ocorrência registrada'
        when 'incident_update' then 'Atualização de ocorrência'
        when 'event_status' then 'Status da hospedagem'
        when 'task_completed' then 'Tarefa concluída'
        else 'Registro da hospedagem'
      end,
      m.body,
      null::text,
      null::text,
      null::text,
      null::numeric
    from public.chat_messages m
    where m.event_id = p_event_id and m.message_type <> 'photo_evidence'

    union all

    select
      'task_photo',
      e.created_at,
      t.pet_id,
      'Evidência: ' || t.title,
      coalesce(e.caption, t.instructions),
      'event-evidence',
      e.storage_path,
      'photo',
      null::numeric
    from public.task_evidence e
    join public.event_tasks t on t.id = e.task_id
    where t.event_id = p_event_id

    union all

    select
      'plan_media',
      m.created_at,
      m.pet_id,
      case when m.media_type = 'video' then 'Vídeo de acompanhamento' else 'Foto de acompanhamento' end,
      null::text,
      'event-updates',
      m.storage_path,
      m.media_type,
      m.duration_seconds
    from public.event_plan_media m
    where m.event_id = p_event_id
  ) x
  where exists(
    select 1 from public.hosting_events he
    where he.id = p_event_id and auth.uid() in (he.tutor_id, he.caregiver_id)
  )
  order by x.happened_at;
$$;

create or replace function public.transition_hosting_event(p_event_id uuid, p_target_status text)
returns public.hosting_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  event_row public.hosting_events;
  allowed boolean := false;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  select * into event_row from public.hosting_events where id = p_event_id for update;
  if event_row.id is null then raise exception 'Hosting event not found'; end if;
  if actor <> event_row.tutor_id and actor <> event_row.caregiver_id then raise exception 'Not allowed'; end if;

  allowed := case
    when event_row.status = 'draft' and p_target_status = 'sent' then actor = event_row.tutor_id
    when event_row.status = 'draft' and p_target_status = 'cancelled' then actor = event_row.tutor_id
    when event_row.status = 'sent' and p_target_status = 'accepted' then actor = event_row.caregiver_id
    when event_row.status = 'sent' and p_target_status = 'cancelled' then actor = event_row.tutor_id
    when event_row.status = 'accepted' and p_target_status = 'in_progress' then actor = event_row.caregiver_id
    when event_row.status = 'accepted' and p_target_status = 'cancelled' then actor in (event_row.tutor_id, event_row.caregiver_id)
    when event_row.status = 'in_progress' and p_target_status = 'completed' then actor = event_row.caregiver_id
    when event_row.status = 'in_progress' and p_target_status = 'cancelled' then actor in (event_row.tutor_id, event_row.caregiver_id)
    else false
  end;
  if not allowed then raise exception 'Invalid hosting event transition'; end if;

  if p_target_status = 'sent' and not exists (
    select 1 from public.hosting_event_pets hep where hep.event_id = p_event_id
  ) then raise exception 'Hosting event requires at least one pet'; end if;

  if p_target_status = 'in_progress' and exists (
    select 1 from public.hosting_event_pets hep
    where hep.event_id = p_event_id and coalesce(hep.handoff_snapshot->>'prepared','false') <> 'true'
  ) then raise exception 'Handoff preparation is incomplete'; end if;

  if p_target_status = 'completed' and exists (
    select 1 from public.event_tasks t where t.event_id = p_event_id and t.completed_at is null
  ) then raise exception 'Checklist has unfinished tasks'; end if;

  if p_target_status = 'completed' and exists (
    select 1 from public.get_event_plan_progress(p_event_id) p
    where p.photos_done < p.min_photos
       or p.videos_done < p.min_videos
       or (p.activity_required and not p.activity_done)
  ) then raise exception 'Plan obligations are incomplete'; end if;

  update public.hosting_events
  set status = p_target_status,
      sent_at = case when p_target_status = 'sent' then now() else sent_at end,
      accepted_at = case when p_target_status = 'accepted' then now() else accepted_at end,
      started_at = case when p_target_status = 'in_progress' then now() else started_at end,
      completed_at = case when p_target_status = 'completed' then now() else completed_at end,
      cancelled_at = case when p_target_status = 'cancelled' then now() else cancelled_at end
  where id = p_event_id
  returning * into event_row;

  insert into public.chat_messages(event_id, sender_id, message_type, body)
  values(p_event_id, actor, 'event_status', p_target_status);
  return event_row;
end;
$$;

grant execute on function public.register_event_plan_media(uuid, uuid, text, text, numeric) to authenticated;
grant execute on function public.get_event_plan_progress(uuid) to authenticated;
grant execute on function public.get_event_report_entries(uuid) to authenticated;
grant execute on function public.get_event_pets(uuid) to authenticated;
