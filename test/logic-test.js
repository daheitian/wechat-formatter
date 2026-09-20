const { JSDOM } = require("C:/Users/ga/.workbuddy/binaries/node/workspace/node_modules/jsdom");
const fs = require("fs");
const path = require("path");

const dom = new JSDOM("<!doctype html><html><body></body></html>");
global.window = dom.window;
global.document = dom.window.document;
global.DOMParser = dom.window.DOMParser;
global.navigator = dom.window.navigator;

function load(f) {
  const code = fs.readFileSync(path.join(__dirname, "..", f), "utf8");
  (0, eval)(code);
}

load("js/templates.js");
load("js/exporters.js");
load("js/images.js");
load("js/highlight.js");
load("js/editor.js");
load("js/markdown.js");

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log("✓", name); }
  else { fail++; console.log("✗ FAIL:", name); }
}

// 1) 14 套模板都能生成内联样式 HTML
check("模板数量为 9", window.TEMPLATES.length === 9);
window.TEMPLATES.forEach((t) => {
  const html = window.applyInlineStyles(t, "<h1>t</h1><p>正文</p><table><tr><th>a</th></tr><tr><td>b</td></tr></table>");
  check("模板 " + t.id + " 内联导出含 style", /style=/.test(html));
  check("模板 " + t.id + " 含系列字段", !!t.series);
});

// 2) applyInlineStyles 合并逻辑：多图网格的内联 width:100% 不被模板覆盖
const gridHtml =
  '<table style="border-collapse:collapse;width:100%;margin:0 0 18px;" data-grid="1">' +
  '<tr><td style="padding:2px;border:none;width:50%;vertical-align:top;">' +
  '<img data-imgid="x" src="img://x" style="width:100%;display:block;margin:0;border-radius:6px;"/></td></tr></table>';
const gridInline = window.applyInlineStyles(window.getTemplate("typora-github"), gridHtml);
check("网格 img 保留 width:100%", /width:100%/.test(gridInline));
check("网格 img 覆盖 margin:0（无 18px auto）", !/margin:18px auto/.test(gridInline));
check("网格 td 保留 border:none", /border:none/.test(gridInline));

// 3) Markdown -> HTML 基础
const md = "# 主标题\n\n这是 **加粗** 与 *斜体* 以及 `行内代码` 的正文。\n\n## 二级标题\n\n> 一句引用\n\n- 项目一\n- 项目二\n\n1. 第一\n2. 第二\n\n```\nconst a = 1;\n```\n\n---\n\n![图](https://x.com/a.png)\n\n| 名称 | 说明 |\n|------|------|\n| A    | 苹果 |\n| B    | 香蕉 |\n";
const sem = window.markdownToHtml(md);
check("MD→H1", sem.includes("<h1>主标题</h1>"));
check("MD→strong", sem.includes("<strong>加粗</strong>"));
check("MD→em", sem.includes("<em>斜体</em>"));
check("MD→code", sem.includes("<code>行内代码</code>"));
check("MD→h2", sem.includes("<h2>二级标题</h2>"));
check("MD→blockquote", sem.includes("<blockquote>一句引用</blockquote>"));
check("MD→ul", sem.includes("<ul><li>项目一</li><li>项目二</li></ul>"));
check("MD→ol", sem.includes("<ol><li>第一</li><li>第二</li></ol>"));
check("MD→pre/code", sem.includes("<pre><code>") && sem.includes("const a = 1;"));
check("MD→hr", sem.includes("<hr/>"));
check("MD→img", sem.includes('<img src="https://x.com/a.png" alt="图"/>'));
check("MD→table", sem.includes("<table>") && sem.includes("<th>名称</th>") && sem.includes("<td>苹果</td>"));

// 4) Markdown 套用主题后内联导出
const t = window.getTemplate("typora-github");
const inline = window.applyInlineStyles(t, sem);
check("MD 内联导出含 style", /style=/.test(inline));
check("MD 内联导出含 table 样式", inline.includes("<table") && inline.includes("border-collapse"));

// 5) 富文本 HTML -> Markdown 反向
const back = window.htmlToMarkdown(sem);
check("HTML→MD 含 # 主标题", back.includes("# 主标题"));
check("HTML→MD 含表格行", back.includes("| 名称 | 说明 |"));

// 6) 图片管线：normalizeImgSrc 把 blob: 归一化成 img://id
const norm = window.ImagePipeline.normalizeImgSrc('<img data-imgid="abc" src="blob:https://x/123" alt=""/>');
check("normalizeImgSrc → img://id", norm === '<img data-imgid="abc" src="img://abc" alt=""/>');
const normNoId = window.ImagePipeline.normalizeImgSrc('<img src="blob:https://x/123" alt=""/>');
check("normalizeImgSrc 无 id 时原样保留", normNoId.includes('src="blob:'));
check("genId 格式", /^img_/.test(window.ImagePipeline.genId()));

// 7) 代码高亮：输出内联 color span；明暗两套配色
const hlDark = window.Highlighter.highlight('const x = "hi"; // note', true);
check("高亮含 span", hlDark.includes("<span"));
check("高亮含关键字 const", /color:/.test(hlDark) && hlDark.includes("const"));
const hlLight = window.Highlighter.highlight('def foo():\n  return 1', false);
check("高亮含函数名 span", hlLight.includes("<span") && hlLight.includes("foo"));
check("高亮保留原始文本", hlLight.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() === "def foo(): return 1");
// 高亮器不应破坏可还原性（去掉 span 后等于原文）
const stripped = hlLight.replace(/<span[^>]*>/g, "").replace(/<\/span>/g, "");
check("高亮可还原纯文本", stripped.replace(/\s+/g, " ").trim() === 'def foo(): return 1'.replace(/\s+/g, " ").trim());

// 8) 智能粘贴净化：把带 style 的 Word 式 HTML 转成语义 HTML
const dirty = '<div style="color:red"><strong>标题</strong><p class="x">正文 <span style="font-weight:bold">加粗</span></p><ul><li>项</li></ul></div>';
const clean = window.sanitizeHtml(dirty);
check("净化去掉 style 属性", !/style=/.test(clean));
check("净化保留 strong", clean.includes("<strong>标题</strong>"));
check("净化保留 ul/li", clean.includes("<ul><li>项</li></ul>"));
check("净化保留段落文字", clean.includes("正文") && clean.includes("<strong>加粗</strong>"));

// 9) isDarkCode：深色代码块模板判为真，浅色为假
check("bear-dark 代码块为深色", window.isDarkCode(window.getTemplate("bear-dark")) === true);
check("typora-gothic 代码块为深色", window.isDarkCode(window.getTemplate("typora-gothic")) === true);
check("bear-warm 代码块为深色", window.isDarkCode(window.getTemplate("bear-warm")) === true);
check("typora-github 代码块为浅色", window.isDarkCode(window.getTemplate("typora-github")) === false);
check("typora-newsprint 代码块为浅色", window.isDarkCode(window.getTemplate("typora-newsprint")) === false);

// 10) 高亮容器：stripHighlight 还原后再 highlight 一致
const codeDoc = new DOMParser().parseFromString("<div><pre><code>const a=1;</code></pre></div>", "text/html");
window.Highlighter.highlightContainers(codeDoc, true);
check("highlightContainers 给 pre/code 上色", codeDoc.querySelector("pre code").innerHTML.includes("<span"));
window.Highlighter.stripHighlight(codeDoc);
check("stripHighlight 还原为纯文本", codeDoc.querySelector("pre code").textContent === "const a=1;");

console.log("\n结果：通过 " + pass + "，失败 " + fail);
process.exit(fail ? 1 : 0);
