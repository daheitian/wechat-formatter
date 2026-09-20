// popup.js — UI 逻辑与导出流程编排
(function () {
  let currentTplId = "typora-github";
  let mode = "rich"; // 'rich' | 'md'
  let favFilter = false;
  let pendingGridFiles = null;

  const gallery = document.getElementById("templateGallery");
  const editor = document.getElementById("editor");
  const hint = document.getElementById("hint");
  const imgFile = document.getElementById("imgFile");
  const gridFile = document.getElementById("gridFile");
  const mdFile = document.getElementById("mdFile");
  const gridModal = document.getElementById("gridModal");
  const modeToggle = document.getElementById("modeToggle");
  const richPane = document.getElementById("richPane");
  const mdPane = document.getElementById("mdPane");
  const mdSource = document.getElementById("mdSource");
  const mdPreview = document.getElementById("mdPreview");
  const favFilterBtn = document.getElementById("favFilter");

  function showHint(text, isErr) {
    hint.textContent = text;
    hint.style.color = isErr ? "#e54d42" : "#07c160";
    setTimeout(() => { if (hint.textContent === text) hint.textContent = ""; }, 2600);
  }

  // ---------- 收藏 ----------
  async function getFavs() {
    const v = await window.storeGet("favTemplates");
    return Array.isArray(v) ? v : [];
  }
  async function toggleFav(id) {
    const favs = await getFavs();
    const i = favs.indexOf(id);
    if (i === -1) favs.push(id); else favs.splice(i, 1);
    await window.storeSet("favTemplates", favs);
    renderGallery();
  }

  // ---------- 模板画廊（按系列分组） ----------
  function makeCard(t, isFav) {
    const card = document.createElement("div");
    card.className = "tpl" + (t.id === currentTplId ? " active" : "") + (isFav ? " fav" : "");
    card.dataset.id = t.id;

    const star = document.createElement("div");
    star.className = "star";
    star.textContent = isFav ? "★" : "☆";
    star.title = "收藏 / 取消收藏";
    star.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFav(t.id);
    });
    card.appendChild(star);

    const sw = document.createElement("div");
    sw.className = "swatch";
    sw.style.background = t.base.background;
    sw.style.borderLeft = "4px solid " + (t.accent || "#07c160");
    const name = document.createElement("div");
    name.className = "name";
    name.textContent = t.name;
    card.appendChild(sw);
    card.appendChild(name);

    card.addEventListener("click", () => {
      currentTplId = t.id;
      renderGallery();
      applyPreview();
      saveDraft();
    });
    return card;
  }

  async function renderGallery() {
    const favs = await getFavs();
    gallery.innerHTML = "";
    // 先按筛选条件过滤
    const visible = window.TEMPLATES.filter((t) => !favFilter || favs.indexOf(t.id) !== -1);
    // 按 series 分组，保持 templates.js 中首次出现顺序
    const order = [];
    const groups = {};
    visible.forEach((t) => {
      const s = t.series || "其他";
      if (!groups[s]) { groups[s] = []; order.push(s); }
      groups[s].push(t);
    });
    order.forEach((s) => {
      const g = document.createElement("div");
      g.className = "tpl-group";
      const title = document.createElement("div");
      title.className = "tpl-group-title";
      title.textContent = s;
      g.appendChild(title);
      const row = document.createElement("div");
      row.className = "tpl-row";
      groups[s].forEach((t) => row.appendChild(makeCard(t, favs.indexOf(t.id) !== -1)));
      g.appendChild(row);
      gallery.appendChild(g);
    });
  }

  function applyPreview() {
    const t = window.getTemplate(currentTplId);
    window.Editor.applyTemplatePreview(t);
    editor.style.background = t.base.background;
    window.__currentDark = window.isDarkCode ? window.isDarkCode(t) : false;
  }

  // ---------- 工具栏（富文本模式） ----------
  const cmdMap = {
    h1: () => window.Editor.formatBlock("h1"),
    h2: () => window.Editor.formatBlock("h2"),
    h3: () => window.Editor.formatBlock("h3"),
    p: () => window.Editor.formatBlock("p"),
    bold: () => window.Editor.bold(),
    italic: () => window.Editor.italic(),
    quote: () => window.Editor.quote(),
    ul: () => window.Editor.unorderedList(),
    ol: () => window.Editor.orderedList(),
    code: () => window.Editor.code(),
    icode: () => window.Editor.inlineCode(),
    hr: () => window.Editor.hr(),
    undo: () => window.Editor.undo(),
    clear: () => window.Editor.clearFormat(),
    img: () => imgFile.click(),
    grid: () => gridFile.click()
  };

  document.getElementById("toolbar").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const cmd = btn.dataset.cmd;
    if (cmdMap[cmd]) { cmdMap[cmd](); window.Editor.focus(); }
  });

  imgFile.addEventListener("change", async (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) await window.Editor.insertImageFile(f);
    imgFile.value = "";
  });

  // 多图网格：选图 → 弹窗选列数 → 插入
  gridFile.addEventListener("change", (e) => {
    const files = e.target.files && Array.from(e.target.files);
    gridFile.value = "";
    if (!files || !files.length) return;
    pendingGridFiles = files;
    gridModal.style.display = "flex";
  });
  gridModal.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const cols = parseInt(btn.dataset.cols, 10);
    gridModal.style.display = "none";
    if (cols > 0 && pendingGridFiles) {
      await window.Editor.insertImageGrid(pendingGridFiles, cols);
      showHint("已插入 " + pendingGridFiles.length + " 张图片的 " + cols + " 列网格 ✓");
    }
    pendingGridFiles = null;
  });

  // ---------- Markdown 模式 ----------
  let previewTimer = null;
  function renderPreview() {
    mdPreview.innerHTML = window.markdownToHtml(mdSource.value);
    if (window.Highlighter) window.Highlighter.highlightContainers(mdPreview, window.__currentDark);
    if (window.ImagePipeline) window.ImagePipeline.hydrateImages(mdPreview);
  }
  mdSource.addEventListener("input", () => {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => { renderPreview(); saveDraft(); }, 200);
  });
  // 智能粘贴（MD 模式）：把剪贴板 HTML 转成 Markdown 续接
  mdSource.addEventListener("paste", (e) => {
    const cd = e.clipboardData || window.clipboardData;
    const html = cd.getData("text/html");
    if (html && html.trim()) {
      e.preventDefault();
      const md = window.htmlToMarkdown(html);
      const start = mdSource.selectionStart, end = mdSource.selectionEnd;
      mdSource.value = mdSource.value.slice(0, start) + md + mdSource.value.slice(end);
      saveDraft();
    }
  });

  function switchMode(toMd) {
    if (toMd && mode === "rich") {
      mdSource.value = window.htmlToMarkdown(window.Editor.getHTML());
      renderPreview();
      mode = "md";
      richPane.style.display = "none";
      mdPane.style.display = "block";
      modeToggle.textContent = "✎ 富文本";
      modeToggle.classList.add("active");
    } else if (!toMd && mode === "md") {
      editor.innerHTML = window.markdownToHtml(mdSource.value);
      if (window.ImagePipeline) window.ImagePipeline.hydrateImages(editor);
      mode = "rich";
      mdPane.style.display = "none";
      richPane.style.display = "block";
      modeToggle.textContent = "⊞ MD";
      modeToggle.classList.remove("active");
      window.Editor.focus();
    }
    saveDraft();
  }
  modeToggle.addEventListener("click", () => switchMode(mode === "rich"));

  // ---------- 导出 ----------
  // 把语义 HTML 规整：移除旧高亮 span → 按导出模板重新高亮 → 图片解析成 base64
  async function buildSemantic() {
    const t = window.getTemplate(currentTplId);
    let semantic = mode === "md" ? window.markdownToHtml(mdSource.value) : window.Editor.getHTML();
    if (window.ImagePipeline) semantic = window.ImagePipeline.normalizeImgSrc(semantic);
    if (window.Highlighter) {
      const doc = new DOMParser().parseFromString("<div>" + semantic + "</div>", "text/html");
      window.Highlighter.stripHighlight(doc);
      window.Highlighter.highlightContainers(doc, window.isDarkCode(t));
      semantic = doc.body.firstChild ? doc.body.firstChild.innerHTML : semantic;
    }
    if (window.ImagePipeline) semantic = await window.ImagePipeline.resolveExportImages(semantic);
    return { t, semantic };
  }

  async function buildExport() {
    const { t, semantic } = await buildSemantic();
    const inlineHtml = window.applyInlineStyles(t, semantic);
    await window.storeSet("lastExport", inlineHtml);
    return inlineHtml;
  }

  document.getElementById("expWechat").addEventListener("click", async () => {
    const html = await buildExport();
    const r = await window.copyRichHtml(html);
    showHint(r.ok ? "已复制富文本，去公众号 Ctrl+V 粘贴 ✓" : "复制失败：" + (r.reason || ""), !r.ok);
  });

  document.getElementById("expWechatTab").addEventListener("click", async () => {
    await buildExport();
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.sendMessage({ type: "IMPORT_TO_WECHAT" }, (res) => {
        if (chrome.runtime.lastError || !res || !res.ok) {
          showHint("未检测到公众号编辑页，请先在浏览器打开 mp.weixin.qq.com 编辑页", true);
        } else {
          showHint("已发送到公众号编辑页，点击页面右侧绿色按钮即可导入 ✓");
        }
      });
    } else {
      showHint("当前为网页预览模式，请使用「复制富文本」后手动粘贴", true);
    }
  });

  // 复制 Markdown（图片内联成 base64，便于直接粘贴进 Notion / FlowUs）
  document.getElementById("expMd").addEventListener("click", async () => {
    const md = await buildMarkdown();
    const r = await window.copyText(md);
    showHint(r.ok ? "已复制 Markdown，可粘贴到 Notion / FlowUs ✓" : "复制失败", !r.ok);
  });

  // 下载 .md
  document.getElementById("expMdFile").addEventListener("click", async () => {
    const md = await buildMarkdown();
    window.downloadMd(md, "公众号文章_" + Date.now());
    showHint("已下载 .md 文件 ✓");
  });

  // 导入 .md
  mdFile.addEventListener("change", async (e) => {
    const f = e.target.files && e.target.files[0];
    mdFile.value = "";
    if (!f) return;
    const text = await f.text();
    mdSource.value = text;
    const sem = window.markdownToHtml(text);
    editor.innerHTML = sem;
    if (window.ImagePipeline) { await window.ImagePipeline.hydrateImages(editor); }
    if (mode !== "md") switchMode(true); else renderPreview();
    if (window.ImagePipeline) { await window.ImagePipeline.hydrateImages(mdPreview); }
    await saveDraft();
    showHint("已导入 .md ✓");
  });

  // 生成 Markdown（含图片 base64，自包含）
  async function buildMarkdown() {
    if (mode === "md") {
      const sem = await window.ImagePipeline.resolveExportImages(window.markdownToHtml(mdSource.value));
      return window.htmlToMarkdown(sem);
    }
    const html = window.ImagePipeline.normalizeImgSrc(window.Editor.getHTML());
    const sem = await window.ImagePipeline.resolveExportImages(html);
    return window.htmlToMarkdown(sem);
  }

  document.getElementById("expHtml").addEventListener("click", async () => {
    const html = await buildExport();
    window.downloadHtml(html, "公众号文章_" + Date.now());
    showHint("已下载 HTML 文件 ✓");
  });

  // ---------- 草稿 ----------
  async function saveDraft() {
    await window.storeSet("draft", {
      mode: mode,
      html: window.ImagePipeline ? window.ImagePipeline.normalizeImgSrc(window.Editor.getHTML()) : window.Editor.getHTML(),
      md: mdSource.value,
      tpl: currentTplId,
      ts: Date.now()
    });
  }
  window.__onEdit = saveDraft;

  document.getElementById("saveDraft").addEventListener("click", async () => {
    await saveDraft();
    showHint("草稿已保存 ✓");
  });

  async function loadDraft() {
    const d = await window.storeGet("draft");
    if (d && (d.html || d.md)) {
      if (d.tpl) currentTplId = d.tpl;
      editor.innerHTML = d.html || "";
      mdSource.value = d.md || "";
      if (window.ImagePipeline) await window.ImagePipeline.hydrateImages(editor);
      if (d.mode === "md") {
        mode = "md";
        richPane.style.display = "none";
        mdPane.style.display = "block";
        modeToggle.textContent = "✎ 富文本";
        modeToggle.classList.add("active");
        renderPreview();
      }
    } else {
      editor.innerHTML =
        "<h1>这里是标题</h1>" +
        "<p>这是一段正文示例。公众号排版助手帮你把内容套上优雅的模板，一键复制到编辑器。</p>" +
        "<h2>小标题</h2>" +
        "<p>支持<strong>加粗</strong>、<em>斜体</em>、引用、列表与代码块。</p>" +
        "<blockquote>引用一句金句，让排版更有呼吸感。</blockquote>" +
        "<pre><code>const a = 1;\nconsole.log(a);</code></pre>" +
        "<ul><li>第一点</li><li>第二点</li></ul>";
      mdSource.value =
        "# 这里是标题\n\n这是一段正文示例。支持 **加粗**、*斜体*、引用与列表。\n\n## 小标题\n\n> 引用一句金句\n\n```\nconst a = 1;\nconsole.log(a);\n```\n\n- 第一点\n- 第二点";
    }
  }

  // ---------- 初始化 ----------
  window.Editor.init("#editor");
  renderGallery();
  applyPreview();
  loadDraft().then(() => {
    applyPreview();
    if (window.Highlighter) window.Highlighter.highlightContainers(editor, window.__currentDark);
    renderPreview();
  });
})();
