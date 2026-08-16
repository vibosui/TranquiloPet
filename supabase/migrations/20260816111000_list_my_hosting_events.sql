create or replace function public.list_my_hosting_events()
returns table (
  id uuid,
  title text,
  status text,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    he.id,
    he.title,
    he.status,
    he.starts_at,
    he.ends_at,
    he.created_at
  from public.hosting_events he
  where auth.uid() is not null
    and (he.tutor_id = auth.uid() or he.caregiver_id = auth.uid())
  order by he.created_at desc;
$$;

revoke all on function public.list_my_hosting_events() from public;
grant execute on function public.list_my_hosting_events() to authenticated;
