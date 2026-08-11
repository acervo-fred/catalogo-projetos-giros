## Acesso restrito, com papel leitor/editor (2026-08-11) — ação pendente no console

O Catálogo exige login com conta Google autorizada pra ver qualquer
coisa (ninguém entra sem estar liberado). A lista de quem pode entrar
**não vive mais no código** — é a coleção Firestore
`catalogo_authorizedEmails` (doc id = e-mail, campo `papel`: `"leitor"`
ou `"editor"`), gerenciada inteira pela tela **🔑 Acessos** no
cabeçalho do app (só aparece logado como o admin principal,
`acervo@girostraffic.page`, fixo em `CATALOGO_ADMIN` no
[`js/bundle.js`](./js/bundle.js)).

Quem tenta entrar sem estar liberado cai num portão com botão **"Pedir
acesso"** — grava um pedido em `catalogo_accessRequests`, que aparece
na tela Acessos pro admin aprovar (como leitor ou editor) ou recusar.
Leitor só vê o catálogo; editor também cadastra/edita/exclui.

**Falta publicar a regra nova do Firestore** pra isso valer de verdade
no servidor (sem isso, o portão na tela funciona, mas a trava real no
banco ainda não está ativa):

1. Abra o [Console do Firebase](https://console.firebase.google.com/) →
   projeto **giros-imagens** → Firestore Database → aba **Regras**.
2. Cole o conteúdo atualizado de
   [`firestore.rules`](../Plataforma_Acervo_Giros/Plataforma/firestore.rules)
   (agora tem `catalogoAdminPrincipal()`, `catalogoPapel()` e as
   coleções `catalogo_authorizedEmails`/`catalogo_accessRequests` —
   as regras do Acervo, no mesmo arquivo, não mudaram).
3. **Publicar.**
4. Logo em seguida, logar no Catálogo como `acervo@girostraffic.page`
   e usar a tela **Acessos** → "Liberar um e-mail direto" pra
   recadastrar (com o papel `editor`) os e-mails que antes estavam na
   lista fixa: `gabrielscmiranda@gmail.com`,
   `datamanager@girostraffic.page`,
   `assistente.extra@girostraffic.page`,
   `assistente.principal@girostraffic.page`,
   `assistente@giros.com.br`, `producao.finalizacao@giros.com.br` —
   senão eles ficam sem acesso entre o passo 3 e este.

Confira também, uma vez só, se o login Google está ativado: Console do
Firebase → **Authentication** → aba **Sign-in method** → **Google**
"Enabled", e em **Authentication → Settings → Authorized domains** se o
domínio onde o Catálogo é publicado (ex.: `*.github.io`) está na lista.

---

# Ativar a sincronização do Catálogo (Firestore)

Este projeto **reaproveita o mesmo projeto Firebase da Plataforma Acervo Giros**
(`giros-imagens`) — não precisa criar projeto novo. Só falta publicar as
regras atualizadas e ligar a chave no código.

## Passo 1 — Publicar as regras atualizadas

As regras do Firestore são compartilhadas por todo o projeto `giros-imagens`
(Acervo e Catálogo), então já atualizei o arquivo com a coleção nova:
[`/Users/giros_acervo/Plataforma_Acervo_Giros/firestore.rules`](../Plataforma_Acervo_Giros/firestore.rules).

1. Abra o [Console do Firebase](https://console.firebase.google.com/) → projeto
   **giros-imagens** → Firestore Database → aba **Regras**.
2. Cole o conteúdo atualizado desse arquivo (agora inclui o bloco
   `match /catalogo_projetos/{document=**}`).
3. **Publicar**.

## Passo 2 — Ligar no código

Em [`js/config/firebase-config.js`](./js/config/firebase-config.js), mude:

```js
export const USE_FIRESTORE = true;
```

## Passo 3 — Migrar os dados já cadastrados

1. Abra o Catálogo (local ou publicado) com `USE_FIRESTORE = true`.
2. Clique em **☁ Sincronizar** no cabeçalho — isso envia todos os projetos
   já salvos neste navegador (localStorage) pro Firestore, de uma vez.
3. Pronto — dali em diante, toda edição (aqui ou em outro navegador/site)
   já vai automaticamente para o Firestore, e ao recarregar a página os
   dados vêm de lá.

## Como funciona (diferente do Acervo/2V)

Aqui a tela **não espera** o Firestore responder — ela sempre lê/escreve
primeiro no localStorage (instantâneo, como sempre foi) e manda uma cópia
pro Firestore em segundo plano. Ao carregar a página, se houver dados no
Firestore, eles substituem o cache local. Isso evita reescrever a interface
toda pra ficar "assíncrona" como nos outros dois projetos.

## Sobre o app "Catálogo" no Firebase

Não é necessário registrar um app Web novo no console — o código já usa
exatamente a mesma configuração (`apiKey`, `projectId` etc.) do app "Acervo",
porque ambos se conectam ao mesmo projeto e banco. Se quiser um app separado
só por organização/analytics, pode criar um a qualquer momento em
Configurações do projeto → Seus apps → registrar um novo Web app — não muda
nada no código, é só um rótulo extra no console.
