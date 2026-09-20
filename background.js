// background.js — MV3 service worker
// 负责：在 popup 点击"一键导入公众号"时，找到已打开的公众号编辑页并把存储的最后导出内容转交 content script 注入。

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "IMPORT_TO_WECHAT") {
    chrome.tabs.query({ url: "https://mp.weixin.qq.com/*" }, (tabs) => {
      if (!tabs || tabs.length === 0) {
        sendResponse({ ok: false, reason: "no_tab" });
        return;
      }
      const tab = tabs[0];
      chrome.tabs.sendMessage(tab.id, { type: "IMPORT_FROM_STORAGE" }, (res) => {
        if (chrome.runtime.lastError) {
          sendResponse({ ok: false, reason: "inject_failed", detail: chrome.runtime.lastError.message });
        } else {
          sendResponse(res || { ok: true });
        }
      });
    });
    return true; // 保持异步响应通道
  }
});
