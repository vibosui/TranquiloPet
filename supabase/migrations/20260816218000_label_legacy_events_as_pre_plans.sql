insert into public.care_plans(
  code, name, tagline, description, min_photos_per_day, suggested_photos_per_day,
  min_videos_per_day, video_max_seconds, activity_required, daily_report, sort_order, active
) values(
  'legacy', 'Pré-planos', 'Hospedagem criada antes da definição dos planos.',
  'Registro histórico sem imposição retroativa das novas obrigações de acompanhamento.',
  0, 0, 0, 15, false, false, 0, false
)
on conflict (code) do update set
  name = excluded.name,
  tagline = excluded.tagline,
  description = excluded.description,
  active = false,
  updated_at = now();

update public.hosting_event_pets
set plan_code = 'legacy',
    plan_snapshot = jsonb_set(plan_snapshot, '{name}', to_jsonb('Pré-planos'::text), true)
where coalesce(plan_snapshot->>'legacy_unenforced', 'false') = 'true';
