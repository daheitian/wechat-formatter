// highlight.js — 轻量、零依赖语法高亮
// 输出「内联 color span」，因此能完美兼容微信的「全内联样式」导出（不会被 applyInlineStyles 覆盖）。
// 配色按模板代码块明暗自动切换：深色代码块用浅亮色，浅色代码块用深暗色。

(function () {
  const LIGHT = {
    comment: "#6a737d", string: "#032f62", number: "#005cc5",
    keyword: "#d73a49", func: "#6f42c1", punct: "#24292e"
  };
  const DARK = {
    comment: "#8b949e", string: "#a5d6ff", number: "#79c0ff",
    keyword: "#ff7b72", func: "#d2a8ff", punct: "#c9d1d9"
  };

  const KEYWORDS = new Set((
    "const let var function return if else for while do switch case break continue new class extends super this typeof instanceof in of await async yield try catch finally throw import export from default null true false undefined void delete " +
    "def lambda None True False and or not is pass raise global nonlocal with as " +
    "package type struct map chan go defer select interface range " +
    "public private protected static final int double float boolean string void " +
    "select from where and or not null insert update delete create table join on group by order limit " +
    "func fn end then else if elsif unless begin"
  ).split(/\s+/).filter(Boolean));

  function tokenize(code) {
    const out = [];
    let i = 0;
    const n = code.length;
    const push = (t, v) => out.push({ t, v });
    while (i < n) {
      const c = code[i];
      // 行注释 // 与 #
      if (c === "/" && code[i + 1] === "/") { let j = i + 2; while (j < n && code[j] !== "\n") j++; push("comment", code.slice(i, j)); i = j; continue; }
      if (c === "#") { let j = i + 1; while (j < n && code[j] !== "\n") j++; push("comment", code.slice(i, j)); i = j; continue; }
      // 块注释 /* */
      if (c === "/" && code[i + 1] === "*") { let j = i + 2; while (j < n && !(code[j] === "*" && code[j + 1] === "/")) j++; j = Math.min(n, j + 2); push("comment", code.slice(i, j)); i = j; continue; }
      // 字符串
      if (c === '"' || c === "'" || c === "`") {
        const q = c; let j = i + 1;
        while (j < n) { if (code[j] === "\\") { j += 2; continue; } if (code[j] === q) { j++; break; } j++; }
        push("string", code.slice(i, j)); i = j; continue;
      }
      // 数字
      if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(code[i + 1] || ""))) {
        let j = i; while (j < n && /[0-9a-fA-FxXob._]/.test(code[j])) j++;
        push("number", code.slice(i, j)); i = j; continue;
      }
      // 标识符 / 关键字 / 函数调用
      if (/[A-Za-z_$]/.test(c)) {
        let j = i + 1; while (j < n && /[A-Za-z0-9_$]/.test(code[j])) j++;
        const word = code.slice(i, j);
        let k = j; while (k < n && code[k] === " ") k++;
        if (KEYWORDS.has(word)) push("keyword", word);
        else if (code[k] === "(") push("func", word);
        else push("ident", word);
        i = j; continue;
      }
      // 其它字符（标点 / 空白）
      push("punct", c); i++;
    }
    return out;
  }

  function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function highlight(code, dark) {
    if (code == null) return "";
    const pal = dark ? DARK : LIGHT;
    const toks = tokenize(code);
    let html = "";
    for (const tk of toks) {
      const v = esc(tk.v);
      if (tk.t === "punct" || tk.t === "ident") {
        html += v;
      } else {
        const weight = tk.t === "keyword" ? "font-weight:bold;" : "";
        html += `<span style="color:${pal[tk.t]};${weight}">${v}</span>`;
      }
    }
    return html;
  }

  // 容器内所有 pre/code 应用高亮（按当前模板明暗）
  function highlightContainers(root, dark) {
    if (!root) return;
    root.querySelectorAll("pre").forEach((pre) => {
      const codeEl = pre.querySelector("code") || pre;
      codeEl.innerHTML = highlight(codeEl.textContent, dark);
    });
  }

  // 去掉 pre/code 内的高亮 span（还原纯文本），便于按导出模板重新高亮
  function stripHighlight(root) {
    if (!root) return;
    root.querySelectorAll("pre").forEach((pre) => {
      const codeEl = pre.querySelector("code") || pre;
      codeEl.querySelectorAll("span").forEach((sp) => {
        const t = document.createTextNode(sp.textContent);
        sp.parentNode.replaceChild(t, sp);
      });
    });
  }

  if (typeof window !== "undefined") {
    window.Highlighter = { highlight, highlightContainers, stripHighlight, tokenize };
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { highlight, tokenize };
  }
})();
