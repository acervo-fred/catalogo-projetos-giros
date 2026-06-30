const LS_KEY = "giros-catalogo-v1";

function novoId(pref) {
  return `${pref}_${Date.now().toString(36)}${Math.floor(Math.random() * 9999)}`;
}

function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return { projetos: [] };
}

const db = load();
const _listeners = [];

function save() {
  localStorage.setItem(LS_KEY, JSON.stringify(db));
  _listeners.forEach(fn => { try { fn(); } catch (_) {} });
}

export const store = {
  onChange(fn) { _listeners.push(fn); },
  /* ---- projetos ---- */
  listProjetos() {
    return [...db.projetos].sort((a, b) => (b.ano ?? 0) - (a.ano ?? 0));
  },
  getProjeto(id) {
    return db.projetos.find((p) => p.id === id) ?? null;
  },
  addProjeto(dados) {
    const novo = {
      id: novoId("p"),
      nome: dados.nome,
      ano: dados.ano,
      categoria: dados.categoria,
      poster: dados.poster || "",
      sinopse: dados.sinopse || "",
      links: [],
      marcaDagua: [],
      demandas: [],
      dataCadastro: new Date().toISOString().slice(0, 10),
    };
    db.projetos.push(novo);
    save();
    return novo;
  },
  updateProjeto(id, campos) {
    const p = db.projetos.find((x) => x.id === id);
    if (!p) return;
    Object.assign(p, campos);
    save();
  },
  removeProjeto(id) {
    db.projetos = db.projetos.filter((p) => p.id !== id);
    save();
  },

  /* ---- links (embed no projeto) ---- */
  addLink(projetoId, dados) {
    const p = db.projetos.find((x) => x.id === projetoId);
    if (!p) return;
    const novo = { id: novoId("l"), tipo: dados.tipo, titulo: dados.titulo, url: dados.url, senha: dados.senha || "", numero: dados.numero || null };
    p.links.push(novo);
    save();
    return novo;
  },
  updateLink(projetoId, linkId, dados) {
    const p = db.projetos.find((x) => x.id === projetoId);
    if (!p) return;
    const l = p.links.find((x) => x.id === linkId);
    if (l) { Object.assign(l, dados); save(); }
  },
  removeLink(projetoId, linkId) {
    const p = db.projetos.find((x) => x.id === projetoId);
    if (!p) return;
    p.links = p.links.filter((l) => l.id !== linkId);
    save();
  },

  /* ---- marca d'água (embed) ---- */
  addMarcaDagua(projetoId, dados) {
    const p = db.projetos.find((x) => x.id === projetoId);
    if (!p) return;
    const novo = { id: novoId("md"), titulo: dados.titulo, url: dados.url, senha: dados.senha || "", observacoes: dados.observacoes || "" };
    p.marcaDagua.push(novo);
    save();
    return novo;
  },
  updateMarcaDagua(projetoId, mdId, dados) {
    const p = db.projetos.find((x) => x.id === projetoId);
    if (!p) return;
    const md = p.marcaDagua.find((x) => x.id === mdId);
    if (md) { Object.assign(md, dados); save(); }
  },
  removeMarcaDagua(projetoId, mdId) {
    const p = db.projetos.find((x) => x.id === projetoId);
    if (!p) return;
    p.marcaDagua = p.marcaDagua.filter((x) => x.id !== mdId);
    save();
  },

  /* ---- demandas (embed) ---- */
  addDemanda(projetoId, dados) {
    const p = db.projetos.find((x) => x.id === projetoId);
    if (!p) return;
    const novo = { id: novoId("d"), descricao: dados.descricao, responsavel: dados.responsavel || "", status: dados.status || "Pendente", data: new Date().toISOString().slice(0, 10) };
    p.demandas.push(novo);
    save();
    return novo;
  },
  updateDemanda(projetoId, dId, dados) {
    const p = db.projetos.find((x) => x.id === projetoId);
    if (!p) return;
    const d = p.demandas.find((x) => x.id === dId);
    if (d) { Object.assign(d, dados); save(); }
  },
  removeDemanda(projetoId, dId) {
    const p = db.projetos.find((x) => x.id === projetoId);
    if (!p) return;
    p.demandas = p.demandas.filter((x) => x.id !== dId);
    save();
  },

  /* ---- backup ---- */
  exportAll() { return JSON.stringify(db, null, 2); },
  importAll(json) {
    const data = JSON.parse(json);
    if (Array.isArray(data.projetos)) { db.projetos = data.projetos; save(); }
  },
};
