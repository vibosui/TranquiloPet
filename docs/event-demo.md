# Demonstração local em eventos

O Hospeda Patas possui uma rota pública e somente leitura em `/demo`, pensada para apresentações presenciais. Ela não exige login e não grava dados no Supabase.

## Iniciar

Na raiz do repositório:

```powershell
npm.cmd install
npm.cmd run start:event
```

O comando:

1. detecta um IPv4 privado do notebook;
2. gera o QR público apontando para `http://IP_DO_NOTEBOOK:8081/demo`;
3. salva o QR em `artifacts/event/hospeda-patas-demo-qr.png`;
4. salva a URL em `artifacts/event/hospeda-patas-demo-url.txt`;
5. inicia o Expo em modo LAN;
6. o Expo imprime o segundo QR, destinado ao Expo Go/teste técnico.

O arquivo PNG é regenerado a cada execução porque o endereço IP pode mudar ao trocar de rede.

## Interface de rede incorreta

Se o computador tiver VPN, WSL, adaptadores virtuais ou mais de uma conexão e o endereço escolhido não for o correto, informe o IPv4 manualmente antes de iniciar:

```powershell
$env:HOSPEDA_PATAS_EVENT_HOST="192.168.1.50"
npm.cmd run start:event
```

Para voltar à detecção automática na mesma janela do PowerShell:

```powershell
Remove-Item Env:HOSPEDA_PATAS_EVENT_HOST
```

## Rede do evento

Estar no mesmo Wi-Fi não garante comunicação direta entre celulares e notebook. Algumas redes públicas usam isolamento de clientes/AP isolation. Antes da apresentação, teste o QR em pelo menos dois celulares conectados à mesma rede.

Se a rede bloquear tráfego local, use como contingência:

- hotspot controlado pelo apresentador/notebook; ou
- uma versão web publicada/túnel acessível pela internet.

Também confirme que o Firewall do Windows permite conexões de entrada do Node/Expo na rede utilizada.
