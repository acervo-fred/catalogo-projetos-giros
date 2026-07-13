/* Store do Catálogo — local-first: toda leitura/escrita da UI é
   síncrona em cima do localStorage, como sempre foi. Quando
   USE_FIRESTORE=true (js/config/firebase-config.js), cada escrita
   também é replicada pro Firestore em segundo plano (fire-and-forget),
   e ao carregar a página os dados vêm do Firestore (hidratação),
   substituindo o cache local. Isso evita reescrever a UI síncrona
   pra async — só a sincronização em si é assíncrona. */

import { USE_FIRESTORE, firebaseConfig, COLLECTIONS } from "../config/firebase-config.js";

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

/* ---------- Firestore (opcional, carregado sob demanda) ---------- */
let _firestoreMod = null; // { fdb, doc, setDoc, deleteDoc, collection, getDocsFromServer }
async function firestoreMod() {
  if (!USE_FIRESTORE) return null;
  if (_firestoreMod) return _firestoreMod;
  const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
  const { getFirestore, doc, setDoc, deleteDoc, collection, getDocsFromServer } =
    await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  const app = initializeApp(firebaseConfig);
  _firestoreMod = { fdb: getFirestore(app), doc, setDoc, deleteDoc, collection, getDocsFromServer };
  return _firestoreMod;
}
async function pushProjeto(p) {
  const mod = await firestoreMod();
  if (!mod) return;
  const { id, ...campos } = p;
  await mod.setDoc(mod.doc(mod.fdb, COLLECTIONS.projetos, id), campos);
}
async function deleteProjetoRemoto(id) {
  const mod = await firestoreMod();
  if (!mod) return;
  await mod.deleteDoc(mod.doc(mod.fdb, COLLECTIONS.projetos, id));
}
async function hidratarDoFirestore() {
  const mod = await firestoreMod();
  if (!mod) return;
  const snap = await mod.getDocsFromServer(mod.collection(mod.fdb, COLLECTIONS.projetos));
  if (snap.empty) return; // nada no Firestore ainda — não apaga dados locais
  db.projetos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  save();
}
function sincronizar(p) {
  pushProjeto(p).catch((e) => console.warn("Firestore: falha ao salvar projeto.", e));
}

if (USE_FIRESTORE) hidratarDoFirestore();

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
    sincronizar(novo);
    return novo;
  },
  updateProjeto(id, campos) {
    const p = db.projetos.find((x) => x.id === id);
    if (!p) return;
    Object.assign(p, campos);
    save();
    sincronizar(p);
  },
  removeProjeto(id) {
    db.projetos = db.projetos.filter((p) => p.id !== id);
    save();
    deleteProjetoRemoto(id).catch((e) => console.warn("Firestore: falha ao excluir projeto.", e));
  },

  /* ---- links (embed no projeto) ---- */
  addLink(projetoId, dados) {
    const p = db.projetos.find((x) => x.id === projetoId);
    if (!p) return;
    const novo = { id: novoId("l"), tipo: dados.tipo, titulo: dados.titulo, url: dados.url, senha: dados.senha || "", numero: dados.numero || null };
    p.links.push(novo);
    save();
    sincronizar(p);
    return novo;
  },
  updateLink(projetoId, linkId, dados) {
    const p = db.projetos.find((x) => x.id === projetoId);
    if (!p) return;
    const l = p.links.find((x) => x.id === linkId);
    if (l) { Object.assign(l, dados); save(); sincronizar(p); }
  },
  removeLink(projetoId, linkId) {
    const p = db.projetos.find((x) => x.id === projetoId);
    if (!p) return;
    p.links = p.links.filter((l) => l.id !== linkId);
    save();
    sincronizar(p);
  },

  /* ---- marca d'água (embed) ---- */
  addMarcaDagua(projetoId, dados) {
    const p = db.projetos.find((x) => x.id === projetoId);
    if (!p) return;
    const novo = { id: novoId("md"), titulo: dados.titulo, url: dados.url, senha: dados.senha || "", observacoes: dados.observacoes || "" };
    p.marcaDagua.push(novo);
    save();
    sincronizar(p);
    return novo;
  },
  updateMarcaDagua(projetoId, mdId, dados) {
    const p = db.projetos.find((x) => x.id === projetoId);
    if (!p) return;
    const md = p.marcaDagua.find((x) => x.id === mdId);
    if (md) { Object.assign(md, dados); save(); sincronizar(p); }
  },
  removeMarcaDagua(projetoId, mdId) {
    const p = db.projetos.find((x) => x.id === projetoId);
    if (!p) return;
    p.marcaDagua = p.marcaDagua.filter((x) => x.id !== mdId);
    save();
    sincronizar(p);
  },

  /* ---- demandas (embed) ---- */
  addDemanda(projetoId, dados) {
    const p = db.projetos.find((x) => x.id === projetoId);
    if (!p) return;
    const novo = { id: novoId("d"), descricao: dados.descricao, responsavel: dados.responsavel || "", status: dados.status || "Pendente", data: new Date().toISOString().slice(0, 10) };
    p.demandas.push(novo);
    save();
    sincronizar(p);
    return novo;
  },
  updateDemanda(projetoId, dId, dados) {
    const p = db.projetos.find((x) => x.id === projetoId);
    if (!p) return;
    const d = p.demandas.find((x) => x.id === dId);
    if (d) { Object.assign(d, dados); save(); sincronizar(p); }
  },
  removeDemanda(projetoId, dId) {
    const p = db.projetos.find((x) => x.id === projetoId);
    if (!p) return;
    p.demandas = p.demandas.filter((x) => x.id !== dId);
    save();
    sincronizar(p);
  },

  /* ---- backup ---- */
  exportAll() { return JSON.stringify(db, null, 2); },
  importAll(json) {
    const data = JSON.parse(json);
    if (Array.isArray(data.projetos)) { db.projetos = data.projetos; save(); }
  },

  /* ---- migração manual: envia TODOS os projetos locais pro Firestore
     de uma vez (usar uma vez, ao ligar USE_FIRESTORE pela primeira vez) ---- */
  async migrarParaFirestore() {
    if (!USE_FIRESTORE) throw new Error("USE_FIRESTORE está desligado.");
    for (const p of db.projetos) await pushProjeto(p);
  },
};
