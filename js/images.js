// images.js — 公众号图片管线
// 设计（对标 huasheng 的本地化方案）：
//   粘贴/上传图片 → Canvas 压缩（长边 ≤1920 / 质量 0.85）→ IndexedDB 本地存储
//   → 编辑器里只显示 img://<id> 短链（不卡、刷新不丢）
//   → 复制到公众号 / 导出时才把 img://id 还原成 base64 数据，喂给微信
// 这样长文不崩、刷新不丢、且导出体积可控（按需转 base64）。

(function () {
  const DB_NAME = "jsq_img_db";
  const STORE = "images";
  let dbPromise = null;
  const objUrlCache = {}; // id -> objectURL（仅本会话显示用）

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") { reject(new Error("no-indexeddb")); return; }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function idbPut(id, blob) {
    try {
      const db = await openDB();
      await new Promise((res, rej) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put({ id, blob, ts: Date.now() });
        tx.oncomplete = res;
        tx.onerror = () => rej(tx.error);
      });
    } catch (e) { /* IndexedDB 不可用（如网页预览）时忽略，退化为直接用原图 */ }
  }

  async function idbGet(id) {
    try {
      const db = await openDB();
      return await new Promise((res, rej) => {
        const tx = db.transaction(STORE, "readonly");
        const r = tx.objectStore(STORE).get(id);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
    } catch (e) { return null; }
  }

  function blobToDataURL(blob) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = rej;
      fr.readAsDataURL(blob);
    });
  }

  function genId() {
    return "img_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  // 压缩：等比缩放，长边不超过 maxDim，输出 JPEG（质量 quality）。
  function compressImage(blob, maxDim, quality) {
    maxDim = maxDim || 1920;
    quality = quality == null ? 0.85 : quality;
    return new Promise((resolve) => {
      if (typeof document === "undefined" || typeof document.createElement !== "function") { resolve(blob); return; }
      const url = URL.createObjectURL(blob);
      const draw = (img) => {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (!w || !h) { URL.revokeObjectURL(url); resolve(blob); return; }
        const scale = Math.min(1, maxDim / Math.max(w, h));
        const tw = Math.max(1, Math.round(w * scale));
        const th = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement("canvas");
        canvas.width = tw; canvas.height = th;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, tw, th);
        URL.revokeObjectURL(url);
        canvas.toBlob((out) => resolve(out || blob), "image/jpeg", quality);
      };
      const fallback = () => {
        const im = new Image();
        im.onload = () => draw(im);
        im.onerror = () => { URL.revokeObjectURL(url); resolve(blob); };
        im.src = url;
      };
      if (typeof createImageBitmap !== "undefined") {
        createImageBitmap(blob).then(draw).catch(fallback);
      } else {
        fallback();
      }
    });
  }

  // 完整流程：File/Blob → 压缩 → 存 IDB → 返回 { id, objectURL, blob }
  async function storeImageFile(file, maxDim, quality) {
    const compressed = await compressImage(file, maxDim, quality);
    const id = genId();
    await idbPut(id, compressed);
    const objectURL = URL.createObjectURL(compressed);
    objUrlCache[id] = objectURL;
    // 内存兜底：即便 IndexedDB 不可用（如 file:// 网页预览），导出时也能还原成 base64
    blobToDataURL(compressed).then((du) => { memCache[id] = du; }).catch(() => {});
    return { id, objectURL, blob: compressed };
  }

  async function getObjectURL(id) {
    if (objUrlCache[id]) return objUrlCache[id];
    const rec = await idbGet(id);
    if (!rec) return null;
    const u = URL.createObjectURL(rec.blob);
    objUrlCache[id] = u;
    return u;
  }

  async function toDataURL(id) {
    const rec = await idbGet(id);
    if (!rec) return null;
    return blobToDataURL(rec.blob);
  }

  // 把元素内所有 data-imgid / img:// 的图片解析为可显示的 objectURL（加载草稿 / 预览时用）
  async function hydrateImages(el) {
    if (!el) return;
    const imgs = el.querySelectorAll("img[data-imgid], img[src^='img://']");
    for (const img of imgs) {
      let id = img.getAttribute("data-imgid");
      if (!id) {
        const s = img.getAttribute("src");
        if (s && s.indexOf("img://") === 0) id = s.slice(6);
      }
      if (!id) continue;
      const u = await getObjectURL(id);
      if (u) img.setAttribute("src", u);
    }
  }

  // 把 HTML 字符串中 img://id 替换为 base64（导出到公众号 / 下载时用），返回新 HTML
  async function resolveExportImages(html) {
    if (!html || html.indexOf("img://") === -1) return html;
    const doc = new DOMParser().parseFromString(html, "text/html");
    const imgs = doc.querySelectorAll("img[src^='img://']");
    for (const img of imgs) {
      const id = img.getAttribute("src").slice(6);
      const du = await toDataURL(id);
      if (du) img.setAttribute("src", du);
    }
    return doc.body.innerHTML;
  }

  // 归一化：把活着的 blob: src 换回 img://id，避免草稿膨胀与失效
  function normalizeImgSrc(html) {
    if (!html) return html;
    return html.replace(/<img([^>]*?)\s+src="blob:[^"]*"([^>]*)>/gi, (m, a, b) => {
      const idm = (a + b).match(/data-imgid="([^"]+)"/);
      if (idm) return `<img${a} src="img://${idm[1]}"${b}>`;
      return m;
    });
  }

  if (typeof window !== "undefined") {
    window.ImagePipeline = {
      storeImageFile, getObjectURL, toDataURL,
      hydrateImages, resolveExportImages, normalizeImgSrc, compressImage, genId
    };
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { normalizeImgSrc, compressImage, genId };
  }
})();
