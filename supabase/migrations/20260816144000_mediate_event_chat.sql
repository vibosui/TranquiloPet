create table if not exists public.chat_question_presets (
  key text primary key,
  sender_role text not null check (sender_role in ('tutor', 'caregiver', 'both')),
  category text not null,
  body text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_answer_presets (
  key text primary key,
  question_key text not null references public.chat_question_presets(key) on delete cascade,
  sender_role text not null check (sender_role in ('tutor', 'caregiver', 'both')),
  body text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.chat_question_presets enable row level security;
alter table public.chat_answer_presets enable row level security;

drop policy if exists chat_question_presets_authenticated_read on public.chat_question_presets;
create policy chat_question_presets_authenticated_read
on public.chat_question_presets for select
to authenticated
using (active = true);

drop policy if exists chat_answer_presets_authenticated_read on public.chat_answer_presets;
create policy chat_answer_presets_authenticated_read
on public.chat_answer_presets for select
to authenticated
using (active = true);

grant select on public.chat_question_presets to authenticated;
grant select on public.chat_answer_presets to authenticated;

insert into public.chat_question_presets (key, sender_role, category, body, sort_order) values
  ('tutor_status_now', 'tutor', 'status', 'Como meu pet está agora?', 10),
  ('tutor_ate_normally', 'tutor', 'feeding', 'Ele comeu normalmente?', 20),
  ('tutor_drank_water', 'tutor', 'water', 'Ele está bebendo água normalmente?', 30),
  ('tutor_bathroom', 'tutor', 'hygiene', 'Ele já fez as necessidades?', 40),
  ('tutor_walk_status', 'tutor', 'walk', 'Como foi o passeio?', 50),
  ('tutor_calm_status', 'tutor', 'status', 'Ele está tranquilo e confortável?', 60),
  ('tutor_rest_status', 'tutor', 'routine', 'Ele conseguiu descansar ou dormir?', 70),
  ('tutor_behavior_change', 'tutor', 'behavior', 'Você percebeu algum comportamento diferente?', 80),
  ('tutor_medication_status', 'tutor', 'medication', 'A medicação programada foi administrada?', 90),
  ('tutor_adaptation', 'tutor', 'status', 'Como está a adaptação dele ao ambiente?', 100),
  ('caregiver_treat_permission', 'caregiver', 'feeding', 'Posso oferecer um petisco?', 110),
  ('caregiver_meal_time_adjust', 'caregiver', 'feeding', 'Posso ajustar um pouco o horário da refeição?', 120),
  ('caregiver_extra_walk', 'caregiver', 'walk', 'Posso fazer um passeio extra ou mais curto?', 130),
  ('caregiver_usual_behavior', 'caregiver', 'behavior', 'Esse comportamento costuma acontecer com ele?', 140),
  ('caregiver_comfort_item', 'caregiver', 'routine', 'Posso usar os brinquedos ou objetos enviados para acalmá-lo?', 150),
  ('caregiver_routine_adjust', 'caregiver', 'routine', 'Posso fazer um pequeno ajuste na rotina hoje?', 160)
on conflict (key) do update set
  sender_role = excluded.sender_role,
  category = excluded.category,
  body = excluded.body,
  sort_order = excluded.sort_order,
  active = true;

insert into public.chat_answer_presets (key, question_key, sender_role, body, sort_order) values
  ('status_calm', 'tutor_status_now', 'caregiver', 'Está tranquilo e bem.', 10),
  ('status_playing', 'tutor_status_now', 'caregiver', 'Está animado e brincando.', 20),
  ('status_resting', 'tutor_status_now', 'caregiver', 'Está descansando.', 30),
  ('status_anxious_controlled', 'tutor_status_now', 'caregiver', 'Está um pouco ansioso, mas está sob controle.', 40),
  ('status_adapting', 'tutor_status_now', 'caregiver', 'Está se adaptando ao ambiente.', 50),
  ('ate_all', 'tutor_ate_normally', 'caregiver', 'Sim, comeu normalmente.', 10),
  ('ate_part', 'tutor_ate_normally', 'caregiver', 'Comeu apenas uma parte.', 20),
  ('ate_none', 'tutor_ate_normally', 'caregiver', 'Ainda não quis comer.', 30),
  ('meal_not_yet', 'tutor_ate_normally', 'caregiver', 'A refeição ainda não aconteceu.', 40),
  ('water_normal', 'tutor_drank_water', 'caregiver', 'Sim, está bebendo normalmente.', 10),
  ('water_less', 'tutor_drank_water', 'caregiver', 'Bebeu um pouco menos que o normal.', 20),
  ('water_none_yet', 'tutor_drank_water', 'caregiver', 'Ainda não bebeu desde o último registro.', 30),
  ('water_changed', 'tutor_drank_water', 'caregiver', 'Acabei de trocar a água e estou acompanhando.', 40),
  ('bathroom_both', 'tutor_bathroom', 'caregiver', 'Sim, fez xixi e cocô.', 10),
  ('bathroom_urine', 'tutor_bathroom', 'caregiver', 'Fez apenas xixi.', 20),
  ('bathroom_stool', 'tutor_bathroom', 'caregiver', 'Fez apenas cocô.', 30),
  ('bathroom_none', 'tutor_bathroom', 'caregiver', 'Ainda não fez.', 40),
  ('walk_calm', 'tutor_walk_status', 'caregiver', 'Foi tranquilo.', 10),
  ('walk_pulled', 'tutor_walk_status', 'caregiver', 'Foi tranquilo, mas puxou um pouco a guia.', 20),
  ('walk_agitated', 'tutor_walk_status', 'caregiver', 'Ficou um pouco agitado durante o passeio.', 30),
  ('walk_not_yet', 'tutor_walk_status', 'caregiver', 'O passeio ainda não aconteceu.', 40),
  ('calm_yes', 'tutor_calm_status', 'caregiver', 'Sim, está tranquilo.', 10),
  ('calm_active', 'tutor_calm_status', 'caregiver', 'Está brincando e ativo.', 20),
  ('calm_resting', 'tutor_calm_status', 'caregiver', 'Está descansando.', 30),
  ('calm_restless', 'tutor_calm_status', 'caregiver', 'Está um pouco inquieto, mas estou acompanhando.', 40),
  ('rest_normal', 'tutor_rest_status', 'caregiver', 'Sim, descansou normalmente.', 10),
  ('rest_sleeping', 'tutor_rest_status', 'caregiver', 'Está dormindo agora.', 20),
  ('rest_little', 'tutor_rest_status', 'caregiver', 'Descansou pouco.', 30),
  ('rest_none', 'tutor_rest_status', 'caregiver', 'Ainda não quis descansar.', 40),
  ('behavior_no_change', 'tutor_behavior_change', 'caregiver', 'Não percebi nada diferente.', 10),
  ('behavior_quieter', 'tutor_behavior_change', 'caregiver', 'Está mais quieto que o habitual.', 20),
  ('behavior_more_active', 'tutor_behavior_change', 'caregiver', 'Está mais agitado que o habitual.', 30),
  ('behavior_different_controlled', 'tutor_behavior_change', 'caregiver', 'Apresentou um comportamento diferente, mas está sob controle.', 40),
  ('med_given', 'tutor_medication_status', 'caregiver', 'Sim, foi administrada conforme o checklist.', 10),
  ('med_not_time', 'tutor_medication_status', 'caregiver', 'Ainda não chegou o horário programado.', 20),
  ('med_not_given', 'tutor_medication_status', 'caregiver', 'Ainda não foi administrada.', 30),
  ('adapt_good', 'tutor_adaptation', 'caregiver', 'Está se adaptando bem.', 10),
  ('adapt_exploring', 'tutor_adaptation', 'caregiver', 'Ainda está reconhecendo o ambiente.', 20),
  ('adapt_close', 'tutor_adaptation', 'caregiver', 'Está mais próximo de mim e tranquilo.', 30),
  ('adapt_insecure', 'tutor_adaptation', 'caregiver', 'Está um pouco inseguro, mas está evoluindo.', 40),
  ('treat_sent_only', 'caregiver_treat_permission', 'tutor', 'Sim, apenas os petiscos enviados.', 10),
  ('treat_dossier', 'caregiver_treat_permission', 'tutor', 'Sim, seguindo as quantidades do dossiê.', 20),
  ('treat_no', 'caregiver_treat_permission', 'tutor', 'Não ofereça petiscos.', 30),
  ('meal_adjust_30', 'caregiver_meal_time_adjust', 'tutor', 'Pode ajustar em até 30 minutos.', 10),
  ('meal_keep', 'caregiver_meal_time_adjust', 'tutor', 'Prefiro manter o horário do dossiê.', 20),
  ('meal_adjust_calm', 'caregiver_meal_time_adjust', 'tutor', 'Pode ajustar se ele estiver tranquilo.', 30),
  ('extra_walk_yes', 'caregiver_extra_walk', 'tutor', 'Sim, pode fazer um passeio extra.', 10),
  ('extra_walk_short', 'caregiver_extra_walk', 'tutor', 'Pode fazer, mas prefiro um passeio mais curto.', 20),
  ('extra_walk_no', 'caregiver_extra_walk', 'tutor', 'Prefiro manter apenas os passeios planejados.', 30),
  ('usual_behavior_yes', 'caregiver_usual_behavior', 'tutor', 'Sim, isso costuma acontecer.', 10),
  ('usual_behavior_sometimes', 'caregiver_usual_behavior', 'tutor', 'Às vezes acontece.', 20),
  ('usual_behavior_no', 'caregiver_usual_behavior', 'tutor', 'Não é comum. Continue observando e registre pelo Hospeda Patas.', 30),
  ('comfort_any_sent', 'caregiver_comfort_item', 'tutor', 'Sim, pode usar os objetos enviados.', 10),
  ('comfort_attachment_only', 'caregiver_comfort_item', 'tutor', 'Use apenas o objeto de apego indicado no dossiê.', 20),
  ('comfort_no', 'caregiver_comfort_item', 'tutor', 'Prefiro que não use agora.', 30),
  ('routine_adjust_yes', 'caregiver_routine_adjust', 'tutor', 'Pode fazer um pequeno ajuste.', 10),
  ('routine_keep', 'caregiver_routine_adjust', 'tutor', 'Prefiro manter a rotina do dossiê.', 20),
  ('routine_time_only', 'caregiver_routine_adjust', 'tutor', 'Pode ajustar apenas o horário, sem mudar alimentação ou medicação.', 30)
on conflict (key) do update set
  question_key = excluded.question_key,
  sender_role = excluded.sender_role,
  body = excluded.body,
  sort_order = excluded.sort_order,
  active = true;

alter table public.chat_messages add column if not exists preset_key text;
alter table public.chat_messages add column if not exists reply_to_message_id uuid references public.chat_messages(id) on delete set null;

alter table public.chat_messages drop constraint if exists chat_messages_type_check;
alter table public.chat_messages add constraint chat_messages_type_check
  check (message_type = any (array[
    'text'::text,
    'system'::text,
    'task_completed'::text,
    'photo_evidence'::text,
    'event_status'::text,
    'preset_question'::text,
    'preset_answer'::text,
    'photo_request'::text
  ]));

drop policy if exists messages_member_insert on public.chat_messages;
create policy messages_member_insert
on public.chat_messages for insert
to authenticated
with check (
  sender_id = auth.uid()
  and private.is_event_member(event_id, auth.uid())
  and message_type = 'photo_evidence'
  and task_id is not null
  and evidence_id is not null
  and exists (
    select 1
    from public.task_evidence e
    join public.event_tasks t on t.id = e.task_id
    where e.id = evidence_id
      and e.task_id = task_id
      and e.uploaded_by = auth.uid()
      and t.event_id = event_id
  )
);

create or replace function public.send_chat_question(p_event_id uuid, p_question_key text)
returns public.chat_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  event_row public.hosting_events;
  question public.chat_question_presets;
  actor_role text;
  created public.chat_messages;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  select * into event_row from public.hosting_events where id = p_event_id;
  if event_row.id is null or actor not in (event_row.tutor_id, event_row.caregiver_id) then raise exception 'Not allowed'; end if;
  if event_row.status not in ('sent', 'accepted', 'in_progress') then raise exception 'Communication is not available for this event state'; end if;
  actor_role := case when actor = event_row.tutor_id then 'tutor' else 'caregiver' end;
  select * into question from public.chat_question_presets where key = p_question_key and active = true;
  if question.key is null or question.sender_role not in (actor_role, 'both') then raise exception 'Question is not available for this participant'; end if;
  insert into public.chat_messages(event_id, sender_id, message_type, body, preset_key)
  values (p_event_id, actor, 'preset_question', question.body, question.key)
  returning * into created;
  return created;
end;
$$;

create or replace function public.send_chat_answer(p_question_message_id uuid, p_answer_key text)
returns public.chat_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  question_message public.chat_messages;
  event_row public.hosting_events;
  answer public.chat_answer_presets;
  actor_role text;
  created public.chat_messages;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  select * into question_message from public.chat_messages where id = p_question_message_id and message_type = 'preset_question';
  if question_message.id is null then raise exception 'Question message not found'; end if;
  select * into event_row from public.hosting_events where id = question_message.event_id;
  if event_row.id is null or actor not in (event_row.tutor_id, event_row.caregiver_id) then raise exception 'Not allowed'; end if;
  if event_row.status not in ('sent', 'accepted', 'in_progress') then raise exception 'Communication is not available for this event state'; end if;
  if question_message.sender_id = actor then raise exception 'You cannot answer your own question'; end if;
  if exists (select 1 from public.chat_messages where reply_to_message_id = p_question_message_id and message_type = 'preset_answer') then raise exception 'Question already answered'; end if;
  actor_role := case when actor = event_row.tutor_id then 'tutor' else 'caregiver' end;
  select * into answer from public.chat_answer_presets where key = p_answer_key and question_key = question_message.preset_key and active = true;
  if answer.key is null or answer.sender_role not in (actor_role, 'both') then raise exception 'Answer is not available for this participant'; end if;
  insert into public.chat_messages(event_id, sender_id, message_type, body, preset_key, reply_to_message_id)
  values (question_message.event_id, actor, 'preset_answer', answer.body, answer.key, question_message.id)
  returning * into created;
  return created;
end;
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
  pet_name text;
  next_sort integer;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  select * into event_row from public.hosting_events where id = p_event_id;
  if event_row.id is null or actor <> event_row.tutor_id then raise exception 'Only the tutor can request a photo'; end if;
  if event_row.status <> 'in_progress' then raise exception 'Photos can only be requested during an active hosting event'; end if;
  select * into event_pet from public.hosting_event_pets where event_id = p_event_id and pet_id = p_pet_id;
  if event_pet.pet_id is null then raise exception 'Pet is not part of this hosting event'; end if;
  if exists (
    select 1 from public.chat_messages m join public.event_tasks t on t.id = m.task_id
    where m.event_id = p_event_id and m.message_type = 'photo_request' and t.pet_id = p_pet_id and t.completed_at is null
  ) then raise exception 'There is already a pending photo request for this pet'; end if;
  pet_name := coalesce(nullif(event_pet.pet_snapshot->>'name', ''), 'pet');
  select coalesce(max(sort_order), -1) + 1 into next_sort from public.event_tasks where event_id = p_event_id;
  insert into public.event_tasks(event_id, pet_id, created_by, category, title, instructions, due_at, requires_photo, sort_order)
  values (p_event_id, p_pet_id, actor, 'photo', 'Foto solicitada: ' || pet_name, 'Responder pelo Hospeda Patas com uma foto atual capturada pela câmera.', null, true, next_sort)
  returning * into task_row;
  insert into public.chat_messages(event_id, sender_id, message_type, body, task_id, preset_key)
  values (p_event_id, actor, 'photo_request', 'Pode enviar uma foto atual de ' || pet_name || '?', task_row.id, 'photo_request')
  returning * into created;
  return created;
end;
$$;

revoke all on function public.send_chat_question(uuid, text) from public;
revoke all on function public.send_chat_answer(uuid, text) from public;
revoke all on function public.request_pet_photo(uuid, uuid) from public;
grant execute on function public.send_chat_question(uuid, text) to authenticated;
grant execute on function public.send_chat_answer(uuid, text) to authenticated;
grant execute on function public.request_pet_photo(uuid, uuid) to authenticated;
