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
  required_plans text[];
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

  if p_target_status = 'accepted' then
    select array_agg(distinct hep.plan_code) into required_plans
    from public.hosting_event_pets hep
    where hep.event_id = p_event_id;

    if not private.caregiver_is_compatible(
      event_row.caregiver_id,
      event_row.starts_at,
      event_row.ends_at,
      coalesce(required_plans, array['essential']::text[])
    ) then
      raise exception 'Caregiver availability or plan compatibility changed';
    end if;
  end if;

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
