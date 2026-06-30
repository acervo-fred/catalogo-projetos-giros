import { store } from "../data/store.js";
import { esc } from "../ui/dom.js";
import { abrirNovoProjeto, abrirNovoLink, abrirNovaMarcaDagua, abrirNovaDemanda } from "./cadastros.js";

const TIPO_META = {
  master:   { label: "Master",        icon: "🎬", ordem: 0 },
  episodio: { label: "Episódios",     icon: "📺", ordem: 1 },
  trailer:  { label: "Trailer",       icon: "▶",  ordem: 2 },
  teaser:   { label: "Teaser",        icon: "✦",  ordem: 3 },
  promo:    { label: "Promo",         icon: "📣", ordem: 4 },
  vitrine:  { label: "Vitrine Vimeo", icon: "🗂", ordem: 5 },
  outro:    { label: "Outros",        icon: "🔗", ordem: 6 },
};

const STATUS_COR = {
  "Pendente": "amber", "Em andamento": "blue", "Concluída": "green", "Cancelada": "gray",
};

export function renderProjeto(app, id) {
  function refresh() { renderProjeto(app, id); }

  const p = store.getProjeto(id);
  if (!p) {
    app.innerHTML = `<a class="back-link" href="#/">← Voltar ao catálogo</a><div class="empty-page">Projeto não encontrado.</div>`;
    return;
  }

  app.innerHTML = `
    <a class="back-link" href="#/">← Voltar ao catálogo</a>

    <div class="proj-detail">
      <div class="proj-detail-aside">
        <div class="proj-detail-poster">
          ${p.poster
            ? `<img src="${p.poster}" alt="${esc(p.nome)}">`
            : `<div class="poster-ph large"><span>${esc(p.nome.slice(0, 2).toUpperCase())}</span></div>`}
        </div>
        <div class="proj-detail-meta">
          <div class="meta-item"><span class="meta-label">Ano</span> ${esc(p.ano ?? "—")}</div>
          <div class="meta-item"><span class="meta-label">Categoria</span> ${esc(p.categoria || "—")}</div>
          <div class="meta-item"><span class="meta-label">Cadastro</span> ${esc(p.dataCadastro || "—")}</div>
        </div>
        <div class="proj-aside-actions">
          <button class="btn" id="btn-editar">Editar projeto</button>
          <button class="btn btn-ghost danger-btn" id="btn-excluir">Excluir</button>
        </div>
      </div>

      <div class="proj-detail-main">
        <h1 class="proj-title">${esc(p.nome)}</h1>
        ${p.sinopse ? `<p class="proj-sinopse">${esc(p.sinopse)}</p>` : ""}

        <div class="tabs">
          <button class="tab-btn active" data-tab="videos">Vídeos <span class="tab-count">${p.links.length}</span></button>
          <button class="tab-btn" data-tab="marca">Marca d'água <span class="tab-count">${p.marcaDagua.length}</span></button>
          <button class="tab-btn" data-tab="demandas">Demandas <span class="tab-count">${p.demandas.length}</span></button>
        </div>

        <!-- TAB VÍDEOS -->
        <div class="tab-panel active" id="tab-videos">
          ${renderVideos(p)}
          <button class="btn btn-ghost tab-add-btn" id="btn-add-link">+ Adicionar link</button>
        </div>

        <!-- TAB MARCA D'ÁGUA -->
        <div class="tab-panel" id="tab-marca">
          ${renderMarcaDagua(p)}
          <button class="btn btn-ghost tab-add-btn" id="btn-add-md">+ Adicionar versão</button>
        </div>

        <!-- TAB DEMANDAS -->
        <div class="tab-panel" id="tab-demandas">
          ${renderDemandas(p)}
          <button class="btn btn-ghost tab-add-btn" id="btn-add-demanda">+ Nova demanda</button>
        </div>
      </div>
    </div>
  `;

  /* tabs */
  app.querySelectorAll(".tab-btn").forEach((btn) =>
    btn.addEventListener("click", () => {
      app.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      app.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.remove("active"));
      btn.classList.add("active");
      app.querySelector(`#tab-${btn.dataset.tab}`).classList.add("active");
    })
  );

  /* ações do cabeçalho */
  app.querySelector("#btn-editar").addEventListener("click", () => abrirNovoProjeto(p));
  app.querySelector("#btn-excluir").addEventListener("click", async () => {
    if (!confirm(`Excluir "${p.nome}" e todos os seus links e demandas?`)) return;
    store.removeProjeto(p.id);
    location.hash = "#/";
  });

  /* adicionar itens */
  app.querySelector("#btn-add-link").addEventListener("click", () => abrirNovoLink(p.id));
  app.querySelector("#btn-add-md").addEventListener("click", () => abrirNovaMarcaDagua(p.id));
  app.querySelector("#btn-add-demanda").addEventListener("click", () => abrirNovaDemanda(p.id));

  /* delegação: editar/excluir links */
  app.querySelector("#tab-videos").addEventListener("click", (e) => {
    const id = e.target.dataset.linkId;
    if (!id) return;
    const link = p.links.find((l) => l.id === id);
    if (!link) return;
    if (e.target.dataset.action === "edit") { abrirNovoLink(p.id, link); return; }
    if (e.target.dataset.action === "del") {
      if (!confirm(`Excluir o link "${link.titulo}"?`)) return;
      store.removeLink(p.id, id);
    }
    if (e.target.dataset.action === "senha") {
      const box = e.target.closest(".link-senha-box");
      box.classList.toggle("revealed");
    }
  });

  /* delegação: editar/excluir marca d'água */
  app.querySelector("#tab-marca").addEventListener("click", (e) => {
    const id = e.target.dataset.mdId;
    if (!id) return;
    const md = p.marcaDagua.find((x) => x.id === id);
    if (!md) return;
    if (e.target.dataset.action === "edit") { abrirNovaMarcaDagua(p.id, md); return; }
    if (e.target.dataset.action === "del") {
      if (!confirm(`Excluir "${md.titulo}"?`)) return;
      store.removeMarcaDagua(p.id, id);
    }
    if (e.target.dataset.action === "senha") {
      e.target.closest(".link-senha-box").classList.toggle("revealed");
    }
  });

  /* delegação: editar/excluir demandas */
  app.querySelector("#tab-demandas").addEventListener("click", (e) => {
    const id = e.target.dataset.demandaId;
    if (!id) return;
    const d = p.demandas.find((x) => x.id === id);
    if (!d) return;
    if (e.target.dataset.action === "edit") { abrirNovaDemanda(p.id, d); return; }
    if (e.target.dataset.action === "del") {
      if (!confirm(`Excluir esta demanda?`)) return;
      store.removeDemanda(p.id, id);
    }
  });
}

/* --- renderers internos --- */

function renderVideos(p) {
  if (!p.links.length) return `<div class="empty-tab">Nenhum link cadastrado ainda.</div>`;

  const grupos = {};
  for (const l of p.links) {
    if (!grupos[l.tipo]) grupos[l.tipo] = [];
    grupos[l.tipo].push(l);
  }

  const ordem = Object.keys(TIPO_META).filter((t) => grupos[t]);
  return ordem.map((tipo) => {
    const meta = TIPO_META[tipo];
    const links = grupos[tipo];
    return `<div class="link-grupo">
      <div class="link-grupo-titulo">${meta.icon} ${meta.label}</div>
      ${links.map((l) => linkRow(l)).join("")}
    </div>`;
  }).join("");
}

function linkRow(l) {
  const temSenha = !!l.senha;
  const rotulo = l.numero ? `Ep. ${l.numero} — ${esc(l.titulo)}` : esc(l.titulo);
  return `<div class="link-item">
    <div class="link-titulo">${rotulo} ${temSenha ? `<span class="lock-icon" title="Protegido por senha">🔒</span>` : ""}</div>
    ${temSenha ? `<div class="link-senha-box">
      <button class="senha-toggle" data-action="senha" data-link-id="${esc(l.id)}">Ver senha</button>
      <span class="senha-valor">${esc(l.senha)}</span>
      <button class="copy-btn" onclick="navigator.clipboard.writeText('${esc(l.senha)}')">Copiar</button>
    </div>` : ""}
    <a href="${esc(l.url)}" target="_blank" rel="noopener" class="btn btn-sm">Abrir ↗</a>
    <div class="item-actions">
      <button class="icon-btn" data-action="edit" data-link-id="${esc(l.id)}" title="Editar">✎</button>
      <button class="icon-btn danger" data-action="del" data-link-id="${esc(l.id)}" title="Excluir">🗑</button>
    </div>
  </div>`;
}

function renderMarcaDagua(p) {
  if (!p.marcaDagua.length) return `<div class="empty-tab">Nenhuma versão com marca d'água cadastrada.</div>`;
  return p.marcaDagua.map((md) => {
    const temSenha = !!md.senha;
    return `<div class="link-item">
      <div class="link-titulo">${esc(md.titulo)} ${temSenha ? `<span class="lock-icon">🔒</span>` : ""}
        ${md.observacoes ? `<span class="link-obs">${esc(md.observacoes)}</span>` : ""}
      </div>
      ${temSenha ? `<div class="link-senha-box">
        <button class="senha-toggle" data-action="senha" data-md-id="${esc(md.id)}">Ver senha</button>
        <span class="senha-valor">${esc(md.senha)}</span>
        <button class="copy-btn" onclick="navigator.clipboard.writeText('${esc(md.senha)}')">Copiar</button>
      </div>` : ""}
      <a href="${esc(md.url)}" target="_blank" rel="noopener" class="btn btn-sm">Abrir ↗</a>
      <div class="item-actions">
        <button class="icon-btn" data-action="edit" data-md-id="${esc(md.id)}" title="Editar">✎</button>
        <button class="icon-btn danger" data-action="del" data-md-id="${esc(md.id)}" title="Excluir">🗑</button>
      </div>
    </div>`;
  }).join("");
}

function renderDemandas(p) {
  if (!p.demandas.length) return `<div class="empty-tab">Nenhuma demanda registrada.</div>`;
  return p.demandas.map((d) => {
    const cor = STATUS_COR[d.status] || "gray";
    return `<div class="demanda-item">
      <div class="demanda-main">
        <div class="demanda-desc">${esc(d.descricao)}</div>
        ${d.responsavel ? `<div class="demanda-resp">${esc(d.responsavel)}</div>` : ""}
      </div>
      <span class="status-badge badge-${cor}">${esc(d.status)}</span>
      <div class="item-actions">
        <button class="icon-btn" data-action="edit" data-demanda-id="${esc(d.id)}" title="Editar">✎</button>
        <button class="icon-btn danger" data-action="del" data-demanda-id="${esc(d.id)}" title="Excluir">🗑</button>
      </div>
    </div>`;
  }).join("");
}
