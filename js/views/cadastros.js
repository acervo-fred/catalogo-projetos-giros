import { store } from "../data/store.js";
import { esc } from "../ui/dom.js";
import { openModal, fText, fTextarea, fSelect, readVal } from "../ui/modal.js";

const CATEGORIAS = ["Documentário", "Filme", "Série", "Curta", "Institucional", "Outro"];
const TIPOS_LINK = [
  { value: "master",   label: "Master" },
  { value: "episodio", label: "Episódio" },
  { value: "trailer",  label: "Trailer" },
  { value: "teaser",   label: "Teaser" },
  { value: "promo",    label: "Promo" },
  { value: "vitrine",  label: "Vitrine Vimeo" },
  { value: "outro",    label: "Outro" },
];
const STATUS_DEMANDA = ["Pendente", "Em andamento", "Concluída", "Cancelada"];

async function compressImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 420;
        const ratio = Math.min(MAX / img.width, (MAX * 1.5) / img.height, 1);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function fetchVimeoTitle(url) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(
      `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`,
      { signal: ctrl.signal }
    );
    clearTimeout(t);
    if (!res.ok) return null;
    const data = await res.json();
    return data.title || null;
  } catch (_) { return null; }
}

/* ---- Projeto (criar / editar) ---- */
export function abrirNovoProjeto(existente = null) {
  const ed = !!existente;
  const p = existente || {};
  let posterBase64 = p.poster || "";

  openModal({
    title: ed ? "Editar projeto" : "Novo projeto",
    submitLabel: ed ? "Salvar alterações" : "Criar projeto",
    bodyHtml: `
      ${fText("nome", "Nome do projeto", { required: true, value: p.nome || "", placeholder: "Ex.: Imortais" })}
      <div class="field-2col">
        ${fText("ano", "Ano", { type: "number", value: p.ano ?? new Date().getFullYear() })}
        ${fSelect("categoria", "Categoria", CATEGORIAS, { value: p.categoria || CATEGORIAS[0] })}
      </div>
      <div class="field">
        <label>Capa / Poster <span style="font-weight:400;color:var(--text-faint)">(opcional)</span></label>
        <div class="poster-upload-area" id="poster-area">
          ${posterBase64
            ? `<img src="${posterBase64}" class="poster-preview" id="poster-preview" alt="Poster">`
            : `<div class="poster-placeholder" id="poster-preview"><span>Sem imagem</span></div>`}
          <label class="btn btn-ghost" style="cursor:pointer;margin-top:10px">
            ${posterBase64 ? "Trocar imagem" : "Escolher imagem"}
            <input type="file" accept="image/*" id="poster-input" style="display:none">
          </label>
          ${posterBase64 ? `<button type="button" class="btn btn-ghost" id="poster-remove" style="color:var(--c-rose-fg)">Remover</button>` : ""}
        </div>
        <div class="field-hint">Formato retrato recomendado (ex.: 400×600 px). Pode deixar sem imagem.</div>
      </div>
      ${fTextarea("sinopse", "Sinopse", { value: p.sinopse || "", placeholder: "Breve descrição (opcional)…" })}
    `,
    onMount: (form) => {
      const input = form.querySelector("#poster-input");
      const preview = () => form.querySelector("#poster-preview");
      const removeBtn = form.querySelector("#poster-remove");

      function setPoster(b64) {
        posterBase64 = b64;
        const prev = preview();
        if (b64) {
          prev.outerHTML = `<img src="${b64}" class="poster-preview" id="poster-preview" alt="Poster">`;
        } else {
          prev.outerHTML = `<div class="poster-placeholder" id="poster-preview"><span>Sem imagem</span></div>`;
        }
      }

      input.addEventListener("change", async () => {
        if (input.files[0]) setPoster(await compressImage(input.files[0]));
      });
      removeBtn?.addEventListener("click", () => setPoster(""));
      form._getPoster = () => posterBase64;
    },
    onSubmit: async (form) => {
      const nome = readVal(form, "nome");
      if (!nome) throw new Error("Informe o nome do projeto.");
      const campos = {
        nome,
        ano: Number(readVal(form, "ano")) || new Date().getFullYear(),
        categoria: readVal(form, "categoria"),
        poster: form._getPoster?.() ?? posterBase64,
        sinopse: readVal(form, "sinopse"),
      };
      if (ed) store.updateProjeto(p.id, campos);
      else store.addProjeto(campos);
    },
  });
}

/* ---- Link Vimeo (criar / editar) ---- */
export function abrirNovoLink(projetoId, existente = null) {
  const ed = !!existente;
  const l = existente || {};
  openModal({
    title: ed ? "Editar link" : "Adicionar link Vimeo",
    submitLabel: ed ? "Salvar" : "Adicionar",
    bodyHtml: `
      ${fText("url", "URL do Vimeo", { required: true, value: l.url || "", placeholder: "https://vimeo.com/123456789" })}
      ${fText("titulo", "Texto do link", { required: true, value: l.titulo || "", placeholder: "Ex.: Master Projeto X — Marca d'água Canal Brasil" })}
      <div class="field-hint" id="vimeo-hint" style="display:none">Buscando título no Vimeo…</div>
      <div class="field-2col">
        ${fSelect("tipo", "Tipo", TIPOS_LINK, { value: l.tipo || "master" })}
        ${fText("numero", "Nº episódio", { type: "number", value: l.numero || "", placeholder: "1 (só para episódios)" })}
      </div>
      ${fText("senha", "Senha Vimeo", { value: l.senha || "", placeholder: "Deixe em branco se público" })}
    `,
    onMount: (form) => {
      if (ed) return;
      const urlInput = form.querySelector("#f_url");
      const tituloInput = form.querySelector("#f_titulo");
      const hint = form.querySelector("#vimeo-hint");

      urlInput.addEventListener("blur", async () => {
        const url = urlInput.value.trim();
        if (!url || tituloInput.value.trim()) return;
        hint.textContent = "Buscando título no Vimeo…";
        hint.style.display = "block";
        const title = await fetchVimeoTitle(url);
        hint.style.display = "none";
        if (title && !tituloInput.value.trim()) {
          tituloInput.value = title;
        }
      });
    },
    onSubmit: async (form) => {
      const titulo = readVal(form, "titulo");
      const url = readVal(form, "url");
      if (!url) throw new Error("Informe a URL do Vimeo.");
      if (!titulo) throw new Error("Informe o texto do link.");
      const dados = {
        tipo: readVal(form, "tipo"),
        titulo,
        url,
        senha: readVal(form, "senha"),
        numero: Number(readVal(form, "numero")) || null,
      };
      if (ed) store.updateLink(projetoId, l.id, dados);
      else store.addLink(projetoId, dados);
    },
  });
}

/* ---- Marca d'água (criar / editar) ---- */
export function abrirNovaMarcaDagua(projetoId, existente = null) {
  const ed = !!existente;
  const md = existente || {};
  openModal({
    title: ed ? "Editar versão com marca d'água" : "Adicionar versão com marca d'água",
    submitLabel: ed ? "Salvar" : "Adicionar",
    bodyHtml: `
      ${fText("titulo", "Descrição", { required: true, value: md.titulo || "", placeholder: "Ex.: Com marca d'água Canal Brasil" })}
      ${fText("url", "URL do Vimeo", { required: true, value: md.url || "", placeholder: "https://vimeo.com/…" })}
      ${fText("senha", "Senha (se protegido)", { value: md.senha || "" })}
      ${fTextarea("observacoes", "Observações", { value: md.observacoes || "", placeholder: "Exibidor, finalidade, data de envio…" })}
    `,
    onSubmit: async (form) => {
      const titulo = readVal(form, "titulo");
      const url = readVal(form, "url");
      if (!titulo) throw new Error("Informe uma descrição.");
      if (!url) throw new Error("Informe a URL.");
      const dados = { titulo, url, senha: readVal(form, "senha"), observacoes: readVal(form, "observacoes") };
      if (ed) store.updateMarcaDagua(projetoId, md.id, dados);
      else store.addMarcaDagua(projetoId, dados);
    },
  });
}

/* ---- Demanda (criar / editar) ---- */
export function abrirNovaDemanda(projetoId, existente = null) {
  const ed = !!existente;
  const d = existente || {};
  openModal({
    title: ed ? "Editar demanda" : "Nova demanda",
    submitLabel: ed ? "Salvar" : "Criar",
    bodyHtml: `
      ${fTextarea("descricao", "Descrição", { required: true, value: d.descricao || "", placeholder: "Ex.: Versão com marca d'água para Canal Brasil" })}
      <div class="field-2col">
        ${fText("responsavel", "Responsável", { value: d.responsavel || "", placeholder: "Nome ou setor" })}
        ${fSelect("status", "Status", STATUS_DEMANDA, { value: d.status || "Pendente" })}
      </div>
    `,
    onSubmit: async (form) => {
      const descricao = readVal(form, "descricao");
      if (!descricao) throw new Error("Descreva a demanda.");
      const dados = { descricao, responsavel: readVal(form, "responsavel"), status: readVal(form, "status") };
      if (ed) store.updateDemanda(projetoId, d.id, dados);
      else store.addDemanda(projetoId, dados);
    },
  });
}
