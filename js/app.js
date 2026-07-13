import { renderHome } from "./views/home.js";
import { renderProjeto } from "./views/projeto.js";
import { abrirNovoProjeto } from "./views/cadastros.js";
import { store } from "./data/store.js";

const app = document.getElementById("app");

function route() {
  const hash = location.hash || "#/";
  const projetoMatch = hash.match(/^#\/projeto\/(.+)$/);
  if (projetoMatch) {
    renderProjeto(app, projetoMatch[1]);
  } else {
    renderHome(app);
  }
}

window.addEventListener("hashchange", route);
store.onChange(route);

document.getElementById("btn-novo-projeto").addEventListener("click", abrirNovoProjeto);
// btn-backup (exportar/importar JSON): implementação real está em js/bundle.js
// (abrirBackup), que é o que roda de fato — ver nota no topo do bundle.

route();
