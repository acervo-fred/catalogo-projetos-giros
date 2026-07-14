/* Catálogo Projetos Giros — bundle único, sem ES modules */
(function () {
"use strict";

/* Token da API do Vimeo — mesma chave usada em vimeo-teste.html, para reaproveitar
   o token já salvo lá sem precisar colar de novo. */
var VIMEO_TOKEN_KEY = "vimeo_pat_teste";

/* ============================================================
   EMAILJS — envio automático do "Solicitar versão"
   ============================================================
   Funciona 100% do navegador (sem backend), então continua funcionando
   quando o catálogo for publicado como site estático.

   Template principal (pra equipe), variáveis: {{nome}} {{email}} {{projeto}}
   {{pedido}} {{data}} {{link}} — "To Email" fixo com os destinatários da equipe,
   "Reply To" configurado como {{reply_to}} (assim, ao responder o e-mail, a
   resposta vai direto pra quem fez o pedido).

   Template de confirmação (pra quem pediu, opcional), mesmas variáveis, mas
   com "To Email" = {{email}} (dinâmico, não fixo) — confirma o recebimento do
   pedido. Deixe EMAILJS_TEMPLATE_CONFIRMACAO_ID em branco pra não enviar. */
var EMAILJS_PUBLIC_KEY = "mpmDe-HFOen6i_dqg";
var EMAILJS_SERVICE_ID = "service_m6pty9b";
var EMAILJS_TEMPLATE_ID = "template_uji17dg";
var EMAILJS_TEMPLATE_CONFIRMACAO_ID = "";

if (typeof emailjs !== "undefined" && EMAILJS_PUBLIC_KEY) {
  emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
}

async function enviarEmailSolicitacao(dados) {
  if (typeof emailjs === "undefined") {
    throw new Error("Serviço de e-mail não carregou (verifique a conexão com a internet).");
  }
  if (!EMAILJS_PUBLIC_KEY || !EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID) {
    throw new Error("Envio de e-mail ainda não configurado (faltam as chaves do EmailJS no código).");
  }
  var params = {
    nome: dados.nome,
    email: dados.email,
    reply_to: dados.email,
    projeto: dados.projeto,
    pedido: dados.pedido,
    data: new Date().toLocaleString("pt-BR"),
    link: dados.link
  };
  /* E-mail principal, pra equipe — crítico: se falhar, quem pediu vê o erro e pode tentar de novo. */
  try {
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, params);
  } catch (e) {
    var detalhe = (e && (e.text || e.message)) || JSON.stringify(e);
    console.warn("[EmailJS] erro ao enviar para a equipe:", e);
    throw new Error("Falha ao enviar o e-mail (" + (e && e.status ? "status " + e.status + ": " : "") + detalhe + ")");
  }
  /* Confirmação automática pra quem pediu — best-effort: se falhar, não bloqueia
     o fluxo, já que o e-mail importante (pra equipe) já saiu. */
  if (EMAILJS_TEMPLATE_CONFIRMACAO_ID) {
    try {
      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_CONFIRMACAO_ID, params);
    } catch (e) {
      console.warn("[EmailJS] falha ao enviar confirmação pro solicitante:", e);
    }
  }
}

/* ============================================================
   STORE
   ============================================================ */
var LS_KEY = "giros-catalogo-v1";
function novoId(pref) {
  return pref + "_" + Date.now().toString(36) + Math.floor(Math.random() * 9999);
}
function loadDb() {
  try { var raw = localStorage.getItem(LS_KEY); if (raw) return JSON.parse(raw); }
  catch (_) {}
  return { projetos: [] };
}
var db = loadDb();
var _listeners = [];
function saveDb() {
  localStorage.setItem(LS_KEY, JSON.stringify(db));
  _listeners.forEach(function(fn) { try { fn(); } catch(_) {} });
}

/* Migração: "Episódio" deixou de ser um tipo separado — episódio é master
   (a diferenciação já é feita pelos campos temporada/número). */
(function migrarTipoEpisodio() {
  var mudou = false;
  (db.projetos || []).forEach(function(p) {
    (p.links || []).forEach(function(l) {
      if (l.tipo === "episodio") { l.tipo = "master"; mudou = true; }
    });
  });
  if (mudou) saveDb();
})();

/* ---------- Firestore (opcional — ver js/config/firebase-config.js) ----------
   Local-first: a UI continua 100% síncrona em cima do localStorage (acima).
   Quando USE_FIRESTORE=true, cada escrita também é replicada pro Firestore
   em segundo plano (fire-and-forget), e ao carregar a página os projetos
   vêm do Firestore (hidratação), substituindo o cache local. */
var _firestoreCfg = null;
var _firestoreMod = null;
async function firestoreMod() {
  if (!_firestoreCfg) _firestoreCfg = await import("./config/firebase-config.js");
  if (!_firestoreCfg.USE_FIRESTORE) return null;
  if (_firestoreMod) return _firestoreMod;
  var appMod = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
  var fsMod = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  var app = appMod.initializeApp(_firestoreCfg.firebaseConfig);
  _firestoreMod = {
    fdb: fsMod.getFirestore(app), doc: fsMod.doc, setDoc: fsMod.setDoc,
    deleteDoc: fsMod.deleteDoc, collection: fsMod.collection, getDocsFromServer: fsMod.getDocsFromServer,
  };
  return _firestoreMod;
}
async function pushProjetoRemoto(p) {
  var mod = await firestoreMod();
  if (!mod) return;
  var campos = Object.assign({}, p);
  delete campos.id;
  await mod.setDoc(mod.doc(mod.fdb, _firestoreCfg.COLLECTIONS.projetos, p.id), campos);
}
async function deleteProjetoRemoto(id) {
  var mod = await firestoreMod();
  if (!mod) return;
  await mod.deleteDoc(mod.doc(mod.fdb, _firestoreCfg.COLLECTIONS.projetos, id));
}
async function hidratarDoFirestore() {
  var mod = await firestoreMod();
  if (!mod) return;
  var snap = await mod.getDocsFromServer(mod.collection(mod.fdb, _firestoreCfg.COLLECTIONS.projetos));
  if (snap.empty) return; // nada no Firestore ainda — não apaga dados locais
  db.projetos = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
  saveDb();
}
function sincronizar(p) {
  pushProjetoRemoto(p).catch(function(e) { console.warn("Firestore: falha ao salvar projeto.", e); });
}
hidratarDoFirestore();

var store = {
  onChange: function(fn) { _listeners.push(fn); },
  listProjetos: function() {
    return db.projetos.slice().sort(function(a,b){ return (b.ano||0)-(a.ano||0); });
  },
  getProjeto: function(id) {
    return db.projetos.find(function(p){ return p.id===id; }) || null;
  },
  addProjeto: function(dados) {
    var novo = {
      id: novoId("p"), nome: dados.nome, ano: dados.ano,
      categoria: dados.categoria, poster: dados.poster||"",
      sinopse: dados.sinopse||"", temporadas: dados.temporadas||[],
      links: [], marcaDagua: []
    };
    db.projetos.push(novo); saveDb(); sincronizar(novo); return novo;
  },
  updateProjeto: function(id, campos) {
    var p = db.projetos.find(function(x){ return x.id===id; });
    if (!p) return; Object.assign(p, campos); saveDb(); sincronizar(p);
  },
  removeProjeto: function(id) {
    db.projetos = db.projetos.filter(function(p){ return p.id!==id; }); saveDb();
    deleteProjetoRemoto(id).catch(function(e) { console.warn("Firestore: falha ao excluir projeto.", e); });
  },
  addLink: function(pid, dados) {
    var p = db.projetos.find(function(x){ return x.id===pid; }); if(!p) return;
    var novo = { id:novoId("l"), tipo:dados.tipo, titulo:dados.titulo,
      url:dados.url, privacidade:dados.privacidade||"", senha:dados.senha||"",
      numero:dados.numero||null, temporada:dados.temporada||null,
      duracao:dados.duracao||null, thumbnail:dados.thumbnail||"" };
    p.links.push(novo); saveDb(); sincronizar(p); return novo;
  },
  updateLink: function(pid, lid, dados) {
    var p = db.projetos.find(function(x){ return x.id===pid; }); if(!p) return;
    var l = p.links.find(function(x){ return x.id===lid; });
    if(l){ Object.assign(l,dados); saveDb(); sincronizar(p); }
  },
  /* Aplica várias atualizações de uma vez (ex.: backfill de duração/thumbnail) e salva
     só uma vez no final, pra não re-renderizar a tela a cada link durante o loop. */
  updateLinksBatch: function(pid, updatesById) {
    var p = db.projetos.find(function(x){ return x.id===pid; }); if(!p) return;
    var mudou = false;
    p.links.forEach(function(l){
      var u = updatesById[l.id];
      if (u) { Object.assign(l, u); mudou = true; }
    });
    if (mudou) { saveDb(); sincronizar(p); }
  },
  removeLink: function(pid, lid) {
    var p = db.projetos.find(function(x){ return x.id===pid; }); if(!p) return;
    p.links = p.links.filter(function(l){ return l.id!==lid; }); saveDb(); sincronizar(p);
  },
  addMarcaDagua: function(pid, dados) {
    var p = db.projetos.find(function(x){ return x.id===pid; }); if(!p) return;
    var novo = { id:novoId("md"), titulo:dados.titulo, url:dados.url,
      senha:dados.senha||"", observacoes:dados.observacoes||"" };
    p.marcaDagua.push(novo); saveDb(); sincronizar(p); return novo;
  },
  updateMarcaDagua: function(pid, mid, dados) {
    var p = db.projetos.find(function(x){ return x.id===pid; }); if(!p) return;
    var md = p.marcaDagua.find(function(x){ return x.id===mid; });
    if(md){ Object.assign(md,dados); saveDb(); sincronizar(p); }
  },
  removeMarcaDagua: function(pid, mid) {
    var p = db.projetos.find(function(x){ return x.id===pid; }); if(!p) return;
    p.marcaDagua = p.marcaDagua.filter(function(x){ return x.id!==mid; }); saveDb(); sincronizar(p);
  },
  /* migração manual: envia TODOS os projetos locais pro Firestore de uma vez
     (usar uma vez, ao ligar USE_FIRESTORE pela primeira vez) */
  migrarParaFirestore: async function() {
    if (!_firestoreCfg) _firestoreCfg = await import("./config/firebase-config.js");
    if (!_firestoreCfg.USE_FIRESTORE) throw new Error("USE_FIRESTORE está desligado.");
    for (const p of db.projetos) await pushProjetoRemoto(p);
  }
};

/* ============================================================
   UTILITÁRIOS
   ============================================================ */
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

async function compressImage(file) {
  return new Promise(function(resolve) {
    var reader = new FileReader();
    reader.onload = function(e) {
      var img = new Image();
      img.onload = function() {
        var MAX = 420;
        var ratio = Math.min(MAX/img.width, (MAX*1.5)/img.height, 1);
        var canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width*ratio);
        canvas.height = Math.round(img.height*ratio);
        canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);
        resolve(canvas.toDataURL("image/jpeg",0.82));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function fetchVimeoOembed(url) {
  try {
    var ctrl = new AbortController();
    var t = setTimeout(function(){ ctrl.abort(); }, 4000);
    var res = await fetch("https://vimeo.com/api/oembed.json?url=" + encodeURIComponent(url),
      { signal: ctrl.signal });
    clearTimeout(t);
    console.log("[Vimeo oEmbed] status:", res.status, "url:", url);
    if (!res.ok) return null;
    var data = await res.json();
    console.log("[Vimeo oEmbed] título:", data.title, "| duração:", data.duration, "| thumb:", data.thumbnail_url);
    return {
      titulo: data.title || null,
      duracao: data.duration || null,
      thumbnail: data.thumbnail_url || null
    };
  } catch(e) {
    console.warn("[Vimeo oEmbed] erro:", e);
    return null;
  }
}

/* Mapeia privacy.view da API do Vimeo pros nossos valores internos */
var VIMEO_PRIV_MAP = {
  anybody:  "publico",
  unlisted: "nao_listado",
  password: "senha",
  disable:  "incorporado",
  nobody:   "privado",
  contacts: "privado",
  users:    "privado"
};

function extrairVimeoId(url) {
  var m = String(url||"").match(/vimeo\.com\/(?:.*\/)?(\d+)/);
  return m ? m[1] : null;
}

/* Escolhe, entre os tamanhos de thumbnail que o Vimeo devolve, o mais próximo de 320px
   de largura — suficiente pra miniatura da tabela sem guardar imagem gigante. */
function pickThumbLink(pictures) {
  var sizes = pictures && pictures.sizes;
  if (!sizes || !sizes.length) return null;
  var alvo = 320, melhor = sizes[0];
  sizes.forEach(function(s) {
    if (Math.abs(s.width - alvo) < Math.abs(melhor.width - alvo)) melhor = s;
  });
  return melhor.link || null;
}

/* Busca título + privacidade + duração + thumbnail via API autenticada (funciona mesmo pra
   vídeo privado/com senha). Retorna null se não houver token salvo, o id não puder ser
   extraído, ou a chamada falhar. */
async function fetchVimeoDadosApi(url) {
  var token = localStorage.getItem(VIMEO_TOKEN_KEY);
  var id = extrairVimeoId(url);
  console.log("[Vimeo API] token presente:", !!token, "| id extraído:", id, "| url:", url);
  if (!token) { console.warn("[Vimeo API] sem token salvo em localStorage['"+VIMEO_TOKEN_KEY+"']."); return null; }
  if (!id) { console.warn("[Vimeo API] não consegui extrair o id numérico dessa URL."); return null; }
  try {
    var ctrl = new AbortController();
    var t = setTimeout(function(){ ctrl.abort(); }, 5000);
    var res = await fetch("https://api.vimeo.com/videos/" + id + "?fields=name,privacy.view,duration,pictures.sizes", {
      signal: ctrl.signal,
      headers: {
        "Authorization": "Bearer " + token,
        "Accept": "application/vnd.vimeo.*+json;version=3.4"
      }
    });
    clearTimeout(t);
    console.log("[Vimeo API] status:", res.status);
    if (!res.ok) {
      var corpoErro = await res.text();
      console.warn("[Vimeo API] resposta de erro:", corpoErro);
      return null;
    }
    var data = await res.json();
    console.log("[Vimeo API] dados recebidos:", data);
    return {
      titulo: data.name || null,
      privacidade: VIMEO_PRIV_MAP[data.privacy && data.privacy.view] || null,
      duracao: data.duration || null,
      thumbnail: pickThumbLink(data.pictures)
    };
  } catch(e) {
    console.warn("[Vimeo API] erro:", e);
    return null;
  }
}

/* Altera a senha do vídeo de verdade no Vimeo (requer token com escopo Edit).
   Lança erro (com mensagem amigável) se algo der errado — quem chama decide o que fazer. */
async function alterarSenhaVimeoApi(url, novaSenha) {
  var token = localStorage.getItem(VIMEO_TOKEN_KEY);
  var id = extrairVimeoId(url);
  if (!token) throw new Error("Nenhum token da API do Vimeo configurado (veja vimeo-teste.html).");
  if (!id) throw new Error("Não consegui identificar o ID do vídeo nessa URL.");

  var res = await fetch("https://api.vimeo.com/videos/" + id, {
    method: "PATCH",
    headers: {
      "Authorization": "Bearer " + token,
      "Content-Type": "application/json",
      "Accept": "application/vnd.vimeo.*+json;version=3.4"
    },
    body: JSON.stringify({ privacy: { view: "password" }, password: novaSenha })
  });

  if (!res.ok) {
    var corpo = await res.text();
    var msg = "";
    try { msg = JSON.parse(corpo).error || ""; } catch(_) {}
    console.warn("[Vimeo API] erro ao alterar senha:", res.status, corpo);
    if (res.status === 401 || res.status === 403) {
      throw new Error("Sem permissão pra alterar (o token provavelmente não tem escopo Edit).");
    }
    if (res.status === 429) {
      throw new Error("Limite de requisições da API atingido — espere um minuto e tente de novo.");
    }
    throw new Error("Erro " + res.status + (msg ? ": " + msg : "") + " ao alterar a senha no Vimeo.");
  }
}

/* ============================================================
   MODAL
   ============================================================ */
function openModal(opts) {
  var title = opts.title||"", subtitle = opts.subtitle||"",
      bodyHtml = opts.bodyHtml||"", submitLabel = opts.submitLabel||"Salvar",
      onSubmit = opts.onSubmit, onMount = opts.onMount, wide = opts.wide||false;

  var overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML =
    '<div class="modal'+(wide?" modal-wide":"")+'" role="dialog" aria-modal="true">'+
      '<div class="modal-head"><div>'+
        '<h2>'+esc(title)+'</h2>'+
        (subtitle?'<div class="modal-sub">'+esc(subtitle)+'</div>':'')+
      '</div>'+
      '<button class="modal-close" type="button" aria-label="Fechar">&times;</button></div>'+
      '<form novalidate>'+
        '<div class="modal-body">'+
          '<div class="form-error" style="display:none"></div>'+
          bodyHtml+
        '</div>'+
        '<div class="modal-foot">'+
          '<button type="button" class="btn btn-ghost" data-close>Cancelar</button>'+
          '<button type="submit" class="btn btn-primary">'+esc(submitLabel)+'</button>'+
        '</div>'+
      '</form>'+
    '</div>';

  document.getElementById("modal-root").appendChild(overlay);
  var form = overlay.querySelector("form");
  var errBox = overlay.querySelector(".form-error");

  function closeModal() { overlay.remove(); document.removeEventListener("keydown", onKey); }
  function onKey(e) { if(e.key==="Escape") closeModal(); }
  document.addEventListener("keydown", onKey);
  overlay.addEventListener("mousedown", function(e){ if(e.target===overlay) closeModal(); });
  overlay.querySelector(".modal-close").addEventListener("click", closeModal);
  overlay.querySelector("[data-close]").addEventListener("click", closeModal);

  form.addEventListener("submit", async function(e) {
    e.preventDefault();
    errBox.style.display = "none";
    var btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      await (onSubmit && onSubmit(form));
      closeModal();
    } catch(err) {
      errBox.textContent = (err && err.message) || "Erro ao salvar.";
      errBox.style.display = "block";
      btn.disabled = false;
    }
  });

  if (onMount) onMount(form);
  var first = form.querySelector("input, select, textarea");
  if (first) first.focus();
  return { close: closeModal };
}

function openTextModal(title, text) {
  var nLinhas = text.split("\n").length;
  var rows = Math.min(28, Math.max(8, nLinhas + 2));

  var overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML =
    '<div class="modal modal-text" role="dialog" aria-modal="true">'+
      '<div class="modal-head"><div>'+
        '<h2>'+esc(title)+'</h2>'+
        '<div class="modal-sub">Selecione tudo ou parte do texto abaixo para copiar novamente.</div>'+
      '</div>'+
      '<button class="modal-close" type="button" aria-label="Fechar">&times;</button></div>'+
      '<div class="modal-body">'+
        '<textarea class="share-text-view" readonly rows="'+rows+'">'+esc(text)+'</textarea>'+
      '</div>'+
      '<div class="modal-foot">'+
        '<button type="button" class="btn btn-ghost" data-close>Fechar</button>'+
        '<button type="button" class="btn btn-primary" data-recopy>Copiar tudo</button>'+
      '</div>'+
    '</div>';

  document.getElementById("modal-root").appendChild(overlay);

  function closeModal() { overlay.remove(); document.removeEventListener("keydown", onKey); }
  function onKey(e) { if(e.key==="Escape") closeModal(); }
  document.addEventListener("keydown", onKey);
  overlay.addEventListener("mousedown", function(e){ if(e.target===overlay) closeModal(); });
  overlay.querySelector(".modal-close").addEventListener("click", closeModal);
  overlay.querySelector("[data-close]").addEventListener("click", closeModal);
  overlay.querySelector("[data-recopy]").addEventListener("click", function(){
    navigator.clipboard.writeText(text).then(function(){ showCopyToast("Texto copiado"); }).catch(function(){});
  });

  var ta = overlay.querySelector(".share-text-view");
  ta.focus();
  ta.select();
}

function fText(name, label, opts) {
  opts = opts||{};
  var value = opts.value!=null?opts.value:"", type=opts.type||"text",
      placeholder=opts.placeholder||"", required=opts.required||false;
  return '<div class="field"><label for="f_'+name+'">'+esc(label)+(required?" *":"")+'</label>'+
    '<input type="'+type+'" id="f_'+name+'" name="'+name+'" value="'+esc(value)+
    '" placeholder="'+esc(placeholder)+'"></div>';
}
function fTextarea(name, label, opts) {
  opts = opts||{};
  return '<div class="field"><label for="f_'+name+'">'+esc(label)+'</label>'+
    '<textarea id="f_'+name+'" name="'+name+'" placeholder="'+esc(opts.placeholder||"")+'">'+
    esc(opts.value||"")+'</textarea></div>';
}
function fSelect(name, label, opts_arr, opts) {
  opts = opts||{};
  var value = opts.value||"";
  var options = opts_arr.map(function(o){
    var v=typeof o==="string"?o:o.value, l=typeof o==="string"?o:o.label;
    return '<option value="'+esc(v)+'"'+(v===value?" selected":"")+'>'+esc(l)+'</option>';
  }).join("");
  return '<div class="field"><label for="f_'+name+'">'+esc(label)+'</label>'+
    '<select id="f_'+name+'" name="'+name+'">'+options+'</select></div>';
}
function readVal(form, name) {
  var el = form.elements[name]; return el ? el.value.trim() : "";
}

/* ============================================================
   CADASTROS
   ============================================================ */
var CATEGORIAS = ["Filme","Série","Curta","Institucional","Outro"];
var TIPOS_LINK = [
  {value:"master",label:"Master"},
  {value:"trailer",label:"Trailer"},{value:"teaser",label:"Teaser"},
  {value:"promo",label:"Promo"},{value:"vitrine",label:"Vitrine Vimeo"},
  {value:"outro",label:"Outro"}
];
var PRIVACIDADES = [
  {value:"privado",    label:"Privado (só com link, sem senha)"},
  {value:"senha",      label:"Senha (protegido por senha)"},
  {value:"nao_listado",label:"Não listado (qualquer pessoa com o link)"},
  {value:"publico",    label:"Público"},
  {value:"incorporado",label:"Apenas incorporado"}
];
var PRIV_META = {
  privado:     {label:"Privado",     cor:"rose"},
  senha:       {label:"Senha",       cor:"amber"},
  nao_listado: {label:"Não listado", cor:"gray"},
  publico:     {label:"Público",     cor:"green"},
  incorporado: {label:"Incorporado", cor:"blue"}
};
function privBadge(priv) {
  if (!priv) return "";
  var m = PRIV_META[priv]; if (!m) return "";
  return '<span class="priv-badge badge-'+m.cor+'">'+m.label+'</span>';
}
/* ---- Projeto ---- */
function abrirNovoProjeto(existente) {
  var ed = !!existente, p = existente||{}, posterBase64 = p.poster||"";

  openModal({
    title: ed?"Editar projeto":"Novo projeto",
    submitLabel: ed?"Salvar alterações":"Criar projeto",
    bodyHtml:
      fText("nome","Nome do projeto",{required:true,value:p.nome||"",placeholder:"Ex.: Imortais"})+
      '<div class="field-2col">'+
        fText("ano","Ano",{type:"number",value:p.ano!=null?p.ano:new Date().getFullYear()})+
        fSelect("categoria","Categoria",CATEGORIAS,{value:p.categoria||CATEGORIAS[0]})+
      '</div>'+

      /* Seção de temporadas — visível só quando Série */
      '<div id="serie-section" style="display:none">'+
        '<div class="field">'+
          '<label>Temporadas</label>'+
          '<div id="temp-lista" style="display:flex;flex-direction:column;gap:6px;margin-top:6px;"></div>'+
          '<button type="button" class="btn btn-ghost btn-sm" id="btn-add-temp" style="margin-top:8px;font-size:12px;">+ Temporada</button>'+
        '</div>'+
      '</div>'+

      '<div class="field">'+
        '<label>Capa / Poster <span style="font-weight:400;color:var(--text-faint)">(opcional)</span></label>'+
        '<div class="poster-upload-area" id="poster-area">'+
          (posterBase64
            ?'<img src="'+posterBase64+'" class="poster-preview" id="poster-preview" alt="Poster">'
            :'<div class="poster-placeholder" id="poster-preview"><span>Sem imagem</span></div>')+
          '<label class="btn btn-ghost" style="cursor:pointer;margin-top:10px">'+
            (posterBase64?"Trocar imagem":"Escolher imagem")+
            '<input type="file" accept="image/*" id="poster-input" style="display:none">'+
          '</label>'+
          (posterBase64?'<button type="button" class="btn btn-ghost" id="poster-remove" style="color:var(--c-rose-fg)">Remover</button>':"")+
        '</div>'+
        '<div class="field-hint">Formato retrato recomendado. Pode deixar sem imagem.</div>'+
      '</div>'+
      fTextarea("sinopse","Sinopse",{value:p.sinopse||"",placeholder:"Breve descrição (opcional)…"}),

    onMount: function(form) {
      /* --- poster --- */
      var input = form.querySelector("#poster-input");
      var removeBtn = form.querySelector("#poster-remove");
      function previewEl() { return form.querySelector("#poster-preview"); }
      function setPoster(b64) {
        posterBase64 = b64;
        var prev = previewEl();
        if (b64) prev.outerHTML = '<img src="'+b64+'" class="poster-preview" id="poster-preview" alt="Poster">';
        else prev.outerHTML = '<div class="poster-placeholder" id="poster-preview"><span>Sem imagem</span></div>';
      }
      input.addEventListener("change", async function() {
        if (input.files[0]) setPoster(await compressImage(input.files[0]));
      });
      if (removeBtn) removeBtn.addEventListener("click", function(){ setPoster(""); });
      form._getPoster = function(){ return posterBase64; };

      /* --- temporadas (Série) --- */
      var catSelect = form.querySelector("#f_categoria");
      var serieSection = form.querySelector("#serie-section");
      var tempLista = form.querySelector("#temp-lista");
      var btnAddTemp = form.querySelector("#btn-add-temp");

      function renumerar() {
        tempLista.querySelectorAll(".temp-row").forEach(function(r, i){
          r.querySelector(".temp-num").textContent = "T"+(i+1);
          r.dataset.num = i+1;
        });
      }

      function addTempRow(num, ano, totalEps) {
        var row = document.createElement("div");
        row.className = "temp-row";
        row.dataset.num = num||1;
        row.innerHTML =
          '<span class="temp-num" style="min-width:22px;font-size:12px;font-weight:700;color:var(--text-soft)">T'+(num||1)+'</span>'+
          '<input type="number" class="temp-ano" placeholder="Ano" value="'+(ano||"")+'" style="width:76px;padding:5px 8px;border:1px solid var(--border-strong);border-radius:6px;font-size:13px;background:var(--surface);color:var(--text);">'+
          '<input type="number" class="temp-eps" placeholder="Eps" value="'+(totalEps||"")+'" style="width:62px;padding:5px 8px;border:1px solid var(--border-strong);border-radius:6px;font-size:13px;background:var(--surface);color:var(--text);">'+
          '<span style="font-size:11px;color:var(--text-faint)">episódios</span>'+
          '<button type="button" style="all:unset;cursor:pointer;font-size:13px;color:var(--text-faint);padding:2px 6px;border-radius:4px;" class="del-temp-btn">✕</button>';
        row.querySelector(".del-temp-btn").addEventListener("click", function(){
          row.remove(); renumerar();
        });
        tempLista.appendChild(row);
        renumerar();
      }

      function updateSerieVisibility() {
        serieSection.style.display = catSelect.value==="Série" ? "block" : "none";
      }
      catSelect.addEventListener("change", updateSerieVisibility);
      updateSerieVisibility();

      /* pré-preenche temporadas no modo edição */
      if (p.temporadas && p.temporadas.length) {
        p.temporadas.forEach(function(t){ addTempRow(t.num, t.ano, t.totalEps); });
      }

      btnAddTemp.addEventListener("click", function(){ addTempRow(null, null, null); });

      form._getTemporadas = function() {
        return Array.from(tempLista.querySelectorAll(".temp-row")).map(function(r, i){
          return {
            num: i+1,
            ano: Number(r.querySelector(".temp-ano").value)||null,
            totalEps: Number(r.querySelector(".temp-eps").value)||null
          };
        });
      };
    },

    onSubmit: async function(form) {
      var nome = readVal(form,"nome");
      if (!nome) throw new Error("Informe o nome do projeto.");
      var categoria = readVal(form,"categoria");
      var campos = {
        nome: nome,
        ano: Number(readVal(form,"ano"))||new Date().getFullYear(),
        categoria: categoria,
        poster: form._getPoster ? form._getPoster() : posterBase64,
        sinopse: readVal(form,"sinopse"),
        temporadas: (categoria==="Série" && form._getTemporadas) ? form._getTemporadas() : []
      };
      if (ed) store.updateProjeto(p.id, campos);
      else store.addProjeto(campos);
    }
  });
}

/* ---- Link Vimeo ---- */
function abrirNovoLink(projetoId, existente, tipoForcado) {
  var ed = !!existente, l = existente||{};
  var duracaoFetched = null, thumbnailFetched = null;
  var proj = store.getProjeto(projetoId);
  var isSerie = proj && proj.categoria==="Série";
  var temporadas = (proj && proj.temporadas) || [];
  var tipoInicial = tipoForcado || l.tipo || "master";
  var tiposDisp = tipoForcado
    ? [{value:tipoForcado, label:(TIPOS_LINK.find(function(t){return t.value===tipoForcado;})||{label:tipoForcado}).label}]
    : TIPOS_LINK.filter(function(t){ return t.value!=="vitrine"; });

  var tempOpts = temporadas.map(function(t){
    return { value: String(t.num), label: "T"+t.num+(t.ano?" ("+t.ano+")":"") };
  });

  openModal({
    title: ed?"Editar link":"Adicionar link Vimeo",
    submitLabel: ed?"Salvar":"Adicionar",
    bodyHtml:
      fText("url","URL do Vimeo",{required:true,value:l.url||"",placeholder:"https://vimeo.com/123456789"})+
      fText("titulo","Texto do link",{required:true,value:l.titulo||"",placeholder:"Ex.: Master — Marca d'água Canal Brasil"})+
      '<div class="field-hint" id="vimeo-hint" style="display:none">Buscando título no Vimeo…</div>'+
      '<div class="field-2col">'+
        fSelect("tipo","Tipo",tiposDisp,{value:tipoInicial})+
        (isSerie && tempOpts.length
          ? fSelect("temporada","Temporada",tempOpts,{value:String(l.temporada||tempOpts[0].value)})
          : '<div></div>')+
      '</div>'+
      fText("numero","Nº episódio",{type:"number",value:l.numero||"",placeholder:isSerie?"Episódio dentro da temporada":"Deixe em branco se não for episódio"})+
      fSelect("privacidade","Privacidade no Vimeo *",PRIVACIDADES,{value:l.privacidade||"nao_listado"})+
      '<div id="campo-senha">'+
        fText("senha","Senha do vídeo",{value:l.senha||"",placeholder:"Senha de acesso ao vídeo"})+
      '</div>',

    onMount: function(form) {
      var privSelect = form.querySelector("#f_privacidade");
      var campoSenha = form.querySelector("#campo-senha");
      function toggleSenha() {
        campoSenha.style.display = privSelect.value==="senha" ? "block" : "none";
      }
      privSelect.addEventListener("change", toggleSenha);
      toggleSenha();

      var urlInput = form.querySelector("#f_url");
      var tituloInput = form.querySelector("#f_titulo");
      var hint = form.querySelector("#vimeo-hint");
      var temToken = !!localStorage.getItem(VIMEO_TOKEN_KEY);
      if (!temToken && !ed) {
        hint.textContent = "💡 Sem token da API do Vimeo configurado — só dá pra buscar o título (vídeos públicos). Configure em vimeo-teste.html pra também preencher a privacidade.";
        hint.style.display = "block";
      }

      async function tentarBuscarDados(url) {
        if (!url) return;
        hint.textContent = "Buscando dados no Vimeo…";
        hint.style.display = "block";

        var viaApi = await fetchVimeoDadosApi(url);
        if (viaApi) {
          if (viaApi.titulo && !tituloInput.value.trim()) tituloInput.value = viaApi.titulo;
          if (viaApi.privacidade) { privSelect.value = viaApi.privacidade; toggleSenha(); }
          if (viaApi.duracao) duracaoFetched = viaApi.duracao;
          if (viaApi.thumbnail) thumbnailFetched = viaApi.thumbnail;
          hint.textContent = "Dados preenchidos via API do Vimeo (título, privacidade, duração, thumbnail).";
          setTimeout(function(){ hint.style.display = "none"; }, 2500);
          return;
        }

        var viaOembed = await fetchVimeoOembed(url);
        if (viaOembed) {
          if (viaOembed.titulo && !tituloInput.value.trim()) tituloInput.value = viaOembed.titulo;
          if (viaOembed.duracao) duracaoFetched = viaOembed.duracao;
          if (viaOembed.thumbnail) thumbnailFetched = viaOembed.thumbnail;
          hint.style.display = "none";
        } else {
          hint.textContent = "Não foi possível buscar os dados automaticamente. Preencha manualmente.";
        }
      }
      urlInput.addEventListener("paste", function(e) {
        var colado = (e.clipboardData || window.clipboardData).getData("text").trim();
        setTimeout(function(){ tentarBuscarDados(colado); }, 0);
      });
      urlInput.addEventListener("blur", function() {
        tentarBuscarDados(urlInput.value.trim());
      });
    },

    onSubmit: async function(form) {
      var url = readVal(form,"url"), titulo = readVal(form,"titulo");
      if (!url) throw new Error("Informe a URL do Vimeo.");
      if (!titulo) throw new Error("Informe o texto do link.");
      var priv = readVal(form,"privacidade");
      if (!priv) throw new Error("Selecione a privacidade do vídeo no Vimeo.");
      var dados = {
        tipo: tipoForcado || readVal(form,"tipo"),
        titulo: titulo, url: url,
        privacidade: priv,
        senha: priv==="senha" ? readVal(form,"senha") : "",
        numero: Number(readVal(form,"numero"))||null,
        temporada: (isSerie && tempOpts.length) ? Number(readVal(form,"temporada"))||null : null
      };
      if (duracaoFetched) dados.duracao = duracaoFetched;
      if (thumbnailFetched) dados.thumbnail = thumbnailFetched;
      if (ed) store.updateLink(projetoId, l.id, dados);
      else store.addLink(projetoId, dados);
    }
  });
}

function abrirAlterarSenha(projetoId, link) {
  openModal({
    title: "Alterar senha do vídeo",
    subtitle: link.titulo,
    submitLabel: "Salvar nova senha",
    bodyHtml:
      '<div class="warning-banner">⚠️ <strong>Atenção:</strong> isso vai alterar a senha diretamente no vídeo no Vimeo (via API). '+
      'Qualquer pessoa com a senha atual perde o acesso ao vídeo assim que a nova senha for salva.</div>'+
      fText("novaSenha","Nova senha",{required:true,value:link.senha||"",placeholder:"Nova senha de acesso ao vídeo"}),
    onSubmit: async function(form) {
      var novaSenha = readVal(form,"novaSenha");
      if (!novaSenha) throw new Error("Informe a nova senha.");
      await alterarSenhaVimeoApi(link.url, novaSenha);
      store.updateLink(projetoId, link.id, { senha: novaSenha });
      showCopyToast("Senha atualizada no Vimeo");
    }
  });
}

/* ---- Marca d'água ---- */
function abrirNovaMarcaDagua(projetoId, existente) {
  var ed = !!existente, md = existente||{};
  openModal({
    title: ed?"Editar versão com marca d'água":"Adicionar versão com marca d'água",
    submitLabel: ed?"Salvar":"Adicionar",
    bodyHtml:
      fText("titulo","Descrição",{required:true,value:md.titulo||"",placeholder:"Ex.: Com marca d'água Canal Brasil"})+
      fText("url","URL do Vimeo",{required:true,value:md.url||"",placeholder:"https://vimeo.com/…"})+
      fText("senha","Senha (se protegido)",{value:md.senha||""})+
      fTextarea("observacoes","Observações",{value:md.observacoes||"",placeholder:"Exibidor, finalidade, data de envio…"}),
    onSubmit: async function(form) {
      var titulo = readVal(form,"titulo"), url = readVal(form,"url");
      if (!titulo) throw new Error("Informe uma descrição.");
      if (!url) throw new Error("Informe a URL.");
      var dados = { titulo:titulo, url:url, senha:readVal(form,"senha"), observacoes:readVal(form,"observacoes") };
      if (ed) store.updateMarcaDagua(projetoId, md.id, dados);
      else store.addMarcaDagua(projetoId, dados);
    }
  });
}

/* ---- Solicitar versão (formulário público: nome, e-mail, projeto, pedido) ----
   Dispara e-mail pra equipe (com Reply-To = e-mail de quem pediu) e, se configurado,
   um e-mail de confirmação automático pra quem pediu. Não fica nada salvo no
   catálogo — é só um disparo de e-mail. */
function abrirSolicitarVersao(projetoId) {
  var proj = store.getProjeto(projetoId);
  var projNome = proj ? proj.nome : "";

  openModal({
    title: "Solicitar versão",
    subtitle: "Preencha seus dados e detalhe o pedido (marca d'água, formato, prazo, finalidade…). A equipe recebe um e-mail automático, e você recebe a confirmação.",
    submitLabel: "Enviar pedido",
    bodyHtml:
      '<div class="field"><label>Projeto</label><div class="solic-projeto-fixo">'+esc(projNome)+'</div></div>'+
      '<div class="field-2col">'+
        fText("nome","Nome",{required:true,placeholder:"Seu nome completo"})+
        fText("email","Seu e-mail",{type:"email",required:true,placeholder:"para receber a confirmação"})+
      '</div>'+
      fTextarea("pedido","Detalhe o pedido",{required:true,
        placeholder:"Ex.: master sem marca d'água, versão com marca d'água de tal canal, formato específico, prazo, finalidade…"}),
    onSubmit: async function(form) {
      var nome = readVal(form,"nome");
      var email = readVal(form,"email");
      var pedido = readVal(form,"pedido");
      if (!nome) throw new Error("Informe seu nome.");
      if (!email) throw new Error("Informe seu e-mail.");
      if (!pedido) throw new Error("Detalhe o pedido.");
      await enviarEmailSolicitacao({ nome:nome, email:email, projeto:projNome, pedido:pedido, link:location.href });
      showCopyToast("Pedido enviado com sucesso!");
    }
  });
}

/* ============================================================
   VIEW: HOME
   ============================================================ */
var CATS_HOME = ["Todos","Filme","Série","Curta","Institucional","Outro"];

function renderHome(app) {
  app.innerHTML =
    '<div class="home-toolbar">'+
      '<div class="home-filters" id="cat-filters">'+
        CATS_HOME.map(function(c){
          return '<button class="filter-btn'+(c==="Todos"?" active":"")+'" data-cat="'+esc(c)+'">'+esc(c)+'</button>';
        }).join("")+
      '</div>'+
      '<div class="home-search-wrap">'+
        '<input class="home-search" id="home-search" type="search" placeholder="Buscar projeto…" autocomplete="off">'+
      '</div>'+
    '</div>'+
    '<div class="catalog-grid" id="catalog-grid"></div>';

  var catAtiva = "Todos", busca = "";

  function render() {
    var lista = store.listProjetos();
    if (catAtiva!=="Todos") lista = lista.filter(function(p){ return p.categoria===catAtiva; });
    if (busca) {
      var q = busca.toLowerCase();
      lista = lista.filter(function(p){ return p.nome.toLowerCase().includes(q)||String(p.ano||"").includes(q); });
    }
    var grid = document.getElementById("catalog-grid"); if (!grid) return;
    if (!lista.length) {
      var msg = (busca||catAtiva!=="Todos") ? "Nenhum projeto encontrado" : "Catálogo vazio";
      var sub = (busca||catAtiva!=="Todos") ? "Tente outro termo ou categoria." : 'Clique em "+ Novo projeto" para começar.';
      grid.innerHTML = '<div class="empty-catalog"><div class="empty-icon">🎬</div><div class="empty-title">'+msg+'</div><div class="empty-sub">'+sub+'</div></div>';
      return;
    }
    grid.innerHTML = lista.map(function(p){
      var posterHtml = p.poster
        ? '<img src="'+p.poster+'" alt="'+esc(p.nome)+'" loading="lazy">'
        : '<div class="poster-ph"><span>'+esc(p.nome.slice(0,2).toUpperCase())+'</span></div>';
      var meta = esc(p.ano||"") + (p.categoria?' · <span class="cat-tag">'+esc(p.categoria)+'</span>':"");
      if (p.categoria==="Série" && p.temporadas && p.temporadas.length)
        meta += ' · <span style="color:var(--text-faint)">'+p.temporadas.length+'T</span>';
      return '<div class="proj-card" data-id="'+esc(p.id)+'" title="'+esc(p.nome)+'">'+
        '<div class="proj-card-poster">'+posterHtml+'<div class="proj-card-hover">Ver projeto →</div></div>'+
        '<div class="proj-card-info"><div class="proj-card-nome">'+esc(p.nome)+'</div>'+
        '<div class="proj-card-meta">'+meta+'</div></div>'+
      '</div>';
    }).join("");
    grid.querySelectorAll(".proj-card").forEach(function(card){
      card.addEventListener("click", function(){ location.hash = "#/projeto/"+card.dataset.id; });
    });
  }

  document.getElementById("cat-filters").addEventListener("click", function(e){
    var btn = e.target.closest(".filter-btn"); if (!btn) return;
    catAtiva = btn.dataset.cat;
    document.querySelectorAll(".filter-btn").forEach(function(b){ b.classList.toggle("active",b===btn); });
    render();
  });
  document.getElementById("home-search").addEventListener("input", function(e){
    busca = e.target.value.trim(); render();
  });
  render();
}

/* ============================================================
   VIEW: PROJETO DETALHE
   ============================================================ */
var TIPO_META = {
  master:   {label:"Master",        icon:"🎬",ordem:0},
  trailer:  {label:"Trailer",       icon:"▶", ordem:1},
  teaser:   {label:"Teaser",        icon:"✦", ordem:2},
  promo:    {label:"Promo",         icon:"📣",ordem:3},
  vitrine:  {label:"Vitrine Vimeo", icon:"🗂",ordem:4},
  outro:    {label:"Outros",        icon:"🔗",ordem:5}
};
var _toastTimer;
function showCopyToast(msg) {
  var t = document.getElementById("copy-toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "copy-toast"; t.className = "copy-toast";
    document.body.appendChild(t);
  }
  t.textContent = msg || "Texto copiado para área de transferência";
  t.classList.add("show");
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(function(){ t.classList.remove("show"); }, 2000);
}

function attrShare(text) {
  return String(text).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/\n/g,"&#10;");
}
function buildShareText(l) {
  var meta = TIPO_META[l.tipo]||{label:l.tipo||""};
  var priv = PRIV_META[l.privacidade]||{label:""};
  var prefix = l.temporada ? "T"+l.temporada+(l.numero?" E"+l.numero:"")+" — "
              : l.numero   ? "Ep."+l.numero+" — " : "";
  var lines = [prefix+l.titulo, meta.label+(priv.label?" · "+priv.label:""), l.url];
  if (l.privacidade==='senha' && l.senha) lines.push("Senha: "+l.senha);
  return lines.join("\n");
}
function buildGroupShareText(tipo, links, projetoNome) {
  var meta = TIPO_META[tipo]||{label:tipo};
  var header = (projetoNome?projetoNome+" — ":"")+meta.label;
  var items = links.map(function(l, i){
    var prefix = l.temporada ? "T"+l.temporada+(l.numero?" E"+l.numero:"")+" — "
                : l.numero   ? "Ep."+l.numero+" — " : "";
    var line = (i+1)+". "+prefix+l.titulo+"\n   "+l.url;
    if (l.privacidade==='senha' && l.senha) line += "\n   Senha: "+l.senha;
    return line;
  });
  return header+"\n\n"+items.join("\n\n");
}

function privCell(l) {
  var m = PRIV_META[l.privacidade];
  if (!m) return "";
  if (l.privacidade!=='senha') return '<span class="priv-badge badge-'+m.cor+'">'+m.label+'</span>';

  var conteudo = l.senha
    ? '<span class="senha-popover-valor" data-copy="'+esc(l.senha)+'" title="Clique para copiar">'+esc(l.senha)+'</span>'+
      '<span class="senha-popover-hint">Clique para copiar</span>'
    : '<span class="senha-popover-aviso">⚠ Não é possível ver a senha</span>';

  return '<span class="priv-badge-wrap" tabindex="0">'+
      '<span class="priv-badge badge-'+m.cor+'">🔒 '+m.label+'</span>'+
      '<span class="senha-popover">'+
        '<span class="senha-popover-box">'+
          conteudo+
        '</span>'+
      '</span>'+
    '</span>';
}

function wrapTable(rowsHtml) {
  return '<div class="videos-table-wrap"><table class="videos-table"><tbody>'+rowsHtml+'</tbody></table></div>';
}

function ordenarPorTitulo(arr) {
  return arr.slice().sort(function(a, b) {
    return (a.titulo || "").localeCompare(b.titulo || "", "pt-BR", { numeric: true, sensitivity: "base" });
  });
}

/* Para séries: respeita a ordem dos episódios (campo "numero") em vez de ordem alfabética. */
function ordenarLinks(arr, porEpisodio) {
  if (!porEpisodio) return ordenarPorTitulo(arr);
  return arr.slice().sort(function(a, b) {
    if (a.numero != null && b.numero != null) return a.numero - b.numero;
    if (a.numero != null) return -1;
    if (b.numero != null) return 1;
    return (a.titulo || "").localeCompare(b.titulo || "", "pt-BR", { numeric: true, sensitivity: "base" });
  });
}

/* Segundos -> "12:34" (ou "1:02:34" acima de 1h) */
function formatDuracao(seg) {
  seg = Number(seg) || 0;
  if (!seg) return "";
  var h = Math.floor(seg / 3600), m = Math.floor((seg % 3600) / 60), s = seg % 60;
  var mm = String(m).padStart(h ? 2 : 1, "0"), ss = String(s).padStart(2, "0");
  return h ? (h + ":" + String(m).padStart(2,"0") + ":" + ss) : (mm + ":" + ss);
}

function linkRow(l) {
  var badge = "";
  if (l.temporada) badge = '<span class="ep-badge">T'+l.temporada+(l.numero?' E'+l.numero:'')+'</span>';
  else if (l.numero) badge = '<span class="ep-badge">Ep.'+l.numero+'</span>';
  var dur = formatDuracao(l.duracao);
  return '<tr class="link-row">'+
    '<td class="col-thumb">'+
      '<div class="thumb-wrap'+(l.thumbnail?"":" thumb-empty")+'">'+
        (l.thumbnail ? '<img class="thumb-img" src="'+esc(l.thumbnail)+'" alt="" loading="lazy">' : "")+
        (dur ? '<span class="thumb-duration">'+dur+'</span>' : "")+
      '</div>'+
    '</td>'+
    '<td class="col-code">'+badge+'</td>'+
    '<td class="col-nome">'+esc(l.titulo)+'</td>'+
    '<td class="col-link"><div class="link-priv-inline">'+
      '<a href="'+esc(l.url)+'" target="_blank" rel="noopener" class="link-col-url" title="'+esc(l.url)+'">'+esc(l.url)+'</a>'+
      privCell(l)+
    '</div></td>'+
    '<td class="col-acoes"><div class="row-actions">'+
      (l.privacidade==='senha'
        ? '<button class="labeled-btn" data-action="altsenha" data-link-id="'+esc(l.id)+'">🔑 Alterar senha</button>'
        : "")+
      '<button class="labeled-btn" data-action="copylink" data-copy-link="'+esc(l.url)+'">📋 Copiar link</button>'+
      '<button class="labeled-btn" data-action="share" data-share-text="'+attrShare(buildShareText(l))+'">'+
        '<img src="./Compartilhar.png" width="14" height="14" alt=""> Compartilhar'+
      '</button>'+
      '<div class="item-actions">'+
        '<button class="icon-btn" data-action="edit" data-link-id="'+esc(l.id)+'" title="Editar">✎</button>'+
        '<button class="icon-btn danger" data-action="del" data-link-id="'+esc(l.id)+'" title="Excluir">🗑</button>'+
      '</div>'+
    '</div></td>'+
  '</tr>';
}

function renderVideosPorTipo(links, projetoNome, porEpisodio) {
  var grupos = {};
  links.forEach(function(l){ if(!grupos[l.tipo]) grupos[l.tipo]=[]; grupos[l.tipo].push(l); });
  return Object.keys(TIPO_META).filter(function(t){ return grupos[t]; }).map(function(tipo){
    var meta = TIPO_META[tipo];
    var linksOrdenados = ordenarLinks(grupos[tipo], porEpisodio);
    var grupoTxt = attrShare(buildGroupShareText(tipo, linksOrdenados, projetoNome||""));
    return '<div class="link-grupo">'+
      '<div class="link-grupo-titulo">'+
        '<span>'+meta.icon+" "+meta.label+'</span>'+
        '<button class="share-grupo-btn" data-action="share" data-share-text="'+grupoTxt+'" title="Compartilhar todos do grupo">'+
          '<img src="./Compartilhar.png" width="14" height="14" alt=""> Compartilhar todos'+
        '</button>'+
      '</div>'+
      wrapTable(linksOrdenados.map(linkRow).join(""))+
    '</div>';
  }).join("");
}

function renderVideos(p) {
  var links = p.links.filter(function(l){ return l.tipo!=='vitrine'; });
  if (!links.length) return '<div class="empty-tab">Nenhum link cadastrado ainda.</div>';

  /* Série: agrupa por temporada */
  if (p.categoria==="Série") {
    var byTemp = {}, semTemp = [];
    links.forEach(function(l){
      if (l.temporada) {
        if (!byTemp[l.temporada]) byTemp[l.temporada] = [];
        byTemp[l.temporada].push(l);
      } else { semTemp.push(l); }
    });
    var keys = Object.keys(byTemp).sort(function(a,b){ return Number(a)-Number(b); });
    var html = keys.map(function(tNum){
      var tInfo = p.temporadas && p.temporadas.find(function(x){ return x.num===Number(tNum); });
      var tLabel = "Temporada "+tNum + (tInfo&&tInfo.ano?" · "+tInfo.ano:"") +
        (tInfo&&tInfo.totalEps?" · "+tInfo.totalEps+" episódios":"");
      return '<div style="margin-bottom:28px">'+
        '<div class="temp-header">'+tLabel+'</div>'+
        renderVideosPorTipo(byTemp[tNum], p.nome, true)+
      '</div>';
    }).join("");
    if (semTemp.length) html += '<div style="margin-bottom:28px">'+
      '<div class="temp-header">Gerais / Sem temporada</div>'+
      renderVideosPorTipo(semTemp, p.nome, true)+'</div>';
    return html;
  }

  /* Outros: agrupa só por tipo */
  return renderVideosPorTipo(links, p.nome, false);
}

function renderVitrine(p) {
  var vitrines = p.links.filter(function(l){ return l.tipo==='vitrine'; });
  if (!vitrines.length) return '<div class="empty-tab">Nenhuma vitrine cadastrada ainda.<br>'+
    '<span style="font-size:13px;color:var(--text-soft);margin-top:6px;display:block">'+
    'Uma vitrine é um mostruário de vídeos no Vimeo — cada vídeo dentro dela tem sua própria privacidade.</span></div>';
  return wrapTable(ordenarPorTitulo(vitrines).map(linkRow).join(""));
}

function renderMarcaDagua(p) {
  if (!p.marcaDagua.length) return '<div class="empty-tab">Nenhuma versão com marca d\'água cadastrada.</div>';
  return ordenarPorTitulo(p.marcaDagua).map(function(md){
    var temSenha = !!md.senha;
    return '<div class="link-item">'+
      '<div class="link-info">'+
        '<div class="link-titulo">'+esc(md.titulo)+(temSenha?' <span class="lock-icon">🔒</span>':"")+
          (md.observacoes?' <span class="link-obs">'+esc(md.observacoes)+'</span>':"")+
        '</div>'+
        '<div class="link-url-text" title="Clique para selecionar">'+esc(md.url)+'</div>'+
      '</div>'+
      (temSenha?
        '<div class="link-senha-box">'+
          '<button class="senha-toggle" data-action="senha" data-md-id="'+esc(md.id)+'">Ver senha</button>'+
          '<span class="senha-valor">'+esc(md.senha)+'</span>'+
          '<button class="copy-btn" data-copy="'+esc(md.senha)+'">Copiar</button>'+
        '</div>':"")+
      '<a href="'+esc(md.url)+'" target="_blank" rel="noopener" class="btn btn-link-abrir">Abrir link no Vimeo</a>'+
      '<div class="item-actions">'+
        '<button class="icon-btn" data-action="edit" data-md-id="'+esc(md.id)+'" title="Editar">✎</button>'+
        '<button class="icon-btn danger" data-action="del" data-md-id="'+esc(md.id)+'" title="Excluir">🗑</button>'+
      '</div>'+
    '</div>';
  }).join("");
}

function renderVideosTipo(p, tipo) {
  var links = p.links.filter(function(l){ return l.tipo===tipo; });
  if (!links.length) return '<div class="empty-tab">Nenhum link cadastrado.</div>';
  if (tipo==='master' && p.categoria==='Série') {
    var byTemp = {}, semTemp = [];
    links.forEach(function(l){
      if (l.temporada) { if (!byTemp[l.temporada]) byTemp[l.temporada]=[]; byTemp[l.temporada].push(l); }
      else semTemp.push(l);
    });
    var keys = Object.keys(byTemp).sort(function(a,b){ return Number(a)-Number(b); });
    var html = keys.map(function(tNum){
      var tInfo = p.temporadas && p.temporadas.find(function(x){ return x.num===Number(tNum); });
      var tLabel = "Temporada "+tNum+(tInfo&&tInfo.ano?" · "+tInfo.ano:"")+(tInfo&&tInfo.totalEps?" · "+tInfo.totalEps+" episódios":"");
      return '<div style="margin-bottom:28px"><div class="temp-header">'+tLabel+'</div>'+wrapTable(ordenarLinks(byTemp[tNum], true).map(linkRow).join(""))+'</div>';
    }).join("");
    if (semTemp.length) html += '<div style="margin-bottom:28px"><div class="temp-header">Gerais</div>'+wrapTable(ordenarLinks(semTemp, true).map(linkRow).join(""))+'</div>';
    return html;
  }
  return wrapTable(ordenarLinks(links, p.categoria==='Série').map(linkRow).join(""));
}

function renderProjeto(app, id) {
  var p = store.getProjeto(id);
  if (!p) {
    app.innerHTML = '<a class="back-link" href="#/">← Voltar ao catálogo</a><div class="empty-page">Projeto não encontrado.</div>';
    return;
  }

  /* info de temporadas no aside (só para Série) */
  var tempInfo = "";
  if (p.categoria==="Série" && p.temporadas && p.temporadas.length) {
    tempInfo = p.temporadas.map(function(t){
      return '<div class="meta-item">'+
        '<span class="meta-label">T'+t.num+'</span> '+
        (t.ano?esc(t.ano)+" ":"")+(t.totalEps?'· '+t.totalEps+' eps':"")+
      '</div>';
    }).join("");
  }

  /* linha de info ao lado do título: ano · nº de episódios · nº de temporadas */
  var nEpisodios = p.links.filter(function(l){ return l.tipo==='master' && l.numero; }).length;
  var headerInfoParts = [esc(p.ano || "—")];
  if (nEpisodios) headerInfoParts.push(nEpisodios + (nEpisodios===1?" episódio":" episódios"));
  if (p.categoria==="Série" && p.temporadas && p.temporadas.length > 1) {
    headerInfoParts.push(p.temporadas.length+" temporadas");
  }
  var headerInfoLine = headerInfoParts.join(" · ");

  /* tipos presentes (excluindo vitrine) para gerar abas dinâmicas */
  var tiposPresentes = Object.keys(TIPO_META).filter(function(t){
    return t!=='vitrine' && p.links.some(function(l){ return l.tipo===t; });
  });
  var nTudo = p.links.filter(function(l){ return l.tipo!=='vitrine'; }).length;

  var tabsHtml =
    '<button class="tab-btn active" data-tab="tudo">Tudo <span class="tab-count">'+nTudo+'</span></button>';
  tiposPresentes.forEach(function(t){
    var meta = TIPO_META[t];
    var n = p.links.filter(function(l){ return l.tipo===t; }).length;
    tabsHtml += '<button class="tab-btn" data-tab="tipo-'+t+'">'+meta.label+' <span class="tab-count">'+n+'</span></button>';
  });
  tabsHtml += '<button class="tab-btn" data-tab="marca">Marca d\'água <span class="tab-count">'+p.marcaDagua.length+'</span></button>';

  var panelsHtml =
    '<div class="tab-panel active" id="tab-tudo">'+
      renderVideos(p)+
      '<button class="btn btn-ghost tab-add-btn" id="btn-add-link">+ Adicionar link</button>'+
    '</div>';
  tiposPresentes.forEach(function(t){
    var tipoLinks = p.links.filter(function(l){ return l.tipo===t; });
    var shareTxt = attrShare(buildGroupShareText(t, tipoLinks, p.nome));
    panelsHtml +=
      '<div class="tab-panel" id="tab-tipo-'+t+'">'+
        '<div class="tab-share-all">'+
          '<button class="share-grupo-btn" data-action="share" data-share-text="'+shareTxt+'" title="Compartilhar todos os links">'+
            '<img src="./Compartilhar.png" width="16" height="16" style="margin-right:6px"> Compartilhar todos'+
          '</button>'+
        '</div>'+
        renderVideosTipo(p,t)+
      '</div>';
  });
  panelsHtml +=
    '<div class="tab-panel" id="tab-marca">'+
      renderMarcaDagua(p)+
      '<button class="btn btn-ghost tab-add-btn" id="btn-add-md">+ Adicionar versão</button>'+
    '</div>';

  app.innerHTML =
    '<a class="back-link" href="#/">← Voltar ao catálogo</a>'+
    '<div class="proj-detail">'+
      '<div class="proj-detail-aside">'+
        '<div class="proj-detail-poster">'+
          (p.poster?'<img src="'+p.poster+'" alt="'+esc(p.nome)+'">'
            :'<div class="poster-ph large"><span>'+esc(p.nome.slice(0,2).toUpperCase())+'</span></div>')+
        '</div>'+
        '<div class="proj-detail-meta">'+
          '<div class="meta-item"><span class="meta-label">Categoria</span> '+esc(p.categoria||"—")+'</div>'+
          (p.categoria!=="Série"?'<div class="meta-item"><span class="meta-label">Ano</span> '+esc(p.ano||"—")+'</div>':"") +
          tempInfo+
        '</div>'+
        '<div class="proj-aside-actions">'+
          '<button class="btn btn-primary" id="btn-add-link-aside">+ Adicionar link</button>'+
          '<button class="btn" id="btn-editar">Editar projeto</button>'+
          '<button class="btn btn-ghost" id="btn-atualizar-vimeo" title="Busca no Vimeo a duração e a miniatura dos links que ainda não têm">Atualizar miniaturas</button>'+
          '<button class="btn btn-ghost danger-btn" id="btn-excluir">Excluir</button>'+
        '</div>'+
      '</div>'+
      '<div class="proj-detail-main">'+
        '<h1 class="proj-title">'+esc(p.nome)+'</h1>'+
        '<div class="proj-header-info">'+headerInfoLine+'</div>'+
        (p.sinopse?'<p class="proj-sinopse">'+esc(p.sinopse)+'</p>':"")+
        '<div class="proj-tabs-row">'+
          '<div class="tabs">'+tabsHtml+'</div>'+
          '<button class="btn btn-ghost btn-solicitar" id="btn-solicitar">Solicitar versão</button>'+
        '</div>'+
        panelsHtml+
      '</div>'+
    '</div>';

  /* troca de abas */
  app.querySelectorAll(".tab-btn").forEach(function(btn){
    btn.addEventListener("click", function(){
      app.querySelectorAll(".tab-btn").forEach(function(b){ b.classList.remove("active"); });
      app.querySelectorAll(".tab-panel").forEach(function(panel){ panel.classList.remove("active"); });
      btn.classList.add("active");
      app.querySelector("#tab-"+btn.dataset.tab).classList.add("active");
    });
  });

  document.getElementById("btn-editar").addEventListener("click", function(){ abrirNovoProjeto(p); });
  document.getElementById("btn-excluir").addEventListener("click", function(){
    if (!confirm('Excluir "'+p.nome+'" e todos os seus dados?')) return;
    store.removeProjeto(p.id); location.hash = "#/";
  });
  document.getElementById("btn-add-link").addEventListener("click", function(){ abrirNovoLink(p.id); });
  document.getElementById("btn-add-link-aside").addEventListener("click", function(){ abrirNovoLink(p.id); });
  document.getElementById("btn-add-md").addEventListener("click", function(){ abrirNovaMarcaDagua(p.id); });
  document.getElementById("btn-solicitar").addEventListener("click", function(){ abrirSolicitarVersao(p.id); });

  document.getElementById("btn-atualizar-vimeo").addEventListener("click", async function(){
    var alvo = p.links.filter(function(l){ return !l.duracao || !l.thumbnail; });
    if (!alvo.length) { showCopyToast("Todos os links já têm duração e miniatura."); return; }
    var btn = this;
    var original = btn.textContent;
    btn.disabled = true;
    var atualizados = {}, ok = 0;
    for (var i = 0; i < alvo.length; i++) {
      var l = alvo[i];
      btn.textContent = "Atualizando " + (i+1) + "/" + alvo.length + "…";
      var dados = await fetchVimeoDadosApi(l.url);
      if (!dados) dados = await fetchVimeoOembed(l.url);
      if (dados && (dados.duracao || dados.thumbnail)) {
        var upd = {};
        if (dados.duracao) upd.duracao = dados.duracao;
        if (dados.thumbnail) upd.thumbnail = dados.thumbnail;
        atualizados[l.id] = upd;
        ok++;
      }
      if (i < alvo.length - 1) await new Promise(function(r){ setTimeout(r, 300); });
    }
    btn.disabled = false;
    btn.textContent = original;
    store.updateLinksBatch(p.id, atualizados);
    showCopyToast(ok + " de " + alvo.length + " link" + (alvo.length===1?"":"s") + " atualizado" + (ok===1?"":"s"));
  });

  function handleShare(e) {
    var btn = e.target.closest("[data-action='share']");
    if (!btn) return;
    var text = btn.dataset.shareText;
    navigator.clipboard.writeText(text).catch(function(){});
    openTextModal("Texto copiado", text);
  }

  function linkDelegacao(el) {
    el.addEventListener("click", function(e){
      if (e.target.closest("[data-action='share']")) { handleShare(e); return; }
      var copyLinkBtn = e.target.closest("[data-action='copylink']");
      if (copyLinkBtn) {
        navigator.clipboard.writeText(copyLinkBtn.dataset.copyLink)
          .then(function(){ showCopyToast("Link copiado"); })
          .catch(function(){});
        return;
      }
      var lid = e.target.dataset.linkId, action = e.target.dataset.action, copy = e.target.dataset.copy;
      if (copy !== undefined) {
        navigator.clipboard.writeText(copy).then(function(){ showCopyToast("Senha copiada"); }).catch(function(){});
        return;
      }
      if (!lid) return;
      var link = p.links.find(function(l){ return l.id===lid; }); if (!link) return;
      if (action==="edit") { abrirNovoLink(p.id, link); return; }
      if (action==="altsenha") { abrirAlterarSenha(p.id, link); return; }
      if (action==="del") { if (!confirm('Excluir o link "'+link.titulo+'"?')) return; store.removeLink(p.id, lid); }
    });
  }

  linkDelegacao(document.getElementById("tab-tudo"));
  tiposPresentes.forEach(function(t){ linkDelegacao(document.getElementById("tab-tipo-"+t)); });

  document.getElementById("tab-marca").addEventListener("click", function(e){
    var mid = e.target.dataset.mdId, action = e.target.dataset.action, copy = e.target.dataset.copy;
    if (copy !== undefined) {
      navigator.clipboard.writeText(copy).then(function(){ showCopyToast("Senha copiada"); }).catch(function(){});
      return;
    }
    if (action==="senha") { var box=e.target.closest(".link-senha-box"); if(box) box.classList.toggle("revealed"); return; }
    if (!mid) return;
    var md = p.marcaDagua.find(function(x){ return x.id===mid; }); if (!md) return;
    if (action==="edit") { abrirNovaMarcaDagua(p.id, md); return; }
    if (action==="del") { if (!confirm('Excluir "'+md.titulo+'"?')) return; store.removeMarcaDagua(p.id, mid); }
  });
}

/* ============================================================
   ROTEADOR
   ============================================================ */
var appEl = document.getElementById("app");
function route() {
  var hash = location.hash || "#/";
  var m = hash.match(/^#\/projeto\/(.+)$/);
  if (m) renderProjeto(appEl, m[1]);
  else renderHome(appEl);
}

window.addEventListener("hashchange", route);
store.onChange(route);
document.getElementById("btn-novo-projeto").addEventListener("click", function(){ abrirNovoProjeto(); });
document.getElementById("btn-backup").addEventListener("click", function(){ abrirBackup(); });
route();

function abrirBackup() {
  openModal({
    title: "Backup e dados",
    subtitle: "Exportar ou importar os projetos cadastrados",
    submitLabel: "Fechar",
    onSubmit: async function() {},
    bodyHtml:
      '<p style="margin-top:0;font-size:13.5px;color:var(--text-soft)">Baixa um arquivo JSON com todos os projetos cadastrados. Faça isso periodicamente.</p>' +
      '<button type="button" class="btn btn-primary" id="btn-export-json">⬇ Exportar JSON</button>' +
      '<hr style="margin:18px 0;border:none;border-top:1px solid var(--border)">' +
      '<p style="margin-top:0;font-size:13.5px;color:var(--text-soft)">Restaura a partir de um JSON exportado. Substitui os projetos atuais pelos do arquivo.</p>' +
      '<input type="file" id="file-import-json" accept="application/json" style="display:none">' +
      '<button type="button" class="btn" id="btn-import-json">⬆ Escolher arquivo…</button>' +
      '<div id="import-json-status" style="font-size:13px;margin-top:8px;color:var(--text-soft)"></div>',
    onMount: function(form) {
      form.querySelector("#btn-export-json").addEventListener("click", function() {
        var json = store.exportAll();
        var blob = new Blob([json], { type: "application/json" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        var carimbo = new Date().toISOString().slice(0, 10);
        a.href = url; a.download = "catalogo-projetos-giros-backup-" + carimbo + ".json";
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
      });
      var fileInput = form.querySelector("#file-import-json");
      var status = form.querySelector("#import-json-status");
      form.querySelector("#btn-import-json").addEventListener("click", function() { fileInput.click(); });
      fileInput.addEventListener("change", async function() {
        var file = fileInput.files[0];
        if (!file) return;
        if (!confirm("Importar este backup? Os projetos atuais serão substituídos.")) { fileInput.value = ""; return; }
        status.textContent = "Importando…";
        try {
          var text = await file.text();
          store.importAll(text);
          status.textContent = "✓ Importado. Recarregando…";
          setTimeout(function(){ location.reload(); }, 600);
        } catch (e) {
          status.textContent = "✗ Erro: " + e.message;
        }
        fileInput.value = "";
      });
    }
  });
}

})();
