/* Giros Catálogo — bundle único, sem ES modules */
(function () {
"use strict";

/* Email para notificações de demandas — altere aqui */
var EMAIL_DEMANDAS = "acervo@girostraffic.page";

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
      links: [], marcaDagua: [], demandas: []
    };
    db.projetos.push(novo); saveDb(); return novo;
  },
  updateProjeto: function(id, campos) {
    var p = db.projetos.find(function(x){ return x.id===id; });
    if (!p) return; Object.assign(p, campos); saveDb();
  },
  removeProjeto: function(id) {
    db.projetos = db.projetos.filter(function(p){ return p.id!==id; }); saveDb();
  },
  addLink: function(pid, dados) {
    var p = db.projetos.find(function(x){ return x.id===pid; }); if(!p) return;
    var novo = { id:novoId("l"), tipo:dados.tipo, titulo:dados.titulo,
      url:dados.url, senha:dados.senha||"", numero:dados.numero||null,
      temporada:dados.temporada||null };
    p.links.push(novo); saveDb(); return novo;
  },
  updateLink: function(pid, lid, dados) {
    var p = db.projetos.find(function(x){ return x.id===pid; }); if(!p) return;
    var l = p.links.find(function(x){ return x.id===lid; });
    if(l){ Object.assign(l,dados); saveDb(); }
  },
  removeLink: function(pid, lid) {
    var p = db.projetos.find(function(x){ return x.id===pid; }); if(!p) return;
    p.links = p.links.filter(function(l){ return l.id!==lid; }); saveDb();
  },
  addMarcaDagua: function(pid, dados) {
    var p = db.projetos.find(function(x){ return x.id===pid; }); if(!p) return;
    var novo = { id:novoId("md"), titulo:dados.titulo, url:dados.url,
      senha:dados.senha||"", observacoes:dados.observacoes||"" };
    p.marcaDagua.push(novo); saveDb(); return novo;
  },
  updateMarcaDagua: function(pid, mid, dados) {
    var p = db.projetos.find(function(x){ return x.id===pid; }); if(!p) return;
    var md = p.marcaDagua.find(function(x){ return x.id===mid; });
    if(md){ Object.assign(md,dados); saveDb(); }
  },
  removeMarcaDagua: function(pid, mid) {
    var p = db.projetos.find(function(x){ return x.id===pid; }); if(!p) return;
    p.marcaDagua = p.marcaDagua.filter(function(x){ return x.id!==mid; }); saveDb();
  },
  addDemanda: function(pid, dados) {
    var p = db.projetos.find(function(x){ return x.id===pid; }); if(!p) return;
    var novo = { id:novoId("d"), descricao:dados.descricao, responsavel:dados.responsavel||"",
      status:dados.status||"Pendente", data:new Date().toISOString().slice(0,10) };
    p.demandas.push(novo); saveDb(); return novo;
  },
  updateDemanda: function(pid, did, dados) {
    var p = db.projetos.find(function(x){ return x.id===pid; }); if(!p) return;
    var d = p.demandas.find(function(x){ return x.id===did; });
    if(d){ Object.assign(d,dados); saveDb(); }
  },
  removeDemanda: function(pid, did) {
    var p = db.projetos.find(function(x){ return x.id===pid; }); if(!p) return;
    p.demandas = p.demandas.filter(function(x){ return x.id!==did; }); saveDb();
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

async function fetchVimeoTitle(url) {
  try {
    var ctrl = new AbortController();
    var t = setTimeout(function(){ ctrl.abort(); }, 4000);
    var res = await fetch("https://vimeo.com/api/oembed.json?url=" + encodeURIComponent(url),
      { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    var data = await res.json();
    return data.title || null;
  } catch(_) { return null; }
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
var CATEGORIAS = ["Documentário","Filme","Série","Curta","Institucional","Outro"];
var TIPOS_LINK = [
  {value:"master",label:"Master"},{value:"episodio",label:"Episódio"},
  {value:"trailer",label:"Trailer"},{value:"teaser",label:"Teaser"},
  {value:"promo",label:"Promo"},{value:"vitrine",label:"Vitrine Vimeo"},
  {value:"outro",label:"Outro"}
];
var STATUS_DEMANDA = ["Pendente","Em andamento","Concluída","Cancelada"];

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
function abrirNovoLink(projetoId, existente) {
  var ed = !!existente, l = existente||{};
  var proj = store.getProjeto(projetoId);
  var isSerie = proj && proj.categoria==="Série";
  var temporadas = (proj && proj.temporadas) || [];

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
        fSelect("tipo","Tipo",TIPOS_LINK,{value:l.tipo||"master"})+
        (isSerie && tempOpts.length
          ? fSelect("temporada","Temporada",tempOpts,{value:String(l.temporada||tempOpts[0].value)})
          : '<div></div>')+
      '</div>'+
      fText("numero","Nº episódio",{type:"number",value:l.numero||"",placeholder:isSerie?"Episódio dentro da temporada":"Deixe em branco se não for episódio"})+
      fText("senha","Senha Vimeo",{value:l.senha||"",placeholder:"Deixe em branco se público"}),

    onMount: function(form) {
      if (ed) return;
      var urlInput = form.querySelector("#f_url");
      var tituloInput = form.querySelector("#f_titulo");
      var hint = form.querySelector("#vimeo-hint");
      urlInput.addEventListener("blur", async function() {
        var url = urlInput.value.trim();
        if (!url || tituloInput.value.trim()) return;
        hint.textContent = "Buscando título no Vimeo…";
        hint.style.display = "block";
        var title = await fetchVimeoTitle(url);
        hint.style.display = "none";
        if (title && !tituloInput.value.trim()) tituloInput.value = title;
      });
    },

    onSubmit: async function(form) {
      var url = readVal(form,"url"), titulo = readVal(form,"titulo");
      if (!url) throw new Error("Informe a URL do Vimeo.");
      if (!titulo) throw new Error("Informe o texto do link.");
      var dados = {
        tipo: readVal(form,"tipo"), titulo: titulo, url: url,
        senha: readVal(form,"senha"),
        numero: Number(readVal(form,"numero"))||null,
        temporada: (isSerie && tempOpts.length) ? Number(readVal(form,"temporada"))||null : null
      };
      if (ed) store.updateLink(projetoId, l.id, dados);
      else store.addLink(projetoId, dados);
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

/* ---- Demanda ---- */
function abrirNovaDemanda(projetoId, existente) {
  var ed = !!existente, d = existente||{};
  openModal({
    title: ed?"Editar demanda":"Nova demanda",
    submitLabel: ed?"Salvar":"Criar demanda",
    bodyHtml:
      fTextarea("descricao","Descrição da demanda",{required:true,value:d.descricao||"",
        placeholder:"Descreva detalhadamente o que é necessário…"})+
      '<div class="field-2col">'+
        fText("responsavel","Quem está pedindo",{required:true,value:d.responsavel||"",placeholder:"Nome / empresa"})+
        fSelect("status","Status",STATUS_DEMANDA,{value:d.status||"Pendente"})+
      '</div>'+
      (!ed ? '<div class="field-hint" style="color:var(--accent)">Após salvar, você poderá enviar um e-mail de notificação.</div>' : ""),
    onSubmit: async function(form) {
      var descricao = readVal(form,"descricao");
      var responsavel = readVal(form,"responsavel");
      if (!descricao) throw new Error("Descreva a demanda.");
      if (!responsavel) throw new Error("Informe quem está pedindo.");
      var dados = { descricao:descricao, responsavel:responsavel, status:readVal(form,"status") };
      if (ed) {
        store.updateDemanda(projetoId, d.id, dados);
      } else {
        store.addDemanda(projetoId, dados);
        /* Abre cliente de e-mail com a demanda pré-preenchida */
        var proj = store.getProjeto(projetoId);
        var projNome = proj ? proj.nome : "";
        var subject = "Nova demanda — " + projNome;
        var body =
          "Nova demanda cadastrada no Giros Catálogo\n\n" +
          "Projeto: " + projNome + "\n" +
          "Solicitante: " + responsavel + "\n\n" +
          "Descrição:\n" + descricao + "\n\n" +
          "Status: " + readVal(form,"status");
        window.location.href = "mailto:" + EMAIL_DEMANDAS +
          "?subject=" + encodeURIComponent(subject) +
          "&body=" + encodeURIComponent(body);
      }
    }
  });
}

/* ============================================================
   VIEW: HOME
   ============================================================ */
var CATS_HOME = ["Todos","Documentário","Filme","Série","Curta","Institucional","Outro"];

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
  episodio: {label:"Episódios",     icon:"📺",ordem:1},
  trailer:  {label:"Trailer",       icon:"▶", ordem:2},
  teaser:   {label:"Teaser",        icon:"✦", ordem:3},
  promo:    {label:"Promo",         icon:"📣",ordem:4},
  vitrine:  {label:"Vitrine Vimeo", icon:"🗂",ordem:5},
  outro:    {label:"Outros",        icon:"🔗",ordem:6}
};
var STATUS_COR = { "Pendente":"amber","Em andamento":"blue","Concluída":"green","Cancelada":"gray" };

function linkRow(l) {
  var temSenha = !!l.senha;
  /* badge de temporada/episódio */
  var badge = "";
  if (l.temporada) badge = '<span class="ep-badge">T'+l.temporada+(l.numero?' E'+l.numero:'')+'</span> ';
  else if (l.numero) badge = '<span class="ep-badge">Ep.'+l.numero+'</span> ';
  return '<div class="link-item">'+
    '<div class="link-titulo">'+badge+esc(l.titulo)+(temSenha?' <span class="lock-icon">🔒</span>':"")+
    '</div>'+
    (temSenha?
      '<div class="link-senha-box">'+
        '<button class="senha-toggle" data-action="senha" data-link-id="'+esc(l.id)+'">Ver senha</button>'+
        '<span class="senha-valor">'+esc(l.senha)+'</span>'+
        '<button class="copy-btn" data-copy="'+esc(l.senha)+'">Copiar</button>'+
      '</div>':"")+
    '<a href="'+esc(l.url)+'" target="_blank" rel="noopener" class="btn btn-sm">Abrir ↗</a>'+
    '<div class="item-actions">'+
      '<button class="icon-btn" data-action="edit" data-link-id="'+esc(l.id)+'" title="Editar">✎</button>'+
      '<button class="icon-btn danger" data-action="del" data-link-id="'+esc(l.id)+'" title="Excluir">🗑</button>'+
    '</div>'+
  '</div>';
}

function renderVideosPorTipo(links) {
  var grupos = {};
  links.forEach(function(l){ if(!grupos[l.tipo]) grupos[l.tipo]=[]; grupos[l.tipo].push(l); });
  return Object.keys(TIPO_META).filter(function(t){ return grupos[t]; }).map(function(tipo){
    var meta = TIPO_META[tipo];
    return '<div class="link-grupo">'+
      '<div class="link-grupo-titulo">'+meta.icon+" "+meta.label+'</div>'+
      grupos[tipo].map(linkRow).join("")+
    '</div>';
  }).join("");
}

function renderVideos(p) {
  if (!p.links.length) return '<div class="empty-tab">Nenhum link cadastrado ainda.</div>';

  /* Série: agrupa por temporada */
  if (p.categoria==="Série") {
    var byTemp = {}, semTemp = [];
    p.links.forEach(function(l){
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
        renderVideosPorTipo(byTemp[tNum])+
      '</div>';
    }).join("");
    if (semTemp.length) html += '<div style="margin-bottom:28px">'+
      '<div class="temp-header">Gerais / Sem temporada</div>'+
      renderVideosPorTipo(semTemp)+'</div>';
    return html;
  }

  /* Outros: agrupa só por tipo */
  return renderVideosPorTipo(p.links);
}

function renderMarcaDagua(p) {
  if (!p.marcaDagua.length) return '<div class="empty-tab">Nenhuma versão com marca d\'água cadastrada.</div>';
  return p.marcaDagua.map(function(md){
    var temSenha = !!md.senha;
    return '<div class="link-item">'+
      '<div class="link-titulo">'+esc(md.titulo)+(temSenha?' <span class="lock-icon">🔒</span>':"")+
        (md.observacoes?' <span class="link-obs">'+esc(md.observacoes)+'</span>':"")+
      '</div>'+
      (temSenha?
        '<div class="link-senha-box">'+
          '<button class="senha-toggle" data-action="senha" data-md-id="'+esc(md.id)+'">Ver senha</button>'+
          '<span class="senha-valor">'+esc(md.senha)+'</span>'+
          '<button class="copy-btn" data-copy="'+esc(md.senha)+'">Copiar</button>'+
        '</div>':"")+
      '<a href="'+esc(md.url)+'" target="_blank" rel="noopener" class="btn btn-sm">Abrir ↗</a>'+
      '<div class="item-actions">'+
        '<button class="icon-btn" data-action="edit" data-md-id="'+esc(md.id)+'" title="Editar">✎</button>'+
        '<button class="icon-btn danger" data-action="del" data-md-id="'+esc(md.id)+'" title="Excluir">🗑</button>'+
      '</div>'+
    '</div>';
  }).join("");
}

function renderDemandas(p) {
  if (!p.demandas.length) return '<div class="empty-tab">Nenhuma demanda registrada.</div>';
  return p.demandas.map(function(d){
    var cor = STATUS_COR[d.status]||"gray";
    return '<div class="demanda-item">'+
      '<div class="demanda-main">'+
        '<div class="demanda-desc">'+esc(d.descricao)+'</div>'+
        (d.responsavel?'<div class="demanda-resp">Pedido por: '+esc(d.responsavel)+'</div>':"")+
      '</div>'+
      '<span class="status-badge badge-'+cor+'">'+esc(d.status)+'</span>'+
      '<div class="item-actions">'+
        '<button class="icon-btn" data-action="edit" data-demanda-id="'+esc(d.id)+'" title="Editar">✎</button>'+
        '<button class="icon-btn danger" data-action="del" data-demanda-id="'+esc(d.id)+'" title="Excluir">🗑</button>'+
      '</div>'+
    '</div>';
  }).join("");
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
          '<button class="btn" id="btn-editar">Editar projeto</button>'+
          '<button class="btn btn-ghost danger-btn" id="btn-excluir">Excluir</button>'+
        '</div>'+
      '</div>'+
      '<div class="proj-detail-main">'+
        '<h1 class="proj-title">'+esc(p.nome)+'</h1>'+
        (p.sinopse?'<p class="proj-sinopse">'+esc(p.sinopse)+'</p>':"")+
        '<div class="tabs">'+
          '<button class="tab-btn active" data-tab="videos">Vídeos <span class="tab-count">'+p.links.length+'</span></button>'+
          '<button class="tab-btn" data-tab="marca">Marca d\'água <span class="tab-count">'+p.marcaDagua.length+'</span></button>'+
          '<button class="tab-btn" data-tab="demandas">Demandas <span class="tab-count">'+p.demandas.length+'</span></button>'+
        '</div>'+
        '<div class="tab-panel active" id="tab-videos">'+
          renderVideos(p)+'<button class="btn btn-ghost tab-add-btn" id="btn-add-link">+ Adicionar link</button>'+
        '</div>'+
        '<div class="tab-panel" id="tab-marca">'+
          renderMarcaDagua(p)+'<button class="btn btn-ghost tab-add-btn" id="btn-add-md">+ Adicionar versão</button>'+
        '</div>'+
        '<div class="tab-panel" id="tab-demandas">'+
          renderDemandas(p)+'<button class="btn btn-ghost tab-add-btn" id="btn-add-demanda">+ Nova demanda</button>'+
        '</div>'+
      '</div>'+
    '</div>';

  /* tabs */
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
    store.removeProjeto(p.id);
    location.hash = "#/";
  });
  document.getElementById("btn-add-link").addEventListener("click", function(){ abrirNovoLink(p.id); });
  document.getElementById("btn-add-md").addEventListener("click", function(){ abrirNovaMarcaDagua(p.id); });
  document.getElementById("btn-add-demanda").addEventListener("click", function(){ abrirNovaDemanda(p.id); });

  /* delegação vídeos */
  document.getElementById("tab-videos").addEventListener("click", function(e){
    var lid = e.target.dataset.linkId, action = e.target.dataset.action, copy = e.target.dataset.copy;
    if (copy !== undefined) { navigator.clipboard.writeText(copy).catch(function(){}); return; }
    if (action==="senha") { var box=e.target.closest(".link-senha-box"); if(box) box.classList.toggle("revealed"); return; }
    if (!lid) return;
    var link = p.links.find(function(l){ return l.id===lid; }); if (!link) return;
    if (action==="edit") { abrirNovoLink(p.id, link); return; }
    if (action==="del") { if (!confirm('Excluir o link "'+link.titulo+'"?')) return; store.removeLink(p.id, lid); }
  });

  /* delegação marca d'água */
  document.getElementById("tab-marca").addEventListener("click", function(e){
    var mid = e.target.dataset.mdId, action = e.target.dataset.action, copy = e.target.dataset.copy;
    if (copy !== undefined) { navigator.clipboard.writeText(copy).catch(function(){}); return; }
    if (action==="senha") { var box=e.target.closest(".link-senha-box"); if(box) box.classList.toggle("revealed"); return; }
    if (!mid) return;
    var md = p.marcaDagua.find(function(x){ return x.id===mid; }); if (!md) return;
    if (action==="edit") { abrirNovaMarcaDagua(p.id, md); return; }
    if (action==="del") { if (!confirm('Excluir "'+md.titulo+'"?')) return; store.removeMarcaDagua(p.id, mid); }
  });

  /* delegação demandas */
  document.getElementById("tab-demandas").addEventListener("click", function(e){
    var did = e.target.dataset.demandaId, action = e.target.dataset.action;
    if (!did) return;
    var d = p.demandas.find(function(x){ return x.id===did; }); if (!d) return;
    if (action==="edit") { abrirNovaDemanda(p.id, d); return; }
    if (action==="del") { if (!confirm("Excluir esta demanda?")) return; store.removeDemanda(p.id, did); }
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
route();

})();
