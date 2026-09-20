// content.js
// 在公众号编辑页（mp.weixin.qq.com）注入：
//  1) 一个悬浮"📥 排版助手导入"按钮，点击后读取扩展存储的最后导出内容并注入编辑器
//  2) 监听来自 background 的 IMPORT_FROM_STORAGE 消息，执行注入

function getEditorDoc() {
  // 微信公众号使用 UEditor，编辑区是一个 id 以 ueditor_ 开头的 iframe
  const iframes = document.querySelectorAll('iframe[id^="ueditor_"]');
  for (const f of iframes) {
    try {
      const d = f.contentDocument;
      if (d && d.body) return d;
    } catch (e) {}
  }
  // 兜底：直接找 contenteditable 区
  const ed = document.querySelector('.edui-editor-body [contenteditable="true"], #js_editor');
  if (ed && ed.ownerDocument) return ed.ownerDocument;
  return null;
}

function injectHtml(html) {
  const doc = getEditorDoc();
  if (!doc) return { ok: false, reason: "editor_not_found" };
  const body = doc.body;
  if (!body) return { ok: false, reason: "body_not_found" };

  // 优先用 insertHTML（可触发微信的上传/清理逻辑），失败则直接 append
  try {
    const sel = doc.getSelection ? doc.getSelection() : doc.selection;
    if (sel && sel.removeAllRanges) {
      sel.removeAllRanges();
      const range = doc.createRange();
      range.selectNodeContents(body);
      range.collapse(false);
      sel.addRange(range);
      doc.execCommand("insertHTML", false, html);
      return { ok: true };
    }
  } catch (e) {}

  body.insertAdjacentHTML("beforeend", html);
  return { ok: true };
}

function doImport() {
  chrome.storage.local.get("lastExport", (r) => {
    const html = r && r.lastExport;
    if (!html) {
      flash("未找到可导出的内容，请先在排版助手生成");
      return;
    }
    const res = injectHtml(html);
    flash(res.ok ? "已导入到公众号编辑器 ✓" : "导入失败：" + res.reason);
  });
}

let flashTimer = null;
function flash(text) {
  let tip = document.getElementById("jsq-flash");
  if (!tip) {
    tip = document.createElement("div");
    tip.id = "jsq-flash";
    tip.style.cssText =
      "position:fixed;top:16px;left:50%;transform:translateX(-50%);" +
      "background:rgba(255,255,255,.6);-webkit-backdrop-filter:blur(20px) saturate(180%);backdrop-filter:blur(20px) saturate(180%);" +
      "color:#1d1d1f;padding:9px 18px;border-radius:16px;font-size:14px;z-index:99999;" +
      "border:1px solid rgba(0,0,0,.08);box-shadow:inset 0 1px 0 rgba(255,255,255,.85),0 8px 24px rgba(17,24,39,.18);font-weight:500;";
    document.body.appendChild(tip);
  }
  tip.textContent = text;
  tip.style.display = "block";
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { tip.style.display = "none"; }, 2200);
}

function mountButton() {
  if (document.getElementById("jsq-import-btn")) return;
  const btn = document.createElement("div");
  btn.id = "jsq-import-btn";
  btn.textContent = "📥 排版助手导入";
  btn.style.cssText =
    "position:fixed;right:16px;top:90px;z-index:99999;" +
    "background:rgba(7,193,96,.85);color:#fff;padding:10px 16px;border-radius:22px;font-size:13px;cursor:pointer;user-select:none;" +
    "-webkit-backdrop-filter:blur(18px) saturate(180%);backdrop-filter:blur(18px) saturate(180%);" +
    "border:1px solid rgba(255,255,255,.35);" +
    "box-shadow:inset 0 1px 0 rgba(255,255,255,.4),0 8px 22px rgba(7,193,96,.35);font-weight:600;";
  btn.addEventListener("click", doImport);
  document.body.appendChild(btn);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "IMPORT_FROM_STORAGE") {
    doImport();
    sendResponse({ ok: true });
  }
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountButton);
} else {
  mountButton();
}
