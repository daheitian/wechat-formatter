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
load("js/compat.js");

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log("✓", name); }
  else { fail++; console.log("✗ FAIL:", name); }
}

// 1) 全部模板都能生成内联样式 HTML
check("模板数量为 18", window.TEMPLATES.length === 18);
window.TEMPLATES.forEach((t) => {
  const html = window.applyInlineStyles(t, "<h1>t</h1><p>正文</p><table><tr><th>a</th></tr><tr><td>b</td></tr></table>");
  check("模板 " + t.id + " 内联导出含 style", /style=/.test(html));
  check("模板 " + t.id + " 含系列字段", !!t.series);
});

// 1.5) 行高安全化：粘贴带来的 px / em / % 行高必须被下限兜底，杜绝微信"行高<字号"告警
(function () {
  const se = window.getTemplate("sees");
  function lhOf(html, sel) {
    const m = html.match(new RegExp(sel + "[^>]*style=\"([^\"]*)\""));
    const s = m ? m[1] : "";
    const lh = (s.match(/line-height:\s*([\d.]+)px/) || [])[1];
    const fs = (s.match(/font-size:\s*([\d.]+)px/) || [])[1];
    return { lh: lh ? parseFloat(lh) : null, fs: fs ? parseFloat(fs) : null };
  }
  const p1 = window.applyInlineStyles(se, '<p style="font-size:17px;line-height:14px">多行正文测试行一 行二 行三</p>');
  const r1 = lhOf(p1, "<p");
  check("px 行高被下限兜底(≥字号)", r1.lh !== null && r1.lh >= r1.fs);
  const p2 = window.applyInlineStyles(se, '<p style="font-size:16px;line-height:1em">多行正文测试行一 行二 行三</p>');
  const r2 = lhOf(p2, "<p");
  check("em 行高被下限兜底(≥字号)", r2.lh !== null && r2.lh >= r2.fs);
  const p3 = window.applyInlineStyles(se, '<p style="font-size:16px;line-height:90%">多行正文测试行一 行二 行三</p>');
  const r3 = lhOf(p3, "<p");
  check("% 行高被下限兜底(≥字号)", r3.lh !== null && r3.lh >= r3.fs);
  // 无文本的图片拼接容器：line-height:0 必须保持原值，不被抬升（保护无缝拼图）
  const d = window.applyInlineStyles(se, '<div style="line-height:0"><img src="x" style="width:100%"/></div>');
  check("无文本容器 line-height:0 保留(未被抬升)", /line-height:0(px)?/.test(d));
  // 标题行高下限 1.2×、正文 1.5×：1.2× 不应被误报偏紧
  const h = window.applyInlineStyles(se, "<h2>小节</h2><p>正文段落足够长以观察行距表现的一行文字</p>");
  const rh = lhOf(h, "<h2");
  const rp = lhOf(h, "<p");
  check("h2 行高下限 1.2×(≥字号)", rh.lh !== null && rh.lh >= rh.fs);
  check("p 行高下限 1.5×(≥字号)", rp.lh !== null && rp.lh >= rp.fs);
})();

// 1.8) 字体系列（iA Presenter Typographic 主题）：两种排版哲学必须真的落在导出结果里
(function () {
  const helv = window.getTemplate("ia-helvetica");
  const garm = window.getTemplate("ia-garamond");
  check("字体系列含 Helvetica / Garamond", !!helv && !!garm && helv.series === "字体系列" && garm.series === "字体系列");

  const hHtml = window.applyInlineStyles(helv, "<h1>大标题</h1><h2>小节</h2><h3>标签</h3><p>正文段落足够长以观察对齐方式的一行文字</p><hr/>");
  const hP = (hHtml.match(new RegExp("<p[^>]*style=\"([^\"]*)\"")) || [])[1] || "";
  // 默认全局两端对齐：连模板写了 text-align:left 也要被拉平
  check("默认全局两端对齐（Helvetica 的齐左被覆盖为 justify）", /text-align:justify/.test(hP) && !/text-align:left/.test(hP));
  // 关掉全局开关 → 回到模板自己的设计（Helvetica 齐左不齐右）
  window.setForceJustify(false);
  const hOff = (window.applyInlineStyles(helv, "<p>正文段落足够长以观察对齐方式的一行文字</p>").match(new RegExp("<p[^>]*style=\"([^\"]*)\"")) || [])[1] || "";
  check("关闭开关后 Helvetica 回到齐左不齐右", /text-align:left/.test(hOff) && !/justify/.test(hOff));
  // 未写 text-align 的模板，关闭开关后仍保持 justify（旧行为不变）
  const gOff = (window.applyInlineStyles(garm, "<p>正文段落足够长以观察对齐方式的一行文字</p>").match(new RegExp("<p[^>]*style=\"([^\"]*)\"")) || [])[1] || "";
  check("关闭开关后 Garamond 仍两端对齐（模板未指定对齐）", /text-align:justify/.test(gOff));
  window.setForceJustify(true);
  // 作者显式居中 / 右对齐必须被尊重，绝不拉平
  const cHtml = window.applyInlineStyles(helv, '<p style="text-align:center">居中的图注</p><p style="text-align:right">右对齐的落款</p>');
  const cAligns = (cHtml.match(/text-align:\s*[a-z]+/gi) || []).join(",");
  check("显式居中/右对齐不被拉平", /center/.test(cAligns) && /right/.test(cAligns) && !/justify/.test(cAligns));
  // 编辑器预览必须与导出结果一致（否则所见非所得）
  const hCss = window.templatePreviewCss(helv);
  check("编辑器预览与导出一致（.editor p 也是 justify）", /\.editor p\{[^}]*text-align:justify/.test(hCss) && !/\.editor p\{[^}]*text-align:left/.test(hCss));
  window.setForceJustify(false);
  check("关闭开关后编辑器预览同步回到齐左", /\.editor p\{[^}]*text-align:left/.test(window.templatePreviewCss(helv)));
  window.setForceJustify(true);
  check("NYT 居中引文在编辑器预览里不被拉平", /\.editor blockquote\{[^}]*text-align:center/.test(window.templatePreviewCss(window.getTemplate("press-nyt"))));
  check("Helvetica h2 带 2px 规则线", /border-top:2px solid #111111/.test(helv.styles.h2));
  check("Helvetica h3 为拉字距大写标签", /text-transform:uppercase/.test(helv.styles.h3) && /letter-spacing:1\.6px/.test(helv.styles.h3));
  check("Helvetica 零圆角（无 border-radius 圆角值）", !/border-radius:[1-9]/.test(JSON.stringify(helv.styles)));
  check("Helvetica 分割线为 2px 通栏规则线", /border-top:2px solid #111111/.test(helv.styles.hr));

  const gHtml = window.applyInlineStyles(garm, "<h1>大标题</h1><h2>小节</h2><p>正文段落足够长以观察对齐方式的一行文字</p>");
  const gH1 = (gHtml.match(new RegExp("<h1[^>]*style=\"([^\"]*)\"")) || [])[1] || "";
  const gH2 = (gHtml.match(new RegExp("<h2[^>]*style=\"([^\"]*)\"")) || [])[1] || "";
  const gP = (gHtml.match(new RegExp("<p[^>]*style=\"([^\"]*)\"")) || [])[1] || "";
  check("Garamond h1 居中", /text-align:center/.test(gH1));
  check("Garamond h2 居中 + 上下发丝线", /text-align:center/.test(gH2) && /border-top:1px solid/.test(gH2) && /border-bottom:1px solid/.test(gH2));
  check("Garamond 正文两端对齐（引擎注入 justify）", /text-align:justify/.test(gP));
  check("Garamond 纸张为象牙白、正文为衬线", garm.base.background === "#FBF8F1" && /Garamond/.test(garm.base.fontFamily));
  check("Garamond 分割线收成居中短线条", /width:72px/.test(garm.styles.hr) && /margin:36px auto/.test(garm.styles.hr));
})();

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

// 3.5) 扩展 Markdown 语法（对齐 iA Writer）
const md2 =
  "***粗斜*** 与 ~~删除~~ 与 ==高亮== 与 ^上标^ 与 ~下标~ 与 __粗__ 与 _斜_\n\n" +
  "#### 四级\n\n- [ ] 未完成\n- [x] 已完成\n\n```js\nconst a = 1;\n```\n\n* * *\n\n+++\n";
const sem2 = window.markdownToHtml(md2);
check("MD→粗斜体", sem2.includes("<strong><em>粗斜</em></strong>"));
check("MD→删除线", sem2.includes("<s>删除</s>"));
check("MD→高亮", sem2.includes("<mark>高亮</mark>"));
check("MD→上标", sem2.includes("<sup>上标</sup>"));
check("MD→下标", sem2.includes("<sub>下标</sub>"));
check("MD→下划线粗体", sem2.includes("<strong>粗</strong>"));
check("MD→下划线斜体", sem2.includes("<em>斜</em>"));
check("MD→h4", sem2.includes("<h4>四级</h4>"));
check("MD→任务列表", sem2.includes('class="task-list"') && sem2.includes("☐</span>未完成") && sem2.includes("☑</span>已完成"));
check("MD→任务项勾选态", sem2.includes('data-checked="true"') && sem2.includes('data-checked="false"'));
check("MD→带语言代码块", /<pre><code class="language-js">/.test(sem2));
check("MD→带空格分割线", sem2.includes("<hr/>"));
check("MD→分页符", sem2.includes('<hr class="page-break"/>'));

// 4) Markdown 套用主题后内联导出
const t = window.getTemplate("typora-github");
const inline = window.applyInlineStyles(t, sem);
check("MD 内联导出含 style", /style=/.test(inline));
check("MD 内联导出含 table 样式", inline.includes("<table") && inline.includes("border-collapse"));

// 5) 富文本 HTML -> Markdown 反向
const back = window.htmlToMarkdown(sem);
check("HTML→MD 含 # 主标题", back.includes("# 主标题"));
check("HTML→MD 含表格行", back.includes("| 名称 | 说明 |"));

// 5.5) 扩展语法反向往返
const sem3 = window.markdownToHtml("==高亮== 与 ~~删除~~ 与 ^上标^ 与 ~下标~ 与 [链接](https://x.com) 与 ![图](https://x.com/a.png)");
const back3 = window.htmlToMarkdown(sem3);
check("HTML→MD 高亮 ==…==", back3.includes("==高亮=="));
check("HTML→MD 删除线 ~~…~~", back3.includes("~~删除~~"));
check("HTML→MD 上标 ^…^", back3.includes("^上标^"));
check("HTML→MD 下标 ~…~", back3.includes("~下标~"));
check("HTML→MD 链接", back3.includes("[链接](https://x.com)"));
check("HTML→MD 图片", back3.includes("![图](https://x.com/a.png)"));
const back4 = window.htmlToMarkdown(window.markdownToHtml("- [ ] 待办甲\n- [x] 待办乙"));
check("HTML→MD 任务列表 [ ]", back4.includes("- [ ] 待办甲"));
check("HTML→MD 任务列表 [x]", back4.includes("- [x] 待办乙"));
const back5 = window.htmlToMarkdown(window.markdownToHtml("```js\nconst a = 1;\n```"));
check("HTML→MD 代码块保留语言", back5.includes("```js"));
const back6 = window.htmlToMarkdown(window.markdownToHtml("+++"));
check("HTML→MD 分页符 +++", back6.includes("+++"));

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

// 11) autoStructure：纯文本 → 语义结构（无 HTML 时的自动排版）
const as = window.autoStructure;
check("autoStructure # 标题 → h1", as("# 一级标题\n正文一段").includes("<h1>一级标题</h1>") && as("# 一级标题\n正文一段").includes("<p>正文一段</p>"));
check("autoStructure ## 标题 → h2", as("## 二级标题").includes("<h2>二级标题</h2>"));
check("autoStructure - 列表 → ul/li", as("- 苹果\n- 香蕉").includes("<ul>") && as("- 苹果\n- 香蕉").includes("<li>苹果</li>"));
check("autoStructure 1. 列表 → ol/li", as("1. 第一\n2. 第二").includes("<ol>") && as("1. 第一\n2. 第二").includes("<li>第一</li>"));
check("autoStructure > 引用 → blockquote", as("> 这是一句引用").includes("<blockquote>") && as("> 这是一句引用").includes("这是一句引用"));
check("autoStructure ``` 代码块 → pre/code", as("```\nconst x=1;\n```").includes("<pre><code>") && as("```\nconst x=1;\n```").includes("const x=1;"));
check("autoStructure 纯散文不误判", (() => { const r = as("今天天气不错，我们去散步。\n\n晚饭吃了面条，很满足。"); return (r.match(/<h/g) || []).length === 0 && (r.match(/<p>/g) || []).length === 2; })());

// 12) smartStructure：无标记中文散文的启发式排版
const ss = window.smartStructure;
const prose = "排版的重要性\n\n好的排版能让阅读更轻松。很多人忽视了这一点，导致文章读起来很累。\n\n小结\n\n以上就是要讲的内容，希望对大家有帮助。";
const sp = ss(prose);
check("smart 孤立短行 → 标题（2 个）", (sp.match(/<h[12]>/g) || []).length === 2);
check("smart 正文段保留 p（2 个）", (sp.match(/<p>/g) || []).length === 2);
check("smart 首个标题为 h1", sp.indexOf("<h1>") === 0);
check("smart 第二个标题为 h2", sp.includes("<h2>小结</h2>"));

// 无空行长文：逐行分段
const longNoEmpty = "第一句内容很长很长。\n第二句内容比较长比较长比较长。\n第三句内容也很长很长很长很长。\n第四句内容继续写一些文字。\n第五句内容再补充一点。\n第六句内容作为结尾。";
const ln = ss(longNoEmpty);
check("smart 无空行长文逐行分段", (ln.match(/<p>/g) || []).length === 6 && (ln.match(/<h/g) || []).length === 0);

// 中文序号小标题 → h2
check("smart 中文序号一、→ 标题", ss("一、什么是排版\n\n正文解释排版的概念。").includes("<h2>一、什么是排版</h2>"));
// 数字序号 → 有序列表
check("smart 数字序号 → ol", ss("1. 第一点\n2. 第二点").includes("<ol>") && ss("1. 第一点\n2. 第二点").includes("<li>第一点</li>"));
// 引号包裹独立行 → 引用
check("smart 引号包裹 → blockquote", ss('"这是一句被引用的话"').includes("<blockquote>") && ss('"这是一句被引用的话"').includes("这是一句被引用的话"));
// 强模式词 → 标题
check("smart 强模式「前言」→ 标题", ss("前言\n\n这里是正文内容。").includes("<h1>前言</h1>"));
// 段落内短句（带句号）不误判
check("smart 段落内短句不误判", (() => { const r = ss("今天我们来聊一个话题。\n\n这个话题很重要，值得展开讲讲。\n\n最后做个总结。"); return (r.match(/<h/g) || []).length === 0 && (r.match(/<p>/g) || []).length === 3; })());
// 无标记纯文本应走 smart 而非 autoStructure
check("hasExplicitMarkup 纯散文为 false", window.hasExplicitMarkup(prose) === false);
check("hasExplicitMarkup 含 # 为 true", window.hasExplicitMarkup("# 标题\n正文") === true);

// 13) 一整坨无换行长文（逐字稿/聊天粘贴）→ 按句子切块分段
const spt = window.smartParagraphText;
const blob = Array.from({ length: 20 }, (_, i) => "这是第" + (i + 1) + "句话，讲述了一个很长的观点但中间没有任何换行符。").join("");
check("smartParagraphText 无换行长文被切块", spt(blob).split("\n\n").length >= 3);
check("smartParagraphText 不丢内容", spt(blob).replace(/\n/g, "").length === blob.length);
check("smartParagraphText 有换行结构时不动", spt("第一段。\n\n第二段。") === "第一段。\n\n第二段。");
check("smartParagraphText 短文本不动", spt("短文本不用处理。") === "短文本不用处理。");
const blobOut = ss(blob);
check("smart 一整坨 → 多个段落", (blobOut.match(/<p>/g) || []).length >= 3);

// 14) isStructurelessHtml：无结构 HTML 识别
const ish = window.isStructurelessHtml;
check("isStructureless 纯段落为 true", ish("<p>第一段</p><p>第二段</p>").structureless === true);
check("isStructureless br 转换行", ish("<p>甲<br/>乙</p>").text === "甲\n乙");
check("isStructureless 含标题为 false", ish("<h1>标题</h1><p>正文</p>").structureless === false);
check("isStructureless 含列表为 false", ish("<ul><li>项</li></ul>").structureless === false);
check("isStructureless 含图片为 false", ish('<p>图</p><img src="x.png"/>').structureless === false);

// 15) markdownToHtml：段落内单换行保留为 <br/>（不再合并成一行）
const multiLine = window.markdownToHtml("第一行文字。\n第二行文字。\n第三行文字。");
check("MD 单换行保留 <br/>", multiLine === "<p>第一行文字。<br/>第二行文字。<br/>第三行文字。</p>");

// 16) 微信行高安全化：导出 HTML 的行高必须全是 px，且无单位比值残留
const expHtml = window.applyInlineStyles(window.getTemplate("typora-github"),
  "<h1>主标题</h1><p>这是一段正文。</p><blockquote>引用</blockquote><ul><li>项</li></ul>");
check("导出无单位 line-height 残留", !/line-height:\s*(\d+(\.\d+)?)\s*([^;pxem%]|$)/i.test(expHtml.replace(/line-height:\s*(\d+(\.\d+)?)px/gi, "")));
check("段落行高为 px", /<p[^>]*line-height:\s*(\d+(\.\d+)?)px/.test(expHtml));
check("标题也带显式 px 行高", /<h1[^>]*line-height:\s*(\d+(\.\d+)?)px/.test(expHtml));
check("容器行高为 px", /<\/div>|<div[^>]*line-height:\s*(\d+(\.\d+)?)px/.test(expHtml));
// 行高数值应 ≥ 字号（提取若干 p 的 font-size 与 line-height 校验）
check("行高≥字号（p）", (() => {
  const m = expHtml.match(/<p[^>]*font-size:(\d+)px[^>]*line-height:(\d+(?:\.\d+)?)px/);
  if (!m) return false;
  return parseFloat(m[2]) >= parseFloat(m[1]);
})());

// 17) 发布前自检：checkWeChatCompat 按微信口径扫描导出 HTML
const good = window.applyInlineStyles(window.getTemplate("typora-github"),
  "<h1>主标题</h1><p>这是一段正文内容，用来测试行高是否安全。</p><blockquote>引用</blockquote><ul><li>项</li></ul>");
const ckGood = window.checkWeChatCompat(good);
check("自检：正常导出无 error", ckGood.errs === 0);
check("自检：含行高安全通过项", ckGood.items.some((i) => i.title === "行高安全" && i.level === "pass"));
check("自检：含表格结构通过项", ckGood.items.some((i) => i.title === "表格结构" && i.level === "pass"));
check("自检：统计字数>0", ckGood.stats.chars > 0);
check("自检：统计标题数=1", ckGood.stats.headings === 1);

// 行高 < 字号 → error
const badLh = window.checkWeChatCompat('<div style="font-size:16px;line-height:10px">这是多行文本这是多行文本这是多行文本</div>');
check("自检：行高<字号报 error", badLh.errs >= 1 && badLh.items.some((i) => i.title === "行高小于字号" && i.level === "error"));

// 嵌套表格 → error
const badTable = window.checkWeChatCompat('<table><tr><td><table><tr><td>内</td></tr></table></td></tr></table>');
check("自检：嵌套表格报 error", badTable.errs >= 1 && badTable.items.some((i) => i.title === "嵌套表格" && i.level === "error"));

// 图片缺宽度 → warn
const badImg = window.checkWeChatCompat('<p>图</p><img src="x.png"/>');
check("自检：图片缺宽度报 warn", badImg.warns >= 1 && badImg.items.some((i) => i.title === "图片缺宽度" && i.level === "warn"));

// 空段落 → warn
const badEmpty = window.checkWeChatCompat('<p>有内容</p><p><br/></p>');
check("自检：空段落报 warn", badEmpty.warns >= 1 && badEmpty.items.some((i) => i.title === "空段落" && i.level === "warn"));

console.log("\n结果：通过 " + pass + "，失败 " + fail);
process.exit(fail ? 1 : 0);
