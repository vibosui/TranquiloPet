# Tranquilo Pet mobile

Aplicativo Expo SDK 54 do Tranquilo Pet.

## Executar

Na raiz do repositório:

```powershell
npm.cmd run start
```

O QR Code aparece no terminal do Metro. O app funciona offline com dados locais; configure `.env.local` somente se quiser acompanhar eventos no monitor Python.

No primeiro acesso, escolha uma das 10 contas fictícias. Não existe senha nesse adaptador de desenvolvimento. A conta 05 possui os dois papéis, e todas as contas possuem dois pets.

Somente o seletor nativo da galeria está habilitado para fotos, sem solicitar acesso amplo antes da escolha. No Android e iOS, as imagens escolhidas são copiadas para o armazenamento persistente do app. Câmera, upload, GPS, notificações, pagamentos, sincronização em segundo plano e autenticação de produção permanecem desligados.

## Verificações

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
```
