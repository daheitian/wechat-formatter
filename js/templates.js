// templates.js
// 公众号排版模板系统（参考 Typora / Bear 设计语言 · 9 套，分系列）。
// 每个模板由 base（容器样式）、styles（各元素的内联 CSS 声明字符串）、series（系列）、accent（强调色）组成。
// - templatePreviewCss(t): 生成用于编辑器/预览实时预览的样式表
// - applyInlineStyles(t, html): 把语义化 HTML 转成微信编辑器友好的「全内联样式」HTML
// - markdownToHtml(md): 轻量 Markdown 解析（见 markdown.js）
//
// 设计语言：
//   Typora 系列 —— 干净文档排版：克制字重、舒适行距、浅灰代码底、细分割线、链接低调。
//   Bear 系列   —— 温暖圆润：奶油底/暖黑底、招牌暖黄(或薄荷)强调、10–12px 大圆角、亲和留白。

const TEMPLATES = [
  // ---------------- Typora 系列（干净文档风） ----------------
  {
    id: "typora-github",
    name: "Typora·GitHub",
    desc: "白底系统字，GitHub 蓝链，浅灰代码底",
    series: "Typora 系列",
    accent: "#0366d6",
    base: {
      fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: "16px", color: "#24292e", lineHeight: "1.7",
      letterSpacing: "0", background: "#ffffff", padding: "10px 8px", maxWidth: "720px"
    },
    styles: {
      h1: "font-size:26px;font-weight:700;color:#24292e;margin:32px 0 16px;padding-bottom:8px;border-bottom:1px solid #eaecef;",
      h2: "font-size:21px;font-weight:700;color:#24292e;margin:28px 0 14px;padding-bottom:6px;border-bottom:1px solid #eaecef;",
      h3: "font-size:18px;font-weight:700;color:#24292e;margin:24px 0 12px;",
      p: "font-size:16px;line-height:1.7;color:#24292e;margin:0 0 16px;",
      blockquote: "font-size:15px;color:#6a737d;border-left:4px solid #dfe2e5;padding:2px 0 2px 16px;margin:0 0 16px;line-height:1.7;",
      ul: "font-size:16px;color:#24292e;padding-left:24px;margin:0 0 16px;line-height:1.7;",
      ol: "font-size:16px;color:#24292e;padding-left:24px;margin:0 0 16px;line-height:1.7;",
      li: "margin:4px 0;",
      pre: "background:#f6f8fa;padding:14px 16px;border-radius:6px;font-size:14px;color:#24292e;overflow:auto;margin:0 0 16px;font-family:Consolas,Menlo,monospace;line-height:1.5;",
      code: "background:rgba(27,31,32,0.05);padding:0.2em 0.4em;border-radius:3px;font-size:14px;color:#24292e;font-family:Consolas,Menlo,monospace;",
      hr: "border:none;border-top:1px solid #eaecef;margin:28px 0;",
      img: "max-width:100%;border-radius:4px;display:block;margin:16px auto;",
      a: "color:#0366d6;text-decoration:none;",
      strong: "color:#24292e;font-weight:700;",
      em: "font-style:italic;"
    }
  },
  {
    id: "typora-newsprint",
    name: "Typora·Newsprint",
    desc: "暖白纸感，衬线宽行距，长文阅读",
    series: "Typora 系列",
    accent: "#8a5a2b",
    base: {
      fontFamily: 'Georgia,"Times New Roman","Songti SC",serif',
      fontSize: "17px", color: "#2f2f2f", lineHeight: "1.8",
      letterSpacing: "0.1px", background: "#fdfcf9", padding: "12px 10px", maxWidth: "700px"
    },
    styles: {
      h1: "font-size:28px;font-weight:700;color:#1a1a1a;margin:34px 0 18px;text-align:center;font-family:Georgia,serif;",
      h2: "font-size:22px;font-weight:700;color:#1a1a1a;margin:30px 0 14px;font-family:Georgia,serif;",
      h3: "font-size:19px;font-weight:700;color:#1a1a1a;margin:26px 0 12px;font-family:Georgia,serif;",
      p: "font-size:17px;line-height:1.8;color:#2f2f2f;margin:0 0 18px;",
      blockquote: "font-size:16px;color:#5a5a5a;font-style:italic;border-left:3px solid #c9c2b4;padding:4px 0 4px 16px;margin:0 0 18px;line-height:1.7;",
      ul: "font-size:17px;color:#2f2f2f;padding-left:26px;margin:0 0 18px;line-height:1.8;",
      ol: "font-size:17px;color:#2f2f2f;padding-left:26px;margin:0 0 18px;line-height:1.8;",
      li: "margin:5px 0;",
      pre: "background:#f3f0e8;padding:14px 16px;border-radius:5px;font-size:14px;color:#2f2f2f;overflow:auto;margin:0 0 18px;font-family:Consolas,Menlo,monospace;line-height:1.5;",
      code: "background:#f3f0e8;padding:0.2em 0.4em;border-radius:3px;font-size:14px;color:#9a5b2e;font-family:Consolas,Menlo,monospace;",
      hr: "border:none;border-top:1px solid #d8d2c4;margin:30px 0;",
      img: "max-width:100%;border-radius:3px;display:block;margin:18px auto;",
      a: "color:#8a5a2b;text-decoration:underline;",
      strong: "color:#1a1a1a;font-weight:700;",
      em: "font-style:italic;color:#1a1a1a;"
    }
  },
  {
    id: "typora-pixyll",
    name: "Typora·Pixyll",
    desc: "轻盈灰调，中等字重，克制留白",
    series: "Typora 系列",
    accent: "#2a7ae2",
    base: {
      fontFamily: '"PingFang SC","Helvetica Neue",sans-serif',
      fontSize: "16px", color: "#333333", lineHeight: "1.7",
      letterSpacing: "0.2px", background: "#ffffff", padding: "12px 10px", maxWidth: "680px"
    },
    styles: {
      h1: "font-size:25px;font-weight:600;color:#333333;margin:30px 0 16px;letter-spacing:-0.2px;",
      h2: "font-size:20px;font-weight:600;color:#333333;margin:26px 0 14px;",
      h3: "font-size:17px;font-weight:600;color:#444444;margin:22px 0 12px;",
      p: "font-size:16px;line-height:1.7;color:#333333;margin:0 0 16px;",
      blockquote: "font-size:15px;color:#7a7a7a;background:#f7f7f7;border-left:4px solid #e0e0e0;padding:10px 16px;margin:0 0 16px;line-height:1.7;border-radius:4px;",
      ul: "font-size:16px;color:#333333;padding-left:24px;margin:0 0 16px;line-height:1.7;",
      ol: "font-size:16px;color:#333333;padding-left:24px;margin:0 0 16px;line-height:1.7;",
      li: "margin:5px 0;",
      pre: "background:#f7f7f7;padding:14px 16px;border-radius:6px;font-size:14px;color:#333333;overflow:auto;margin:0 0 16px;font-family:Consolas,Menlo,monospace;line-height:1.5;",
      code: "background:#f7f7f7;padding:0.2em 0.4em;border-radius:3px;font-size:14px;color:#c7254e;font-family:Consolas,Menlo,monospace;",
      hr: "border:none;border-top:1px solid #e0e0e0;margin:28px 0;",
      img: "max-width:100%;border-radius:5px;display:block;margin:16px auto;",
      a: "color:#2a7ae2;text-decoration:none;",
      strong: "color:#333333;font-weight:600;",
      em: "font-style:italic;"
    }
  },
  {
    id: "typora-gothic",
    name: "Typora·Gothic",
    desc: "现代无衬线，几何标题，利落",
    series: "Typora 系列",
    accent: "#111111",
    base: {
      fontFamily: '"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif',
      fontSize: "16px", color: "#1f1f1f", lineHeight: "1.65",
      letterSpacing: "0.3px", background: "#ffffff", padding: "12px 10px", maxWidth: "700px"
    },
    styles: {
      h1: "font-size:26px;font-weight:800;color:#111111;margin:30px 0 16px;letter-spacing:0.5px;",
      h2: "font-size:20px;font-weight:700;color:#111111;margin:26px 0 14px;",
      h3: "font-size:17px;font-weight:700;color:#222222;margin:22px 0 12px;",
      p: "font-size:16px;line-height:1.65;color:#1f1f1f;margin:0 0 16px;letter-spacing:0.3px;",
      blockquote: "font-size:15px;color:#555555;border-left:4px solid #111111;padding:6px 0 6px 16px;margin:0 0 16px;line-height:1.7;",
      ul: "font-size:16px;color:#1f1f1f;padding-left:24px;margin:0 0 16px;line-height:1.65;",
      ol: "font-size:16px;color:#1f1f1f;padding-left:24px;margin:0 0 16px;line-height:1.65;",
      li: "margin:5px 0;",
      pre: "background:#1f1f1f;color:#f0f0f0;padding:14px 16px;border-radius:6px;font-size:14px;overflow:auto;margin:0 0 16px;font-family:Consolas,Menlo,monospace;line-height:1.5;",
      code: "background:#ececec;padding:0.2em 0.4em;border-radius:3px;font-size:14px;color:#c7254e;font-family:Consolas,Menlo,monospace;",
      hr: "border:none;border-top:2px solid #111111;margin:28px 0;",
      img: "max-width:100%;border-radius:4px;display:block;margin:16px auto;",
      a: "color:#111111;text-decoration:none;border-bottom:1px solid #111111;",
      strong: "color:#111111;font-weight:800;",
      em: "font-style:italic;"
    }
  },

  // ---------------- Bear 系列（温暖圆润风） ----------------
  {
    id: "bear-warm",
    name: "Bear·暖白",
    desc: "奶油底，招牌暖黄高亮，圆润亲和",
    series: "Bear 系列",
    accent: "#f5b700",
    base: {
      fontFamily: '-apple-system,BlinkMacSystemFont,"PingFang SC","Helvetica Neue",sans-serif',
      fontSize: "17px", color: "#2b2b2b", lineHeight: "1.7",
      letterSpacing: "0.1px", background: "#fbf9f4", padding: "16px 12px", maxWidth: "700px"
    },
    styles: {
      h1: "font-size:27px;font-weight:700;color:#1c1c1e;margin:32px 0 18px;letter-spacing:-0.3px;",
      h2: "font-size:21px;font-weight:700;color:#1c1c1e;margin:28px 0 14px;padding-bottom:6px;border-bottom:2px solid #f5b700;",
      h3: "font-size:18px;font-weight:700;color:#1c1c1e;margin:24px 0 12px;",
      p: "font-size:17px;line-height:1.7;color:#2b2b2b;margin:0 0 18px;",
      blockquote: "font-size:16px;color:#6b6457;background:#f3efe4;border-left:4px solid #f5b700;padding:12px 16px;margin:0 0 18px;line-height:1.7;border-radius:8px;",
      ul: "font-size:17px;color:#2b2b2b;padding-left:24px;margin:0 0 18px;line-height:1.7;",
      ol: "font-size:17px;color:#2b2b2b;padding-left:24px;margin:0 0 18px;line-height:1.7;",
      li: "margin:6px 0;",
      pre: "background:#2b2b2b;color:#f5f5f5;padding:14px 16px;border-radius:10px;font-size:14px;overflow:auto;margin:0 0 18px;font-family:'SF Mono',Consolas,Menlo,monospace;line-height:1.5;",
      code: "background:#f0ebe0;padding:0.2em 0.4em;border-radius:5px;font-size:14px;color:#b07d1f;font-family:'SF Mono',Consolas,Menlo,monospace;",
      hr: "border:none;border-top:2px solid #efe6d6;margin:30px 0;",
      img: "max-width:100%;border-radius:12px;display:block;margin:18px auto;box-shadow:0 2px 10px rgba(0,0,0,0.06);",
      a: "color:#d99e00;text-decoration:none;",
      strong: "color:#1c1c1e;font-weight:700;",
      em: "font-style:italic;color:#b07d1f;"
    }
  },
  {
    id: "bear-dark",
    name: "Bear·暗夜",
    desc: "暖黑底，暖白字，黄色链",
    series: "Bear 系列",
    accent: "#f5b700",
    base: {
      fontFamily: '-apple-system,BlinkMacSystemFont,"PingFang SC","Helvetica Neue",sans-serif',
      fontSize: "17px", color: "#e8e6e1", lineHeight: "1.7",
      letterSpacing: "0.1px", background: "#1c1c1e", padding: "16px 12px", maxWidth: "700px"
    },
    styles: {
      h1: "font-size:27px;font-weight:700;color:#f5f5f5;margin:32px 0 18px;letter-spacing:-0.3px;",
      h2: "font-size:21px;font-weight:700;color:#f5f5f5;margin:28px 0 14px;padding-bottom:6px;border-bottom:2px solid #f5b700;",
      h3: "font-size:18px;font-weight:700;color:#f0f0f0;margin:24px 0 12px;",
      p: "font-size:17px;line-height:1.7;color:#e8e6e1;margin:0 0 18px;",
      blockquote: "font-size:16px;color:#b8b2a7;background:#2a2a2c;border-left:4px solid #f5b700;padding:12px 16px;margin:0 0 18px;line-height:1.7;border-radius:8px;",
      ul: "font-size:17px;color:#e8e6e1;padding-left:24px;margin:0 0 18px;line-height:1.7;",
      ol: "font-size:17px;color:#e8e6e1;padding-left:24px;margin:0 0 18px;line-height:1.7;",
      li: "margin:6px 0;",
      pre: "background:#121214;color:#e8e6e1;padding:14px 16px;border-radius:10px;font-size:14px;overflow:auto;margin:0 0 18px;font-family:'SF Mono',Consolas,Menlo,monospace;line-height:1.5;",
      code: "background:#2a2a2c;padding:0.2em 0.4em;border-radius:5px;font-size:14px;color:#f5b700;font-family:'SF Mono',Consolas,Menlo,monospace;",
      hr: "border:none;border-top:2px solid #3a3a3c;margin:30px 0;",
      img: "max-width:100%;border-radius:12px;display:block;margin:18px auto;",
      a: "color:#f5b700;text-decoration:none;",
      strong: "color:#ffffff;font-weight:700;",
      em: "font-style:italic;color:#d9c89a;",
      table: "width:100%;border-collapse:collapse;margin:0 0 18px;font-size:15px;",
      th: "border:1px solid #3a3a3c;padding:8px 10px;background:#2a2a2c;font-weight:700;text-align:left;",
      td: "border:1px solid #3a3a3c;padding:8px 10px;"
    }
  },
  {
    id: "bear-serif",
    name: "Bear·衬线",
    desc: "暖调衬线，文艺静读",
    series: "Bear 系列",
    accent: "#b07d1f",
    base: {
      fontFamily: 'Georgia,"Songti SC","Times New Roman",serif',
      fontSize: "17px", color: "#2b2b2b", lineHeight: "1.8",
      letterSpacing: "0.1px", background: "#fdfbf6", padding: "16px 12px", maxWidth: "700px"
    },
    styles: {
      h1: "font-size:27px;font-weight:700;color:#1c1c1e;margin:32px 0 18px;text-align:center;font-family:Georgia,serif;",
      h2: "font-size:21px;font-weight:700;color:#1c1c1e;margin:28px 0 14px;font-family:Georgia,serif;",
      h3: "font-size:18px;font-weight:700;color:#1c1c1e;margin:24px 0 12px;font-family:Georgia,serif;",
      p: "font-size:17px;line-height:1.8;color:#2b2b2b;margin:0 0 18px;",
      blockquote: "font-size:16px;color:#6b6457;font-style:italic;border-left:3px solid #f5b700;padding:6px 0 6px 16px;margin:0 0 18px;line-height:1.7;",
      ul: "font-size:17px;color:#2b2b2b;padding-left:26px;margin:0 0 18px;line-height:1.8;",
      ol: "font-size:17px;color:#2b2b2b;padding-left:26px;margin:0 0 18px;line-height:1.8;",
      li: "margin:5px 0;",
      pre: "background:#2b2b2b;color:#f5f5f5;padding:14px 16px;border-radius:10px;font-size:14px;overflow:auto;margin:0 0 18px;font-family:'SF Mono',Consolas,Menlo,monospace;line-height:1.5;",
      code: "background:#f0ebe0;padding:0.2em 0.4em;border-radius:5px;font-size:14px;color:#b07d1f;font-family:'SF Mono',Consolas,Menlo,monospace;",
      hr: "border:none;border-top:1px solid #e8ddc9;margin:30px 0;",
      img: "max-width:100%;border-radius:10px;display:block;margin:18px auto;",
      a: "color:#b07d1f;text-decoration:underline;",
      strong: "color:#1c1c1e;font-weight:700;",
      em: "font-style:italic;color:#b07d1f;"
    }
  },
  {
    id: "bear-mint",
    name: "Bear·薄荷",
    desc: "柔和薄荷强调，清新淡底",
    series: "Bear 系列",
    accent: "#2bb3a3",
    base: {
      fontFamily: '-apple-system,BlinkMacSystemFont,"PingFang SC","Helvetica Neue",sans-serif',
      fontSize: "17px", color: "#2b2b2b", lineHeight: "1.7",
      letterSpacing: "0.1px", background: "#f7fbfa", padding: "16px 12px", maxWidth: "700px"
    },
    styles: {
      h1: "font-size:27px;font-weight:700;color:#1c1c1e;margin:32px 0 18px;letter-spacing:-0.3px;",
      h2: "font-size:21px;font-weight:700;color:#1c1c1e;margin:28px 0 14px;padding-bottom:6px;border-bottom:2px solid #2bb3a3;",
      h3: "font-size:18px;font-weight:700;color:#1c1c1e;margin:24px 0 12px;",
      p: "font-size:17px;line-height:1.7;color:#2b2b2b;margin:0 0 18px;",
      blockquote: "font-size:16px;color:#5f7a76;background:#e8f4f1;border-left:4px solid #2bb3a3;padding:12px 16px;margin:0 0 18px;line-height:1.7;border-radius:8px;",
      ul: "font-size:17px;color:#2b2b2b;padding-left:24px;margin:0 0 18px;line-height:1.7;",
      ol: "font-size:17px;color:#2b2b2b;padding-left:24px;margin:0 0 18px;line-height:1.7;",
      li: "margin:6px 0;",
      pre: "background:#16302c;color:#e8f4f1;padding:14px 16px;border-radius:10px;font-size:14px;overflow:auto;margin:0 0 18px;font-family:'SF Mono',Consolas,Menlo,monospace;line-height:1.5;",
      code: "background:#e8f4f1;padding:0.2em 0.4em;border-radius:5px;font-size:14px;color:#1f7a6e;font-family:'SF Mono',Consolas,Menlo,monospace;",
      hr: "border:none;border-top:2px solid #d4ece7;margin:30px 0;",
      img: "max-width:100%;border-radius:12px;display:block;margin:18px auto;",
      a: "color:#1f7a6e;text-decoration:none;",
      strong: "color:#1c1c1e;font-weight:700;",
      em: "font-style:italic;color:#1f7a6e;"
    }
  },

  // ---------------- 品牌 ----------------
  {
    id: "sees",
    name: "见室",
    desc: "黑 + 暖白，编辑雕版（圆润版）",
    series: "见室品牌",
    accent: "#b8895a",
    base: {
      fontFamily: '"Songti SC","SimSun",Georgia,serif',
      fontSize: "16px", color: "#1f1b16", lineHeight: "2.0",
      letterSpacing: "0.6px", background: "#faf7f2", padding: "18px 12px", maxWidth: "700px"
    },
    styles: {
      h1: "font-size:25px;font-weight:700;color:#1a1a1a;text-align:center;margin:32px 0 20px;letter-spacing:2px;font-family:'Songti SC',serif;",
      h2: "font-size:20px;font-weight:700;color:#1a1a1a;margin:28px 0 14px;padding-bottom:8px;border-bottom:2px solid #b8895a;font-family:'Songti SC',serif;",
      h3: "font-size:17px;font-weight:700;color:#8a5a2b;margin:24px 0 12px;font-family:'Songti SC',serif;",
      p: "font-size:16px;line-height:2.0;color:#1f1b16;margin:0 0 20px;letter-spacing:0.6px;",
      blockquote: "font-size:15px;color:#7a6a55;background:#f1e9dd;border-left:4px solid #b8895a;padding:12px 16px;margin:0 0 20px;line-height:1.9;border-radius:8px;",
      ul: "font-size:16px;color:#1f1b16;padding-left:26px;margin:0 0 20px;line-height:2.0;",
      ol: "font-size:16px;color:#1f1b16;padding-left:26px;margin:0 0 20px;line-height:2.0;",
      li: "margin:7px 0;",
      pre: "background:#1f1b16;color:#f3ece0;padding:14px 16px;border-radius:8px;font-size:14px;overflow:auto;margin:0 0 20px;font-family:Consolas,Menlo,monospace;line-height:1.5;",
      code: "background:#ece2d2;padding:0.2em 0.4em;border-radius:5px;font-size:14px;color:#8a5a2b;font-family:Consolas,Menlo,monospace;",
      hr: "border:none;border-top:1px solid #b8895a;margin:32px 0;",
      img: "max-width:100%;border-radius:10px;display:block;margin:20px auto;box-shadow:0 2px 10px rgba(0,0,0,0.08);",
      a: "color:#b8895a;text-decoration:none;border-bottom:1px solid #b8895a;",
      strong: "color:#1a1a1a;font-weight:700;",
      em: "font-style:italic;color:#8a5a2b;"
    }
  }
];

// 默认表格样式（没有单独定义的主题自动补上），微信原生支持 <table>
const _TABLE_DEFAULT = {
  table: "width:100%;border-collapse:collapse;margin:0 0 18px;font-size:15px;",
  th: "border:1px solid #e2e2e2;padding:8px 10px;background:#f5f5f5;font-weight:bold;text-align:left;",
  td: "border:1px solid #e2e2e2;padding:8px 10px;"
};
TEMPLATES.forEach((t) => {
  for (const k in _TABLE_DEFAULT) if (!t.styles[k]) t.styles[k] = _TABLE_DEFAULT[k];
});

function objToCss(obj) {
  return Object.entries(obj)
    .map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase())}:${v}`)
    .join(";") + ";";
}

// 生成编辑器/预览实时预览样式表（作用于 .editor 容器内的语义元素）
function templatePreviewCss(t) {
  let css = `.editor{${objToCss(t.base)}}`;
  for (const [tag, decl] of Object.entries(t.styles)) {
    css += `.editor ${tag}{${decl}}`;
  }
  return css;
}

// 把语义化 HTML 转成「全内联样式」的 HTML（微信友好）
function applyInlineStyles(t, html) {
  const doc = new DOMParser().parseFromString(html || "", "text/html");
  const wrapper = doc.createElement("div");
  wrapper.setAttribute("style", objToCss(t.base) + "box-sizing:border-box;");

  while (doc.body.firstChild) wrapper.appendChild(doc.body.firstChild);

  const fontDecl = t.base.fontFamily ? `font-family:${t.base.fontFamily};` : "";
  // 提取已有内联样式里的属性名集合，用于「去重」：元素自带样式优先，模板里冲突的属性丢掉
  function existingProps(existing) {
    const set = new Set();
    existing.split(";").forEach((pair) => {
      const i = pair.indexOf(":");
      if (i > 0) set.add(pair.slice(0, i).trim().toLowerCase());
    });
    return set;
  }
  wrapper.querySelectorAll("*").forEach((el) => {
    const tag = el.tagName.toLowerCase();
    const decl = t.styles[tag];
    const existing = el.getAttribute("style") || "";
    if (decl) {
      // 去掉模板里与已有样式冲突的声明，避免脏输出与潜在冲突
      const props = existingProps(existing);
      const kept = decl.split(";").filter((pair) => {
        const i = pair.indexOf(":");
        const p = i > 0 ? pair.slice(0, i).trim().toLowerCase() : "";
        return p && !props.has(p);
      }).join(";");
      el.setAttribute("style", (kept ? kept + ";" : "") + fontDecl + existing);
    } else if (fontDecl) {
      el.setAttribute("style", fontDecl + existing);
    }
  });

  return wrapper.outerHTML;
}

// 解析颜色亮度（用于判断代码块明暗，决定高亮配色）
function colorLuminance(color) {
  if (!color) return 1;
  color = color.trim();
  let m;
  if ((m = color.match(/#([0-9a-f]{6})/i))) {
    const n = parseInt(m[1], 16);
    return 0.2126 * ((n >> 16) & 255) / 255 + 0.7152 * ((n >> 8) & 255) / 255 + 0.0722 * (n & 255) / 255;
  }
  if ((m = color.match(/#([0-9a-f]{3})/i))) {
    const s = m[1];
    return 0.2126 * parseInt(s[0] + s[0], 16) / 255 + 0.7152 * parseInt(s[1] + s[1], 16) / 255 + 0.0722 * parseInt(s[2] + s[2], 16) / 255;
  }
  if ((m = color.match(/rgba?\(([^)]+)\)/i))) {
    const p = m[1].split(",").map((x) => parseFloat(x));
    return 0.2126 * (p[0] / 255) + 0.7152 * (p[1] / 255) + 0.0722 * (p[2] / 255);
  }
  return 1;
}

// 该模板的代码块背景是否为深色（决定高亮配色）
function isDarkCode(t) {
  const m = (t.styles.pre || "").match(/background:\s*([^;]+)/);
  const bg = m ? m[1].trim() : "#ffffff";
  return colorLuminance(bg) < 0.5;
}

function getTemplate(id) {
  return TEMPLATES.find((t) => t.id === id) || TEMPLATES[0];
}

if (typeof window !== "undefined") {
  window.TEMPLATES = TEMPLATES;
  window.templatePreviewCss = templatePreviewCss;
  window.applyInlineStyles = applyInlineStyles;
  window.getTemplate = getTemplate;
  window.isDarkCode = isDarkCode;
}
