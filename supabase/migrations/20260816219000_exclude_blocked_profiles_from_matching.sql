create or replace function public.list_compatible_caregivers(
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_plan_codes text[]
)
returns table(
  id uuid,
  public_code text,
  full_name text,
  avatar_path text,
  plan_codes text[],
  accepts_multiday boolean,
  available_weekdays integer[],
  starts_at time,
  ends_at time
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.public_code,
    p.full_name,
    p.avatar_path,
    array(
      select cpo.plan_code
      from public.caregiver_plan_options cpo
      join public.care_plans cp on cp.code = cpo.plan_code
      where cpo.user_id = p.id and cpo.enabled = true and cp.active = true
      order by cp.sort_order
    ) as plan_codes,
    csp.accepts_multiday,
    array(
      select caw.weekday::integer
      from public.caregiver_availability_windows caw
      where caw.user_id = p.id
      order by caw.weekday
    ) as available_weekdays,
    (select min(caw.starts_at) from public.caregiver_availability_windows caw where caw.user_id = p.id) as starts_at,
    (select max(caw.ends_at) from public.caregiver_availability_windows caw where caw.user_id = p.id) as ends_at
  from public.profiles p
  join public.caregiver_service_profiles csp on csp.user_id = p.id
  where auth.uid() is not null
    and p.id <> auth.uid()
    and p.caregiver_enabled = true
    and not exists (
      select 1
      from public.connections c
      where c.status = 'blocked'
        and ((c.user_a_id = auth.uid() and c.user_b_id = p.id) or (c.user_b_id = auth.uid() and c.user_a_id = p.id))
    )
    and private.caregiver_is_compatible(p.id, p_starts_at, p_ends_at, p_plan_codes)
  order by p.full_name;
$$;
