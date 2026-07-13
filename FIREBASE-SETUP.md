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
