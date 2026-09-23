// test/shot.js — 无头截图验收工具
//
// 用途：改完界面后，用真实 Chrome 把「手机预览弹窗」/「写作模式」渲染出来看一眼，
// 避免只靠读代码判断版式。standalone.html 是自包含单文件，所以在任意路径都能跑。
//
// 用法：
//   node test/shot.js preview   # 预览弹窗（含示例正文 + 自检面板）
//   node test/shot.js write     # 写作模式画布 + 底部工具坞
//   node test/shot.js preview 1440x960
//
// 产物：.tmp/shot-<mode>.html 与 .tmp/shot-<mode>.png
//
// 坑：standalone.html 内联的 JS 里也存在 "</body>" 字面量，注入必须用 lastIndexOf，
//     否则会把脚本插进某个字符串里，整页变成一坨源码。

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const TMP = path.join(ROOT, ".tmp");
const mode = process.argv[2] || "preview";
const size = process.argv[3] || "1440x960";

const SAMPLE = [
  "<h1>把复杂留给自己，把简单留给用户</h1>",
  "<p>先写，再排版。用 Markdown 写纯文本，切换到预览即可看到样式。一旦设置好模板，设计就无需再考虑。</p>",
  "<p>好的排版不会说话，它只是让文字看起来值得被读完。行距、字号、留白，都是为了让读者忘记自己正在阅读。</p>",
  "<h2>写作的三条纪律</h2>",
  "<ul><li>一句话只说一件事</li><li>删掉所有可以删掉的形容词</li><li>把结论放在最前面</li></ul>",
  "<h3>关于留白</h3>",
  "<blockquote>没有任何东西会与你的文字争夺注意力。</blockquote>",
  "<p>这也是为什么我们坚持把控件收进底部的一条窄坞：它需要时可被找到，不需要时彻底消失。</p>",
  '<pre><code class="language-js">const words = text.split(/\\s+/);</code></pre>',
  "<hr/>",
  "<p>最后一段用于验证长文的滚动与行高，确保在手机上不会出现行高小于字号的挤压现象。</p>",
].join("");

// 不同模式要触发的界面动作
const TO_WRITE = 'var s = document.querySelector(\'[data-mode="write"]\'); if (s) s.click();';
// 把光标放进第一段再派发右键事件（模拟真实右键唤起菜单），同步执行
const CTX_NOW =
  'var ed = document.getElementById("editor");' +
  'var p = ed.querySelector("p") || ed.firstElementChild;' +
  'var rg = document.createRange(); rg.setStart(p.firstChild || p, 1); rg.collapse(true);' +
  'var sl = window.getSelection(); sl.removeAllRanges(); sl.addRange(rg);' +
  'ed.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 320, clientY: 300 }));';
const ACTION = {
  preview: 'var b = document.getElementById("openPreview"); if (b) b.click();',
  write: TO_WRITE,
  // 写作 + 外观面板
  look: TO_WRITE + '\n    setTimeout(function () { var a = document.getElementById("appearanceBtn"); if (a) a.click(); }, 260);',
  // 写作 + 并排实时预览
  pane: TO_WRITE + '\n    var w = document.getElementById("wpaneBtn"); if (w) w.click();',
  // 写作 + 右键菜单
  // 注意：headless 在截图前会做一次 resize，而 resize 会主动收起菜单，
  // 所以真实菜单在截图里拍不到。菜单皮肤请看 ctxskin；菜单逻辑靠 test-web.js 断言。
  ctx: TO_WRITE + '\n    ' + CTX_NOW,
  // 右键菜单的外观验收：插一块静态菜单（不经过事件链，因此不会被 resize 收走）
  ctxskin: TO_WRITE +
    '\n    document.body.insertAdjacentHTML("beforeend", ' +
    '"<div class=\'ctx\' style=\'display:block;left:320px;top:200px\'>" +' +
    '"<div class=\'ctx-group\'>行内</div>" +' +
    '"<button class=\'ctx-item\'><span class=\'ctx-ic\'>B</span><span class=\'ctx-txt\'>加粗</span><span class=\'ctx-key\'>Ctrl+B</span></button>" +' +
    '"</div>");',
  // 字体系列模板：点卡片切模板，看编辑器里的真实排版（h1/h2/h3/引用/代码/分割线一次看全）
  helv: 'var c = document.querySelector(\'#templateGallery .tpl[data-id="ia-helvetica"]\'); if (c) c.click();',
  garm: 'var c = document.querySelector(\'#templateGallery .tpl[data-id="ia-garamond"]\'); if (c) c.click();',
  // 字体系列在画廊末尾：把左侧模板栏滚到底，验收新增分组的缩略图
  // （.rail 本身 overflow:hidden，真正滚动的是里面的 .templates）
  fonts: 'var e = document.querySelector(".templates"); if (e) e.scrollTop = e.scrollHeight;',
  // 关闭全局两端对齐：验证 Helvetica 回到齐左不齐右（先切模板再按开关）
  left: 'var c = document.querySelector(\'#templateGallery .tpl[data-id="ia-helvetica"]\'); if (c) c.click();' +
    '\n    var j = document.getElementById("justifyBtn"); if (j) j.click();',
  // 手机预览（走导出引擎、真内联样式）：对比「全局两端对齐 开 / 关」下同一模板的差别
  pvhelv: 'var c = document.querySelector(\'#templateGallery .tpl[data-id="ia-helvetica"]\'); if (c) c.click();' +
    '\n    var b = document.getElementById("openPreview"); if (b) b.click();',
  pvleft: 'var c = document.querySelector(\'#templateGallery .tpl[data-id="ia-helvetica"]\'); if (c) c.click();' +
    '\n    var j = document.getElementById("justifyBtn"); if (j) j.click();' +
    '\n    var b = document.getElementById("openPreview"); if (b) b.click();',
};

const inject =
  "\n<script>\nwindow.addEventListener('load', function () {\n  setTimeout(function () {\n" +
  "    var ed = document.getElementById('editor');\n" +
  "    if (ed) ed.innerHTML = " + JSON.stringify(SAMPLE) + ";\n" +
  "    " + (ACTION[mode] || ACTION.preview) + "\n" +
  "  }, 400);\n});\n</script>\n";

function findChrome() {
  const candidates = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  throw new Error("no Chrome/Edge found");
}

fs.mkdirSync(TMP, { recursive: true });

const src = fs.readFileSync(path.join(ROOT, "web", "standalone.html"), "utf8");
const at = src.lastIndexOf("</body>");
if (at < 0) throw new Error("no </body> in standalone.html");
const htmlPath = path.join(TMP, "shot-" + mode + ".html");
fs.writeFileSync(htmlPath, src.slice(0, at) + inject + src.slice(at), "utf8");

const pngPath = path.join(TMP, "shot-" + mode + ".png");
execFileSync(findChrome(), [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  "--window-size=" + size.replace("x", ","),
  "--virtual-time-budget=6000",
  "--screenshot=" + pngPath,
  "file:///" + htmlPath.replace(/\\/g, "/"),
], { stdio: "ignore" });

console.log(mode + " → " + pngPath);
