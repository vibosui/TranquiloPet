# Preparação local no Windows

## Estado verificado desta máquina

Verificado em 15 de agosto de 2026:

| Ferramenta | Estado |
|---|---|
| Git | `2.55.0.windows.3` |
| Node.js | `24.19.0` |
| npm | `11.17.0` |
| Python | `3.13.14` |
| Expo / React Native | SDK `54.0.36` / RN `0.81.5` |
| Expo Go testado | cliente `54.0.8`, SDK suportado `54` |
| Java | Java 8; inadequado para builds Android atuais |
| Android SDK / ADB | ainda não instalado |
| Docker / Supabase CLI | ainda não instalados |

Feche e reabra o PowerShell depois de instalar Node ou Python para atualizar o `Path`.

## Teste atual com celulares físicos

Instale apenas:

1. Node.js 24 LTS;
2. Python 3.12 ou superior;
3. Expo Go atualizado no celular;
4. dependências npm e o ambiente virtual descritos no [README](../README.md).

Não instale `expo-cli` globalmente. O projeto usa a CLI correspondente ao SDK 54 pelo workspace npm.

### Configurar a rede

Descubra o IPv4 da interface Wi-Fi com `ipconfig`. Em `apps/mobile/.env.local`, use:

```env
EXPO_PUBLIC_MONITOR_API_URL=http://192.168.1.6:8000
```

`localhost` não funciona no app: no celular ele aponta para o próprio aparelho. Reinicie o Metro sempre que alterar esse arquivo.

O monitor escuta a rede privada para receber os aparelhos. Permita o Python apenas em **redes privadas** no Firewall do Windows, use um Wi-Fi confiável e mantenha Radmin VPN ou outras interfaces desnecessárias desligadas. O servidor rejeita endereços que não sejam privados, mas não possui autenticação; use somente dados fictícios.

### Executar

Terminal 1:

```powershell
npm.cmd run monitor
```

Terminal 2:

```powershell
npm.cmd run start
```

Painel no computador: `http://127.0.0.1:8000`. O QR Code fica no Terminal 2 enquanto o Metro estiver ativo.

### Roteiro em dois aparelhos

1. Abra `http://192.168.1.6:8000/api/health` no navegador de cada celular.
2. Leia o mesmo QR Code com o Expo Go nos dois aparelhos.
3. Toque em **Testar interação** e confirme duas sessões no painel.
4. Envie o formulário vazio e confirme os cinco erros e o foco no primeiro campo.
5. Cadastre um perfil fictício válido e confirme sucesso no app, no CMD e no painel.
6. Desligue o Wi-Fi, tente outro cadastro e confirme a mensagem de conexão sem perder os campos.
7. Religue o Wi-Fi e tente novamente; a chave de submissão evita criar o mesmo perfil duas vezes se a primeira resposta tiver se perdido.
8. Feche e reabra o painel para confirmar que o SQLite preservou os dados.

## Emulador e builds Android locais

Não são necessários para este teste com Expo Go. Para a próxima fase, instale:

1. Android Studio e Android SDK;
2. Android Virtual Device;
3. JDK 17;
4. `ANDROID_HOME`, normalmente `%LOCALAPPDATA%\Android\Sdk`;
5. `platform-tools` no `Path`.

No Windows não há simulador iOS. Um iPhone físico pode usar Expo Go; builds iOS posteriores podem usar EAS Build.

## Supabase e builds distribuíveis

Quando começarmos o backend real, instalaremos Docker Desktop com WSL 2 e a Supabase CLI como dependência do projeto. Pagamentos sempre usarão sandbox. EAS será configurado somente quando sairmos do Expo Go.

## Segredos

- `.env.example` contém apenas nomes ou exemplos públicos.
- arquivos `.env.local` são ignorados pelo Git;
- `EXPO_PUBLIC_*` fica visível no bundle e nunca recebe segredo;
- tokens do Mercado Pago e chaves administrativas do Supabase ficam somente no backend.
