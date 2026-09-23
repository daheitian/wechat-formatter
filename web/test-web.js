// web/test-web.js — 网页版加载冒烟测试（jsdom 模拟浏览器执行真实 index.html + 引擎脚本）
const { JSDOM } = require("C:/Users/ga/.workbuddy/binaries/node/workspace/node_modules/jsdom");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = "C:/Users/ga/WorkBuddy/2026-09-19-08-44-39/wechat-formatter";

// 去掉 <script> 标签，只保留 DOM 结构，避免 jsdom 自行加载网络
const html = fs.readFileSync(path.join(root, "web/index.html"), "utf8")
  .replace(/<script[\s\S]*?<\/script>/g, "");

const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true, url: "https://local.test/" });
const { window } = dom;

// 提供 jsdom 缺失但引擎可能用到的桩
window.ClipboardItem = function () {};
window.getSelection = window.getSelection || function () { return { rangeCount: 0, isCollapsed: true, toString: () => "" }; };

const ctx = dom.getInternalVMContext();

const files = [
  "js/templates.js", "js/exporters.js", "js/images.js", "js/highlight.js",
  "js/editor.js", "js/markdown.js", "web/web-app.js"
];

let failures = 0;
function check(name, cond) {
  console.log((cond ? "PASS " : "FAIL ") + name);
  if (!cond) failures++;
}

try {
  for (const f of files) {
    const code = fs.readFileSync(path.join(root, f), "utf8");
    vm.runInContext(code, ctx, { filename: f });
  }
  check("脚本全部加载无抛错", true);
} catch (e) {
  check("脚本全部加载无抛错", false);
  console.log("  错误:", e.message);
}

// 等待 loadDraft 的 Promise 完成
setTimeout(() => {
  const D = window.document;
  const cards = D.querySelectorAll("#templateGallery .tpl");
  // 模板数会随迭代增加，改成动态对齐，别再写死数字
  check("模板画廊卡片数 = TEMPLATES 数量", cards.length === window.TEMPLATES.length);
  check("TEMPLATES 已挂载（18 套）", Array.isArray(window.TEMPLATES) && window.TEMPLATES.length === 18);
  check("Highlighter 已挂载", !!window.Highlighter);
  check("Markdown 解析器已挂载", typeof window.markdownToHtml === "function");
  check("编辑器默认内容含 h1", !!D.querySelector("#editor h1"));
  check("预览样式表已注入", !!D.getElementById("tpl-preview-style"));
  const seriesCount = new Set(window.TEMPLATES.map((t) => t.series)).size;
  check("分组数量 = 系列数", D.querySelectorAll("#templateGallery .tpl-group").length === seriesCount);
  check("分段控件存在", !!D.getElementById("modeSeg"));

  // ---------- 写作模式：工具坞 / 外观面板 / 并排预览 ----------
  const writeBtn = D.querySelector('#modeSeg .seg-btn[data-mode="write"]');
  writeBtn.dispatchEvent(new window.Event("click", { bubbles: true }));
  check("切到写作后 body.writing", D.body.classList.contains("writing"));
  check("写作坞存在", !!D.getElementById("writeDock"));
  check("坞内含外观/并排按钮", !!D.getElementById("appearanceBtn") && !!D.getElementById("wpaneBtn"));

  const look = D.getElementById("writeLook");
  D.getElementById("appearanceBtn").dispatchEvent(new window.Event("click", { bubbles: true }));
  check("外观面板可打开", look.style.display === "block");
  const size = D.getElementById("wlSize");
  size.value = "24";
  size.dispatchEvent(new window.Event("input", { bubbles: true }));
  check("外观面板改字号写入 --w-size", D.body.style.getPropertyValue("--w-size") === "24px");
  const colInput = D.getElementById("wlCol");
  colInput.value = "880";
  colInput.dispatchEvent(new window.Event("input", { bubbles: true }));
  check("外观面板改栏宽写入 --w-col", D.body.style.getPropertyValue("--w-col") === "880px");
  D.querySelector('#wlFont button[data-v="serif"]').dispatchEvent(new window.Event("click", { bubbles: true }));
  check("外观面板字体切到衬线", /Georgia/.test(D.body.style.getPropertyValue("--w-font")));
  D.querySelector('#wlTheme button[data-v="night"]').dispatchEvent(new window.Event("click", { bubbles: true }));
  check("外观面板夜主题生效", D.body.classList.contains("w-night"));
  D.getElementById("wlReset").dispatchEvent(new window.Event("click", { bubbles: true }));
  check("恢复默认清掉夜主题", !D.body.classList.contains("w-night"));
  check("恢复默认后回到 19px", D.body.style.getPropertyValue("--w-size") === "19px");

  // 并排预览
  D.getElementById("wpaneBtn").dispatchEvent(new window.Event("click", { bubbles: true }));
  check("并排预览打开 body.wpane-on", D.body.classList.contains("wpane-on"));
  check("并排预览有同步滚动勾选", !!D.getElementById("wpaneSync"));
  D.getElementById("wpaneClose").dispatchEvent(new window.Event("click", { bubbles: true }));
  check("并排预览可关闭", !D.body.classList.contains("wpane-on"));

  // ---------- 全局两端对齐（默认开） ----------
  const jb = D.getElementById("justifyBtn");
  const djb = D.getElementById("dockJustify");
  check("底部栏有两端对齐开关", !!jb);
  check("写作坞有两端对齐开关", !!djb);
  check("默认即为开启态", jb.classList.contains("on") && djb.classList.contains("active"));
  check("默认导出对 Helvetica 也强制 justify",
    /text-align:justify/.test(window.applyInlineStyles(window.getTemplate("ia-helvetica"), "<p>正文段落</p>")));
  check("编辑器模板样式表同步写 justify",
    /text-align:justify/.test(D.getElementById("tpl-preview-style").textContent));
  jb.dispatchEvent(new window.Event("click", { bubbles: true }));
  check("点按后关掉全局对齐", !jb.classList.contains("on") && !djb.classList.contains("active"));
  check("关掉后 Helvetica 回到齐左不齐右",
    /text-align:left/.test(window.applyInlineStyles(window.getTemplate("ia-helvetica"), "<p>正文段落</p>")));
  djb.dispatchEvent(new window.Event("click", { bubbles: true }));
  check("坞内开关再点按恢复开启", jb.classList.contains("on") && djb.classList.contains("active"));

  // ---------- 编辑器右键菜单 ----------
  const ed = D.getElementById("editor");
  const p = ed.querySelector("p");
  const r = D.createRange();
  r.setStart(p.firstChild, 1);
  r.collapse(true);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(r);
  ed.dispatchEvent(new window.MouseEvent("contextmenu", { bubbles: true, clientX: 160, clientY: 160 }));
  const menu = D.getElementById("ctxMenu");
  check("右键菜单弹出", menu.style.display === "block");
  check("右键菜单 21 项（5 行内 + 8 段落 + 3 插入 + 5 复制）", menu.querySelectorAll(".ctx-item").length === 21);
  check("右键菜单 4 个分组", menu.querySelectorAll(".ctx-group").length === 4);
  check("右键菜单含智能复制", !!menu.querySelector('.ctx-item[data-k="copyText"]'));
  check("右键菜单含复制 Markdown", !!menu.querySelector('.ctx-item[data-k="copyMd"]'));
  check("右键菜单含插入日期", !!menu.querySelector('.ctx-item[data-k="date"]'));
  const h3Before = ed.querySelectorAll("h3").length;
  menu.querySelector('.ctx-item[data-k="h3"]').dispatchEvent(new window.Event("click", { bubbles: true }));
  check("右键 H3 生效（段落→标题三）", ed.querySelectorAll("h3").length === h3Before + 1);
  ed.dispatchEvent(new window.MouseEvent("contextmenu", { bubbles: true, clientX: 160, clientY: 160 }));
  const pBefore = ed.querySelectorAll("p").length;
  menu.querySelector('.ctx-item[data-k="p"]').dispatchEvent(new window.Event("click", { bubbles: true }));
  check("右键正文回退（h3→段落）", ed.querySelectorAll("p").length === pBefore + 1);

  // 模拟切换到 Markdown 模式
  const mdBtn = D.querySelector('#modeSeg .seg-btn[data-mode="md"]');
  mdBtn.dispatchEvent(new window.Event("click", { bubbles: true }));
  check("切到 MD 后 mdPane 显示", D.getElementById("mdPane").style.display === "flex");
  check("切到 MD 后 mdPreview 有内容", D.getElementById("mdPreview").innerHTML.length > 0);

  console.log("\n" + (failures === 0 ? "✅ 网页版冒烟测试全部通过" : "❌ 有 " + failures + " 项失败"));
  process.exit(failures === 0 ? 0 : 1);
}, 300);
