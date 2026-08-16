create table if not exists public.care_plans (
  code text primary key,
  name text not null,
  tagline text not null,
  description text not null,
  min_photos_per_day integer not null check (min_photos_per_day >= 0),
  suggested_photos_per_day integer not null check (suggested_photos_per_day >= min_photos_per_day),
  min_videos_per_day integer not null check (min_videos_per_day >= 0),
  video_max_seconds integer not null default 15 check (video_max_seconds between 1 and 60),
  activity_required boolean not null default false,
  daily_report boolean not null default false,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.care_plans(
  code, name, tagline, description, min_photos_per_day, suggested_photos_per_day,
  min_videos_per_day, video_max_seconds, activity_required, daily_report, sort_order, active
) values
  ('essential', 'Essencial', 'Tranquilidade com acompanhamento da rotina.', 'Alimentação e água conforme orientação, acompanhamento essencial e comunicação de alterações relevantes.', 1, 1, 0, 15, false, false, 10, true),
  ('care_plus', 'Cuidado+', 'Acompanhar mais de perto o dia do pet.', 'Tudo do Essencial, passeio ou atividade programada, acompanhamento fotográfico ampliado e vídeo curto.', 4, 6, 1, 15, true, false, 20, true),
  ('premium', 'Premium', 'Máxima proximidade durante a ausência.', 'Tudo do Cuidado+, acompanhamento fotográfico ampliado, dois vídeos curtos e relatório automático de cada período de cuidado.', 6, 8, 2, 15, true, true, 30, true)
on conflict (code) do update set
  name = excluded.name,
  tagline = excluded.tagline,
  description = excluded.description,
  min_photos_per_day = excluded.min_photos_per_day,
  suggested_photos_per_day = excluded.suggested_photos_per_day,
  min_videos_per_day = excluded.min_videos_per_day,
  video_max_seconds = excluded.video_max_seconds,
  activity_required = excluded.activity_required,
  daily_report = excluded.daily_report,
  sort_order = excluded.sort_order,
  active = excluded.active,
  updated_at = now();

alter table public.care_plans enable row level security;
drop policy if exists care_plans_authenticated_read on public.care_plans;
create policy care_plans_authenticated_read on public.care_plans
for select to authenticated using (active = true);

create table if not exists public.caregiver_service_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  accepts_multiday boolean not null default false,
  timezone_name text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.caregiver_plan_options (
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_code text not null references public.care_plans(code),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, plan_code)
);

create table if not exists public.caregiver_availability_windows (
  user_id uuid not null references public.profiles(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  starts_at time not null,
  ends_at time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, weekday),
  check (starts_at < ends_at)
);

alter table public.caregiver_service_profiles enable row level security;
alter table public.caregiver_plan_options enable row level security;
alter table public.caregiver_availability_windows enable row level security;

drop policy if exists caregiver_service_self on public.caregiver_service_profiles;
create policy caregiver_service_self on public.caregiver_service_profiles
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists caregiver_plans_self on public.caregiver_plan_options;
create policy caregiver_plans_self on public.caregiver_plan_options
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists caregiver_windows_self on public.caregiver_availability_windows;
create policy caregiver_windows_self on public.caregiver_availability_windows
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.get_my_caregiver_service_settings()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'accepts_multiday', coalesce(csp.accepts_multiday, false),
    'timezone_name', coalesce(csp.timezone_name, 'America/Sao_Paulo'),
    'plans', coalesce((
      select jsonb_agg(cpo.plan_code order by cp.sort_order)
      from public.caregiver_plan_options cpo
      join public.care_plans cp on cp.code = cpo.plan_code
      where cpo.user_id = auth.uid() and cpo.enabled = true and cp.active = true
    ), '[]'::jsonb),
    'weekdays', coalesce((
      select jsonb_agg(caw.weekday order by caw.weekday)
      from public.caregiver_availability_windows caw
      where caw.user_id = auth.uid()
    ), '[]'::jsonb),
    'starts_at', (
      select to_char(min(caw.starts_at), 'HH24:MI')
      from public.caregiver_availability_windows caw where caw.user_id = auth.uid()
    ),
    'ends_at', (
      select to_char(max(caw.ends_at), 'HH24:MI')
      from public.caregiver_availability_windows caw where caw.user_id = auth.uid()
    )
  )
  from (select 1) seed
  left join public.caregiver_service_profiles csp on csp.user_id = auth.uid()
  where auth.uid() is not null;
$$;

create or replace function public.save_my_caregiver_service_settings(
  p_plan_codes text[], p_weekdays integer[], p_starts_at time, p_ends_at time, p_accepts_multiday boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  plan_code text;
  weekday_value integer;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.profiles p where p.id = actor and p.caregiver_enabled = true) then
    raise exception 'Caregiver role is required';
  end if;
  if coalesce(array_length(p_plan_codes, 1), 0) = 0 then raise exception 'Select at least one plan'; end if;
  if coalesce(array_length(p_weekdays, 1), 0) = 0 then raise exception 'Select at least one available day'; end if;
  if p_starts_at is null or p_ends_at is null or p_starts_at >= p_ends_at then raise exception 'Invalid availability window'; end if;

  foreach plan_code in array p_plan_codes loop
    if not exists (select 1 from public.care_plans cp where cp.code = plan_code and cp.active = true) then
      raise exception 'Unknown plan: %', plan_code;
    end if;
  end loop;

  foreach weekday_value in array p_weekdays loop
    if weekday_value < 0 or weekday_value > 6 then raise exception 'Invalid weekday'; end if;
  end loop;

  insert into public.caregiver_service_profiles(user_id, accepts_multiday, timezone_name)
  values(actor, coalesce(p_accepts_multiday, false), 'America/Sao_Paulo')
  on conflict (user_id) do update set accepts_multiday = excluded.accepts_multiday, updated_at = now();

  delete from public.caregiver_plan_options where user_id = actor;
  insert into public.caregiver_plan_options(user_id, plan_code, enabled)
  select actor, x, true from unnest(p_plan_codes) x;

  delete from public.caregiver_availability_windows where user_id = actor;
  insert into public.caregiver_availability_windows(user_id, weekday, starts_at, ends_at)
  select actor, x::smallint, p_starts_at, p_ends_at from unnest(p_weekdays) x;

  return public.get_my_caregiver_service_settings();
end;
$$;

create or replace function private.caregiver_is_compatible(
  p_caregiver_id uuid, p_starts_at timestamptz, p_ends_at timestamptz, p_plan_codes text[]
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  svc public.caregiver_service_profiles;
  local_start timestamp;
  local_end timestamp;
  day_value date;
begin
  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at then return false; end if;
  select * into svc from public.caregiver_service_profiles where user_id = p_caregiver_id;
  if svc.user_id is null then return false; end if;
  if p_ends_at - p_starts_at > interval '24 hours' and not svc.accepts_multiday then return false; end if;
  if exists (
    select 1 from unnest(p_plan_codes) requested(code)
    where not exists (
      select 1 from public.caregiver_plan_options cpo
      where cpo.user_id = p_caregiver_id and cpo.plan_code = requested.code and cpo.enabled = true
    )
  ) then return false; end if;

  local_start := p_starts_at at time zone svc.timezone_name;
  local_end := p_ends_at at time zone svc.timezone_name;

  for day_value in select d::date from generate_series(local_start::date, local_end::date, interval '1 day') d loop
    if not exists (
      select 1 from public.caregiver_availability_windows caw
      where caw.user_id = p_caregiver_id and caw.weekday = extract(dow from day_value)::integer
    ) then return false; end if;
  end loop;

  if not exists (
    select 1 from public.caregiver_availability_windows caw
    where caw.user_id = p_caregiver_id
      and caw.weekday = extract(dow from local_start)::integer
      and local_start::time >= caw.starts_at and local_start::time <= caw.ends_at
  ) then return false; end if;

  if not exists (
    select 1 from public.caregiver_availability_windows caw
    where caw.user_id = p_caregiver_id
      and caw.weekday = extract(dow from local_end)::integer
      and local_end::time >= caw.starts_at and local_end::time <= caw.ends_at
  ) then return false; end if;

  return true;
end;
$$;

create or replace function public.list_compatible_caregivers(
  p_starts_at timestamptz, p_ends_at timestamptz, p_plan_codes text[]
)
returns table(
  id uuid, public_code text, full_name text, avatar_path text, plan_codes text[], accepts_multiday boolean,
  available_weekdays integer[], starts_at time, ends_at time
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id, p.public_code, p.full_name, p.avatar_path,
    array(
      select cpo.plan_code from public.caregiver_plan_options cpo
      join public.care_plans cp on cp.code = cpo.plan_code
      where cpo.user_id = p.id and cpo.enabled = true and cp.active = true order by cp.sort_order
    ),
    csp.accepts_multiday,
    array(select caw.weekday::integer from public.caregiver_availability_windows caw where caw.user_id = p.id order by caw.weekday),
    (select min(caw.starts_at) from public.caregiver_availability_windows caw where caw.user_id = p.id),
    (select max(caw.ends_at) from public.caregiver_availability_windows caw where caw.user_id = p.id)
  from public.profiles p
  join public.caregiver_service_profiles csp on csp.user_id = p.id
  where auth.uid() is not null
    and p.id <> auth.uid()
    and p.caregiver_enabled = true
    and private.caregiver_is_compatible(p.id, p_starts_at, p_ends_at, p_plan_codes)
  order by p.full_name;
$$;

alter table public.hosting_event_pets add column if not exists plan_code text;
alter table public.hosting_event_pets add column if not exists plan_snapshot jsonb;

update public.hosting_event_pets hep
set plan_code = coalesce(hep.plan_code, 'essential'),
    plan_snapshot = coalesce(hep.plan_snapshot, (
      select to_jsonb(cp) || jsonb_build_object('captured_at', now(), 'legacy_unenforced', true)
      from public.care_plans cp where cp.code = 'essential'
    ))
where hep.plan_code is null or hep.plan_snapshot is null;

alter table public.hosting_event_pets alter column plan_code set default 'essential';
alter table public.hosting_event_pets alter column plan_code set not null;
alter table public.hosting_event_pets alter column plan_snapshot set default '{}'::jsonb;
alter table public.hosting_event_pets alter column plan_snapshot set not null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'hosting_event_pets_plan_code_fkey') then
    alter table public.hosting_event_pets add constraint hosting_event_pets_plan_code_fkey foreign key (plan_code) references public.care_plans(code);
  end if;
end $$;

create table if not exists public.event_plan_periods (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.hosting_events(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  sequence_no integer not null check (sequence_no > 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique(event_id, pet_id, sequence_no),
  check (ends_at > starts_at)
);

alter table public.event_plan_periods enable row level security;
drop policy if exists event_plan_periods_member_read on public.event_plan_periods;
create policy event_plan_periods_member_read on public.event_plan_periods
for select to authenticated using (private.is_event_member(event_id, auth.uid()));

alter table public.event_tasks add column if not exists source text not null default 'custom';
alter table public.event_tasks add column if not exists plan_period_id uuid references public.event_plan_periods(id) on delete cascade;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'event_tasks_source_check') then
    alter table public.event_tasks add constraint event_tasks_source_check check (source in ('custom','photo_request','plan_activity'));
  end if;
end $$;

create table if not exists public.event_plan_media (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.hosting_events(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  plan_period_id uuid not null references public.event_plan_periods(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete cascade,
  media_type text not null check (media_type in ('photo','video')),
  storage_path text not null unique,
  duration_seconds numeric(6,2),
  created_at timestamptz not null default now(),
  check ((media_type = 'photo' and duration_seconds is null) or (media_type = 'video' and duration_seconds is not null and duration_seconds > 0))
);

alter table public.event_plan_media enable row level security;
drop policy if exists event_plan_media_member_read on public.event_plan_media;
create policy event_plan_media_member_read on public.event_plan_media
for select to authenticated using (private.is_event_member(event_id, auth.uid()));

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values('event-updates', 'event-updates', false, 62914560, array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists event_updates_member_read on storage.objects;
create policy event_updates_member_read on storage.objects
for select to authenticated using (
  bucket_id = 'event-updates'
  and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
  and private.is_event_member(((storage.foldername(name))[2])::uuid, auth.uid())
);

drop policy if exists event_updates_caregiver_insert on storage.objects;
create policy event_updates_caregiver_insert on storage.objects
for insert to authenticated with check (
  bucket_id = 'event-updates'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
  and (storage.foldername(name))[3] ~* '^[0-9a-f-]{36}$'
  and exists (
    select 1 from public.hosting_events he
    join public.hosting_event_pets hep on hep.event_id = he.id
    where he.id = ((storage.foldername(name))[2])::uuid
      and hep.pet_id = ((storage.foldername(name))[3])::uuid
      and he.caregiver_id = auth.uid()
      and he.status = 'in_progress'
  )
);

create or replace function public.create_hosting_draft_with_plans(
  p_caregiver_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_title text,
  p_pet_plans jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  event_id_value uuid;
  connection_row public.connections;
  user_a uuid;
  user_b uuid;
  item jsonb;
  pet_id_value uuid;
  plan_code_value text;
  pet_row public.pets;
  plan_row public.care_plans;
  period_start timestamptz;
  period_end timestamptz;
  period_seq integer;
  period_id_value uuid;
  requested_plans text[];
  sort_value integer := 0;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if p_caregiver_id is null or p_caregiver_id = actor then raise exception 'Invalid caregiver'; end if;
  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at then raise exception 'Invalid hosting period'; end if;
  if not exists (select 1 from public.profiles p where p.id = actor and p.tutor_enabled = true) then raise exception 'Tutor role is required'; end if;
  if not exists (select 1 from public.profiles p where p.id = p_caregiver_id and p.caregiver_enabled = true) then raise exception 'Caregiver is unavailable'; end if;
  if jsonb_typeof(p_pet_plans) <> 'array' or jsonb_array_length(p_pet_plans) = 0 then raise exception 'Select at least one pet and plan'; end if;

  select array_agg(distinct value->>'plan_code') into requested_plans from jsonb_array_elements(p_pet_plans) value;
  if not private.caregiver_is_compatible(p_caregiver_id, p_starts_at, p_ends_at, requested_plans) then
    raise exception 'Caregiver is not compatible with the selected plans or period';
  end if;

  if actor::text < p_caregiver_id::text then user_a := actor; user_b := p_caregiver_id; else user_a := p_caregiver_id; user_b := actor; end if;
  select * into connection_row from public.connections where user_a_id = user_a and user_b_id = user_b;
  if connection_row.id is not null and connection_row.status = 'blocked' then raise exception 'This caregiver is not available for this tutor'; end if;
  if connection_row.id is null then
    insert into public.connections(user_a_id, user_b_id, initiated_by, status, accepted_at)
    values(user_a, user_b, actor, 'accepted', now()) returning * into connection_row;
  elsif connection_row.status <> 'accepted' then
    update public.connections set status = 'accepted', accepted_at = now(), updated_at = now()
    where id = connection_row.id returning * into connection_row;
  end if;

  insert into public.hosting_events(connection_id, tutor_id, caregiver_id, title, status, starts_at, ends_at, tutor_instructions)
  values(connection_row.id, actor, p_caregiver_id, nullif(trim(p_title), ''), 'draft', p_starts_at, p_ends_at, null)
  returning id into event_id_value;

  for item in select value from jsonb_array_elements(p_pet_plans) value loop
    pet_id_value := (item->>'pet_id')::uuid;
    plan_code_value := item->>'plan_code';
    select * into pet_row from public.pets where id = pet_id_value and owner_id = actor;
    if pet_row.id is null then raise exception 'Pet does not belong to tutor'; end if;
    select * into plan_row from public.care_plans where code = plan_code_value and active = true;
    if plan_row.code is null then raise exception 'Invalid plan'; end if;

    insert into public.hosting_event_pets(event_id, pet_id, pet_snapshot, handoff_snapshot, plan_code, plan_snapshot)
    values(
      event_id_value,
      pet_row.id,
      jsonb_build_object(
        'captured_at', now(), 'source_updated_at', pet_row.updated_at, 'id', pet_row.id, 'name', pet_row.name,
        'species', pet_row.species, 'breed', pet_row.breed, 'sex', pet_row.sex, 'birth_date', pet_row.birth_date,
        'approximate_weight_kg', pet_row.approximate_weight_kg, 'size', pet_row.size,
        'primary_photo_path', pet_row.primary_photo_path, 'identification_notes', pet_row.identification_notes, 'dossier', pet_row.dossier
      ),
      jsonb_build_object('prepared', false, 'recorded_at', '', 'items', '[]'::jsonb, 'item_quantities', '', 'pet_state', '', 'observation', '', 'photos', '[]'::jsonb),
      plan_row.code,
      to_jsonb(plan_row) || jsonb_build_object('captured_at', now(), 'legacy_unenforced', false, 'additional_pet_discount_percent', 20)
    );

    period_start := p_starts_at;
    period_seq := 1;
    while period_start < p_ends_at loop
      period_end := least(period_start + interval '24 hours', p_ends_at);
      insert into public.event_plan_periods(event_id, pet_id, sequence_no, starts_at, ends_at)
      values(event_id_value, pet_row.id, period_seq, period_start, period_end)
      returning id into period_id_value;

      if plan_row.activity_required then
        sort_value := sort_value + 1;
        insert into public.event_tasks(event_id, pet_id, created_by, category, title, instructions, due_at, requires_photo, sort_order, source, plan_period_id)
        values(
          event_id_value, pet_row.id, actor, 'routine',
          'Passeio ou atividade programada — ' || pet_row.name || ' • período ' || period_seq,
          'O cuidador escolhe uma atividade adequada ao pet e registra uma foto como evidência.',
          period_end, true, sort_value, 'plan_activity', period_id_value
        );
      end if;

      period_start := period_end;
      period_seq := period_seq + 1;
    end loop;
  end loop;

  insert into public.contact_chat_preferences(user_id, connection_id, active_event_id)
  values(actor, connection_row.id, event_id_value)
  on conflict (user_id, connection_id) do update set active_event_id = excluded.active_event_id, updated_at = now();

  return event_id_value;
end;
$$;

grant execute on function public.get_my_caregiver_service_settings() to authenticated;
grant execute on function public.save_my_caregiver_service_settings(text[], integer[], time, time, boolean) to authenticated;
grant execute on function public.list_compatible_caregivers(timestamptz, timestamptz, text[]) to authenticated;
grant execute on function public.create_hosting_draft_with_plans(uuid, timestamptz, timestamptz, text, jsonb) to authenticated;
