import { store } from "../data/store.js";
import { esc } from "../ui/dom.js";

const CATEGORIAS = ["Todos", "Documentário", "Filme", "Série", "Curta", "Institucional", "Outro"];

export function renderHome(app) {
  app.innerHTML = `
    <div class="home-toolbar">
      <div class="home-filters" id="cat-filters">
        ${CATEGORIAS.map((c) => `<button class="filter-btn${c === "Todos" ? " active" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("")}
      </div>
      <div class="home-search-wrap">
        <input class="home-search" id="home-search" type="search" placeholder="Buscar projeto…" autocomplete="off" spellcheck="false">
      </div>
    </div>
    <div class="catalog-grid" id="catalog-grid"></div>
  `;

  let catAtiva = "Todos";
  let busca = "";

  function render() {
    let lista = store.listProjetos();
    if (catAtiva !== "Todos") lista = lista.filter((p) => p.categoria === catAtiva);
    if (busca) {
      const q = busca.toLowerCase();
      lista = lista.filter((p) => p.nome.toLowerCase().includes(q) || String(p.ano).includes(q));
    }

    const grid = app.querySelector("#catalog-grid");
    if (!lista.length) {
      grid.innerHTML = `<div class="empty-catalog">
        <div class="empty-icon">🎬</div>
        <div class="empty-title">${busca || catAtiva !== "Todos" ? "Nenhum projeto encontrado" : "Catálogo vazio"}</div>
        <div class="empty-sub">${busca || catAtiva !== "Todos" ? "Tente outro termo ou categoria." : 'Clique em "+ Novo projeto" para começar.'}</div>
      </div>`;
      return;
    }

    grid.innerHTML = lista.map((p) => `
      <div class="proj-card" data-id="${esc(p.id)}" title="${esc(p.nome)}">
        <div class="proj-card-poster">
          ${p.poster
            ? `<img src="${p.poster}" alt="${esc(p.nome)}" loading="lazy">`
            : `<div class="poster-ph"><span>${esc(p.nome.slice(0, 2).toUpperCase())}</span></div>`}
          <div class="proj-card-hover">Ver projeto →</div>
        </div>
        <div class="proj-card-info">
          <div class="proj-card-nome">${esc(p.nome)}</div>
          <div class="proj-card-meta">${esc(p.ano ?? "")} ${p.categoria ? `· <span class="cat-tag">${esc(p.categoria)}</span>` : ""}</div>
        </div>
      </div>`).join("");

    grid.querySelectorAll(".proj-card").forEach((card) =>
      card.addEventListener("click", () => { location.hash = `#/projeto/${card.dataset.id}`; })
    );
  }

  app.querySelector("#cat-filters").addEventListener("click", (e) => {
    const btn = e.target.closest(".filter-btn");
    if (!btn) return;
    catAtiva = btn.dataset.cat;
    app.querySelectorAll(".filter-btn").forEach((b) => b.classList.toggle("active", b === btn));
    render();
  });

  app.querySelector("#home-search").addEventListener("input", (e) => {
    busca = e.target.value.trim();
    render();
  });

  render();
}
