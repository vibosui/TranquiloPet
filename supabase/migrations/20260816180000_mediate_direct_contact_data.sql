create or replace function private.sanitize_pet_snapshot(p_snapshot jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
    when p_snapshot is null then null
    else
      (p_snapshot - 'tutor_phone' - 'tutor_whatsapp')
      #- '{dossier,emergency,tutor_phone}'
      #- '{dossier,emergency,tutor_whatsapp}'
  end;
$$;

drop policy if exists profiles_read_self_or_connections on public.profiles;
drop policy if exists profiles_read_self on public.profiles;
create policy profiles_read_self
on public.profiles for select
to authenticated
using (id = auth.uid());

create or replace function public.get_safe_connected_profile(p_profile_id uuid)
returns table(
  id uuid,
  public_code text,
  full_name text,
  phone text,
  avatar_path text,
  tutor_enabled boolean,
  caregiver_enabled boolean,
  created_at timestamptz,
  updated_at timestamptz
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
    null::text as phone,
    p.avatar_path,
    p.tutor_enabled,
    p.caregiver_enabled,
    p.created_at,
    p.updated_at
  from public.profiles p
  where p.id = p_profile_id
    and auth.uid() is not null
    and (
      p.id = auth.uid()
      or exists (
        select 1
        from public.connections c
        where c.status = 'accepted'
          and (
            (c.user_a_id = auth.uid() and c.user_b_id = p.id)
            or (c.user_b_id = auth.uid() and c.user_a_id = p.id)
          )
      )
    );
$$;

create or replace function public.list_my_safe_connection_profiles()
returns table(
  id uuid,
  public_code text,
  full_name text,
  phone text,
  avatar_path text,
  tutor_enabled boolean,
  caregiver_enabled boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct
    p.id,
    p.public_code,
    p.full_name,
    null::text as phone,
    p.avatar_path,
    p.tutor_enabled,
    p.caregiver_enabled,
    p.created_at,
    p.updated_at
  from public.connections c
  join public.profiles p
    on p.id = case when c.user_a_id = auth.uid() then c.user_b_id else c.user_a_id end
  where auth.uid() is not null
    and c.status = 'accepted'
    and auth.uid() in (c.user_a_id, c.user_b_id);
$$;

create or replace function public.get_event_participant_profiles(p_event_id uuid)
returns table(
  id uuid,
  public_code text,
  full_name text,
  phone text,
  avatar_path text,
  tutor_enabled boolean,
  caregiver_enabled boolean,
  created_at timestamptz,
  updated_at timestamptz
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
    null::text as phone,
    p.avatar_path,
    p.tutor_enabled,
    p.caregiver_enabled,
    p.created_at,
    p.updated_at
  from public.hosting_events he
  join public.profiles p on p.id in (he.tutor_id, he.caregiver_id)
  where he.id = p_event_id
    and auth.uid() is not null
    and auth.uid() in (he.tutor_id, he.caregiver_id);
$$;

drop policy if exists event_pets_member_read on public.hosting_event_pets;
drop policy if exists event_pets_tutor_read on public.hosting_event_pets;
create policy event_pets_tutor_read
on public.hosting_event_pets for select
to authenticated
using (
  exists (
    select 1
    from public.hosting_events he
    where he.id = hosting_event_pets.event_id
      and he.tutor_id = auth.uid()
  )
);

create or replace function public.get_event_pets(p_event_id uuid)
returns table(
  event_id uuid,
  pet_id uuid,
  pet_snapshot jsonb,
  handoff_snapshot jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    ep.event_id,
    ep.pet_id,
    case
      when auth.uid() = he.caregiver_id then private.sanitize_pet_snapshot(ep.pet_snapshot)
      else ep.pet_snapshot
    end as pet_snapshot,
    ep.handoff_snapshot
  from public.hosting_event_pets ep
  join public.hosting_events he on he.id = ep.event_id
  where ep.event_id = p_event_id
    and auth.uid() is not null
    and auth.uid() in (he.tutor_id, he.caregiver_id);
$$;

create or replace function public.list_pets_under_my_care()
returns table(
  event_id uuid,
  pet_id uuid,
  event_title text,
  event_status text,
  starts_at timestamptz,
  ends_at timestamptz,
  pet_snapshot jsonb,
  handoff_snapshot jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    ep.event_id,
    ep.pet_id,
    he.title as event_title,
    he.status::text as event_status,
    he.starts_at,
    he.ends_at,
    private.sanitize_pet_snapshot(ep.pet_snapshot) as pet_snapshot,
    ep.handoff_snapshot
  from public.hosting_event_pets ep
  join public.hosting_events he on he.id = ep.event_id
  where he.caregiver_id = auth.uid()
    and he.status in ('accepted', 'in_progress')
  order by he.starts_at desc nulls last, he.created_at desc;
$$;

revoke all on function public.get_safe_connected_profile(uuid) from public;
revoke all on function public.list_my_safe_connection_profiles() from public;
revoke all on function public.get_event_participant_profiles(uuid) from public;
revoke all on function public.get_event_pets(uuid) from public;
grant execute on function public.get_safe_connected_profile(uuid) to authenticated;
grant execute on function public.list_my_safe_connection_profiles() to authenticated;
grant execute on function public.get_event_participant_profiles(uuid) to authenticated;
grant execute on function public.get_event_pets(uuid) to authenticated;
