import { esc } from "./dom.js";

const root = () => document.getElementById("modal-root");

export function openModal({ title, subtitle = "", bodyHtml = "", submitLabel = "Salvar", onSubmit, onMount, onAfterClose, wide = false }) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal${wide ? " modal-wide" : ""}" role="dialog" aria-modal="true">
      <div class="modal-head">
        <div>
          <h2>${esc(title)}</h2>
          ${subtitle ? `<div class="modal-sub">${esc(subtitle)}</div>` : ""}
        </div>
        <button class="modal-close" type="button" aria-label="Fechar">×</button>
      </div>
      <form novalidate>
        <div class="modal-body">
          <div class="form-error" style="display:none"></div>
          ${bodyHtml}
        </div>
        <div class="modal-foot">
          <button type="button" class="btn btn-ghost" data-close>Cancelar</button>
          <button type="submit" class="btn btn-primary">${esc(submitLabel)}</button>
        </div>
      </form>
    </div>`;

  root().appendChild(overlay);
  const form = overlay.querySelector("form");
  const errBox = overlay.querySelector(".form-error");

  function close() {
    overlay.remove();
    document.removeEventListener("keydown", onKey);
  }
  function onKey(e) { if (e.key === "Escape") close(); }
  document.addEventListener("keydown", onKey);
  overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) close(); });
  overlay.querySelector(".modal-close").addEventListener("click", close);
  overlay.querySelector("[data-close]").addEventListener("click", close);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errBox.style.display = "none";
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      await onSubmit?.(form);
      close();
      onAfterClose?.();
    } catch (err) {
      errBox.textContent = err.message || "Erro ao salvar.";
      errBox.style.display = "block";
      btn.disabled = false;
    }
  });

  onMount?.(form);
  form.querySelector("input, select, textarea")?.focus();
  return { close };
}

export function fText(name, label, { value = "", type = "text", placeholder = "", required = false, hint = "" } = {}) {
  return `<div class="field">
    <label for="f_${name}">${esc(label)}${required ? " *" : ""}</label>
    <input type="${type}" id="f_${name}" name="${name}" value="${esc(value)}" placeholder="${esc(placeholder)}">
    ${hint ? `<div class="field-hint">${esc(hint)}</div>` : ""}
  </div>`;
}

export function fTextarea(name, label, { value = "", placeholder = "", hint = "" } = {}) {
  return `<div class="field">
    <label for="f_${name}">${esc(label)}</label>
    <textarea id="f_${name}" name="${name}" placeholder="${esc(placeholder)}">${esc(value)}</textarea>
    ${hint ? `<div class="field-hint">${esc(hint)}</div>` : ""}
  </div>`;
}

export function fSelect(name, label, opts, { value = "" } = {}) {
  const options = opts.map((o) => {
    const v = typeof o === "string" ? o : o.value;
    const l = typeof o === "string" ? o : o.label;
    return `<option value="${esc(v)}" ${v === value ? "selected" : ""}>${esc(l)}</option>`;
  }).join("");
  return `<div class="field">
    <label for="f_${name}">${esc(label)}</label>
    <select id="f_${name}" name="${name}">${options}</select>
  </div>`;
}

export function readVal(form, name) {
  const el = form.elements[name];
  return el ? el.value.trim() : "";
}
