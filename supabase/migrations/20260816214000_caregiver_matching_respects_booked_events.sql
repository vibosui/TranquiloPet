create or replace function private.caregiver_is_compatible(
  p_caregiver_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_plan_codes text[]
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
    select 1
    from public.hosting_events he
    where he.caregiver_id = p_caregiver_id
      and he.status in ('accepted', 'in_progress')
      and he.starts_at is not null
      and he.ends_at is not null
      and tstzrange(he.starts_at, he.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
  ) then return false; end if;

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
