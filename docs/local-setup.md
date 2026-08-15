# Preparação local no Windows

## Diagnóstico desta máquina

Verificado em 15 de agosto de 2026:

| Ferramenta | Estado |
|---|---|
| Git | instalado (`2.55.0.windows.3`) |
| Node.js | não encontrado |
| npm | não encontrado |
| Java | Java 8 encontrado; inadequado para builds Android atuais |
| Android SDK / ADB | não encontrado |
| Docker | não encontrado |
| Supabase CLI | não encontrada |
| EAS CLI | não encontrada |

## Fase 1: suficiente para o primeiro app no celular

### 1. Node.js LTS

Instale o Node.js 24 LTS pelo instalador MSI oficial para Windows. O npm já acompanha o Node.js. O `winget` não está disponível nesta máquina, portanto o instalador oficial é o caminho recomendado.

Feche e abra novamente o PowerShell e valide:

```powershell
node --version
npm --version
```

Na raiz do projeto, execute também:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\check-environment.ps1
```

Não instale `expo-cli` globalmente. O projeto usará a CLI correspondente à versão do Expo por meio de `npx`.

### 2. Expo Go no celular

Instale **Expo Go** pela Play Store ou App Store. Para o primeiro teste, computador e celular devem preferencialmente estar na mesma rede Wi-Fi.

Depois que o app for criado, o fluxo será:

```powershell
npm install
npm run start
```

O terminal exibirá um QR Code. No Android, ele pode ser aberto pelo Expo Go. No iPhone, pode ser lido pela câmera.

Se a rede bloquear a conexão local, tentaremos o modo tunnel. Não o adotaremos como padrão porque é mais lento.

### 3. Editor

Use o VS Code ou outro editor com suporte a TypeScript. Extensões serão sugeridas no repositório somente quando a configuração de lint e formatação existir.

## Fase 2: necessária para emulador e builds Android locais

Não é necessário instalar estes itens antes do primeiro teste com Expo Go:

1. Android Studio;
2. Android SDK, SDK Platform e Android Virtual Device;
3. JDK 17 — o Java 8 atual não deve ser utilizado;
4. variável `ANDROID_HOME` apontando normalmente para `%LOCALAPPDATA%\Android\Sdk`;
5. `%LOCALAPPDATA%\Android\Sdk\platform-tools` no `Path`.

Depois da instalação, validar:

```powershell
java -version
adb --version
```

Para iOS, o simulador e builds nativos locais exigem macOS/Xcode. Um iPhone físico ainda pode executar o teste inicial pelo Expo Go no Windows; builds posteriores podem ser feitos pelo EAS na nuvem.

## Fase 3: necessária para banco local

Quando iniciarmos o Supabase local:

1. instalar Docker Desktop com WSL 2 habilitado;
2. instalar a Supabase CLI como dependência de desenvolvimento do projeto;
3. executar a CLI com `npx supabase`, sem instalação global;
4. inicializar o projeto para gerar `supabase/config.toml`;
5. executar `npx supabase start`.

O Supabase local roda em contêineres e requer Docker ativo. Para o primeiro app visual, isso ainda não é necessário.

## Fase 4: builds distribuíveis

Quando sairmos do Expo Go, configuraremos EAS Build e um development build. A CLI também será invocada pelo projeto ou com `npx`; não há necessidade de instalá-la globalmente agora.

## Segredos

- Nunca preencher `.env.example` com valores reais.
- Arquivos `.env` locais são ignorados pelo Git.
- Apenas variáveis explicitamente públicas recebem o prefixo `EXPO_PUBLIC_`.
- Tokens do Mercado Pago e chaves administrativas do Supabase existem somente no backend.
