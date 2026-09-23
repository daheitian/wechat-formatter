// web-app.js — 网页版 UI 逻辑（复用扩展引擎，纯网页运行，无扩展 API 依赖）
(function () {
  let currentTplId = "typora-github";
  let mode = "rich"; // 'rich' | 'md' | 'write'（write 与 rich 共用编辑器，叠加专注样式）
  let favFilter = false;
  let pendingGridFiles = null;
  let smartSnapshot = null; // 智能排版前的快照（富文本 + Markdown），用于一键还原

  const gallery = document.getElementById("templateGallery");
  const editor = document.getElementById("editor");
  const hint = document.getElementById("hint");
  const imgFile = document.getElementById("imgFile");
  const gridFile = document.getElementById("gridFile");
  const mdFile = document.getElementById("mdFile");
  const gridModal = document.getElementById("gridModal");
  const modeSeg = document.getElementById("modeSeg");
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
  // 缩略图示例文档：展示标题/正文/小标题/引用/列表，足以传达模板气质
  const THUMB_SAMPLE =
    "<h1>标题样式</h1>" +
    "<p>正文段落展示模板的字体、行距与配色气质。</p>" +
    "<h2>小标题</h2>" +
    "<blockquote>一句引用，见呼吸感。</blockquote>" +
    "<ul><li>列表项一</li><li>列表项二</li></ul>";

  function makeThumb(t) {
    const wrap = document.createElement("div");
    wrap.className = "tpl-thumb";
    if (t.base && t.base.background) wrap.style.background = t.base.background;
    const inner = document.createElement("div");
    inner.className = "tpl-thumb-inner";
    try {
      inner.innerHTML = window.applyInlineStyles(t, THUMB_SAMPLE);
    } catch (e) {
      inner.textContent = t.name;
    }
    wrap.appendChild(inner);
    return wrap;
  }

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

    card.appendChild(makeThumb(t));

    const name = document.createElement("div");
    name.className = "name";
    name.textContent = t.name;
    card.appendChild(name);

    card.addEventListener("click", () => {
      currentTplId = t.id;
      renderGallery();
      applyPreview();
      if (typeof scheduleWpane === "function") scheduleWpane(); // 并排预览跟着换模板
      saveDraft();
    });
    return card;
  }

  async function renderGallery() {
    const favs = await getFavs();
    gallery.innerHTML = "";
    const visible = window.TEMPLATES.filter((t) => !favFilter || favs.indexOf(t.id) !== -1);
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
    grid: () => gridFile.click(),
    smart: () => {
      // 非破坏式：先存快照，误判标题/结构可一键还原
      smartSnapshot = { rich: window.Editor.getHTML(), md: mdSource.value };
      showRestore(true);
      if (mode === "md") {
        const raw = mdSource.value;
        if (!raw.trim()) { showHint("源码是空的", true); clearSnapshot(); return; }
        const structured = window.smartStructure(raw);
        mdSource.value = window.htmlToMarkdown(structured);
        renderPreview();
        saveDraft();
        showHint("已智能重排 ✓");
        return;
      }
      const el = window.Editor.el;
      const text = (el.innerText || el.textContent || "").replace(/\n{3,}/g, "\n");
      if (!text.trim()) { showHint("编辑器是空的", true); clearSnapshot(); return; }
      const structured = window.smartStructure(text);
      window.Editor.setHTML(structured);
      if (window.Highlighter) window.Highlighter.highlightContainers(el, window.__currentDark);
      if (window.ImagePipeline) window.ImagePipeline.hydrateImages(el);
      window.Editor.focus();
      saveDraft();
      showHint("已智能重排 ✓");
    }
  };

  document.getElementById("toolbar").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const cmd = btn.dataset.cmd;
    if (cmdMap[cmd]) { cmdMap[cmd](); window.Editor.focus(); }
  });

  // ---------- 非破坏式智能排版：快照 + 一键还原 ----------
  function showRestore(show) {
    const btn = document.getElementById("restoreBtn");
    if (btn) btn.style.display = show ? "" : "none";
  }
  function clearSnapshot() {
    smartSnapshot = null;
    showRestore(false);
  }
  function restoreOriginal() {
    if (!smartSnapshot) return;
    if (mode === "md") {
      mdSource.value = smartSnapshot.md;
      renderPreview();
    } else {
      window.Editor.setHTML(smartSnapshot.rich);
      const el = window.Editor.el;
      if (window.Highlighter) window.Highlighter.highlightContainers(el, window.__currentDark);
      if (window.ImagePipeline) window.ImagePipeline.hydrateImages(el);
    }
    smartSnapshot = null;
    showRestore(false);
    saveDraft();
    showHint("已还原原文");
  }
  const restoreBtnEl = document.getElementById("restoreBtn");
  if (restoreBtnEl) restoreBtnEl.addEventListener("click", restoreOriginal);
  // 用户手动编辑后，快照失效，自动收起还原按钮
  editor.addEventListener("input", () => { if (smartSnapshot) clearSnapshot(); toggleEmptyHint(); });
  mdSource.addEventListener("input", () => { if (smartSnapshot) clearSnapshot(); });

  // ---------- 空状态引导 ----------
  const richWrap = document.querySelector("#richPane .editor-wrap");
  const emptyHint = document.createElement("div");
  emptyHint.className = "editor-empty";
  emptyHint.innerHTML =
    '<div class="editor-empty-ic">✍️</div>' +
    '<div class="editor-empty-t1">在这里开始写作</div>' +
    '<div class="editor-empty-t2">支持 Markdown 实时渲染 · 聚焦 · 打字机</div>' +
    '<div class="editor-empty-t3">底部工具坞可切换 预览 / 风格检查</div>';
  richWrap.appendChild(emptyHint);
  function toggleEmptyHint() {
    const empty = !(editor.textContent && editor.textContent.trim());
    emptyHint.style.display = empty ? "flex" : "none";
  }

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
  mdSource.addEventListener("paste", (e) => {
    const cd = e.clipboardData || window.clipboardData;
    const html = cd.getData("text/html");
    const text = cd.getData("text/plain");
    if (html && html.trim()) {
      e.preventDefault();
      let md = window.htmlToMarkdown(html);
      // 无结构长文（逐字稿/聊天粘贴，无空行分段）→ 自动智能分段
      if (!/\n\n/.test(md) && md.replace(/\s/g, "").length > 300 && window.smartStructure) {
        md = window.htmlToMarkdown(window.smartStructure(md));
      }
      const start = mdSource.selectionStart, end = mdSource.selectionEnd;
      mdSource.value = mdSource.value.slice(0, start) + md + mdSource.value.slice(end);
      renderPreview();
      saveDraft();
    } else if (text && text.trim()) {
      // 纯文本粘贴（无 text/html）→ 同样走智能排版，避免 Markdown 模式下的双模式陷阱
      e.preventDefault();
      const structured = (window.hasExplicitMarkup && window.hasExplicitMarkup(text))
        ? window.autoStructure(text)
        : window.smartStructure(text);
      const md = window.htmlToMarkdown(structured);
      const start = mdSource.selectionStart, end = mdSource.selectionEnd;
      mdSource.value = mdSource.value.slice(0, start) + md + mdSource.value.slice(end);
      renderPreview();
      saveDraft();
      showHint("已自动排版 ✓");
    }
  });

  function setSegActive() {
    modeSeg.querySelectorAll(".seg-btn").forEach((b) =>
      b.classList.toggle("active", b.dataset.mode === mode));
  }

  const isRichLike = (m) => m === "rich" || m === "write";

  function clearFocusDim() {
    Array.from(editor.children).forEach((ch) => ch.classList.remove("wfocused"));
  }

  function switchMode(target) {
    if (target === mode) return;
    if (target === "md") {
      if (isRichLike(mode)) {
        mdSource.value = window.htmlToMarkdown(window.Editor.getHTML());
      }
      renderPreview();
    } else if (mode === "md") {
      editor.innerHTML = window.markdownToHtml(mdSource.value);
      if (window.ImagePipeline) window.ImagePipeline.hydrateImages(editor);
    }
    mode = target;
    const md = target === "md";
    richPane.style.display = md ? "none" : "flex";
    mdPane.style.display = md ? "flex" : "none";
    // 写作模式：模板栏/工具栏/导出项退场，模板底色换纯白（离开时恢复模板预览）
    document.body.classList.toggle("writing", target === "write");
    if (target === "write") {
      editor.style.background = ""; // 底色交给 --w-bg，外观面板才改得动
      applyLook();
    } else {
      applyPreview();
      toggleMdHelp(false);
      toggleWriteLook(false);
      hideCtx();
    }
    setSegActive();
    if (!md) { toggleEmptyHint(); window.Editor.focus(); }
    if (target === "write") {
      syncWritingControls();
      refreshFocus();
      if (wpaneOn) renderWpane();
    } else { stripAllDeco(); }
    saveDraft();
  }
  modeSeg.addEventListener("click", (e) => {
    const b = e.target.closest(".seg-btn");
    if (b) switchMode(b.dataset.mode);
  });

  // ========== 写作增强（参考 iA Writer：聚焦 / 打字机 / 字数 / 风格检查） ==========
  let focusLevel = "paragraph"; // 'off' | 'paragraph' | 'sentence'
  let typewriterOn = false;
  let styleCheckOn = false;
  let lastDecoBlock = null, lastDecoOff = null;
  let decoratedBlock = null;

  const writingControls = document.getElementById("writeDock");
  const typewriterBtn = document.getElementById("typewriterBtn");
  const styleCheckBtn = document.getElementById("styleCheckBtn");
  const stMain = document.getElementById("stMain");
  const stDetail = document.getElementById("stDetail");

  // —— 光标偏移工具（在块内按纯文本偏移定位，便于重排后还原） ——
  function getCaretOffset(root) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    const r = sel.getRangeAt(0);
    const pre = r.cloneRange();
    pre.selectNodeContents(root);
    pre.setEnd(r.endContainer, r.endOffset);
    return pre.toString().length;
  }
  function setCaretOffset(root, offset) {
    if (offset == null) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let n, count = 0, target = null, pos = 0;
    while ((n = walker.nextNode())) {
      const len = n.nodeValue.length;
      if (count + len >= offset) { target = n; pos = offset - count; break; }
      count += len;
    }
    const sel = window.getSelection();
    sel.removeAllRanges();
    const r = document.createRange();
    if (!target) { r.selectNodeContents(root); r.collapse(false); }
    else { r.setStart(target, Math.min(pos, target.nodeValue.length)); r.collapse(true); }
    sel.addRange(r);
  }
  function escapeHtml(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  function currentFocusBlock() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount) {
      let node = sel.anchorNode;
      while (node && node !== editor) {
        if (node.parentNode === editor) return node.nodeType === 3 ? null : node;
        node = node.parentNode;
      }
    }
    return null;
  }
  function isSimple(block) { return block && block.querySelectorAll("*").length === 0; }

  function splitSentences(text) {
    const re = /[^。！？!?\n]+[。！？!?]*/g;
    const out = []; let m;
    while ((m = re.exec(text)) !== null) { if (m[0].length) out.push(m[0]); }
    return out;
  }
  function decorateSentence(block) {
    const off = getCaretOffset(block);
    if (block === lastDecoBlock && off === lastDecoOff && block.classList.contains("ws-decorated")) return;
    const text = block.textContent;
    const sents = splitSentences(text);
    if (!sents.length) return;
    let html = "", acc = 0, activeIdx = -1;
    sents.forEach((s, idx) => {
      const start = acc, end = acc + s.length;
      const active = off != null && off >= start && off <= end;
      if (active) activeIdx = idx;
      html += '<span class="ws">' + escapeHtml(s) + "</span>";
      acc = end;
    });
    block.innerHTML = html;
    block.classList.add("ws-decorated");
    const spans = block.querySelectorAll(".ws");
    if (activeIdx >= 0 && spans[activeIdx]) spans[activeIdx].classList.add("ws-active");
    if (off != null) setCaretOffset(block, off);
    lastDecoBlock = block; lastDecoOff = off;
  }
  function stripSentenceDeco(block) {
    block.querySelectorAll(".ws").forEach((span) => {
      const p = span.parentNode;
      while (span.firstChild) p.insertBefore(span.firstChild, span);
      p.removeChild(span);
    });
    block.normalize();
    block.classList.remove("ws-decorated");
    if (lastDecoBlock === block) { lastDecoBlock = null; lastDecoOff = null; }
  }

  // —— 风格检查（中文版）：填充词 / 冗余 / 陈词，软红波浪下划线，编辑器内可见、导出前剥离 ——
  const STYLE_FILLER = ["其实", "基本上", "也就是说", "换句话说", "总而言之", "说到底", "老实说", "说实在的", "毋庸置疑", "众所周知", "事实上", "显然", "可以说", "在一定程度上", "某种程度上", "一般来说", "通常情况下", "不可否认", "不得不说", "个人认为", "在我看来", "值得注意的是", "需要指出的是", "综上所述", "简而言之", "换言之", "应该说", "客观地说", "平心而论", "毫不夸张地说", "严格来说", "从某种意义上说"];
  const STYLE_REDUNDANCY = ["免费的赠品", "过去的往事", "目前的现状", "最终的结局", "基本的基础", "完全彻底", "首先第一步", "新的革新", "最后的终点", "成功的胜利", "错误的谬误", "普通的常人", "真正的实情", "凯旋而归", "亲眼目睹", "毫无根据的谣言", "涉及到", "来自于", "进行学习", "进行工作", "进行讨论"];
  const STYLE_CLICHE = ["一举两得", "事半功倍", "画龙点睛", "锦上添花", "雪中送炭", "至关重要", "不可或缺", "毫无疑问", "不言而喻", "不忘初心", "应运而生", "脱颖而出", "势在必行", "刻不容缓", "独树一帜", "别具一格", "浓墨重彩", "冰山一角", "九牛一毛", "沧海一粟", "凤毛麟角", "如火如荼", "方兴未艾", "蒸蒸日上", "日新月异", "百花齐放", "一道亮丽的风景线", "时代的车轮", "历史的必然", "大势所趋"];
  const _fillerSet = new Set(STYLE_FILLER), _redSet = new Set(STYLE_REDUNDANCY), _cliSet = new Set(STYLE_CLICHE);
  function _kindOf(s) { if (_fillerSet.has(s)) return "filler"; if (_redSet.has(s)) return "redundancy"; if (_cliSet.has(s)) return "cliche"; return "filler"; }
  function _escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  const STYLE_RE = new RegExp("(" + STYLE_FILLER.concat(STYLE_REDUNDANCY, STYLE_CLICHE).map(_escRe).join("|") + ")", "g");

  function _wrapMatchesInTextNode(textNode) {
    const text = textNode.nodeValue;
    STYLE_RE.lastIndex = 0;
    if (!STYLE_RE.test(text)) return false;
    STYLE_RE.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let last = 0, m;
    while ((m = STYLE_RE.exec(text)) !== null) {
      const s = m.index, e = s + m[0].length;
      if (s > last) frag.appendChild(document.createTextNode(text.slice(last, s)));
      const span = document.createElement("span");
      span.className = "wstyle";
      span.setAttribute("data-kind", _kindOf(m[0]));
      span.textContent = m[0];
      frag.appendChild(span);
      last = e;
      if (m[0].length === 0) STYLE_RE.lastIndex++;
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    textNode.parentNode.replaceChild(frag, textNode);
    return true;
  }
  function removeStyleCheckSpans(root) {
    root.querySelectorAll(".wstyle").forEach((span) => {
      const p = span.parentNode;
      while (span.firstChild) p.insertBefore(span.firstChild, span);
      p.removeChild(span);
    });
    root.normalize();
  }
  function scanStyle(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const p = n.parentNode;
        if (p && p.nodeType === 1 && p.classList && (p.classList.contains("wstyle") || p.classList.contains("ws"))) return NodeFilter.FILTER_REJECT;
        let anc = p;
        while (anc && anc !== root) {
          if (anc.tagName === "PRE" || anc.tagName === "CODE" || anc.tagName === "SCRIPT" || anc.tagName === "STYLE") return NodeFilter.FILTER_REJECT;
          anc = anc.parentNode;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = []; let n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(_wrapMatchesInTextNode);
  }

  // —— 打字机滚动：当前块垂直居中于编辑区 ——
  function typewriterScroll(block) {
    if (!block) return;
    const sc = editor.parentElement;
    const scRect = sc.getBoundingClientRect();
    const bRect = block.getBoundingClientRect();
    sc.scrollTop += (bRect.top + bRect.height / 2) - (scRect.top + scRect.height / 2);
  }

  // —— 字数统计气泡（iA 式：字数 / 字符 / 句数 / 阅读时长，选中即变范围） ——
  function updateStats() {
    const sel = window.getSelection();
    let text = "";
    if (sel && sel.rangeCount && !sel.isCollapsed && editor.contains(sel.anchorNode) && editor.contains(sel.focusNode)) {
      text = sel.toString();
    }
    if (!text) text = editor.innerText || "";
    const noSpace = text.replace(/\s/g, "");
    const chars = noSpace.length;
    const cjk = (noSpace.match(/[一-鿿]/g) || []).length;
    const latinWords = (noSpace.replace(/[一-鿿]/g, " ").match(/[A-Za-z0-9]+/g) || []).length;
    const words = cjk + latinWords;
    const sentences = (text.match(/[。！？!?]/g) || []).length;
    const minutes = Math.max(1, Math.round(words / 300));
    stMain.textContent = words.toLocaleString() + " 字";
    stDetail.innerHTML =
      '<div><span>字数</span>' + words.toLocaleString() + "</div>" +
      '<div><span>字符</span>' + chars.toLocaleString() + "</div>" +
      '<div><span>句数</span>' + sentences.toLocaleString() + "</div>" +
      '<div><span>阅读</span>≈ ' + minutes + " 分钟</div>";
  }

  function syncWritingControls() {
    writingControls.querySelectorAll(".wc-focus").forEach((b) => b.classList.toggle("active", b.dataset.focus === focusLevel));
    typewriterBtn.classList.toggle("active", typewriterOn);
    styleCheckBtn.classList.toggle("active", styleCheckOn);
    if (writingControls.querySelector("#wpaneBtn")) {
      writingControls.querySelector("#wpaneBtn").classList.toggle("active", !!document.body.classList.contains("wpane-on"));
    }
  }

  // —— 主编排：根据开关应用 段落变淡 / 句子聚焦 / 风格检查 / 打字机 / 统计 ——
  function refreshFocus() {
    if (mode !== "write") return;
    const block = currentFocusBlock();
    if (focusLevel === "off" || !block) {
      Array.from(editor.children).forEach((ch) => ch.classList.remove("wfocused"));
    } else {
      Array.from(editor.children).forEach((ch) => ch.classList.toggle("wfocused", ch === block));
    }
    // 句子聚焦：用 decoratedBlock 跟踪当前装饰块，避免重建后 isSimple 变 false 被误剥离
    const sentenceActive = focusLevel === "sentence" && !styleCheckOn;
    if (sentenceActive && block) {
      if (decoratedBlock !== block) {
        if (decoratedBlock) stripSentenceDeco(decoratedBlock);
        if (isSimple(block)) { decorateSentence(block); decoratedBlock = block; }
        else { decoratedBlock = null; }
      } else if (block.children.length && Array.from(block.children).some((c) => !c.classList.contains("ws"))) {
        stripSentenceDeco(block); decoratedBlock = null;
      } else {
        decorateSentence(block);
      }
    } else if (decoratedBlock) {
      stripSentenceDeco(decoratedBlock); decoratedBlock = null;
    }
    if (styleCheckOn && block) {
      const off = getCaretOffset(block);
      removeStyleCheckSpans(block);
      scanStyle(block);
      if (off != null) setCaretOffset(block, off);
    }
    if (typewriterOn) typewriterScroll(block);
    updateStats();
  }

  function stripAllDeco() {
    removeStyleCheckSpans(editor);
    editor.querySelectorAll(".ws-decorated").forEach(stripSentenceDeco);
    Array.from(editor.children).forEach((ch) => ch.classList.remove("wfocused"));
  }

  // 控件事件
  writingControls.querySelectorAll(".wc-focus").forEach((b) => {
    b.addEventListener("click", () => {
      focusLevel = b.dataset.focus;
      if (focusLevel === "sentence" && styleCheckOn) styleCheckOn = false;
      lastDecoBlock = null; lastDecoOff = null;
      syncWritingControls();
      refreshFocus();
    });
  });
  typewriterBtn.addEventListener("click", () => {
    typewriterOn = !typewriterOn;
    syncWritingControls();
    if (typewriterOn) typewriterScroll(currentFocusBlock());
  });
  styleCheckBtn.addEventListener("click", () => {
    styleCheckOn = !styleCheckOn;
    if (styleCheckOn && focusLevel === "sentence") focusLevel = "paragraph";
    lastDecoBlock = null; lastDecoOff = null;
    if (styleCheckOn) {
      const off = getCaretOffset(editor);
      removeStyleCheckSpans(editor);
      scanStyle(editor);
      setCaretOffset(editor, off);
    } else {
      removeStyleCheckSpans(editor);
    }
    syncWritingControls();
    refreshFocus();
  });

  document.addEventListener("selectionchange", () => { if (!previewOpen) refreshFocus(); });

  // ==================================================================
  // 写作增强（二）：外观（Modify Preview）/ 并排实时预览 / 编辑器右键菜单
  // ==================================================================

  // ---------- 🎨 写作外观：字体 / 字号 / 行高 / 栏宽 / 主题 ----------
  // 画布样式全部走 body 上的 --w-* 变量，面板改的是变量，不动导出成品。
  const LOOK_FONT = {
    mono: '"iA Writer Duo S", "iA Writer Duo", "Sarasa Mono SC", "Cascadia Code", "SF Mono", "JetBrains Mono", Menlo, Consolas, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", monospace',
    serif: 'Georgia, "Times New Roman", "Songti SC", "Source Han Serif SC", "SimSun", serif',
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'
  };
  const LOOK_DEFAULT = { font: "mono", theme: "paper", size: 19, lh: 1.95, col: 720 };
  let look = Object.assign({}, LOOK_DEFAULT);

  const writeLook = document.getElementById("writeLook");
  const appearanceBtn = document.getElementById("appearanceBtn");
  const wlFont = document.getElementById("wlFont");
  const wlTheme = document.getElementById("wlTheme");
  const wlSize = document.getElementById("wlSize"), wlSizeOut = document.getElementById("wlSizeOut");
  const wlLh = document.getElementById("wlLh"), wlLhOut = document.getElementById("wlLhOut");
  const wlCol = document.getElementById("wlCol"), wlColOut = document.getElementById("wlColOut");

  function applyLook() {
    const st = document.body.style;
    document.body.classList.toggle("w-night", look.theme === "night");
    st.setProperty("--w-font", LOOK_FONT[look.font] || LOOK_FONT.mono);
    st.setProperty("--w-size", look.size + "px");
    st.setProperty("--w-lh", String(look.lh));
    st.setProperty("--w-col", look.col + "px");
    // 白主题只是把「纸」换成冷白，其余三色仍交给 .w-night / 默认值
    if (look.theme === "white") {
      st.setProperty("--w-bg", "#ffffff");
      st.setProperty("--w-code", "#f5f6f8");
      st.setProperty("--w-pane-bg", "#f4f5f7");
    } else {
      st.removeProperty("--w-bg");
      st.removeProperty("--w-code");
      st.removeProperty("--w-pane-bg");
    }
    if (wlFont) wlFont.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.v === look.font));
    if (wlTheme) wlTheme.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.v === look.theme));
    if (wlSize) { wlSize.value = look.size; wlSizeOut.textContent = look.size; }
    if (wlLh) { wlLh.value = look.lh; wlLhOut.textContent = look.lh; }
    if (wlCol) { wlCol.value = look.col; wlColOut.textContent = look.col; }
    // 写作模式下底色交给 --w-bg；富文本模式要保留模板底色，别乱清
    if (editor && mode === "write") editor.style.background = "";
  }
  // 滑块拖动会连续触发，攒一下再落盘，避免每次 input 都写一次存储
  let lookSaveTimer = null;
  function saveLook() {
    clearTimeout(lookSaveTimer);
    lookSaveTimer = setTimeout(() => {
      if (window.storeSet) window.storeSet("writeLook", { look: look, wpane: wpaneOn, sync: wpaneSync });
    }, 400);
  }
  async function loadLook() {
    if (!window.storeGet) { applyLook(); return; }
    const d = await window.storeGet("writeLook");
    if (d && d.look) look = Object.assign({}, LOOK_DEFAULT, d.look);
    if (d && d.sync === false) { wpaneSync = false; if (wpaneSyncBox) wpaneSyncBox.checked = false; }
    applyLook();
    if (d && d.wpane) setWpane(true);
  }
  function toggleWriteLook(show) {
    if (!writeLook) return;
    const on = show != null ? show : writeLook.style.display === "none";
    writeLook.style.display = on ? "block" : "none";
    if (appearanceBtn) appearanceBtn.classList.toggle("active", on);
  }
  if (appearanceBtn) appearanceBtn.addEventListener("click", () => toggleWriteLook());
  const writeLookClose = document.getElementById("writeLookClose");
  if (writeLookClose) writeLookClose.addEventListener("click", () => toggleWriteLook(false));
  if (wlFont) wlFont.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    look.font = b.dataset.v; applyLook(); saveLook();
  });
  if (wlTheme) wlTheme.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    look.theme = b.dataset.v; applyLook(); saveLook();
  });
  function bindRange(el, out, key, fmt) {
    if (!el) return;
    el.addEventListener("input", () => {
      look[key] = parseFloat(el.value);
      out.textContent = fmt ? fmt(look[key]) : look[key];
      applyLook(); saveLook();
    });
  }
  bindRange(wlSize, wlSizeOut, "size");
  bindRange(wlLh, wlLhOut, "lh");
  bindRange(wlCol, wlColOut, "col");
  const wlReset = document.getElementById("wlReset");
  if (wlReset) wlReset.addEventListener("click", () => { look = Object.assign({}, LOOK_DEFAULT); applyLook(); saveLook(); });
  // 点面板外收起
  document.addEventListener("click", (e) => {
    if (!writeLook || writeLook.style.display === "none") return;
    if (writeLook.contains(e.target) || (appearanceBtn && appearanceBtn.contains(e.target))) return;
    toggleWriteLook(false);
  });

  // ---------- ▥ 并排实时预览：右侧手机宽度成品栏 ----------
  const wpane = document.getElementById("writePreview");
  const wpaneCanvas = document.getElementById("wpaneCanvas");
  const wpaneTpl = document.getElementById("wpaneTpl");
  const wpaneSheet = wpane ? wpane.querySelector(".wpane-sheet") : null;
  const wpaneSyncBox = document.getElementById("wpaneSync");
  const wpaneBtn = document.getElementById("wpaneBtn");
  let wpaneOn = false, wpaneSync = true, wpaneTimer = null, wpaneRendering = false;

  async function renderWpane() {
    if (!wpaneOn || !wpaneCanvas) return;
    if (wpaneRendering) { scheduleWpane(); return; }
    wpaneRendering = true;
    try {
      const t = window.getTemplate(currentTplId);
      const html = await buildExport();
      if (!wpaneOn) return;
      wpaneCanvas.innerHTML = html;
      if (wpaneTpl) wpaneTpl.textContent = t ? t.name : "";
      if (wpaneSheet && t && t.base && t.base.background) wpaneSheet.style.background = t.base.background;
    } catch (e) { /* 渲染失败不打断写作 */ }
    wpaneRendering = false;
  }
  function scheduleWpane() {
    if (!wpaneOn) return;
    clearTimeout(wpaneTimer);
    wpaneTimer = setTimeout(renderWpane, 400);
  }
  function setWpane(on) {
    wpaneOn = !!on;
    document.body.classList.toggle("wpane-on", wpaneOn);
    if (wpaneBtn) wpaneBtn.classList.toggle("active", wpaneOn);
    if (wpaneOn) renderWpane();
    saveLook();
  }
  function syncWpaneScroll() {
    if (!wpaneOn || !wpaneSync || !wpaneSheet) return;
    const sc = editor.parentElement;
    const max = sc.scrollHeight - sc.clientHeight;
    const pct = max > 0 ? sc.scrollTop / max : 0;
    const pmax = wpaneSheet.scrollHeight - wpaneSheet.clientHeight;
    if (pmax > 0) wpaneSheet.scrollTop = Math.max(0, pct * pmax);
  }
  if (wpaneBtn) wpaneBtn.addEventListener("click", () => setWpane(!wpaneOn));
  const wpaneClose = document.getElementById("wpaneClose");
  if (wpaneClose) wpaneClose.addEventListener("click", () => setWpane(false));
  if (wpaneSyncBox) wpaneSyncBox.addEventListener("change", () => { wpaneSync = wpaneSyncBox.checked; saveLook(); });
  if (editor.parentElement) editor.parentElement.addEventListener("scroll", syncWpaneScroll);

  // ---------- 编辑器右键菜单：为写作而生 ----------
  const ctxMenu = document.getElementById("ctxMenu");
  const ctxLink = document.getElementById("ctxLink");
  const ctxLinkText = document.getElementById("ctxLinkText");
  const ctxLinkUrl = document.getElementById("ctxLinkUrl");
  let ctxTargetBlock = null;

  const CTX_GROUPS = [
    { label: "行内", items: [
      { k: "bold", ic: "B", t: "加粗", key: "Ctrl+B" },
      { k: "italic", ic: "I", t: "斜体", key: "Ctrl+I" },
      { k: "strike", ic: "S", t: "删除线" },
      { k: "mark", ic: "▨", t: "高亮" },
      { k: "icode", ic: "</>", t: "行内代码" }
    ]},
    { label: "段落", items: [
      { k: "p", ic: "¶", t: "正文" },
      { k: "h1", ic: "H1", t: "标题一" },
      { k: "h2", ic: "H2", t: "标题二" },
      { k: "h3", ic: "H3", t: "标题三" },
      { k: "quote", ic: "❝", t: "引用" },
      { k: "ul", ic: "•", t: "无序列表" },
      { k: "ol", ic: "1.", t: "有序列表" },
      { k: "task", ic: "☐", t: "待办事项" }
    ]},
    { label: "插入", items: [
      { k: "date", ic: "📅", t: "插入今天日期" },
      { k: "hr", ic: "―", t: "分隔线" },
      { k: "link", ic: "🔗", t: "插入链接…" }
    ]},
    { label: "复制 · 其他", items: [
      { k: "copyText", ic: "T", t: "智能复制（纯文本）" },
      { k: "copyMd", ic: "M", t: "复制 Markdown" },
      { k: "copyRich", ic: "📋", t: "复制到公众号" },
      { k: "selectAll", ic: "▤", t: "全选", key: "Ctrl+A" },
      { k: "clear", ic: "⌫", t: "清除格式" }
    ]}
  ];

  function hideCtx() {
    if (ctxMenu) ctxMenu.style.display = "none";
    if (ctxLink) ctxLink.style.display = "none";
  }
  function currentCtxBlock() {
    if (ctxTargetBlock && editor.contains(ctxTargetBlock)) return ctxTargetBlock;
    return getActiveBlock(window.getSelection().anchorNode);
  }
  // 写作模式下的临时装饰（句子聚焦 / 风格检查）必须先剥掉，否则标记会跟着格式走
  function stripBlockDeco(block) {
    if (!block || block.nodeType !== 1) return;
    if (block.classList.contains("ws-decorated")) stripSentenceDeco(block);
    removeStyleCheckSpans(block);
    block.classList.remove("wfocused");
  }
  // 把 block 从列表里提出来变成普通段落（右键换格式时避免 <ul><h2> 这种非法嵌套）
  function liftFromList(block) {
    if (!block || block.tagName !== "LI") return block;
    const list = block.parentNode;
    const p = document.createElement("p");
    while (block.firstChild) p.appendChild(block.firstChild);
    list.parentNode.insertBefore(p, list);
    block.remove();
    if (!list.children.length) list.remove();
    return p;
  }
  // 保留内部行内元素（链接 / 图片 / 代码）地换块级标签
  function setBlockTag(block, tag) {
    if (block.tagName.toLowerCase() === tag) return block;
    const el = document.createElement(tag);
    while (block.firstChild) el.appendChild(block.firstChild);
    block.replaceWith(el);
    return el;
  }
  // 行内包裹：同标签已存在则视为取消（真正的 toggle）
  function closestInline(node, tag) {
    let n = node;
    while (n && n !== editor) {
      if (n.nodeType === 1 && n.tagName.toLowerCase() === tag) return n;
      n = n.parentNode;
    }
    return null;
  }
  function unwrapEl(el) {
    const p = el.parentNode;
    while (el.firstChild) p.insertBefore(el.firstChild, el);
    p.removeChild(el);
    p.normalize();
  }
  function wrapSelection(tag) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !editor.contains(sel.anchorNode)) return false;
    const range = sel.getRangeAt(0);
    const existing = closestInline(range.startContainer, tag);
    if (existing) { unwrapEl(existing); if (window.__onEdit) window.__onEdit(); refreshFocus(); saveDraft(); return true; }
    const el = document.createElement(tag);
    if (range.collapsed) {
      range.insertNode(el);
      const r = document.createRange();
      r.setStart(el, 0); r.collapse(true);
      sel.removeAllRanges(); sel.addRange(r);
    } else {
      try { range.surroundContents(el); }
      catch (e) { el.appendChild(range.extractContents()); range.insertNode(el); }
      const r = document.createRange();
      r.selectNodeContents(el);
      sel.removeAllRanges(); sel.addRange(r);
    }
    if (window.__onEdit) window.__onEdit();
    refreshFocus(); saveDraft();
    return true;
  }
  function insertTextAtCaret(str) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const r = sel.getRangeAt(0);
    r.deleteContents();
    const tn = document.createTextNode(str);
    r.insertNode(tn);
    r.setStartAfter(tn); r.collapse(true);
    sel.removeAllRanges(); sel.addRange(r);
    if (window.__onEdit) window.__onEdit();
    refreshFocus(); saveDraft();
  }
  function todayCn() {
    const d = new Date();
    return d.getFullYear() + "年" + (d.getMonth() + 1) + "月" + d.getDate() + "日";
  }
  function insertHrAfter(block) {
    const hr = document.createElement("hr");
    const p = document.createElement("p");
    p.innerHTML = "<br>";
    if (block && block.parentNode === editor) { block.after(hr); hr.after(p); }
    else { editor.appendChild(hr); editor.appendChild(p); }
    placeCaretIn(p, 0);
    if (window.__onEdit) window.__onEdit();
    refreshFocus(); saveDraft();
  }
  // 块内纯文本（<br> → 换行），不依赖 innerText（detached 节点上不可靠）
  function blockText(el) {
    let out = "";
    el.childNodes.forEach((n) => {
      if (n.nodeType === 3) out += n.nodeValue;
      else if (n.nodeType === 1) out += n.tagName.toLowerCase() === "br" ? "\n" : blockText(n);
    });
    return out;
  }
  function buildPlainText() {
    let html = "";
    try { html = stripDeco(window.Editor.getHTML()); } catch (e) { html = window.Editor.getHTML(); }
    const doc = new DOMParser().parseFromString("<div>" + html + "</div>", "text/html");
    const root = doc.body.firstChild;
    if (!root) return "";
    const lines = [];
    root.querySelectorAll("h1,h2,h3,h4,h5,h6,p,blockquote,li,pre,hr").forEach((el) => {
      const tg = el.tagName.toLowerCase();
      if (tg === "hr") { lines.push("———"); return; }
      const txt = blockText(el).trim();
      if (!txt) return;
      if (tg === "li") { lines.push("· " + txt); return; }
      if (tg === "blockquote") { lines.push(txt); return; }
      lines.push(txt);
    });
    return lines.join("\n\n");
  }
  function isCtxActive(k, block) {
    try {
      if (k === "bold") return document.queryCommandState("bold");
      if (k === "italic") return document.queryCommandState("italic");
      if (k === "strike") return document.queryCommandState("strikeThrough");
    } catch (e) { /* 某些环境不支持查询，忽略 */ }
    if (!block || block.nodeType !== 1) return false;
    const tag = block.tagName.toLowerCase();
    if (k === "p") return tag === "p";
    if (k === "h1" || k === "h2" || k === "h3") return tag === k;
    if (k === "quote") return tag === "blockquote";
    if (k === "ul") return tag === "li" && block.parentNode.tagName === "UL" && !block.parentNode.classList.contains("task-list");
    if (k === "ol") return tag === "li" && block.parentNode.tagName === "OL";
    if (k === "task") return tag === "li" && block.parentNode.classList.contains("task-list");
    return false;
  }
  function showCtx(x, y, block) {
    if (!ctxMenu) return;
    ctxTargetBlock = block;
    let html = "";
    CTX_GROUPS.forEach((g) => {
      if (html) html += '<div class="ctx-sep"></div>';
      html += '<div class="ctx-group">' + g.label + "</div>";
      g.items.forEach((it) => {
        const on = isCtxActive(it.k, block);
        html += '<button class="ctx-item' + (on ? " active" : "") + '" data-k="' + it.k + '">' +
          '<span class="ctx-ic">' + it.ic + '</span><span class="ctx-txt">' + it.t + "</span>" +
          (it.key ? '<span class="ctx-key">' + it.key + "</span>" : "") +
          "</button>";
      });
    });
    ctxMenu.innerHTML = html;
    ctxMenu.style.display = "block";
    ctxMenu.style.left = "0px";
    ctxMenu.style.top = "0px";
    const r = ctxMenu.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    ctxMenu.style.maxHeight = Math.max(240, vh - 24) + "px";
    ctxMenu.style.left = Math.max(8, Math.min(x, vw - r.width - 10)) + "px";
    ctxMenu.style.top = Math.max(8, Math.min(y, vh - Math.min(r.height, vh - 24) - 10)) + "px";
    if (ctxLink) ctxLink.style.display = "none";
  }
  function openLinkForm() {
    if (!ctxLink || !ctxMenu) return;
    const box = ctxMenu.getBoundingClientRect();
    ctxMenu.style.display = "none";
    ctxLink.style.display = "block";
    ctxLink.style.left = box.left + "px";
    ctxLink.style.top = box.top + "px";
    const sel = window.getSelection();
    const picked = sel && !sel.isCollapsed ? sel.toString().trim() : "";
    ctxLinkText.value = picked;
    ctxLinkUrl.value = "https://";
    setTimeout(() => { (picked ? ctxLinkUrl : ctxLinkText).focus(); (picked ? ctxLinkUrl : ctxLinkText).select(); }, 0);
  }
  function applyLink() {
    const text = (ctxLinkText.value || "").trim();
    const url = (ctxLinkUrl.value || "").trim() || "https://";
    hideCtx();
    if (!text) return;
    const sel = window.getSelection();
    let node;
    if (sel && !sel.isCollapsed && editor.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0);
      const a = document.createElement("a");
      a.setAttribute("href", url);
      try { range.surroundContents(a); }
      catch (e) { a.appendChild(range.extractContents()); range.insertNode(a); }
      node = a;
    } else {
      const a = document.createElement("a");
      a.setAttribute("href", url);
      a.textContent = text;
      const r = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
      if (r) { r.deleteContents(); r.insertNode(a); r.setStartAfter(a); r.collapse(true); }
      else editor.appendChild(a);
      node = a;
    }
    if (window.__onEdit) window.__onEdit();
    refreshFocus(); saveDraft();
    if (node) { const r2 = document.createRange(); r2.setStartAfter(node); r2.collapse(true);
      const s2 = window.getSelection(); s2.removeAllRanges(); s2.addRange(r2); }
    showHint("已插入链接 ✓");
  }
  function setBlockKind(kind) {
    let block = currentCtxBlock();
    if (!block || block.nodeType !== 1) { showHint("先把光标放进某一段", true); return; }
    stripBlockDeco(block);
    block = liftFromList(block);
    const off = getCaretOffset(block);
    let el = block;
    if (kind === "p" || kind === "h1" || kind === "h2" || kind === "h3") {
      el = setBlockTag(block, kind);
    } else if (kind === "quote") {
      el = setBlockTag(block, block.tagName.toLowerCase() === "blockquote" ? "p" : "blockquote");
    } else if (kind === "ul" || kind === "ol") {
      const txt = blockText(block).replace(/^[\s\-*+•]+/, "");
      convertListItem(block, kind, txt);
      refreshFocus(); saveDraft();
      return;
    } else if (kind === "task") {
      const txt = blockText(block).replace(/^[\s\-*+•]+/, "");
      convertListItem(block, "ul", txt, { checked: false });
      refreshFocus(); saveDraft();
      return;
    }
    if (off != null) setCaretOffset(el, off);
    if (window.__onEdit) window.__onEdit();
    refreshFocus(); saveDraft();
  }
  async function runCtx(k) {
    const block = currentCtxBlock();
    hideCtx();
    switch (k) {
      case "bold": wrapSelection("b"); break;
      case "italic": wrapSelection("i"); break;
      case "strike": wrapSelection("s"); break;
      case "mark": wrapSelection("mark"); break;
      case "icode": wrapSelection("code"); break;
      case "p": case "h1": case "h2": case "h3": case "quote": case "ul": case "ol": case "task":
        setBlockKind(k); break;
      case "date": insertTextAtCaret(todayCn()); break;
      case "hr": insertHrAfter(block); break;
      case "link": openLinkForm(); break;
      case "copyText": {
        const r = await window.copyText(buildPlainText());
        showToast(r.ok ? "✅ 已复制纯文本（不带格式）" : "❌ 复制失败：" + (r.reason || ""), !r.ok);
        break;
      }
      case "copyMd": {
        const md = await buildMarkdown();
        const r = await window.copyText(md);
        showHint(r.ok ? "已复制 Markdown ✓" : "复制失败", !r.ok);
        break;
      }
      case "copyRich": await doCopyWechat(); break;
      case "selectAll": {
        const r = document.createRange();
        r.selectNodeContents(editor);
        const s = window.getSelection();
        s.removeAllRanges(); s.addRange(r);
        break;
      }
      case "clear": window.Editor.clearFormat(); break;
    }
  }
  if (ctxMenu) {
    // 关键：按下就阻止默认，菜单不会夺走编辑器的选区
    ctxMenu.addEventListener("mousedown", (e) => e.preventDefault());
    ctxMenu.addEventListener("click", (e) => {
      const b = e.target.closest(".ctx-item");
      if (b) runCtx(b.dataset.k);
    });
  }
  if (ctxLink) {
    ctxLink.addEventListener("mousedown", (e) => { if (e.target.tagName !== "INPUT") e.preventDefault(); });
    ctxLink.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); applyLink(); }
      if (e.key === "Escape") { e.preventDefault(); hideCtx(); }
    });
    const ok = document.getElementById("ctxLinkOk");
    const cancel = document.getElementById("ctxLinkCancel");
    if (ok) ok.addEventListener("click", applyLink);
    if (cancel) cancel.addEventListener("click", hideCtx);
  }
  editor.addEventListener("contextmenu", (e) => {
    if (mode === "md") return; // Markdown 模式在 textarea 上，保留原生菜单
    e.preventDefault();
    const block = getActiveBlock(e.target) || getActiveBlock(window.getSelection().anchorNode);
    showCtx(e.clientX, e.clientY, block);
  });
  document.addEventListener("mousedown", (e) => {
    if (!ctxMenu || ctxMenu.style.display === "none") return;
    if (ctxMenu.contains(e.target) || (ctxLink && ctxLink.contains(e.target))) return;
    hideCtx();
  });
  window.addEventListener("resize", hideCtx);
  if (editor.parentElement) editor.parentElement.addEventListener("scroll", hideCtx);

  // ===== 写作模式：Markdown 所见即所得（块级 + 行内实时渲染） =====
  let suppressInput = false;

  function placeCaretIn(node, offset) {
    const sel = window.getSelection();
    sel.removeAllRanges();
    const r = document.createRange();
    if (node.nodeType === 3) {
      r.setStart(node, Math.max(0, Math.min(offset, node.nodeValue.length)));
    } else {
      r.selectNodeContents(node);
    }
    r.collapse(true);
    sel.addRange(r);
  }
  function getActiveBlock(node) {
    let n = node;
    while (n && n !== editor) {
      if (n.parentNode === editor) return n.nodeType === 3 ? null : n;
      n = n.parentNode;
    }
    return null;
  }
  function placeCaretEnd(el) {
    const sel = window.getSelection();
    sel.removeAllRanges();
    const r = document.createRange();
    r.selectNodeContents(el);
    r.collapse(false);
    sel.addRange(r);
  }
  function convertTo(block, tag, content) {
    const el = document.createElement(tag);
    el.textContent = content;
    block.replaceWith(el);
    placeCaretIn(el, 0);
  }
  function convertListItem(block, type, content, task) {
    const li = document.createElement("li");
    if (task) {
      li.className = "task";
      li.setAttribute("data-checked", task.checked ? "true" : "false");
      const box = document.createElement("span");
      box.className = "task-box";
      box.textContent = task.checked ? "☑" : "☐";
      li.appendChild(box);
    }
    li.appendChild(document.createTextNode(content));
    const prev = block.previousElementSibling;
    const joinable = prev && prev.tagName === type.toUpperCase() && prev.children.length &&
      (task ? prev.classList.contains("task-list") : !prev.classList.contains("task-list"));
    if (joinable) {
      prev.appendChild(li);
    } else {
      const list = document.createElement(type);
      if (task) list.className = "task-list";
      list.appendChild(li);
      block.replaceWith(list);
    }
    placeCaretIn(li, 0);
  }
  function convertHr(block, pageBreak) {
    const hr = document.createElement("hr");
    if (pageBreak) hr.className = "page-break";
    const p = document.createElement("p"); p.innerHTML = "<br>";
    block.replaceWith(hr);
    hr.after(p);
    placeCaretIn(p, 0);
  }
  function convertCode(block, lang) {
    const pre = document.createElement("pre");
    const code = document.createElement("code");
    if (lang) code.className = "language-" + lang;
    pre.appendChild(code);
    block.replaceWith(pre);
    placeCaretIn(code, 0);
  }
  function convertBlockquote(block, depth, content) {
    const inner = document.createElement("p");
    inner.innerHTML = content ? escapeHtml(content) : "<br>";
    let node = inner;
    for (let k = 0; k < depth; k++) {
      const bq = document.createElement("blockquote");
      bq.appendChild(node);
      node = bq;
    }
    block.replaceWith(node);
    placeCaretIn(inner, inner.textContent.length);
  }

  const HR_RE = /^\s*(?:-\s*){3,}$|^\s*(?:\*\s*){3,}$|^\s*(?:_\s*){3,}$/;

  // 块级 Markdown：输入触发符后即时转成对应元素（对齐 iA Writer 语法）
  function handleBlockMarkdown() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const block = getActiveBlock(sel.anchorNode);
    if (!block) return;
    if (block.tagName === "PRE") return;
    if (block.classList.contains("ws-decorated")) return;
    if (block.querySelector(".wstyle")) return;

    // 列表项内输入 [ ] / [x] → 升级为任务项
    if (block.tagName === "LI") {
      if (!block.classList.contains("task")) {
        const tm = block.textContent.match(/^\s*\[([ xX])\]\s?/);
        if (tm) {
          const checked = tm[1].toLowerCase() === "x";
          const rest = block.textContent.slice(tm[0].length);
          block.className = "task";
          block.setAttribute("data-checked", checked ? "true" : "false");
          block.innerHTML = "";
          const box = document.createElement("span");
          box.className = "task-box";
          box.textContent = checked ? "☑" : "☐";
          block.appendChild(box);
          block.appendChild(document.createTextNode(rest));
          const ul = block.parentNode;
          if (ul && ul.tagName === "UL" && !ul.classList.contains("task-list")) ul.classList.add("task-list");
          placeCaretIn(block.lastChild, rest.length);
        }
      }
      return;
    }

    const text = block.textContent;
    let m;
    // 标题 1–6：'#'~'######' + 空格
    if ((m = text.match(/^\s*(#{1,6})\s/))) { convertTo(block, "h" + m[1].length, text.replace(/^\s*#{1,6}\s/, "")); return; }
    // 代码围栏（可带语言）
    if ((m = text.match(/^\s*```(\w*)\s*$/))) { convertCode(block, m[1]); return; }
    // 任务列表：- [ ] / - [x] / 1. [ ]
    if ((m = text.match(/^\s*([-*+]|\d+\.)\s+\[([ xX])\]\s/))) {
      const checked = m[2].toLowerCase() === "x";
      convertListItem(block, /^\s*\d/.test(m[1]) ? "ol" : "ul",
        text.replace(/^\s*([-*+]|\d+\.)\s+\[[ xX]\]\s/, ""), { checked: checked });
      return;
    }
    // 引用（支持嵌套 >>）
    if ((m = text.match(/^\s*(>+)\s?/))) { convertBlockquote(block, m[1].length, text.replace(/^\s*>+\s?/, "")); return; }
    // 分割线（--- / *** / ___ / * * * …）—— 须先于列表判断
    if (HR_RE.test(text.trim())) { convertHr(block); return; }
    // 分页符
    if (/^\s*\+\+\+\s*$/.test(text)) { convertHr(block, true); return; }
    // 无序 / 有序列表
    if (/^\s*[-*+]\s/.test(text)) { convertListItem(block, "ul", text.replace(/^\s*[-*+]\s/, "")); return; }
    if (/^\s*\d+[.)]\s/.test(text)) { convertListItem(block, "ol", text.replace(/^\s*\d+[.)]\s/, "")); return; }
  }

  // 行内 Markdown：闭合定界符即转成对应行内元素（长定界符优先）
  const INLINE_RULES = [
    { d: "***", tag: ["strong", "em"] },
    { d: "___", tag: ["strong", "em"] },
    { d: "**", tag: "strong" },
    { d: "__", tag: "strong" },
    { d: "~~", tag: "s" },
    { d: "==", tag: "mark" },
    { d: "`", tag: "code" },
    { d: "^", tag: "sup" },
    { d: "~", tag: "sub" },
    { d: "*", tag: "em" },
    { d: "_", tag: "em" }
  ];
  const _SINGLE_DELIM = { "*": 1, "_": 1, "~": 1, "^": 1 };

  function replaceRangeWithEl(node, start, end, el) {
    const text = node.nodeValue;
    const parent = node.parentNode;
    const tn1 = document.createTextNode(text.slice(0, start));
    const tn2 = document.createTextNode(text.slice(end));
    parent.insertBefore(tn1, node);
    parent.insertBefore(el, node);
    parent.insertBefore(tn2, node);
    parent.removeChild(node);
    placeCaretIn(tn2, 0);
  }

  function handleInlineMarkdown() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const node = sel.anchorNode;
    if (!node || node.nodeType !== 3) return;
    if (!editor.contains(node)) return;
    let anc = node.parentNode;
    while (anc && anc !== editor) {
      if (anc.tagName === "CODE" || anc.tagName === "PRE") return;
      if (anc.classList && (anc.classList.contains("wstyle") || anc.classList.contains("ws"))) return;
      anc = anc.parentNode;
    }
    const offset = sel.anchorOffset;
    if (offset < 1) return;
    const text = node.nodeValue;
    const before = text.slice(0, offset);

    // 1) 链接 / 图片：输入闭合 ')' 即成链
    if (before.endsWith(")")) {
      const lm = before.match(/(!?)\[([^\]]*)\]\(([^)\s]*)\)$/);
      if (lm) {
        const isImg = lm[1] === "!";
        const el = document.createElement(isImg ? "img" : "a");
        if (isImg) { el.src = lm[3]; el.alt = lm[2]; }
        else { el.href = lm[3]; el.textContent = lm[2]; }
        replaceRangeWithEl(node, offset - lm[0].length, offset, el);
        return;
      }
    }

    // 2) 强调 / 删除 / 高亮 / 上下标 / 行内代码
    for (let r = 0; r < INLINE_RULES.length; r++) {
      const rule = INLINE_RULES[r], d = rule.d, len = d.length;
      if (!before.endsWith(d)) continue;
      const openIdx = before.slice(0, offset - len).lastIndexOf(d);
      if (openIdx < 0) continue;
      const innerStart = openIdx + len, innerEnd = offset - len;
      if (innerEnd <= innerStart) continue;
      // 单字符定界符：避免吃掉更长的定界符（* vs **，~ vs ~~）
      if (_SINGLE_DELIM[d]) {
        if (before[openIdx - 1] === d) continue;
        if (before[openIdx + len] === d) continue;
      }
      const inner = text.slice(innerStart, innerEnd);
      let el;
      if (Array.isArray(rule.tag)) {
        el = document.createElement(rule.tag[0]);
        const ie = document.createElement(rule.tag[1]);
        ie.textContent = inner;
        el.appendChild(ie);
      } else {
        el = document.createElement(rule.tag);
        el.textContent = inner;
      }
      replaceRangeWithEl(node, openIdx, offset, el);
      return;
    }
  }
  function onWriteInput() {
    if (suppressInput) return;
    if (mode !== "write") { refreshFocus(); return; }
    suppressInput = true;
    try {
      handleInlineMarkdown();
      handleBlockMarkdown();
    } finally {
      suppressInput = false;
    }
    refreshFocus();
    scheduleWpane(); // 并排预览 400ms 防抖跟进
  }
  editor.addEventListener("input", onWriteInput);

  // Enter：代码块空行退出 / 列表续行（任务项保持复选框）/ 引用续行或退出
  editor.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || mode !== "write") return;
    const sel = window.getSelection();
    if (!sel.rangeCount) return;

    // 代码块内：在末行空行回车 → 退出代码块
    const pre = (function () {
      let n = sel.anchorNode;
      while (n && n !== editor) { if (n.nodeType === 1 && n.tagName === "PRE") return n; n = n.parentNode; }
      return null;
    })();
    if (pre) {
      const code = pre.querySelector("code") || pre;
      const range = sel.getRangeAt(0);
      const after = range.cloneRange();
      after.selectNodeContents(code);
      after.setStart(range.endContainer, range.endOffset);
      const all = code.textContent;
      const lastLine = all.slice(all.lastIndexOf("\n") + 1);
      if (after.toString().length === 0 && lastLine.trim() === "" && all.indexOf("\n") !== -1) {
        e.preventDefault();
        const p = document.createElement("p"); p.innerHTML = "<br>";
        pre.after(p);
        if (all.replace(/\n+$/, "").trim() === "") pre.remove();
        placeCaretIn(p, 0);
        refreshFocus();
      }
      return;
    }

    const block = getActiveBlock(sel.anchorNode);
    if (!block) return;

    // 列表项：空项退出列表，非空项拆分
    if (block.tagName === "LI") {
      e.preventDefault();
      if (block.textContent.replace(/[☐☑]/g, "").trim() === "") {
        const list = block.parentNode;
        const isLast = !block.nextElementSibling;
        block.remove();
        const p = document.createElement("p"); p.innerHTML = "<br>";
        if (list.children.length === 0) list.replaceWith(p);
        else if (isLast) list.after(p);
        else list.before(p);
        placeCaretIn(p, 0);
        refreshFocus();
        return;
      }
      const range = sel.getRangeAt(0);
      const after = range.cloneRange();
      after.selectNodeContents(block);
      after.setStart(range.endContainer, range.endOffset);
      const frag = after.extractContents();
      const newLi = document.createElement("li");
      if (block.classList.contains("task")) {
        newLi.className = "task";
        newLi.setAttribute("data-checked", "false");
        const box = document.createElement("span");
        box.className = "task-box";
        box.textContent = "☐";
        newLi.appendChild(box);
        newLi.appendChild(frag);
        block.after(newLi);
        const t = box.nextSibling;
        if (t && t.nodeType === 3) placeCaretIn(t, 0); else placeCaretEnd(newLi);
      } else {
        newLi.appendChild(frag);
        block.after(newLi);
        placeCaretIn(newLi, 0);
      }
      refreshFocus();
      return;
    }

    // 引用块：空行退出引用，非空换行续引
    if (block.tagName === "BLOCKQUOTE") {
      e.preventDefault();
      let inner = sel.anchorNode;
      while (inner && inner.parentNode !== block) inner = inner.parentNode;
      const empty = inner && inner.nodeType === 1 && inner.textContent.trim() === "";
      if (empty) {
        const p = document.createElement("p"); p.innerHTML = "<br>";
        block.after(p);
        if (!block.textContent.trim() && !block.querySelector("img")) block.remove();
        placeCaretIn(p, 0);
      } else {
        const np = document.createElement("p"); np.innerHTML = "<br>";
        block.appendChild(np);
        placeCaretIn(np, 0);
      }
      refreshFocus();
      return;
    }
  });

  // 快捷键：Alt+T 打字机开关，Alt+F 循环切换聚焦（关→段落→句子）
  document.addEventListener("keydown", (e) => {
    if (mode !== "write" || previewOpen) return;
    if (e.altKey && (e.key === "t" || e.key === "T")) {
      e.preventDefault();
      typewriterOn = !typewriterOn;
      syncWritingControls();
      if (typewriterOn) typewriterScroll(currentFocusBlock());
      if (typeof showHint === "function") showHint(typewriterOn ? "打字机滚动：开" : "打字机滚动：关");
      refreshFocus();
    } else if (e.altKey && (e.key === "f" || e.key === "F")) {
      e.preventDefault();
      focusLevel = focusLevel === "off" ? "paragraph" : focusLevel === "paragraph" ? "sentence" : "off";
      if (focusLevel === "sentence" && styleCheckOn) styleCheckOn = false;
      syncWritingControls();
      refreshFocus();
      if (typeof showHint === "function") showHint("聚焦：" + ({ off: "关", paragraph: "段落", sentence: "句子" }[focusLevel]));
    } else if (e.altKey && (e.key === "p" || e.key === "P")) {
      e.preventDefault();
      setWpane(!wpaneOn);
      if (typeof showHint === "function") showHint(wpaneOn ? "并排预览：开" : "并排预览：关");
    }
  });

  favFilterBtn.addEventListener("click", () => {
    favFilter = !favFilter;
    favFilterBtn.classList.toggle("active", favFilter);
    renderGallery();
  });

  // ---------- 导出 ----------
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
    semantic = stripDeco(semantic);
    return { t, semantic };
  }

  // 导出前剥离写作模式的临时装饰（句子聚焦 .ws / 风格检查 .wstyle），保证成品纯净
  function stripDeco(html) {
    if (/class="(ws|wstyle)/.test(html) === false) return html;
    const doc = new DOMParser().parseFromString("<div>" + html + "</div>", "text/html");
    doc.querySelectorAll(".wstyle, .ws").forEach((span) => {
      const p = span.parentNode;
      while (span.firstChild) p.insertBefore(span.firstChild, span);
      p.removeChild(span);
    });
    const root = doc.body.firstChild;
    return root ? root.innerHTML : html;
  }

  async function buildExport() {
    const { t, semantic } = await buildSemantic();
    return window.applyInlineStyles(t, semantic);
  }

  // 导出动作抽成函数：工具栏与预览弹窗底部共用同一套逻辑
  async function doCopyWechat() {
    const html = await buildExport();
    const r = await window.copyRichHtml(html);
    showToast(r.ok ? "✅ 已复制富文本，去公众号 Ctrl+V 粘贴" : "❌ 复制失败：" + (r.reason || ""), !r.ok);
  }
  async function doDownloadHtml() {
    const html = await buildExport();
    window.downloadHtml(html, "公众号文章_" + Date.now());
    showHint("已下载 HTML 文件 ✓");
  }
  document.getElementById("expWechat").addEventListener("click", doCopyWechat);

  document.getElementById("expMd").addEventListener("click", async () => {
    const md = await buildMarkdown();
    const r = await window.copyText(md);
    showHint(r.ok ? "已复制 Markdown，可粘贴到 Notion / FlowUs ✓" : "复制失败", !r.ok);
  });

  document.getElementById("expMdFile").addEventListener("click", async () => {
    const md = await buildMarkdown();
    window.downloadMd(md, "公众号文章_" + Date.now());
    showHint("已下载 .md 文件 ✓");
  });

  document.getElementById("impMd").addEventListener("click", () => mdFile.click());

  mdFile.addEventListener("change", async (e) => {
    const f = e.target.files && e.target.files[0];
    mdFile.value = "";
    if (!f) return;
    const text = await f.text();
    mdSource.value = text;
    const sem = window.markdownToHtml(text);
    editor.innerHTML = sem;
    if (window.ImagePipeline) { await window.ImagePipeline.hydrateImages(editor); }
    if (mode !== "md") switchMode("md"); else renderPreview();
    if (window.ImagePipeline) { await window.ImagePipeline.hydrateImages(mdPreview); }
    await saveDraft();
    showHint("已导入 .md ✓");
  });

  async function buildMarkdown() {
    if (mode === "md") {
      const sem = await window.ImagePipeline.resolveExportImages(window.markdownToHtml(mdSource.value));
      return window.htmlToMarkdown(sem);
    }
    const html = window.ImagePipeline.normalizeImgSrc(window.Editor.getHTML());
    const sem = await window.ImagePipeline.resolveExportImages(html);
    return window.htmlToMarkdown(sem);
  }

  document.getElementById("expHtml").addEventListener("click", doDownloadHtml);

  // ---------- 手机预览 & 发布前自检 ----------
  function renderCheck(r) {
    const panel = document.getElementById("checkPanel");
    const lvl = r.errs > 0 ? "err" : (r.warns > 0 ? "warn" : "pass");
    const verdict = r.errs > 0 ? "需要修正后再发布" : (r.warns > 0 ? "可以发布，建议优化" : "全部通过，可直接发布");
    const mark = r.errs > 0 ? "!" : (r.warns > 0 ? "!" : "✓");
    const stats =
      '<div class="ck-stats">' +
      '<div class="ck-stat"><b>' + r.stats.chars + '</b><em>字数</em></div>' +
      '<div class="ck-stat"><b>' + r.stats.paras + '</b><em>段落</em></div>' +
      '<div class="ck-stat"><b>' + r.stats.images + '</b><em>图片</em></div>' +
      '<div class="ck-stat"><b>' + r.stats.headings + '</b><em>标题</em></div>' +
      '</div>';
    const list = r.items.map((it) => {
      return '<div class="ck-item ck-' + it.level + '"><span class="ck-ic"></span>' +
        '<div><div class="ck-t">' + it.title + '</div><div class="ck-d">' + it.detail + '</div></div></div>';
    }).join("");
    panel.innerHTML =
      '<div class="ck-verdict ck-' + lvl + '">' +
      '<span class="vd-ic">' + mark + '</span>' +
      '<div><div class="vd-t">' + verdict + '</div><div class="vd-d">' + r.summary + '</div></div>' +
      '</div>' + stats + list;
  }

  const previewModal = document.getElementById("previewModal");
  const phoneScreen = document.getElementById("phoneScreen");
  let previewOpen = false;
  async function openPreviewModal() {
    const t = window.getTemplate(currentTplId);
    const html = await buildExport();
    phoneScreen.innerHTML = html;
    // 状态栏/导航栏那块留白用模板底色铺满，正文与机身之间不出现白缝
    phoneScreen.style.background = (t && t.base && t.base.background) || "#ffffff";
    phoneScreen.scrollTop = 0;
    const nameEl = document.getElementById("previewTplName");
    if (nameEl && t) nameEl.textContent = t.name;
    renderCheck(window.checkWeChatCompat(html));
    previewOpen = true;
    document.body.classList.add("preview-open");
    previewModal.style.display = "flex";
  }
  function closePreviewModal() {
    if (!previewOpen) return;
    previewOpen = false;
    document.body.classList.remove("preview-open");
    previewModal.style.display = "none";
  }
  // Esc：先收预览弹窗，再收右键菜单 / 外观面板（写作模式下的 Alt 快捷键也依赖 previewOpen 做互斥）
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (previewOpen) closePreviewModal();
    hideCtx();
    toggleWriteLook(false);
  });
  document.getElementById("openPreview").addEventListener("click", openPreviewModal);
  const dockPreview = document.getElementById("dockPreview");
  if (dockPreview) dockPreview.addEventListener("click", openPreviewModal);
  // 预览弹窗底部：先收起弹窗再执行，复制结果不会被挡住
  const pvCopy = document.getElementById("pvCopy");
  if (pvCopy) pvCopy.addEventListener("click", async () => { closePreviewModal(); await doCopyWechat(); });
  const pvDownload = document.getElementById("pvDownload");
  if (pvDownload) pvDownload.addEventListener("click", async () => { closePreviewModal(); await doDownloadHtml(); });
  document.getElementById("previewClose").addEventListener("click", closePreviewModal);
  previewModal.addEventListener("click", (e) => { if (e.target === previewModal) closePreviewModal(); });

  // ---------- Markdown 语法速查（写作模式工具坞） ----------
  const mdHelp = document.getElementById("mdHelp");
  const dockMd = document.getElementById("dockMd");
  function toggleMdHelp(show) {
    if (!mdHelp) return;
    const on = show != null ? show : mdHelp.style.display === "none";
    mdHelp.style.display = on ? "block" : "none";
    if (dockMd) dockMd.classList.toggle("active", on);
  }
  if (dockMd) dockMd.addEventListener("click", () => toggleMdHelp());
  const mdHelpClose = document.getElementById("mdHelpClose");
  if (mdHelpClose) mdHelpClose.addEventListener("click", () => toggleMdHelp(false));
  document.addEventListener("click", (e) => {
    if (!mdHelp || mdHelp.style.display === "none") return;
    if (mdHelp.contains(e.target) || (dockMd && dockMd.contains(e.target))) return;
    toggleMdHelp(false);
  });

  // ---------- 复制等操作 toast（比普通 hint 更显眼、停留更久） ----------
  function showToast(text, isErr) {
    const toast = document.getElementById("toast");
    toast.textContent = text;
    toast.className = "toast" + (isErr ? " err" : "");
    toast.style.display = "block";
    // 强制 reflow 后再加 show，触发过渡
    void toast.offsetWidth;
    toast.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => { if (!toast.classList.contains("show")) toast.style.display = "none"; }, 320);
    }, 3200);
  }

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
        mdPane.style.display = "flex";
        setSegActive();
        renderPreview();
      } else if (d.mode === "write") {
        mode = "write";
        document.body.classList.add("writing");
        editor.style.background = "";
        applyLook();
        setSegActive();
        syncWritingControls();
        refreshFocus();
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

  // ---------- 全局两端对齐（默认开） ----------
  // 开：所有模板的正文/列表/引用一律两端对齐（作者显式居中/右对齐的仍保留）；
  // 关：回到各模板自己的设计（如 Helvetica 齐左不齐右）。偏好独立存 key justifyAll。
  const justifyBtn = document.getElementById("justifyBtn");
  const dockJustify = document.getElementById("dockJustify");
  const JUSTIFY_TIP_ON = "两端对齐：正文 / 列表 / 引用左右齐平（所有模板统一）。点按可关闭，改回各模板自身设计";
  const JUSTIFY_TIP_OFF = "当前为「按模板自身设计」对齐（如 Helvetica 齐左不齐右）。点按开启全局两端对齐";
  function syncJustifyUI() {
    const on = window.getForceJustify ? window.getForceJustify() : true;
    if (justifyBtn) {
      justifyBtn.classList.toggle("on", on);
      justifyBtn.textContent = on ? "≣ 两端对齐" : "≣ 按模板对齐";
      justifyBtn.title = on ? JUSTIFY_TIP_ON : JUSTIFY_TIP_OFF;
      justifyBtn.setAttribute("aria-pressed", on ? "true" : "false");
    }
    if (dockJustify) {
      dockJustify.classList.toggle("active", on);
      dockJustify.textContent = on ? "≣ 两端" : "≣ 齐左";
      dockJustify.title = on ? JUSTIFY_TIP_ON : JUSTIFY_TIP_OFF;
    }
  }
  function applyJustify(on, persist) {
    if (window.setForceJustify) window.setForceJustify(on);
    // 只重算「模板预览样式表」——对齐就写在这张表里。
    // 刻意不调 applyPreview()：它会顺手写 editor 的行内底色，而写作模式的主题底色
    // 必须由 CSS 变量（--w-bg）控制，写死行内底色会把夜/纸主题冲掉。
    window.Editor.applyTemplatePreview(window.getTemplate(currentTplId));
    if (mode === "md") renderPreview();                 // Markdown 实时预览
    if (typeof scheduleWpane === "function") scheduleWpane(); // 并排实时预览（走导出引擎）
    syncJustifyUI();
    if (persist && window.storeSet) window.storeSet("justifyAll", !!on);
  }
  async function loadJustify() {
    if (!window.storeGet) { syncJustifyUI(); return; }
    const v = await window.storeGet("justifyAll");
    if (v === false) applyJustify(false, false);
    else syncJustifyUI();
  }
  [justifyBtn, dockJustify].forEach((b) => {
    if (!b) return;
    b.addEventListener("click", () => {
      const on = !(window.getForceJustify ? window.getForceJustify() : true);
      applyJustify(on, true);
      showHint(on ? "两端对齐已开启：所有模板正文左右齐平 ✓" : "已改为按模板自身设计对齐（Helvetica 等回到齐左）");
    });
  });

  // ---------- 初始化 ----------
  window.Editor.init("#editor");
  renderGallery();
  applyPreview();
  loadDraft().then(async () => {
    applyPreview();
    if (window.Highlighter) window.Highlighter.highlightContainers(editor, window.__currentDark);
    renderPreview();
    toggleEmptyHint();
    // 写作外观 + 并排预览的偏好（独立于草稿存储，空文章也记住）
    await loadJustify();
    await loadLook();
  });
})();
