# Tranquilo Pet — monitor local

Ferramenta exclusiva para desenvolvimento. Recebe eventos e cadastros dos celulares na rede local, persiste em SQLite, imprime atividades sanitizadas no terminal e atualiza um painel web em tempo real.

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

## Testes

```powershell
.\.venv\Scripts\python.exe -m pytest
```
