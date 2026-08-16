create extension if not exists pg_net with schema extensions;

create or replace function private.create_chat_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.hosting_events;
  recipient uuid;
  notification_title text;
  notification_body text;
begin
  select * into event_row from public.hosting_events where id = new.event_id;
  if event_row.id is null or new.sender_id is null then return new; end if;

  recipient := case
    when new.sender_id = event_row.tutor_id then event_row.caregiver_id
    when new.sender_id = event_row.caregiver_id then event_row.tutor_id
    else null
  end;
  if recipient is null then return new; end if;

  notification_title := case new.message_type
    when 'preset_question' then 'Nova pergunta sobre a hospedagem'
    when 'preset_answer' then 'Nova resposta sobre a hospedagem'
    when 'photo_request' then 'Foto do pet solicitada'
    when 'photo_evidence' then 'Nova foto do cuidado'
    when 'task_completed' then 'Checklist atualizado'
    when 'incident_reported' then 'Ocorrência registrada'
    when 'incident_update' then 'Ocorrência atualizada'
    when 'event_status' then 'Hospedagem atualizada'
    else 'Hospeda Patas'
  end;

  notification_body := case new.message_type
    when 'preset_question' then left(coalesce(new.body, 'Há uma nova pergunta sobre o pet.'), 180)
    when 'preset_answer' then left(coalesce(new.body, 'Há uma nova resposta sobre o pet.'), 180)
    when 'photo_request' then left(coalesce(new.body, 'O tutor solicitou uma foto atual do pet.'), 180)
    when 'photo_evidence' then 'Uma nova evidência fotográfica foi registrada.'
    when 'task_completed' then 'Tarefa concluída: ' || coalesce(new.body, 'checklist')
    when 'incident_reported' then left(coalesce(new.body, 'Uma ocorrência requer atenção.'), 180)
    when 'incident_update' then left(coalesce(new.body, 'Uma ocorrência recebeu atualização.'), 180)
    when 'event_status' then 'Novo estado: ' || coalesce(new.body, 'atualizado')
    else left(coalesce(new.body, 'Há uma novidade na hospedagem.'), 180)
  end;

  insert into public.notifications(user_id, event_id, type, title, body, payload)
  values(
    recipient,
    new.event_id,
    new.message_type,
    notification_title,
    notification_body,
    jsonb_build_object(
      'message_id', new.id,
      'event_id', new.event_id,
      'message_type', new.message_type,
      'url', '/hosting/' || new.event_id::text
    )
  );
  return new;
end;
$$;

create or replace function private.create_plan_media_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.hosting_events;
  pet_name text;
begin
  select * into event_row from public.hosting_events where id = new.event_id;
  if event_row.id is null or new.uploaded_by <> event_row.caregiver_id then return new; end if;

  select coalesce(nullif(hep.pet_snapshot->>'name', ''), 'pet') into pet_name
  from public.hosting_event_pets hep
  where hep.event_id = new.event_id and hep.pet_id = new.pet_id;

  insert into public.notifications(user_id, event_id, type, title, body, payload)
  values(
    event_row.tutor_id,
    new.event_id,
    'plan_' || new.media_type,
    case when new.media_type = 'video' then 'Novo vídeo do cuidado' else 'Nova foto do cuidado' end,
    case when new.media_type = 'video' then 'O cuidador registrou um novo vídeo de ' || coalesce(pet_name, 'seu pet') || '.' else 'O cuidador registrou uma nova foto de ' || coalesce(pet_name, 'seu pet') || '.' end,
    jsonb_build_object(
      'event_id', new.event_id,
      'pet_id', new.pet_id,
      'media_id', new.id,
      'media_type', new.media_type,
      'url', '/hosting/' || new.event_id::text
    )
  );
  return new;
end;
$$;

drop trigger if exists event_plan_media_create_notification on public.event_plan_media;
create trigger event_plan_media_create_notification
after insert on public.event_plan_media
for each row execute function private.create_plan_media_notification();

create or replace function private.dispatch_expo_push_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  token_row record;
  queued boolean := false;
  notification_url text;
begin
  notification_url := coalesce(new.payload->>'url', case when new.event_id is not null then '/hosting/' || new.event_id::text else '/notifications' end);

  for token_row in
    select expo_push_token
    from public.device_push_tokens
    where user_id = new.user_id
      and last_seen_at > now() - interval '90 days'
      and (expo_push_token like 'ExponentPushToken[%]' or expo_push_token like 'ExpoPushToken[%]')
  loop
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Accept', 'application/json',
        'Accept-Encoding', 'gzip, deflate'
      ),
      body := jsonb_build_object(
        'to', token_row.expo_push_token,
        'title', new.title,
        'body', new.body,
        'sound', 'default',
        'priority', 'high',
        'channelId', 'hosting-updates',
        'data', new.payload || jsonb_build_object(
          'notification_id', new.id,
          'event_id', new.event_id,
          'url', notification_url
        )
      ),
      timeout_milliseconds := 5000
    );
    queued := true;
  end loop;

  if queued then
    update public.notifications set push_sent_at = now() where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists notifications_dispatch_expo_push on public.notifications;
create trigger notifications_dispatch_expo_push
after insert on public.notifications
for each row execute function private.dispatch_expo_push_notification();

create index if not exists notifications_user_created_idx on public.notifications(user_id, created_at desc);
create index if not exists device_push_tokens_user_seen_idx on public.device_push_tokens(user_id, last_seen_at desc);
