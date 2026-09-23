// exporters.js
// 负责把编辑器内容导出为：
//  1) 公众号富文本（复制到剪贴板，带 text/html，可直接 Ctrl+V 进公众号编辑器）
//  2) Markdown（复制到剪贴板，用于 Notion / FlowUs 粘贴）
//  3) 独立 HTML 文件（下载）
// 同时提供 HTML -> Markdown 的轻量转换器。

// ---------- 存储抽象（兼容扩展环境 / 普通网页预览） ----------
function storeGet(key) {
  return new Promise((resolve) => {
    try {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(key, (r) => resolve(r && r[key] !== undefined ? r[key] : null));
        return;
      }
    } catch (e) {}
    try {
      const v = localStorage.getItem(key);
      resolve(v === null ? null : JSON.parse(v));
    } catch (e) {
      resolve(null);
    }
  });
}
function storeSet(key, val) {
  return new Promise((resolve) => {
    try {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ [key]: val }, () => resolve(true));
        return;
      }
    } catch (e) {}
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {}
    resolve(true);
  });
}

// ---------- 剪贴板 ----------
async function copyRichHtml(html) {
  const plain = htmlToText(html);
  try {
    if (navigator.clipboard && window.ClipboardItem) {
      const item = new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([plain], { type: "text/plain" })
      });
      await navigator.clipboard.write([item]);
      return { ok: true, mode: "rich" };
    }
  } catch (e) {}
  // 回退：用 contenteditable 承载富文本再 execCommand（file:// 等非安全上下文也能复制出真正的富文本）
  try {
    const div = document.createElement("div");
    div.contentEditable = "true";
    div.style.position = "fixed";
    div.style.left = "-9999px";
    div.style.top = "0";
    div.innerHTML = html;
    document.body.appendChild(div);
    const range = document.createRange();
    range.selectNodeContents(div);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    document.execCommand("copy");
    sel.removeAllRanges();
    document.body.removeChild(div);
    return { ok: true, mode: "fallback" };
  } catch (e) {
    return { ok: false, reason: String(e) };
  }
}

async function copyText(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return { ok: true };
    }
  } catch (e) {}
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: String(e) };
  }
}

// ---------- 下载 HTML 文件 ----------
function downloadHtml(html, filename) {
  const full = `<!doctype html><html><head><meta charset="utf-8"><title>${filename || "公众号文章"}</title></head><body>${html}</body></html>`;
  const blob = new Blob([full], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = (filename || "wechat-article") + ".html";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- 下载 Markdown 文件 ----------
function downloadMd(md, filename) {
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = (filename || "article") + ".md";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- HTML -> 纯文本 ----------
function htmlToText(html) {
  const doc = new DOMParser().parseFromString(html || "", "text/html");
  return (doc.body.textContent || "").replace(/\n{2,}/g, "\n").trim();
}

// ---------- HTML -> Markdown ----------
function htmlToMarkdown(html) {
  const doc = new DOMParser().parseFromString(html || "", "text/html");
  const out = [];
  function walk(node, depth) {
    node.childNodes.forEach((child) => {
      if (child.nodeType === 3) {
        const t = child.textContent;
        if (t && t.trim()) out.push({ t: "text", v: t });
        return;
      }
      if (child.nodeType !== 1) return;
      const tag = child.tagName.toLowerCase();
      const txt = child.textContent.trim();
      switch (tag) {
        case "h1": out.push({ t: "h", v: txt, n: 1 }); break;
        case "h2": out.push({ t: "h", v: txt, n: 2 }); break;
        case "h3": out.push({ t: "h", v: txt, n: 3 }); break;
        case "h4": out.push({ t: "h", v: txt, n: 4 }); break;
        case "p": out.push({ t: "p", v: inline(child) }); break;
        case "blockquote": out.push({ t: "quote", v: inline(child) }); break;
        case "pre": {
          const codeEl = child.querySelector ? child.querySelector("code") : null;
          const lm = ((codeEl && codeEl.getAttribute("class")) || "").match(/language-([\w-]+)/);
          out.push({ t: "code", v: child.textContent.replace(/\n$/, ""), lang: lm ? lm[1] : "" });
          break;
        }
        case "ul": out.push({ t: "list", v: listItems(child), ordered: false }); break;
        case "ol": out.push({ t: "list", v: listItems(child), ordered: true }); break;
        case "hr": out.push({ t: "hr", v: child.classList && child.classList.contains("page-break") ? "+++" : null }); break;
        case "table": out.push({ t: "table", v: tableToMd(child) }); break;
        case "img": out.push({ t: "img", v: child.getAttribute("src"), alt: child.getAttribute("alt") || "" }); break;
        case "br": out.push({ t: "br" }); break;
        default:
          // div / span 等容器：递归
          walk(child, depth);
      }
    });
  }
  function inline(node) {
    let s = "";
    node.childNodes.forEach((c) => {
      if (c.nodeType === 3) s += c.textContent;
      else if (c.nodeType === 1) {
        const tg = c.tagName.toLowerCase();
        if (c.classList && c.classList.contains("task-box")) return; // 复选框由列表层统一处理
        const inner = inline(c);
        if (tg === "strong" || tg === "b") s += `**${inner}**`;
        else if (tg === "em" || tg === "i") s += `*${inner}*`;
        else if (tg === "mark") s += `==${inner}==`;
        else if (tg === "s" || tg === "del" || tg === "strike") s += `~~${inner}~~`;
        else if (tg === "sup") s += `^${inner}^`;
        else if (tg === "sub") s += `~${inner}~`;
        else if (tg === "code") s += "`" + c.textContent + "`";
        else if (tg === "a") s += `[${inner}](${c.getAttribute("href") || ""})`;
        else if (tg === "img") s += `![${c.getAttribute("alt") || ""}](${c.getAttribute("src") || ""})`;
        else if (tg === "br") s += "\n";
        else s += inner;
      }
    });
    return s.replace(/\s+/g, " ").trim();
  }
  function listItems(ul) {
    const items = [];
    ul.childNodes.forEach((li) => {
      if (li.nodeType === 1 && li.tagName.toLowerCase() === "li") {
        const box = li.querySelector ? li.querySelector(".task-box") : null;
        if (box) {
          const checked = li.getAttribute("data-checked") === "true" || /☑|✓|\[x\]/i.test(box.textContent || "");
          items.push({ task: true, checked: checked, v: inline(li) });
        } else {
          items.push({ task: false, v: inline(li) });
        }
      }
    });
    return items;
  }
  function tableToMd(table) {
    const rows = Array.from(table.querySelectorAll("tr"));
    if (!rows.length) return "";
    const data = rows.map((r) =>
      Array.from(r.querySelectorAll("th,td")).map((c) => c.textContent.trim().replace(/\s+/g, " "))
    );
    const header = data[0];
    const body = data.slice(1);
    const cols = header.length;
    const esc = (s) => s.replace(/\|/g, "\\|");
    const lines = [];
    lines.push("| " + header.map(esc).join(" | ") + " |");
    lines.push("| " + Array(cols).fill("---").join(" | ") + " |");
    body.forEach((r) => { lines.push("| " + r.map(esc).join(" | ") + " |"); });
    return lines.join("\n");
  }
  walk(doc.body, 0);
  return render(out);
}

function render(blocks) {
  const lines = [];
  blocks.forEach((b) => {
    switch (b.t) {
      case "h": lines.push("#".repeat(b.n) + " " + b.v); lines.push(""); break;
      case "p": lines.push(b.v); lines.push(""); break;
      case "quote": lines.push("> " + b.v); lines.push(""); break;
      case "code": lines.push("```" + (b.lang || "") + "\n" + b.v + "\n```"); lines.push(""); break;
      case "list":
        b.v.forEach((it, i) => {
          const marker = b.ordered ? (i + 1) + ". " : "- ";
          const task = it && it.task ? "[" + (it.checked ? "x" : " ") + "] " : "";
          const val = it && typeof it === "object" ? it.v : it;
          lines.push(marker + task + val);
        });
        lines.push(""); break;
      case "hr": lines.push(b.v || "---"); lines.push(""); break;
      case "table": lines.push(b.v); lines.push(""); break;
      case "img": lines.push(`![${b.alt}](${b.v})`); lines.push(""); break;
      case "br": lines.push(""); break;
      case "text": break;
    }
  });
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

if (typeof window !== "undefined") {
  window.copyRichHtml = copyRichHtml;
  window.copyText = copyText;
  window.downloadHtml = downloadHtml;
  window.downloadMd = downloadMd;
  window.htmlToMarkdown = htmlToMarkdown;
  window.storeGet = storeGet;
  window.storeSet = storeSet;
}
