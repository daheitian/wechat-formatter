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

// ---------- 纯文本 → 语义结构（无 HTML 时的自动排版）----------
// 只识别明确语法标记，避免把普通短句误判成标题；无标记的纯散文退回普通段落。
function autoStructure(text) {
  const lines = (text || "").replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let para = [];   // 累积普通段落行
  let quote = [];  // 累积引用行
  let ul = [];     // 无序列表
  let ol = [];     // 有序列表
  let code = null; // 代码块累积（null 表示不在代码块）

  function flushPara() {
    if (para.length) { out.push("<p>" + para.map(escHtml).join("<br/>") + "</p>"); para = []; }
  }
  function flushQuote() {
    if (quote.length) { out.push("<blockquote>" + quote.map(escHtml).join("<br/>") + "</blockquote>"); quote = []; }
  }
  function flushList() {
    if (ul.length) { out.push("<ul>" + ul.map((i) => "<li>" + escHtml(i) + "</li>").join("") + "</ul>"); ul = []; }
    if (ol.length) { out.push("<ol>" + ol.map((i) => "<li>" + escHtml(i) + "</li>").join("") + "</ol>"); ol = []; }
  }

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    const fence = line.match(/^```(.*)$/);
    if (fence) {
      if (code === null) { flushPara(); flushQuote(); flushList(); code = []; }
      else { out.push("<pre><code>" + escHtml(code.join("\n")) + "</code></pre>"); code = null; }
      continue;
    }
    if (code !== null) { code.push(raw); continue; }
    if (!line.trim()) { flushPara(); flushQuote(); flushList(); continue; }

    let m;
    if ((m = line.match(/^(#{1,6})\s+(.*)$/))) {
      flushPara(); flushQuote(); flushList();
      const lvl = Math.min(m[1].length, 4);
      out.push("<h" + lvl + ">" + escHtml(m[2].trim()) + "</h" + lvl + ">");
      continue;
    }
    if ((m = line.match(/^[>》]\s?(.*)$/))) {
      flushPara(); flushList(); quote.push(m[1].trim()); continue;
    }
    if ((m = line.match(/^[-*+]\s+(.*)$/))) {
      flushPara(); flushQuote(); ul.push(m[1].trim()); continue;
    }
    if ((m = line.match(/^\d+\.\s+(.*)$/))) {
      flushPara(); flushQuote(); ol.push(m[1].trim()); continue;
    }
    flushQuote(); flushList();
    para.push(line.trim());
  }
  if (code !== null) out.push("<pre><code>" + escHtml(code.join("\n")) + "</code></pre>");
  flushPara(); flushQuote(); flushList();
  return out.join("");
}

// ---------- 启发式排版：无标记中文散文 → 语义 HTML（自动识别标题/引用/列表/段落）----------
// 仅在纯文本且没有显式 Markdown 标记时启用；有标记走保守的 autoStructure。
function hasExplicitMarkup(text) {
  const lines = (text || "").replace(/\r\n/g, "\n").split("\n");
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (/^#{1,6}\s/.test(line)) return true;        // # 标题
    if (/^[>》]\s/.test(line)) return true;          // > 引用
    if (/^[-*+]\s+/.test(line)) return true;         // - 列表
    if (/^\d+\.\s+/.test(line)) return true;         // 1. 列表
    if (/^```/.test(line)) return true;              // 代码围栏
  }
  return false;
}

// ---------- 无换行长文（"一整坨"）→ 按句子切块分段 ----------
// 播客逐字稿 / 聊天记录粘贴时换行常丢失，整篇糊成一段；按中英文句末标点切块成可读段落。
function smartParagraphText(text) {
  const t = (text || "").replace(/\r\n/g, "\n").trim();
  const newlineCount = (t.match(/\n/g) || []).length;
  if (newlineCount >= 2 || t.length < 300) return t; // 已有换行结构或太短，不动
  const sentences = t.match(/[^。！？!?…]*[。！？!?…]+["”』」）)]*|[^。！？!?…]+$/g) || [t];
  const paras = [];
  let buf = "";
  for (const s of sentences) {
    if (buf && (buf + s).length > 110) { paras.push(buf); buf = s; }
    else buf += s;
  }
  if (buf.trim()) paras.push(buf);
  return paras.join("\n\n");
}

function smartStructure(text) {
  const lines = smartParagraphText(text).split("\n");
  const out = [];
  let para = [];          // 普通正文行累积
  let quote = [];         // 引用累积
  let ul = [];            // 无序列表
  let ol = [];            // 有序列表
  let code = null;        // 代码块累积
  let headingCount = 0;   // 第 1 个标题用 h1，其余 h2

  const n = lines.length;
  const emptyCount = lines.filter((l) => !l.trim()).length;
  // 若全文几乎无空行（<5%），则逐行分段，避免一整坨合成一段
  const linePerPara = emptyCount / n < 0.05 && n > 5;

  function flushPara() { if (para.length) { out.push("<p>" + para.map(escHtml).join("<br/>") + "</p>"); para = []; } }
  function flushQuote() { if (quote.length) { out.push("<blockquote>" + quote.map(escHtml).join("<br/>") + "</blockquote>"); quote = []; } }
  function flushList() {
    if (ul.length) { out.push("<ul>" + ul.map((i) => "<li>" + escHtml(i) + "</li>").join("") + "</ul>"); ul = []; }
    if (ol.length) { out.push("<ol>" + ol.map((i) => "<li>" + escHtml(i) + "</li>").join("") + "</ol>"); ol = []; }
  }
  function headingStrong(t) {
    return /^(第[一二三四五六七八九十百千0-9]+[章回节部分篇卷集]|序章|前言|引言|导语|结语|后记|附录|目录|摘要|概要|序|跋|导读|编者按)/.test(t)
      || /^[一二三四五六七八九十百千]+[、.．]/.test(t)   // 一、二、
      || /^（[一二三四五六七八九十]+）/.test(t)          // （一）
      || /^[A-Za-z][.、]/.test(t);                       // A. B、
  }
  function isListLine(t) {
    let m;
    if ((m = t.match(/^([0-9]+)[.、．）)]\s+/))) return { ol: true, rest: t.slice(m[0].length) };
    if ((m = t.match(/^[（(][0-9]+[)）]\s+/))) return { ol: true, rest: t.slice(m[0].length) };
    if ((m = t.match(/^([•·●○◆▪▫⚫\-*+])\s+/))) return { ol: false, rest: t.slice(m[0].length) };
    return null;
  }
  function isQuoteLine(t) {
    return /^["“”「『][\s\S]*["”」』]$/.test(t) && t.length > 2;
  }

  for (let i = 0; i < n; i++) {
    const raw = lines[i];
    const t = raw.trim();
    if (code !== null) {
      if (/^```/.test(t)) { out.push("<pre><code>" + escHtml(code.join("\n")) + "</code></pre>"); code = null; }
      else code.push(raw);
      continue;
    }
    if (/^```/.test(t)) { flushPara(); flushQuote(); flushList(); code = []; continue; }
    if (!t) { flushPara(); flushQuote(); flushList(); continue; }

    const lm = isListLine(t);
    if (lm) { flushPara(); flushQuote(); (lm.ol ? ol : ul).push(lm.rest); continue; }
    if (isQuoteLine(t)) { flushPara(); flushList(); quote.push(t.slice(1, -1).trim()); continue; }

    // 标题候选：短行（2–30 字）、不以句末标点结尾
    const len = t.length;
    if (len >= 2 && len <= 30 && !"。，；：…".includes(t[len - 1])) {
      const prevEmpty = i === 0 || !lines[i - 1].trim();
      const nextRaw = i + 1 < n ? lines[i + 1] : "";
      const nextEmpty = !nextRaw.trim();
      const nextLong = nextRaw.trim().length > len * 1.6 && nextRaw.trim().length >= 18;
      if (headingStrong(t) || (prevEmpty && (nextEmpty || nextLong))) {
        flushPara(); flushQuote(); flushList();
        // 中文序号小节标题（一、二、 / （一））恒为 h2；其余首个标题为 h1
        const isCnOrdinal = /^[一二三四五六七八九十百千]+[、.．]/.test(t) || /^（[一二三四五六七八九十]+）/.test(t);
        const tag = isCnOrdinal ? "h2" : (headingCount === 0 ? "h1" : "h2");
        headingCount++;
        out.push("<" + tag + ">" + escHtml(t) + "</" + tag + ">");
        continue;
      }
    }

    flushQuote(); flushList();
    if (linePerPara) out.push("<p>" + escHtml(t) + "</p>");
    else para.push(t);
  }
  if (code !== null) out.push("<pre><code>" + escHtml(code.join("\n")) + "</code></pre>");
  flushPara(); flushQuote(); flushList();
  return out.join("");
}

// ---------- 判断净化后的 HTML 是否"毫无结构"（无标题/列表/引用/代码/表格/图片）----------
// 无结构长文（如逐字稿粘贴）应自动走智能排版而不是糊成一坨段落。
function isStructurelessHtml(html) {
  try {
    const doc = new DOMParser().parseFromString("<div>" + html + "</div>", "text/html");
    const root = doc.body.firstChild;
    if (!root) return { structureless: false, text: "" };
    const hasStructure = root.querySelector("h1,h2,h3,h4,h5,h6,ul,ol,blockquote,pre,table,img,hr");
    root.querySelectorAll("br").forEach((b) => b.parentNode.replaceChild(doc.createTextNode("\n"), b));
    return { structureless: !hasStructure, text: root.textContent || "" };
  } catch (e) {
    return { structureless: false, text: "" };
  }
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
        let clean = sanitizeHtml(html);
        // 无结构长文（无任何标题/列表/引用/代码/表格/图片）→ 自动智能排版
        const chk = isStructurelessHtml(clean);
        if (chk.structureless && chk.text.replace(/\s/g, "").length > 150) {
          clean = smartStructure(chk.text);
        }
        exec("insertHTML", clean);
        if (window.Highlighter) window.Highlighter.highlightContainers(this.el, window.__currentDark);
        if (window.ImagePipeline) window.ImagePipeline.hydrateImages(this.el);
      } else if (text && text.trim()) {
        let structured;
        if (window.hasExplicitMarkup && window.hasExplicitMarkup(text)) {
          structured = window.autoStructure(text);
        } else {
          structured = window.smartStructure
            ? window.smartStructure(text)
            : text.trim().split(/\n{2,}/).map((p) => "<p>" + escHtml(p).replace(/\n/g, "<br/>") + "</p>").join("");
        }
        exec("insertHTML", structured);
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
  window.autoStructure = autoStructure;
  window.smartStructure = smartStructure;
  window.hasExplicitMarkup = hasExplicitMarkup;
  window.smartParagraphText = smartParagraphText;
  window.isStructurelessHtml = isStructurelessHtml;
}
