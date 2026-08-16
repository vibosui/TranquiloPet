create or replace function public.list_pets_under_my_care()
returns table (
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
security invoker
set search_path = public
as $$
  select
    ep.event_id,
    ep.pet_id,
    he.title as event_title,
    he.status::text as event_status,
    he.starts_at,
    he.ends_at,
    ep.pet_snapshot,
    ep.handoff_snapshot
  from public.hosting_event_pets ep
  join public.hosting_events he on he.id = ep.event_id
  where he.caregiver_id = auth.uid()
    and he.status in ('accepted', 'in_progress')
  order by he.starts_at desc nulls last, he.created_at desc;
$$;

revoke all on function public.list_pets_under_my_care() from public;
grant execute on function public.list_pets_under_my_care() to authenticated;
