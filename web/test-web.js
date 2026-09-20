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
  const cards = window.document.querySelectorAll("#templateGallery .tpl");
  check("模板画廊渲染卡片数 = 9", cards.length === 9);
  check("TEMPLATES 已挂载", Array.isArray(window.TEMPLATES) && window.TEMPLATES.length === 9);
  check("Highlighter 已挂载", !!window.Highlighter);
  check("Markdown 解析器已挂载", typeof window.markdownToHtml === "function");
  check("编辑器默认内容含 h1", !!window.document.querySelector("#editor h1"));
  check("预览样式表已注入", !!window.document.getElementById("tpl-preview-style"));
  check("分组数量 = 3（系列）", window.document.querySelectorAll("#templateGallery .tpl-group").length === 3);
  check("分段控件存在", !!window.document.getElementById("modeSeg"));
  // 模拟切换到 Markdown 模式
  const mdBtn = window.document.querySelector('#modeSeg .seg-btn[data-mode="md"]');
  mdBtn.dispatchEvent(new window.Event("click", { bubbles: true }));
  check("切到 MD 后 mdPane 显示", window.document.getElementById("mdPane").style.display === "flex");
  check("切到 MD 后 mdPreview 有内容", window.document.getElementById("mdPreview").innerHTML.length > 0);

  console.log("\n" + (failures === 0 ? "✅ 网页版冒烟测试全部通过" : "❌ 有 " + failures + " 项失败"));
  process.exit(failures === 0 ? 0 : 1);
}, 300);
