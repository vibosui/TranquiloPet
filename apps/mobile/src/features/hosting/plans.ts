export type CarePlanCode = 'essential' | 'care_plus' | 'premium';

export type CarePlan = {
  code: CarePlanCode;
  name: string;
  tagline: string;
  description: string;
  min_photos_per_day: number;
  suggested_photos_per_day: number;
  min_videos_per_day: number;
  video_max_seconds: number;
  activity_required: boolean;
  daily_report: boolean;
  sort_order: number;
};

export const planShortFeatures = (plan: CarePlan) => {
  const features = [`${plan.min_photos_per_day}+ foto(s) por período de 24 h`];
  if (plan.activity_required) features.push('1 passeio ou atividade com evidência');
  if (plan.min_videos_per_day > 0) {
    features.push(`${plan.min_videos_per_day} vídeo(s) curto(s) de até ${plan.video_max_seconds}s`);
  }
  if (plan.daily_report) features.push('Relatório automático completo');
  features.push('Ocorrências relevantes sempre comunicadas');
  return features;
};

export const planName = (code: string | null | undefined) => {
  if (code === 'care_plus') return 'Cuidado+';
  if (code === 'premium') return 'Premium';
  return 'Essencial';
};
