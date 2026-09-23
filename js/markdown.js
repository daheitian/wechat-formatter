// markdown.js
// 轻量 Markdown -> 语义化 HTML 解析器（无依赖，适合打包进扩展）。
// 支持：标题、粗体/斜体、行内代码、链接、图片、引用、有序/无序列表、
//       代码围栏、分割线、段落，以及 GFM 表格。
// 输出为语义化 HTML，交给 applyInlineStyles / templatePreviewCss 套用主题。

function _esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function _inline(text) {
  // text 已经过 HTML 转义
  var codes = [];
  // 1) 保护行内代码，避免其中的 * _ 被后续规则误伤
  text = text.replace(/`([^`]+)`/g, function (m, c) {
    codes.push(c);
    return "@@" + (codes.length - 1) + "@@";
  });
  // 2) 图片
  text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, function (m, alt, url) {
    return '<img src="' + url + '" alt="' + alt + '"/>';
  });
  // 3) 链接
  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, t, url) {
    return '<a href="' + url + '">' + t + "</a>";
  });
  // 4) 粗斜体（三星号 / 三下划线）—— 必须先于粗体 / 斜体
  text = text.replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>")
             .replace(/___([^_]+)___/g, "<strong><em>$1</em></strong>");
  // 5) 删除线
  text = text.replace(/~~([^~]+)~~/g, "<s>$1</s>");
  // 6) 高亮
  text = text.replace(/==([^=]+)==/g, "<mark>$1</mark>");
  // 7) 粗体
  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/__([^_]+)__/g, "<strong>$1</strong>");
  // 8) 斜体
  text = text.replace(/\*([^*]+)\*/g, "<em>$1</em>").replace(/(^|[^_])_([^_]+)_(?!_)/g, "$1<em>$2</em>");
  // 9) 上标 / 下标（单 ~ 须在 ~~ 之后，避免误吃删除线）
  text = text.replace(/\^([^\s^]+)\^/g, "<sup>$1</sup>");
  text = text.replace(/~([^\s~]+)~/g, "<sub>$1</sub>");
  // 10) 还原行内代码
  text = text.replace(/@@(\d+)@@/g, function (m, i) {
    return "<code>" + codes[+i] + "</code>";
  });
  return text;
}

function _splitRow(line) {
  var s = line.trim();
  if (s.charAt(0) === "|") s = s.slice(1);
  if (s.charAt(s.length - 1) === "|") s = s.slice(0, -1);
  return s.split("|").map(function (c) { return c.trim(); });
}

// 分割线：--- / *** / ___ ，允许中间夹空格（* * *）
function _isHr(s) {
  return /^\s*(?:-\s*){3,}$/.test(s) || /^\s*(?:\*\s*){3,}$/.test(s) || /^\s*(?:_\s*){3,}$/.test(s);
}

// 任务列表：- [ ] / - [x] / 1. [ ] …
var _TASK_RE = /^\s*([-*+]|\d+\.)\s+\[([ xX])\]\s+(.*)$/;

function markdownToHtml(md) {
  var lines = (md || "").replace(/\r\n?/g, "\n").split("\n");
  var html = "";
  var i = 0;

  function isTableSep(s) {
    return /^\s*\|?[\s:|\-]+\|?\s*$/.test(s) && s.indexOf("-") !== -1;
  }

  while (i < lines.length) {
    var line = lines[i];

    // 代码围栏
    var fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      i++;
      var buf = [];
      while (i < lines.length && !/^```\s*$/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++;
      var langAttr = fence[1] ? ' class="language-' + fence[1] + '"' : "";
      html += "<pre><code" + langAttr + ">" + _esc(buf.join("\n")) + "</code></pre>";
      continue;
    }

    // 空行
    if (/^\s*$/.test(line)) { i++; continue; }

    // 标题
    var h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      var lvl = h[1].length;
      html += "<h" + lvl + ">" + _inline(_esc(h[2].trim())) + "</h" + lvl + ">";
      i++; continue;
    }

    // 分页符
    if (/^\s*\+\+\+\s*$/.test(line)) { html += '<hr class="page-break"/>'; i++; continue; }

    // 分割线（--- / *** / ___ / * * * …）
    if (_isHr(line)) { html += "<hr/>"; i++; continue; }

    // 引用
    if (/^>\s?/.test(line)) {
      var q = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { q.push(lines[i].replace(/^>\s?/, "")); i++; }
      html += "<blockquote>" + _inline(_esc(q.join(" "))) + "</blockquote>";
      continue;
    }

    // 任务列表
    if (_TASK_RE.test(line)) {
      var tasks = [];
      while (i < lines.length) {
        var tm = lines[i].match(_TASK_RE);
        if (!tm) break;
        tasks.push({ checked: tm[2].toLowerCase() === "x", text: tm[3] });
        i++;
      }
      html += '<ul class="task-list">' + tasks.map(function (it) {
        return '<li class="task" data-checked="' + it.checked + '">' +
          '<span class="task-box">' + (it.checked ? "☑" : "☐") + "</span>" +
          _inline(_esc(it.text)) + "</li>";
      }).join("") + "</ul>";
      continue;
    }

    // 表格 (GFM)
    if (line.indexOf("|") !== -1 && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      var header = _splitRow(line);
      var aligns = _splitRow(lines[i + 1]).map(function (c) {
        var l = c.charAt(0) === ":";
        var r = c.charAt(c.length - 1) === ":";
        return l && r ? "center" : r ? "right" : l ? "left" : "";
      });
      i += 2;
      var rows = [];
      while (i < lines.length && lines[i].indexOf("|") !== -1 && !/^\s*$/.test(lines[i])) {
        rows.push(_splitRow(lines[i])); i++;
      }
      var t = "<table><thead><tr>";
      header.forEach(function (c, idx) {
        t += "<th>" + _inline(_esc(c)) + "</th>";
      });
      t += "</tr></thead><tbody>";
      rows.forEach(function (r) {
        t += "<tr>";
        r.forEach(function (c) { t += "<td>" + _inline(_esc(c)) + "</td>"; });
        t += "</tr>";
      });
      t += "</tbody></table>";
      html += t;
      continue;
    }

    // 列表
    if (/^\s*([\-*+])\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      var ordered = /^\s*\d+\.\s+/.test(line);
      var re = ordered ? /^\s*\d+\.\s+(.*)$/ : /^\s*[\-*+]\s+(.*)$/;
      var items = [];
      while (i < lines.length && (ordered ? /^\s*\d+\.\s+/.test(lines[i]) : /^\s*[\-*+]\s+/.test(lines[i]))) {
        items.push(lines[i].match(re)[1]); i++;
      }
      var tag = ordered ? "ol" : "ul";
      html += "<" + tag + ">" + items.map(function (it) { return "<li>" + _inline(_esc(it)) + "</li>"; }).join("") + "</" + tag + ">";
      continue;
    }

    // 段落：聚合直到下一个块开始
    var para = [];
    while (
      i < lines.length &&
      !/^\s*$/.test(lines[i]) &&
      !/^(#{1,6})\s/.test(lines[i]) &&
      !/^>\s?/.test(lines[i]) &&
      !/^```/.test(lines[i]) &&
      !/^\s*\+\+\+\s*$/.test(lines[i]) &&
      !_isHr(lines[i]) &&
      !/^\s*([\-*+])\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !(lines[i].indexOf("|") !== -1 && i + 1 < lines.length && isTableSep(lines[i + 1]))
    ) {
      para.push(lines[i]); i++;
    }
    if (para.length) html += "<p>" + para.map(function (l) { return _inline(_esc(l)); }).join("<br/>") + "</p>";
  }

  return html;
}

if (typeof window !== "undefined") window.markdownToHtml = markdownToHtml;
