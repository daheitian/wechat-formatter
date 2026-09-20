// editor.js
// 基于 contenteditable 的轻量富文本编辑器：工具栏命令 + 图片管线 + 多图网格 + 智能粘贴 + 代码高亮。

function escHtml(s) {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function exec(cmd, value) {
  document.execCommand(cmd, false, value || null);
  if (window.__onEdit) window.__onEdit();
}

// ---------- 智能粘贴：把外部 HTML（Notion / Word / 飞书等）净化成干净语义 HTML ----------
function sanitizeHtml(html) {
  const doc = new DOMParser().parseFromString(html || "", "text/html");
  const blocks = [];
  function walkText(node) {
    let s = "";
    node.childNodes.forEach((c) => {
      if (c.nodeType === 3) { s += escHtml(c.textContent); return; }
      if (c.nodeType !== 1) return;
      const g = c.tagName.toLowerCase();
      const inner = walkText(c);
      if (g === "strong" || g === "b") s += "<strong>" + inner + "</strong>";
      else if (g === "em" || g === "i") s += "<em>" + inner + "</em>";
      else if (g === "code") s += "<code>" + escHtml(c.textContent) + "</code>";
      else if (g === "a") s += '<a href="' + escHtml(c.getAttribute("href") || "") + '">' + inner + "</a>";
      else if (g === "br") s += "<br/>";
      else if (g === "img") s += '<img src="' + escHtml(c.getAttribute("src") || "") + '" alt="' + escHtml(c.getAttribute("alt") || "") + '"/>';
      else if (g === "span" || g === "font") {
        const st = (c.getAttribute("style") || "").toLowerCase();
        if (/font-weight:\s*(bold|[6-9]00)/.test(st)) s += "<strong>" + inner + "</strong>";
        else if (/font-style:\s*italic/.test(st)) s += "<em>" + inner + "</em>";
        else s += inner;
      } else s += inner;
    });
    return s;
  }
  function walk(node) {
    node.childNodes.forEach((child) => {
      if (child.nodeType === 3) {
        const t = child.textContent;
        if (t && t.trim()) blocks.push({ t: "text", v: t });
        return;
      }
      if (child.nodeType !== 1) return;
      const tag = child.tagName.toLowerCase();
      switch (tag) {
        case "h1": case "h2": case "h3": case "h4":
          blocks.push({ t: tag, v: walkText(child) }); break;
        case "p":
          blocks.push({ t: "p", v: walkText(child) }); break;
        case "div": case "section": case "article":
          walk(child); break; // 块级容器：递归，保留内部嵌套块
        case "strong": case "b": blocks.push({ t: "strong", v: walkText(child) }); break;
        case "em": case "i": blocks.push({ t: "em", v: walkText(child) }); break;
        case "a": blocks.push({ t: "a", v: walkText(child), href: child.getAttribute("href") || "" }); break;
        case "img": blocks.push({ t: "img", src: child.getAttribute("src") || "", alt: child.getAttribute("alt") || "" }); break;
        case "br": blocks.push({ t: "br" }); break;
        case "hr": blocks.push({ t: "hr" }); break;
        case "blockquote": blocks.push({ t: "quote", v: walkText(child) }); break;
        case "pre": blocks.push({ t: "pre", v: child.textContent }); break;
        case "code": blocks.push({ t: "code", v: child.textContent }); break;
        case "ul": case "ol": {
          const items = [];
          child.childNodes.forEach((li) => {
            if (li.nodeType === 1 && li.tagName.toLowerCase() === "li") items.push(walkText(li));
          });
          blocks.push({ t: "list", ordered: tag === "ol", v: items }); break;
        }
        default: walk(child); // 其它容器（span/font/section/article/table 等）解包，保留文字
      }
    });
  }
  walk(doc.body);
  return blocks.map((b) => {
    switch (b.t) {
      case "h1": case "h2": case "h3": case "h4": return `<${b.t}>${b.v}</${b.t}>`;
      case "strong": return `<strong>${b.v}</strong>`;
      case "em": return `<em>${b.v}</em>`;
      case "a": return `<a href="${escHtml(b.href)}">${b.v}</a>`;
      case "img": return `<img src="${escHtml(b.src)}" alt="${escHtml(b.alt)}"/>`;
      case "br": return "<br/>";
      case "hr": return "<hr/>";
      case "quote": return `<blockquote>${b.v}</blockquote>`;
      case "pre": return `<pre><code>${escHtml(b.v)}</code></pre>`;
      case "code": return `<code>${escHtml(b.v)}</code>`;
      case "list": return (b.ordered ? "<ol>" : "<ul>") + b.v.map((i) => `<li>${i}</li>`).join("") + (b.ordered ? "</ol>" : "</ul>");
      case "p": return `<p>${b.v || "<br/>"}</p>`;
      case "text": return `<p>${escHtml(b.v)}</p>`;
      default: return "";
    }
  }).join("");
}

const Editor = {
  el: null,

  init(selector) {
    this.el = document.querySelector(selector);
    if (!this.el) return;
    this.el.addEventListener("input", () => {
      if (window.__onEdit) window.__onEdit();
    });
    // 智能粘贴：优先净化 text/html；否则纯文本保留换行
    this.el.addEventListener("paste", (e) => {
      e.preventDefault();
      const cd = e.clipboardData || window.clipboardData;
      const html = cd.getData("text/html");
      const text = cd.getData("text/plain");
      if (html && html.trim()) {
        const clean = sanitizeHtml(html);
        exec("insertHTML", clean);
        if (window.Highlighter) window.Highlighter.highlightContainers(this.el, window.__currentDark);
        if (window.ImagePipeline) window.ImagePipeline.hydrateImages(this.el);
      } else if (text && text.trim()) {
        const para = text.trim().split(/\n{2,}/).map((p) => "<p>" + escHtml(p).replace(/\n/g, "<br/>") + "</p>").join("");
        exec("insertHTML", para);
      }
    });
  },

  focus() { if (this.el) this.el.focus(); },

  formatBlock(tag) { exec("formatBlock", tag); },

  bold() { exec("bold"); },
  italic() { exec("italic"); },

  unorderedList() { exec("insertUnorderedList"); },
  orderedList() { exec("insertOrderedList"); },

  quote() { exec("formatBlock", "blockquote"); },

  // 代码块：把选区文字包成 <pre><code> 并立即按当前模板明暗高亮
  code() {
    const sel = window.getSelection();
    let text = "";
    if (sel && sel.rangeCount && !sel.isCollapsed) text = sel.toString();
    exec("insertHTML", `<pre><code>${escHtml(text || "在此输入代码")}</code></pre>`);
    if (window.Highlighter) window.Highlighter.highlightContainers(this.el, window.__currentDark);
  },

  inlineCode() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    const code = document.createElement("code");
    code.textContent = range.toString();
    range.deleteContents();
    range.insertNode(code);
    if (window.__onEdit) window.__onEdit();
  },

  hr() { exec("insertHTML", "<hr/>"); },

  clearFormat() { exec("removeFormat"); exec("formatBlock", "p"); },

  undo() { exec("undo"); },

  // 图片（单张）：走图片管线（压缩 + IndexedDB），编辑器里显示 objectURL
  async insertImageFile(file) {
    if (!file || !window.ImagePipeline) {
      // 没有管线时退化为原 base64 直插
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => { exec("insertHTML", `<img src="${reader.result}" alt=""/>`); resolve(); };
        reader.readAsDataURL(file);
      });
    }
    const r = await window.ImagePipeline.storeImageFile(file, 1920, 0.85);
    exec("insertHTML", `<img data-imgid="${r.id}" src="img://${r.id}" alt=""/>`);
    const imgEl = this.el.querySelector(`img[data-imgid="${r.id}"]`);
    if (imgEl && r.objectURL) imgEl.setAttribute("src", r.objectURL);
    if (window.__onEdit) window.__onEdit();
  },

  // 多图网格：把多张图片排进一个 <table>（微信对 Grid 支持差，table 最稳）
  async insertImageGrid(files, cols) {
    if (!files || !files.length) return;
    cols = Math.max(1, Math.min(4, cols | 0));
    const cells = [];
    for (const f of files) {
      if (!window.ImagePipeline) {
        // 退化：直接 base64
        const dataUrl = await new Promise((res) => {
          const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(f);
        });
        cells.push({ id: null, objectURL: dataUrl });
      } else {
        const r = await window.ImagePipeline.storeImageFile(f, 1920, 0.85);
        cells.push({ id: r.id, objectURL: r.objectURL });
      }
    }
    let rowsHtml = "";
    for (let i = 0; i < cells.length; i += cols) {
      const row = cells.slice(i, i + cols);
      const tds = row.map((c) => {
        const imgTag = c.id
          ? `<img data-imgid="${c.id}" src="img://${c.id}" style="width:100%;display:block;margin:0;border-radius:6px;"/>`
          : `<img src="${c.objectURL}" style="width:100%;display:block;margin:0;border-radius:6px;"/>`;
        return `<td style="padding:2px;border:none;width:${100 / cols}%;vertical-align:top;">${imgTag}</td>`;
      }).join("");
      rowsHtml += `<tr>${tds}</tr>`;
    }
    const table = `<table style="border-collapse:collapse;width:100%;margin:0 0 18px;" data-grid="1">${rowsHtml}</table>`;
    exec("insertHTML", table);
    // 立即用 objectURL 显示
    this.el.querySelectorAll(`img[data-imgid]`).forEach((img) => {
      const c = cells.find((x) => x.id && x.id === img.getAttribute("data-imgid"));
      if (c && c.objectURL) img.setAttribute("src", c.objectURL);
    });
    if (window.__onEdit) window.__onEdit();
  },

  getHTML() { return this.el ? this.el.innerHTML : ""; },

  setHTML(html) { if (this.el) this.el.innerHTML = html || ""; },

  applyTemplatePreview(t) {
    let styleEl = document.getElementById("tpl-preview-style");
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "tpl-preview-style";
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = window.templatePreviewCss(t);
  }
};

if (typeof window !== "undefined") {
  window.Editor = Editor;
  window.sanitizeHtml = sanitizeHtml;
}
