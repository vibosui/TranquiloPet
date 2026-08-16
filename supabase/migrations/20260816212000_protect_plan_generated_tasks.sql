drop policy if exists tasks_tutor_delete_draft on public.event_tasks;
create policy tasks_tutor_delete_draft
on public.event_tasks for delete
to authenticated
using (
  source = 'custom'
  and exists (
    select 1
    from public.hosting_events he
    where he.id = event_tasks.event_id
      and he.tutor_id = auth.uid()
      and he.status = 'draft'
  )
);
