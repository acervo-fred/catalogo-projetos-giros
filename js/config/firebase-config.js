/* ============================================================
   Configuração do Firebase — MESMO projeto usado pela Plataforma
   Acervo Giros (giros-imagens), coleção isolada por prefixo.

   Diferente do Acervo/2V, aqui o SDK do Firebase é carregado via
   import() dinâmico dentro de js/bundle.js (que não é ES module),
   não por um data/firestore.js separado — ver comentário lá.
   ============================================================ */

// Backend de dados.
//  false → modo LOCAL (localStorage do navegador), como sempre foi.
//  true  → Firestore (giros-imagens) além do localStorage: toda
//          escrita local também é enviada pro Firestore em segundo
//          plano, e ao carregar a página os dados vêm do Firestore.
export const USE_FIRESTORE = false;

export const firebaseConfig = {
  apiKey: "AIzaSyC-0iuPs5xhvjjh2LmzoGjAKtAh6aY2-ZQ",
  authDomain: "giros-imagens.firebaseapp.com",
  projectId: "giros-imagens",
  storageBucket: "giros-imagens.firebasestorage.app",
  messagingSenderId: "623464708019",
  appId: "1:623464708019:web:94aa710dd5b3a566a5bdc6",
};

/* Coleção isolada do catálogo — mesmo projeto, prefixo diferente
   do Acervo (acervo_*), sem colisão possível. */
export const COLLECTIONS = {
  projetos: "catalogo_projetos",
};
