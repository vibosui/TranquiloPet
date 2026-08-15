const eventLabels = {
  app_opened: 'Aplicativo aberto',
  interaction_test_pressed: 'Interação de teste',
  tutor_registration_opened: 'Cadastro de tutor aberto',
  tutor_registration_submit_started: 'Envio do cadastro iniciado',
  tutor_registration_validation_failed: 'Validação do cadastro falhou',
  tutor_registration_submit_failed: 'Envio do cadastro falhou',
  tutor_registration_succeeded: 'Cadastro de tutor concluído',
  demo_login_succeeded: 'Login de demonstração concluído',
  demo_account_registered: 'Conta local criada',
  demo_logout: 'Sessão local encerrada',
  profile_viewed: 'Perfil consultado',
  tutor_profile_saved: 'Perfil de tutor salvo',
  caregiver_profile_saved: 'Perfil de cuidador salvo',
  pet_profile_viewed: 'Perfil de pet consultado',
  pet_profile_saved: 'Perfil de pet salvo',
};

const elements = {
  liveStatus: document.querySelector('#live-status'),
  liveLabel: document.querySelector('#live-label'),
  refreshButton: document.querySelector('#refresh-button'),
  activeSessions: document.querySelector('#metric-active-sessions'),
  eventsToday: document.querySelector('#metric-events-today'),
  profileSaves: document.querySelector('#metric-profile-saves'),
  accountsCreated: document.querySelector('#metric-accounts-created'),
  eventCount: document.querySelector('#event-count'),
  activityList: document.querySelector('#activity-list'),
};

let refreshTimer;

function setConnectionState(state, label) {
  elements.liveStatus.dataset.state = state;
  elements.liveLabel.textContent = label;
}

function formatTime(value) {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value));
}

function platformInitial(platform) {
  if (platform === 'android') return 'A';
  if (platform === 'ios') return 'i';
  return 'W';
}

function renderMetrics(metrics) {
  elements.activeSessions.textContent = metrics.active_sessions;
  elements.eventsToday.textContent = metrics.events_today;
  elements.profileSaves.textContent = metrics.profile_saves;
  elements.accountsCreated.textContent = metrics.accounts_created;
}

function renderEvents(events) {
  elements.eventCount.textContent = `${events.length} evento${events.length === 1 ? '' : 's'}`;
  elements.activityList.replaceChildren();

  if (events.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'Aguardando a primeira interação do aplicativo.';
    elements.activityList.append(empty);
    return;
  }

  for (const event of events) {
    const item = document.createElement('div');
    item.className = 'activity-item';

    const avatar = document.createElement('span');
    avatar.className = 'activity-avatar';
    avatar.textContent = platformInitial(event.platform);

    const copy = document.createElement('div');
    copy.className = 'activity-copy';
    const title = document.createElement('strong');
    title.textContent = eventLabels[event.event_name] ?? event.event_name;
    const detail = document.createElement('small');
    detail.textContent = `${event.platform} · ${event.screen} · ${event.session_id.slice(0, 16)}`;
    copy.append(title, detail);

    const time = document.createElement('time');
    time.className = 'activity-time';
    time.dateTime = event.received_at;
    time.textContent = formatTime(event.received_at);

    item.append(avatar, copy, time);
    elements.activityList.append(item);
  }
}

async function refreshDashboard() {
  elements.refreshButton.disabled = true;
  try {
    const response = await fetch('/api/dashboard/snapshot', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const snapshot = await response.json();
    renderMetrics(snapshot.metrics);
    renderEvents(snapshot.events);
  } catch (error) {
    console.error('Falha ao atualizar o painel', error);
    setConnectionState('offline', 'Painel indisponível');
  } finally {
    elements.refreshButton.disabled = false;
  }
}

function scheduleRefresh() {
  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(refreshDashboard, 120);
}

function connectLiveStream() {
  const stream = new EventSource('/api/dashboard/stream');

  stream.addEventListener('ready', () => {
    setConnectionState('online', 'Ao vivo');
  });

  stream.addEventListener('update', () => {
    setConnectionState('online', 'Ao vivo');
    scheduleRefresh();
  });

  stream.onerror = () => {
    setConnectionState('connecting', 'Reconectando…');
  };
}

elements.refreshButton.addEventListener('click', refreshDashboard);
void refreshDashboard();
connectLiveStream();
window.setInterval(refreshDashboard, 30_000);
