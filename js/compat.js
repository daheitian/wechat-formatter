// compat.js — 发布前自检：按微信公众号内容校验口径扫描导出 HTML
// 目的：把"粘到公众号后台才看到结构风险告警"前置到工具内，绿勾/红项一目了然。
// 输入：applyInlineStyles 产出的「全内联样式」HTML 字符串（即实际会进入微信的内容）。
(function () {
  function parseHtml(html) {
    const doc = new DOMParser().parseFromString("<div>" + html + "</div>", "text/html");
    return doc.body.firstChild;
  }

  function numPx(decl, prop) {
    const m = decl.match(new RegExp(prop + "\\s*:\\s*([\\d.]+)px", "i"));
    return m ? parseFloat(m[1]) : null;
  }

  function cssOf(el) {
    return (el.getAttribute("style") || "").toLowerCase();
  }

  // 返回 { summary, errs, warns, items:[{level,title,detail,count}], stats:{chars,paras,images,headings} }
  function checkWeChatCompat(html) {
    const root = parseHtml(html);
    if (!root) {
      return { summary: "内容为空，无可检查项。", errs: 0, warns: 0, items: [], stats: { chars: 0, paras: 0, images: 0, headings: 0 } };
    }

    const stats = {
      chars: (root.textContent || "").replace(/\s/g, "").length,
      paras: root.querySelectorAll("p").length,
      images: root.querySelectorAll("img").length,
      headings: root.querySelectorAll("h1,h2,h3,h4,h5,h6").length
    };

    const blocks = root.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li,blockquote,pre,td,th,div");
    const items = [];

    // 1) 行高安全（微信实测重叠告警的根源：行高 < 字号）
    let lhErr = 0, lhWarn = 0;
    blocks.forEach((el) => {
      const decl = cssOf(el);
      const fs = numPx(decl, "font-size");
      const lh = numPx(decl, "line-height");
      const hasText = (el.textContent || "").trim().length > 0;
      if (hasText && fs && lh) {
        if (lh < fs) lhErr++;
        else if (lh < fs * 1.1) lhWarn++;
      }
    });
    if (lhErr > 0) {
      items.push({ level: "error", title: "行高小于字号", detail: lhErr + " 处块级元素的行高小于字号，手机端多行文本会重叠（实测）。", count: lhErr });
    } else if (lhWarn > 0) {
      items.push({ level: "warn", title: "行高偏紧", detail: lhWarn + " 处行高小于字号的 1.4 倍，长文阅读略挤。", count: lhWarn });
    } else {
      items.push({ level: "pass", title: "行高安全", detail: "所有文本块行高均 ≥ 字号，手机端不会重叠。", count: 0 });
    }

    // 2) 字号过小（手机端可读性）
    let fsErr = 0, fsWarn = 0;
    blocks.forEach((el) => {
      const decl = cssOf(el);
      const fs = numPx(decl, "font-size");
      const hasText = (el.textContent || "").trim().length > 0;
      if (hasText && fs) {
        if (fs < 12) fsErr++;
        else if (fs < 14) fsWarn++;
      }
    });
    if (fsErr > 0) {
      items.push({ level: "error", title: "字号过小", detail: fsErr + " 处字号 < 12px，手机端几乎看不清。", count: fsErr });
    } else if (fsWarn > 0) {
      items.push({ level: "warn", title: "字号偏小", detail: fsWarn + " 处字号 12–13px，建议 ≥ 14px 更护眼。", count: fsWarn });
    }

    // 3) 嵌套表格（微信不支持）
    const nested = root.querySelectorAll("table table");
    if (nested.length > 0) {
      items.push({ level: "error", title: "嵌套表格", detail: nested.length + " 个嵌套表格，微信编辑器不支持，会错位。", count: nested.length });
    } else {
      items.push({ level: "pass", title: "表格结构", detail: "无嵌套表格，微信可正常渲染。", count: 0 });
    }

    // 4) 图片缺宽度（易拉伸变形）
    let noW = 0;
    root.querySelectorAll("img").forEach((im) => {
      const decl = cssOf(im);
      const wAttr = im.getAttribute("width");
      const wStyle = decl.match(/width\s*:\s*[\d.]+%/) || decl.match(/width\s*:\s*[\d.]+px/);
      if (!wAttr && !wStyle) noW++;
    });
    if (noW > 0) {
      items.push({ level: "warn", title: "图片缺宽度", detail: noW + " 张图片未设宽度，微信可能拉伸变形。", count: noW });
    } else if (stats.images > 0) {
      items.push({ level: "pass", title: "图片宽度", detail: stats.images + " 张图片均带宽度，不会变形。", count: 0 });
    }

    // 5) 代码块超长行（手机端横向滑动）
    let overlong = 0;
    root.querySelectorAll("pre").forEach((pre) => {
      const lines = (pre.textContent || "").split("\n");
      if (lines.some((l) => l.replace(/[^\x00-\xff]/g, "aa").length > 46)) overlong++;
    });
    if (overlong > 0) {
      items.push({ level: "warn", title: "代码行过长", detail: overlong + " 个代码块含超长行，手机端需横向滑动。", count: overlong });
    } else if (root.querySelectorAll("pre").length > 0) {
      items.push({ level: "pass", title: "代码块", detail: root.querySelectorAll("pre").length + " 个代码块行宽正常。", count: 0 });
    }

    // 6) 空段落（撑出多余空白）
    let empty = 0;
    root.querySelectorAll("p").forEach((p) => {
      const h = (p.innerHTML || "").replace(/<br\s*\/?>/gi, "").replace(/&nbsp;/gi, "").trim();
      if (h === "" || h === "<br>") empty++;
    });
    if (empty > 0) {
      items.push({ level: "warn", title: "空段落", detail: empty + " 个空段落会撑出多余空白。", count: empty });
    }

    const errs = items.filter((i) => i.level === "error").length;
    const warns = items.filter((i) => i.level === "warn").length;
    let summary;
    if (errs > 0) summary = "发现 " + errs + " 处必须修复的问题，建议修复后再发布。";
    else if (warns > 0) summary = "通过基础校验，" + warns + " 处建议优化（不影响发布）。";
    else summary = "完美，全部通过，可放心发布 ✓";

    return { summary: summary, errs: errs, warns: warns, items: items, stats: stats };
  }

  if (typeof window !== "undefined") window.checkWeChatCompat = checkWeChatCompat;
})();
