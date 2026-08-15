# Tranquilo Pet — monitor local

Ferramenta exclusiva para desenvolvimento. Recebe eventos sanitizados dos celulares na rede local, persiste somente esses eventos em SQLite, imprime atividades no terminal e atualiza um painel web em tempo real.

Não use como backend de produção: não há autenticação, autorização por usuário ou TLS.

O servidor aceita ingestão apenas de endereços privados/loopback. Ainda assim, mantenha VPNs desnecessárias desligadas e permita o Python somente em redes privadas no Firewall do Windows.

## Instalação

Requer Python 3.12 ou superior.

```powershell
cd tools\dev-monitor
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
```

## Executar

```powershell
.\.venv\Scripts\tranquilo-pet-monitor.exe
```

- Painel local: `http://127.0.0.1:8000`
- Saúde pela LAN: `http://IP_DO_COMPUTADOR:8000/api/health`
- Banco: `%LOCALAPPDATA%\TranquiloPet\dev-monitor\monitor.sqlite3`

No app, crie `apps/mobile/.env.local`:

```env
EXPO_PUBLIC_MONITOR_API_URL=http://IP_DO_COMPUTADOR:8000
```

Reinicie o Metro depois de alterar variáveis de ambiente.

## Dados aceitos

- `POST /api/events`: recebe somente nomes de eventos, plataforma, tela, identificador efêmero de sessão e um conjunto restrito de metadados.
- `GET /api/health`: pode ser consultado pelos celulares na rede privada.
- Painel, snapshot e stream SSE: disponíveis somente em loopback no computador.

O monitor não recebe nomes, e-mails, telefones, CPF, localização ou conteúdo digitado nos formulários. O endpoint legado `POST /api/tutors` foi removido e responde `404`.

Instalações antigas podem manter a tabela `tutor_profiles` dentro do arquivo SQLite. Ela não é consultada nem exposta pelo monitor atual e não é apagada automaticamente, para evitar perda destrutiva de dados. Para descartar todo o laboratório antigo, pare o monitor e remova manualmente o arquivo indicado em **Banco** somente se esses dados não forem mais necessários.

As métricas do painel são derivadas dos eventos sanitizados:

- sessões ativas nos últimos cinco minutos;
- eventos recebidos hoje;
- perfis de tutor, cuidador e pet salvos hoje;
- contas locais criadas hoje.

## Testes

```powershell
.\.venv\Scripts\python.exe -m pytest
```
