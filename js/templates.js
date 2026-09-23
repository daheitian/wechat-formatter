// templates.js
// 公众号排版模板系统（参考 Typora / Bear / iA Presenter 设计语言 · 18 套，分系列）。
// 每个模板由 base（容器样式）、styles（各元素的内联 CSS 声明字符串）、series（系列）、accent（强调色）组成。
// - templatePreviewCss(t): 生成用于编辑器/预览实时预览的样式表
// - applyInlineStyles(t, html): 把语义化 HTML 转成微信编辑器友好的「全内联样式」HTML
// - markdownToHtml(md): 轻量 Markdown 解析（见 markdown.js）
//
// 设计语言：
//   Typora 系列 —— 干净文档排版：克制字重、舒适行距、浅灰代码底、细分割线、链接低调。
//   Bear 系列   —— 温暖圆润：奶油底/暖黑底、招牌暖黄(或薄荷)强调、10–12px 大圆角、亲和留白。
//   字体系列    —— 靠字体本身立气质（取自 iA Presenter Typographic 主题）：
//                  Helvetica 瑞士国际主义（强层级、黑白+瑞士红、零圆角、规则线）；
//                  Garamond 文艺复兴书籍体（象牙纸、居中标题、小型大写、酒红墨色）。
//
// 对齐（全局开关 FORCE_JUSTIFY，默认 true）：
//   默认所有模板的正文 / 列表 / 引用一律两端对齐；作者显式写的居中 / 右对齐不受影响。
//   关掉后回到「各模板自己说了算」——写出 text-align 的模板按其设计（如 Helvetica 齐左不齐右），
//   没写的才补 justify。「模板预览样式表」与「导出内联样式」共用同一套规则，保证所见即所得。

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
  // 见室品牌 DNA（与 SEES MOOK 封面系统一致）：黑 + 暖白双色出版系统。
  //   油墨 Charcoal #30343A（非纯黑，含暖灰）、纸张 Pale Beige #F5F1E8（象牙暖白）。
  //   禁止彩色 —— 层级全靠字重 / 字号 / 细线 / 留白建立，不靠色相。
  //   中文宋体（雕版感），字间距紧凑，气质克制·理性·安静·知识性（Swiss Editorial）。
  {
    id: "sees",
    name: "见室",
    desc: "黑 + 暖白双色 · 宋体雕版 · 编辑级留白",
    series: "见室品牌",
    accent: "#30343A",
    base: {
      fontFamily: '"Songti SC","Source Han Serif SC","STSong","SimSun",Georgia,serif',
      fontSize: "17px", color: "#30343A", lineHeight: "1.9",
      letterSpacing: "0", background: "#F5F1E8", padding: "22px 16px", maxWidth: "680px"
    },
    styles: {
      // 巨标题：居中、紧凑字距、接近封面巨型宋体的严肃感（行高由引擎下限锁 1.5×）
      h1: "font-size:27px;font-weight:700;color:#1f1d1a;text-align:center;margin:34px 0 22px;letter-spacing:1px;line-height:1.3;font-family:'Songti SC',serif;",
      // 一级节：左对齐宋体 + 细墨线分隔（编辑级 section rule），替代粗彩条
      h2: "font-size:21px;font-weight:700;color:#1f1d1a;margin:32px 0 14px;padding-bottom:10px;border-bottom:1px solid rgba(48,52,58,0.22);line-height:1.35;font-family:'Songti SC',serif;letter-spacing:0.5px;",
      // 二级节：墨色左标线 subsection marker，无彩色
      h3: "font-size:18px;font-weight:700;color:#1f1d1a;margin:26px 0 12px;padding-left:12px;border-left:3px solid rgba(48,52,58,0.55);line-height:1.4;font-family:'Songti SC',serif;letter-spacing:0.3px;",
      // 正文：17px / 行距 1.9 / 零字距（中文不需 tracking，旧版 0.6px 显得松散）
      p: "font-size:17px;line-height:1.9;color:#30343A;margin:0 0 18px;letter-spacing:0.3px;",
      // 引文：暖灰底 + 墨色左线，文字降一阶灰度，不换色相
      blockquote: "font-size:16px;color:#4a4640;background:#ECE6DA;border-left:3px solid rgba(48,52,58,0.3);padding:14px 18px;margin:0 0 18px;line-height:1.8;border-radius:4px;",
      ul: "font-size:17px;color:#30343A;padding-left:26px;margin:0 0 18px;line-height:1.9;",
      ol: "font-size:17px;color:#30343A;padding-left:26px;margin:0 0 18px;line-height:1.9;",
      li: "margin:6px 0;",
      // 代码：反相（墨底 + 象牙字），直接呼应黑+暖白双色系统
      pre: "background:#30343A;color:#F5F1E8;padding:16px 18px;border-radius:6px;font-size:14px;overflow:auto;margin:0 0 18px;font-family:Consolas,Menlo,monospace;line-height:1.55;",
      code: "background:#ECE6DA;padding:0.2em 0.45em;border-radius:4px;font-size:14px;color:#5a5249;font-family:Consolas,Menlo,monospace;",
      // 分隔：短居中细墨线（出版物式优雅分隔），替代贯穿彩线
      hr: "border:none;border-top:1px solid rgba(48,52,58,0.2);width:64px;margin:32px auto;",
      img: "max-width:100%;border-radius:8px;display:block;margin:20px auto;box-shadow:0 2px 12px rgba(48,52,58,0.10);",
      // 链接：墨色 + 细下划线，不引入蓝/金
      a: "color:#30343A;text-decoration:none;border-bottom:1px solid rgba(48,52,58,0.45);",
      strong: "color:#1f1d1a;font-weight:700;",
      em: "font-style:italic;color:#1f1d1a;",
      // 表格：暖灰描边 + 象牙底，与双色系统一致
      table: "width:100%;border-collapse:collapse;margin:0 0 18px;font-size:15px;",
      th: "border:1px solid rgba(48,52,58,0.2);padding:9px 11px;background:#ECE6DA;font-weight:700;text-align:left;color:#1f1d1a;",
      td: "border:1px solid rgba(48,52,58,0.18);padding:9px 11px;color:#30343A;"
    }
  },

  // ---------------- 极简系列（iA Writer 风格） ----------------
  // iA Writer 设计 DNA：极简黑白、零装饰、少即是多。签名元素是「iA 蓝链接」+
  // Duospace 等宽节奏（拉丁文等宽、中文回退系统黑体），纯白底近黑字，超大留白。
  // 字体栈把等宽字体放前、CJK 系统黑体放后 —— 拉丁/数字走 Duospace 节奏，中文自动回退，
  // 这正是 iA Writer 中英混排的真实做法。
  {
    id: "ia-writer",
    name: "iA Writer",
    desc: "极简黑白 · 蓝链接 · 等宽节奏",
    series: "极简系列",
    accent: "#2d7ff9",
    base: {
      fontFamily: '"iA Writer Duo","iA Writer Mono","IBM Plex Mono","SF Mono",Menlo,Consolas,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif',
      fontSize: "17px", color: "#1a1a1a", lineHeight: "1.7",
      letterSpacing: "0", background: "#ffffff", padding: "20px 16px", maxWidth: "680px"
    },
    styles: {
      // 标题：左对齐、纯黑、靠字号字重建立层级，无彩条无边框（iA 的「省略」哲学）
      h1: "font-size:26px;font-weight:700;color:#000000;margin:30px 0 16px;letter-spacing:-0.2px;line-height:1.35;",
      h2: "font-size:21px;font-weight:700;color:#000000;margin:28px 0 14px;line-height:1.4;",
      h3: "font-size:18px;font-weight:700;color:#000000;margin:24px 0 12px;line-height:1.4;",
      // 正文：17px / 行距 1.7 / 零字距，近黑字配纯白底，高对比、克制
      p: "font-size:17px;line-height:1.7;color:#1a1a1a;margin:0 0 18px;letter-spacing:0;",
      // 引文：极轻灰左线 + 降一阶灰度，无底色块（不喧宾夺主）
      blockquote: "font-size:16px;color:#5a5a5a;border-left:3px solid #e2e2e2;padding:2px 0 2px 16px;margin:0 0 18px;line-height:1.7;",
      ul: "font-size:17px;color:#1a1a1a;padding-left:24px;margin:0 0 18px;line-height:1.7;",
      ol: "font-size:17px;color:#1a1a1a;padding-left:24px;margin:0 0 18px;line-height:1.7;",
      li: "margin:5px 0;",
      // 代码：浅灰底 + 等宽，呼应 Duospace；不与正文抢色
      pre: "background:#f5f5f5;color:#1a1a1a;padding:14px 16px;border-radius:4px;font-size:14px;overflow:auto;margin:0 0 18px;font-family:'iA Writer Duo','IBM Plex Mono',Menlo,Consolas,monospace;line-height:1.5;",
      code: "background:#f0f0f0;color:#1a1a1a;padding:0.2em 0.4em;border-radius:3px;font-size:14px;font-family:'iA Writer Duo','IBM Plex Mono',Menlo,Consolas,monospace;",
      // 分隔：一道极淡灰发丝线，全宽不张扬
      hr: "border:none;border-top:1px solid #e6e6e6;margin:28px 0;",
      // 图片：近乎直角（iA 的锋利极简），无阴影、无圆角堆叠
      img: "max-width:100%;border-radius:2px;display:block;margin:18px auto;",
      // 链接：签名 iA 蓝 + 细下划线，全篇唯一的彩色
      a: "color:#2d7ff9;text-decoration:none;border-bottom:1px solid rgba(45,127,249,0.35);",
      strong: "color:#000000;font-weight:700;",
      em: "font-style:italic;color:#1a1a1a;",
      table: "width:100%;border-collapse:collapse;margin:0 0 18px;font-size:15px;",
      th: "border:1px solid #e2e2e2;padding:8px 10px;background:#f5f5f5;font-weight:700;text-align:left;color:#000000;",
      td: "border:1px solid #e2e2e2;padding:8px 10px;color:#1a1a1a;"
    }
  },

  // ---------------- 刊物系列 ----------------
  // 五大刊物的排版 DNA（经官方 style guide / 品牌色核实），每套只保留一个签名元素，
  // 让人一眼认出「这是哪家」——不堆装饰，签名即识别。

  // 《纽约时报》：白纸 + 墨色 #121212，Cheltenham/Imperial 衬线三件套，发丝线分栏，
  // 签名 = 「斜体引文夹在两条粗墨线之间」（全网被抄袭最多的编辑瞬间）+ 编辑蓝 #326891。
  // 直角主义：全系统最大圆角 4px，broadsheet 拒绝圆润。
  {
    id: "press-nyt",
    name: "纽约时报",
    desc: "白纸墨色 · 双墨线斜体引文 · 编辑蓝",
    series: "刊物系列",
    accent: "#326891",
    base: {
      fontFamily: 'Georgia,"Cheltenham","Times New Roman","Noto Serif SC","Songti SC","SimSun",serif',
      fontSize: "17px", color: "#121212", lineHeight: "1.85",
      letterSpacing: "0", background: "#ffffff", padding: "20px 16px", maxWidth: "640px"
    },
    styles: {
      // 标题：居中衬线，报头式的端正；不彩不粗过界，靠字号与留白立住
      h1: "font-size:26px;font-weight:700;color:#121212;text-align:center;margin:32px 0 20px;letter-spacing:0.5px;line-height:1.5;",
      h2: "font-size:20px;font-weight:700;color:#121212;margin:30px 0 14px;padding-bottom:8px;border-bottom:1px solid #dfdfdf;line-height:1.5;",
      h3: "font-size:17px;font-weight:700;color:#121212;margin:24px 0 12px;line-height:1.5;",
      p: "font-size:17px;line-height:1.85;color:#121212;margin:0 0 20px;letter-spacing:0;",
      // 签名引文：斜体、居中、夹在两条粗细不一的墨线之间（NYT pull-quote 的经典构造）
      blockquote: "font-size:18px;font-style:italic;color:#363636;text-align:center;border-top:2px solid #121212;border-bottom:1px solid #121212;padding:16px 8px;margin:0 0 22px;line-height:1.8;",
      ul: "font-size:17px;color:#121212;padding-left:26px;margin:0 0 20px;line-height:1.85;",
      ol: "font-size:17px;color:#121212;padding-left:26px;margin:0 0 20px;line-height:1.85;",
      li: "margin:6px 0;",
      pre: "background:#f7f7f7;color:#121212;padding:14px 16px;border-radius:2px;font-size:14px;overflow:auto;margin:0 0 20px;font-family:Menlo,Consolas,'Courier New',monospace;line-height:1.5;",
      code: "background:#f0f0f0;color:#121212;padding:0.2em 0.4em;border-radius:2px;font-size:14px;font-family:Menlo,Consolas,'Courier New',monospace;",
      hr: "border:none;border-top:1px solid #dfdfdf;margin:30px 0;",
      // 直角：broadsheet 美学拒绝圆角与阴影
      img: "max-width:100%;border-radius:0;display:block;margin:20px auto;",
      a: "color:#326891;text-decoration:none;border-bottom:1px solid rgba(50,104,145,0.4);",
      strong: "color:#121212;font-weight:700;",
      em: "font-style:italic;color:#121212;",
      table: "width:100%;border-collapse:collapse;margin:0 0 20px;font-size:15px;",
      th: "border:none;border-bottom:2px solid #121212;padding:8px 10px;font-weight:700;text-align:left;color:#121212;",
      td: "border:none;border-bottom:1px solid #dfdfdf;padding:8px 10px;color:#121212;"
    }
  },

  // 《TIME》：签名 = 那个红框。红 #E90606 近百年不变、使用极度节制，
  // 米白 Linen 纸底 #FCF3ED 是它安静的舞台——红色只出现在标题框、链接与引文线上。
  {
    id: "press-time",
    name: "TIME",
    desc: "米白纸底 · 红框标题 · 签名红",
    series: "刊物系列",
    accent: "#E90606",
    base: {
      fontFamily: 'Georgia,"Times New Roman","Noto Serif SC","Songti SC","SimSun",serif',
      fontSize: "17px", color: "#1b1b1b", lineHeight: "1.85",
      letterSpacing: "0", background: "#FCF3ED", padding: "20px 16px", maxWidth: "660px"
    },
    styles: {
      // 签名标题：标题住进红框里——那道近百年不变的红边框
      h1: "font-size:25px;font-weight:700;color:#1b1b1b;text-align:center;border:3px solid #E90606;padding:18px 16px;margin:30px 0 24px;letter-spacing:1px;line-height:1.5;",
      h2: "font-size:20px;font-weight:700;color:#1b1b1b;margin:30px 0 14px;line-height:1.5;",
      h3: "font-size:17px;font-weight:700;color:#1b1b1b;margin:24px 0 12px;line-height:1.5;",
      p: "font-size:17px;line-height:1.85;color:#1b1b1b;margin:0 0 20px;letter-spacing:0;",
      // 引文：红色左线是红框的回声，全篇红色三处之一，克制
      blockquote: "font-size:16px;color:#4a4038;border-left:3px solid #E90606;padding:10px 16px;margin:0 0 20px;line-height:1.8;",
      ul: "font-size:17px;color:#1b1b1b;padding-left:26px;margin:0 0 20px;line-height:1.85;",
      ol: "font-size:17px;color:#1b1b1b;padding-left:26px;margin:0 0 20px;line-height:1.85;",
      li: "margin:6px 0;",
      pre: "background:#1b1b1b;color:#FCF3ED;padding:14px 16px;border-radius:0;font-size:14px;overflow:auto;margin:0 0 20px;font-family:Menlo,Consolas,monospace;line-height:1.5;",
      code: "background:#f0e4da;color:#1b1b1b;padding:0.2em 0.4em;border-radius:2px;font-size:14px;font-family:Menlo,Consolas,monospace;",
      hr: "border:none;border-top:1px solid #e2d2c4;margin:30px 0;",
      img: "max-width:100%;border-radius:0;display:block;margin:20px auto;",
      a: "color:#E90606;text-decoration:none;border-bottom:1px solid rgba(233,6,6,0.35);",
      strong: "color:#1b1b1b;font-weight:700;",
      em: "font-style:italic;color:#1b1b1b;",
      table: "width:100%;border-collapse:collapse;margin:0 0 20px;font-size:15px;",
      th: "border:1px solid #e2d2c4;padding:8px 10px;background:#f5e9df;font-weight:700;text-align:left;color:#1b1b1b;",
      td: "border:1px solid #e2d2c4;padding:8px 10px;color:#1b1b1b;"
    }
  },

  // 《卫报》：签名 = 深蓝 #052962（数字系统锚色）+ 4px 板块顶条 + 意大利体引文夹双蓝线。
  // 标题用超重字重立住 slab 气质；链接用卫报的暖红 #c70000，与深蓝标题形成品牌对色。
  {
    id: "press-guardian",
    name: "卫报",
    desc: "深蓝 #052962 · 板块顶条 · 暖红链接",
    series: "刊物系列",
    accent: "#052962",
    base: {
      fontFamily: 'Georgia,"Noto Serif SC","Source Han Serif SC","Songti SC","SimSun",serif',
      fontSize: "17px", color: "#121212", lineHeight: "1.85",
      letterSpacing: "0", background: "#ffffff", padding: "20px 16px", maxWidth: "640px"
    },
    styles: {
      // 签名标题：Guardian 深蓝 + 超重字重，上方 4px 板块顶条（卫报的导航性色彩信号）
      h1: "font-size:26px;font-weight:900;color:#052962;border-top:4px solid #052962;padding-top:16px;margin:28px 0 18px;line-height:1.5;",
      h2: "font-size:20px;font-weight:800;color:#052962;margin:30px 0 14px;line-height:1.5;",
      h3: "font-size:17px;font-weight:800;color:#121212;margin:24px 0 12px;line-height:1.5;",
      p: "font-size:17px;line-height:1.85;color:#121212;margin:0 0 20px;letter-spacing:0;",
      // 签名引文：意大利体夹在两条卫报蓝线之间（卫报 pull-quote 构造）
      blockquote: "font-size:18px;font-style:italic;font-weight:700;color:#052962;border-top:2px solid #052962;border-bottom:2px solid #052962;padding:16px 8px;margin:0 0 22px;line-height:1.8;",
      ul: "font-size:17px;color:#121212;padding-left:26px;margin:0 0 20px;line-height:1.85;",
      ol: "font-size:17px;color:#121212;padding-left:26px;margin:0 0 20px;line-height:1.85;",
      li: "margin:6px 0;",
      pre: "background:#f6f6f6;color:#121212;padding:14px 16px;border-radius:0;font-size:14px;overflow:auto;margin:0 0 20px;font-family:Menlo,Consolas,monospace;line-height:1.5;border-top:3px solid #052962;",
      code: "background:#ededed;color:#121212;padding:0.2em 0.4em;border-radius:2px;font-size:14px;font-family:Menlo,Consolas,monospace;",
      hr: "border:none;border-top:1px solid #dcdcdc;margin:30px 0;",
      img: "max-width:100%;border-radius:0;display:block;margin:20px auto;",
      a: "color:#c70000;text-decoration:none;border-bottom:1px solid rgba(199,0,0,0.35);",
      strong: "color:#052962;font-weight:800;",
      em: "font-style:italic;color:#121212;",
      table: "width:100%;border-collapse:collapse;margin:0 0 20px;font-size:15px;",
      th: "border:none;border-top:4px solid #052962;border-bottom:1px solid #dcdcdc;padding:8px 10px;font-weight:800;text-align:left;color:#052962;",
      td: "border:none;border-bottom:1px solid #dcdcdc;padding:8px 10px;color:#121212;"
    }
  },

  // 《WIRED》：签名 = 黑白高对比 + 黑底白字标签。超重黑体标题压一道粗黑底线，
  // h2 做成黑底白字「板块标签」——杂志栏目标签的印刷感，数字端一眼认出。
  {
    id: "press-wired",
    name: "WIRED",
    desc: "黑白高对比 · 黑底标签 · 超重标题",
    series: "刊物系列",
    accent: "#0a0a0a",
    base: {
      fontFamily: '"Helvetica Neue",Helvetica,Arial,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif',
      fontSize: "17px", color: "#0a0a0a", lineHeight: "1.8",
      letterSpacing: "0", background: "#ffffff", padding: "20px 16px", maxWidth: "660px"
    },
    styles: {
      // 签名标题：超重黑体 + 粗黑底线，杂志封面的力量感
      h1: "font-size:28px;font-weight:900;color:#0a0a0a;border-bottom:5px solid #0a0a0a;padding-bottom:10px;margin:30px 0 20px;letter-spacing:0.5px;line-height:1.5;",
      // 签名 h2：黑底白字板块标签（inline-block 使色块只包住文字）
      h2: "font-size:17px;font-weight:800;color:#ffffff;background:#0a0a0a;display:inline-block;padding:6px 14px;margin:26px 0 14px;letter-spacing:1px;line-height:1.5;",
      h3: "font-size:18px;font-weight:800;color:#0a0a0a;margin:24px 0 12px;line-height:1.5;",
      p: "font-size:17px;line-height:1.8;color:#0a0a0a;margin:0 0 20px;letter-spacing:0;",
      blockquote: "font-size:19px;font-weight:800;color:#0a0a0a;border-left:6px solid #0a0a0a;padding:6px 0 6px 18px;margin:0 0 22px;line-height:1.7;",
      ul: "font-size:17px;color:#0a0a0a;padding-left:24px;margin:0 0 20px;line-height:1.8;",
      ol: "font-size:17px;color:#0a0a0a;padding-left:24px;margin:0 0 20px;line-height:1.8;",
      li: "margin:6px 0;",
      // 代码反相：墨底白字，呼应黑签系统
      pre: "background:#0a0a0a;color:#ffffff;padding:14px 16px;border-radius:0;font-size:14px;overflow:auto;margin:0 0 20px;font-family:'SF Mono',Menlo,Consolas,monospace;line-height:1.5;",
      code: "background:#f0f0f0;color:#0a0a0a;padding:0.2em 0.4em;border-radius:2px;font-size:14px;font-family:'SF Mono',Menlo,Consolas,monospace;",
      // 粗黑分隔线：WIRED 的果断
      hr: "border:none;border-top:3px solid #0a0a0a;margin:30px 0;",
      img: "max-width:100%;border-radius:0;display:block;margin:20px auto;",
      a: "color:#0a0a0a;font-weight:700;text-decoration:none;border-bottom:2px solid #0a0a0a;",
      strong: "color:#0a0a0a;font-weight:800;",
      em: "font-style:italic;color:#0a0a0a;",
      table: "width:100%;border-collapse:collapse;margin:0 0 20px;font-size:15px;",
      th: "border:none;background:#0a0a0a;color:#ffffff;padding:8px 10px;font-weight:800;text-align:left;",
      td: "border:none;border-bottom:1px solid #dcdcdc;padding:8px 10px;color:#0a0a0a;"
    }
  },

  // 《福布斯》：官方 style guide = Merriweather 粗衬线标题 + Work Sans 标签 + Georgia 正文。
  // 签名 = 粗衬线大标题配 Work Sans 小字距标签（h2 用无衬线、字距拉开、发丝线收尾），
  // 引文用 breaking red #D8361E，商务感与温度并存。
  {
    id: "press-forbes",
    name: "Forbes",
    desc: "粗衬线标题 · Work Sans 标签 · 商务红引文",
    series: "刊物系列",
    accent: "#0066B2",
    base: {
      fontFamily: 'Georgia,"Merriweather","Noto Serif SC","Source Han Serif SC","Songti SC",serif',
      fontSize: "17px", color: "#333333", lineHeight: "1.85",
      letterSpacing: "0", background: "#FCFCFC", padding: "20px 16px", maxWidth: "660px"
    },
    styles: {
      // 标题：Merriweather 式粗衬线，near-black #181716（site-black）
      h1: "font-size:26px;font-weight:800;color:#181716;margin:30px 0 18px;line-height:1.5;",
      // 签名 h2：Work Sans 标签——无衬线、semibold、拉开字距、发丝线收尾（官网 utility 用法）
      h2: "font-size:16px;font-weight:600;color:#181716;font-family:'Helvetica Neue',Arial,'PingFang SC','Microsoft YaHei',sans-serif;letter-spacing:2px;border-bottom:1px solid #E2E2E2;padding-bottom:8px;margin:30px 0 14px;line-height:1.5;",
      h3: "font-size:17px;font-weight:700;color:#181716;margin:24px 0 12px;line-height:1.5;",
      p: "font-size:17px;line-height:1.85;color:#333333;margin:0 0 20px;letter-spacing:0;",
      // 引文：Georgia 斜体 + 浅灰底 + breaking red 左线（福布斯的关键时刻色）
      blockquote: "font-size:17px;font-style:italic;color:#212424;background:#F4F4F4;border-left:3px solid #D8361E;padding:14px 18px;margin:0 0 20px;line-height:1.8;",
      ul: "font-size:17px;color:#333333;padding-left:26px;margin:0 0 20px;line-height:1.85;",
      ol: "font-size:17px;color:#333333;padding-left:26px;margin:0 0 20px;line-height:1.85;",
      li: "margin:6px 0;",
      pre: "background:#212424;color:#FCFCFC;padding:14px 16px;border-radius:0;font-size:14px;overflow:auto;margin:0 0 20px;font-family:Menlo,Consolas,monospace;line-height:1.5;",
      code: "background:#F0F0F0;color:#212424;padding:0.2em 0.4em;border-radius:2px;font-size:14px;font-family:Menlo,Consolas,monospace;",
      hr: "border:none;border-top:1px solid #E2E2E2;margin:30px 0;",
      img: "max-width:100%;border-radius:2px;display:block;margin:20px auto;",
      a: "color:#0066B2;text-decoration:none;border-bottom:1px solid rgba(0,102,178,0.35);",
      strong: "color:#181716;font-weight:700;",
      em: "font-style:italic;color:#333333;",
      table: "width:100%;border-collapse:collapse;margin:0 0 20px;font-size:15px;",
      th: "border:none;border-bottom:2px solid #181716;padding:8px 10px;font-weight:700;text-align:left;color:#181716;",
      td: "border:none;border-bottom:1px solid #E2E2E2;padding:8px 10px;color:#333333;"
    }
  },

  // 《Every》(every.to)：签名 = 超大衬线标题 + 无衬线正文（serif-headline / sans-body 反差，
  // 与 NYT/卫报全衬线形成差异）+ 极简黑白 + 一抹暖珊瑚强调。栏目小标签（大写、拉字距、细顶线）
  // 与编辑式大留白是其可辨识的骨架。
  {
    id: "every",
    name: "Every",
    desc: "衬线大标题 · 无衬线正文 · 暖珊瑚",
    series: "刊物系列",
    accent: "#E8541E",
    base: {
      fontFamily: '-apple-system,BlinkMacSystemFont,"PingFang SC","Helvetica Neue","Microsoft YaHei",sans-serif',
      fontSize: "17px", color: "#141414", lineHeight: "1.75",
      letterSpacing: "0", background: "#ffffff", padding: "22px 18px", maxWidth: "680px"
    },
    styles: {
      // 签名标题：超大衬线展示体，紧字距、紧行距，杂志封面般的张力
      h1: "font-size:30px;font-weight:700;color:#141414;font-family:Georgia,\"Times New Roman\",\"Noto Serif SC\",\"Songti SC\",serif;letter-spacing:-0.5px;line-height:1.2;margin:30px 0 18px;",
      // 签名 h2：栏目小标签——无衬线、大写、拉字距，配一道细顶线（Every 的 section label 用法）
      h2: "font-size:15px;font-weight:700;color:#E8541E;font-family:-apple-system,\"PingFang SC\",\"Helvetica Neue\",sans-serif;text-transform:uppercase;letter-spacing:1px;border-top:2px solid #141414;padding-top:10px;margin:34px 0 16px;line-height:1.4;",
      // 子标题回到衬线，承接大标题
      h3: "font-size:21px;font-weight:700;color:#141414;font-family:Georgia,\"Noto Serif SC\",\"Songti SC\",serif;margin:28px 0 14px;line-height:1.3;",
      // 正文：干净无衬线（Every 的 utility 取向），衬线只留给标题
      p: "font-size:17px;line-height:1.75;color:#141414;margin:0 0 20px;letter-spacing:0;",
      // 引文：大号衬线斜体 + 上下细黑线（Every 的 pull-quote 构造）
      blockquote: "font-size:20px;font-style:italic;font-weight:600;color:#141414;font-family:Georgia,\"Noto Serif SC\",\"Songti SC\",serif;border-top:1px solid #141414;border-bottom:1px solid #141414;padding:16px 4px;margin:0 0 22px;line-height:1.5;",
      ul: "font-size:17px;color:#141414;padding-left:24px;margin:0 0 20px;line-height:1.75;",
      ol: "font-size:17px;color:#141414;padding-left:24px;margin:0 0 20px;line-height:1.75;",
      li: "margin:6px 0;",
      pre: "background:#141414;color:#ffffff;padding:14px 16px;border-radius:0;font-size:14px;overflow:auto;margin:0 0 20px;font-family:Menlo,Consolas,monospace;line-height:1.5;",
      code: "background:#f0f0f0;color:#141414;padding:0.2em 0.4em;border-radius:2px;font-size:14px;font-family:Menlo,Consolas,monospace;",
      hr: "border:none;border-top:1px solid #141414;margin:32px 0;",
      img: "max-width:100%;border-radius:0;display:block;margin:22px auto;",
      a: "color:#E8541E;text-decoration:none;border-bottom:1px solid rgba(232,84,30,0.4);",
      strong: "color:#141414;font-weight:700;",
      em: "font-style:italic;color:#141414;",
      table: "width:100%;border-collapse:collapse;margin:0 0 20px;font-size:15px;",
      th: "border:none;border-bottom:2px solid #141414;padding:8px 10px;font-weight:700;text-align:left;color:#141414;",
      td: "border:none;border-bottom:1px solid #e2e2e2;padding:8px 10px;color:#141414;"
    }
  },

  // ---------------- 字体系列（iA Presenter 的 Typographic 主题） ----------------
  // 这一组不靠配色取胜，全靠「字体本身的语言」立住气质：
  //   Helvetica —— 瑞士国际主义。无衬线、齐左不齐右、极端层级的字号跳跃、只用黑白与一抹瑞士红、
  //   零圆角零阴影，分隔靠「线」而不是「色块」。反差来自层级而非装饰。
  //   Garamond  —— 文艺复兴书籍体。象牙纸、居中标题、小型大写字母、细发丝线、酒红墨色，
  //   两端对齐 + 1.9 行距，读起来像一本印刷出来的书，而不是一块屏幕。
  {
    id: "ia-helvetica",
    name: "Helvetica",
    desc: "瑞士国际主义 · 无衬线强层级 · 零圆角规则线",
    series: "字体系列",
    accent: "#E30613",
    base: {
      fontFamily: '"Helvetica Neue",Helvetica,Arial,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif',
      fontSize: "17px", color: "#111111", lineHeight: "1.72",
      letterSpacing: "0", background: "#ffffff", padding: "10px 8px", maxWidth: "700px"
    },
    styles: {
      // 签名标题：字号跳跃是瑞士风格的骨架，紧字距压出重量感
      h1: "font-size:30px;font-weight:700;color:#111111;letter-spacing:-0.6px;line-height:1.22;text-align:left;margin:30px 0 18px;",
      // 签名 h2：一道 2px 实心黑线压在标题上方（瑞士风格的「规则线」用法），替代一切装饰
      h2: "font-size:22px;font-weight:700;color:#111111;letter-spacing:-0.3px;line-height:1.3;text-align:left;border-top:2px solid #111111;padding-top:12px;margin:34px 0 14px;",
      // 三级标题退成「标签」：小号大写 + 拉字距，层级因此比常规模板多出一档
      h3: "font-size:13px;font-weight:700;color:#111111;letter-spacing:1.6px;text-transform:uppercase;line-height:1.5;text-align:left;margin:26px 0 10px;",
      // 正文齐左不齐右（瑞士风格明确反对两端对齐）——这是「关闭全局两端对齐」时的样子；
      // 开着全局对齐就统一 justify，此处显式 text-align 会被覆盖
      p: "font-size:17px;line-height:1.72;color:#111111;margin:0 0 18px;letter-spacing:0;text-align:left;",
      // 引用不斜体（无衬线斜体在中文里几乎不可读），改用红色竖线 + 加粗来立住
      blockquote: "font-size:19px;line-height:1.6;color:#111111;font-weight:500;border-left:3px solid #E30613;padding:2px 0 2px 18px;margin:0 0 20px;text-align:left;",
      ul: "font-size:17px;color:#111111;padding-left:22px;margin:0 0 18px;line-height:1.72;",
      ol: "font-size:17px;color:#111111;padding-left:22px;margin:0 0 18px;line-height:1.72;",
      li: "margin:6px 0;",
      pre: "background:#F2F2F2;color:#111111;padding:15px 16px;border-radius:0;font-size:14px;line-height:1.55;overflow:auto;margin:0 0 20px;font-family:Menlo,Consolas,monospace;text-align:left;",
      code: "background:#EFEFEF;color:#111111;padding:0.15em 0.35em;border-radius:0;font-size:14px;font-family:Menlo,Consolas,monospace;",
      // 分割线是一条真正的「规则线」：2px 纯黑，通栏
      hr: "border:none;border-top:2px solid #111111;margin:34px 0;",
      img: "max-width:100%;border-radius:0;display:block;margin:20px auto;",
      a: "color:#E30613;text-decoration:none;border-bottom:1px solid rgba(227,6,19,0.35);",
      strong: "color:#111111;font-weight:700;",
      em: "font-style:italic;color:#111111;",
      mark: "background:#FFE94A;color:#111111;padding:0 3px;",
      table: "width:100%;border-collapse:collapse;margin:0 0 20px;font-size:15px;",
      th: "border:none;border-bottom:2px solid #111111;padding:8px 10px;font-weight:700;text-align:left;color:#111111;",
      td: "border:none;border-bottom:1px solid #E4E4E4;padding:8px 10px;color:#111111;"
    }
  },
  {
    id: "ia-garamond",
    name: "Garamond",
    desc: "文艺复兴书籍体 · 居中标题 · 温润象牙纸",
    series: "字体系列",
    accent: "#7A3B35",
    base: {
      fontFamily: '"EB Garamond","Adobe Garamond Pro",Garamond,"Palatino Linotype","Book Antiqua","Songti SC","Noto Serif SC",Georgia,serif',
      fontSize: "18px", color: "#2A2621", lineHeight: "1.9",
      letterSpacing: "0.1px", background: "#FBF8F1", padding: "14px 10px", maxWidth: "700px"
    },
    styles: {
      // 居中大标题：文艺复兴书籍的扉页做法，与 Helvetica 的齐左形成最强对照
      h1: "font-size:31px;font-weight:600;color:#2A2621;text-align:center;letter-spacing:0.4px;line-height:1.3;margin:28px 0 22px;",
      // 签名 h2：小型大写字母 + 上下两道发丝线，居中——像书里的章节题头
      h2: "font-size:19px;font-weight:600;color:#2A2621;text-align:center;font-variant:small-caps;letter-spacing:1.6px;line-height:1.5;border-top:1px solid rgba(90,74,58,0.3);border-bottom:1px solid rgba(90,74,58,0.3);padding:9px 0;margin:36px 0 20px;",
      // 三级标题回到齐左 + 斜体，给居中的 h2 让出呼吸
      h3: "font-size:20px;font-weight:600;font-style:italic;color:#453C33;line-height:1.4;text-align:left;margin:28px 0 12px;",
      // 正文两端对齐（不加 text-align，交由导出引擎注入 justify）——铅字排版的默认对齐方式
      p: "font-size:18px;line-height:1.9;color:#2A2621;margin:0 0 22px;letter-spacing:0.1px;",
      blockquote: "font-size:19px;font-style:italic;color:#4A4038;line-height:1.75;border-left:2px solid rgba(122,59,53,0.5);padding:4px 0 4px 20px;margin:0 0 24px;",
      ul: "font-size:18px;color:#2A2621;padding-left:24px;margin:0 0 22px;line-height:1.85;",
      ol: "font-size:18px;color:#2A2621;padding-left:24px;margin:0 0 22px;line-height:1.85;",
      li: "margin:7px 0;",
      pre: "background:#F3EDE1;color:#2A2621;border:1px solid rgba(90,74,58,0.18);padding:16px 18px;border-radius:2px;font-size:14px;line-height:1.6;overflow:auto;margin:0 0 24px;font-family:Menlo,Consolas,monospace;text-align:left;",
      code: "background:rgba(122,59,53,0.07);color:#6B3A33;padding:0.15em 0.35em;border-radius:2px;font-size:15px;font-family:Menlo,Consolas,monospace;",
      // 分割线收成居中的一小段，像书页里的花饰线
      hr: "border:none;border-top:1px solid rgba(90,74,58,0.4);width:72px;margin:36px auto;",
      img: "max-width:100%;display:block;margin:24px auto;",
      a: "color:#7A3B35;text-decoration:none;border-bottom:1px solid rgba(122,59,53,0.4);",
      strong: "color:#2A2621;font-weight:700;",
      em: "font-style:italic;",
      mark: "background:rgba(122,59,53,0.14);color:#2A2621;padding:0 3px;",
      table: "width:100%;border-collapse:collapse;margin:0 0 24px;font-size:16px;",
      th: "border:none;border-bottom:1px solid #2A2621;padding:9px 10px;font-weight:600;font-variant:small-caps;letter-spacing:0.8px;text-align:left;color:#2A2621;",
      td: "border:none;border-bottom:1px solid rgba(90,74,58,0.2);padding:9px 10px;color:#2A2621;"
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

// ---------- 全局对齐策略（两端对齐 / 齐左不齐右） ----------
// 默认「两端对齐」：正文段落 / 列表项 / 引用一律 justify，中文正文左右两侧都齐平，读起来更像印刷品。
// 两条铁律：
//   ① 作者显式写的居中 / 右对齐（NYT 的居中引文、粘来的居中图注）必须尊重，绝不强行拉平；
//   ② 关掉 FORCE_JUSTIFY 就回到「各模板自己说了算」——模板写了 text-align 就听模板的
//      （Helvetica 因此回到齐左不齐右的瑞士风格），没写才补 justify。
// 同一处 styleStr 里若出现多个 text-align（模板 + 粘贴内容），按 CSS 层叠取「最后一个」为准。
const JUSTIFY_TAGS = { p: 1, li: 1, blockquote: 1 };
let FORCE_JUSTIFY = true;

function setForceJustify(v) { FORCE_JUSTIFY = v !== false; return FORCE_JUSTIFY; }
function getForceJustify() { return FORCE_JUSTIFY; }

// 返回该元素最终应写入的 text-align（null = 完全不干预）
function _textAlignFor(styleStr, force) {
  const all = String(styleStr || "").match(/text-align:\s*[a-z\-]+/gi) || [];
  const cur = all.length ? all[all.length - 1].replace(/text-align:\s*/i, "").toLowerCase() : "";
  if (cur === "center" || cur === "right" || cur === "end") return null;
  if (cur && !force) return null;
  return "justify";
}
// 清掉原有 text-align，改写为指定值（放最前，保证优先级）
function _applyTextAlign(styleStr, value) {
  return "text-align:" + value + ";" + String(styleStr || "").replace(/text-align:\s*[a-z\-]+\s*;?/gi, "");
}

// 生成编辑器/预览实时预览样式表（作用于 .editor 容器内的语义元素）
// 对齐策略必须在这里同样生效，否则编辑器显示齐左、导出却是两端对齐 —— 所见非所得。
function templatePreviewCss(t) {
  let css = `.editor{${objToCss(t.base)}}`;
  for (const [tag, decl] of Object.entries(t.styles)) {
    let d = decl;
    if (JUSTIFY_TAGS[tag]) {
      const al = _textAlignFor(d, FORCE_JUSTIFY);
      if (al) d = _applyTextAlign(d, al);
    }
    css += `.editor ${tag}{${d}}`;
  }
  return css;
}

// ---------- 行高安全化：彻底消除微信"行高小于字号"告警 ----------
// 微信实测：行高 < 字号 且多行文本 → 文字重叠。粘贴内容常带来 px / em / % 形式的行高，
// 此前只保护「无单位比值」，px/em/% 直接透传而漏网。现把四种写法统一换算成 px，
// 并对「含文本」的元素强制下限（标题 1.2×、正文 1.5×），保证行高恒 ≥ 字号。
// 无文本元素（如图片拼接用的 line-height:0 容器）保持原值，不做下限干预（微信亦将其排除）。
function _lhToPx(value, fontPx, minRatio, hasText) {
  const v = String(value).trim();
  let px = null;
  if (/^(\d+(\.\d+)?)$/.test(v)) {
    px = parseFloat(v) * fontPx;                 // 无单位比值
  } else if (/^(\d+(\.\d+)?)px$/i.test(v)) {
    px = parseFloat(v);
  } else if (/^(\d+(\.\d+)?)em$/i.test(v)) {
    px = parseFloat(v) * fontPx;
  } else if (/^(\d+(\.\d+)?)%$/i.test(v)) {
    px = parseFloat(v) / 100 * fontPx;
  } else {
    return v;                                    // vh/rem/normal/inherit 等原样保留
  }
  if (hasText) {
    const min = fontPx * (minRatio || 1.5);
    if (px < min) px = min;
  }
  return Math.round(px * 100) / 100 + "px";
}
function _normalizeLhIn(styleStr, fontPx, minRatio, hasText) {
  return (styleStr || "").replace(/line-height:\s*([^;]+)/gi,
    (m, v) => "line-height:" + _lhToPx(v, fontPx, minRatio, hasText));
}
function _fontPxOf(decl, existing, baseFontPx) {
  let m = decl && decl.match(/font-size:\s*(\d+(?:\.\d+)?)px/i);
  if (!m && existing) m = existing.match(/font-size:\s*(\d+(?:\.\d+)?)px/i);
  return m ? parseFloat(m[1]) : baseFontPx;
}

// 把语义化 HTML 转成「全内联样式」的 HTML（微信友好）
function applyInlineStyles(t, html) {
  const doc = new DOMParser().parseFromString(html || "", "text/html");
  const baseFontPx = parseFloat(t.base.fontSize) || 16;
  const baseRatio = parseFloat(t.base.lineHeight) || 1.6;

  // 容器行高也换算成 px
  const baseStyle = Object.assign({}, t.base);
  baseStyle.lineHeight = _lhToPx(t.base.lineHeight, baseFontPx);
  const wrapper = doc.createElement("div");
  wrapper.setAttribute("style", objToCss(baseStyle) + "box-sizing:border-box;");

  while (doc.body.firstChild) wrapper.appendChild(doc.body.firstChild);

  const fontDecl = t.base.fontFamily ? `font-family:${t.base.fontFamily};` : "";
  // 长词（URL 等）超行宽时强制断行，避免撑破容器（对齐策略见文件上方的 JUSTIFY_TAGS / FORCE_JUSTIFY）
  const BREAK_TAGS = { p: 1, li: 1, blockquote: 1, td: 1, th: 1, div: 1, pre: 1, h1: 1, h2: 1, h3: 1, h4: 1, h5: 1, h6: 1 };
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
    let existing = el.getAttribute("style") || "";
    const fontPx = _fontPxOf(decl, existing, baseFontPx);
    const isHeading = /^h[1-6]$/.test(tag);
    const hasText = (el.textContent || "").trim().length > 0;
    // 无文本元素（如图片拼接用的 line-height:0 容器）只保留原始内联样式，不做文本向干预，
    // 以免破坏无缝拼图；微信规范亦将「无文字」容器排除在行高校验之外。
    if (!hasText) {
      el.setAttribute("style", existing || "");
      return;
    }

    let styleStr;
    if (decl) {
      // 去掉模板里与已有样式冲突的声明，避免脏输出与潜在冲突
      const props = existingProps(existing);
      const kept = decl.split(";").filter((pair) => {
        const i = pair.indexOf(":");
        const p = i > 0 ? pair.slice(0, i).trim().toLowerCase() : "";
        return p && !props.has(p);
      }).join(";");
      styleStr = (kept ? kept + ";" : "") + fontDecl + existing;
    } else if (fontDecl) {
      styleStr = fontDecl + existing;
    } else {
      styleStr = existing;
    }
    // 无单位/px/em/% 行高 → px，并保证文本元素行高 ≥ 字号（标题下限 1.2，其余 1.5）
    styleStr = _normalizeLhIn(styleStr, fontPx, isHeading ? 1.2 : 1.5, true);
    // 两端对齐（默认全局生效；居中等显式对齐与「关闭全局对齐」时不动）
    if (JUSTIFY_TAGS[tag]) {
      const al = _textAlignFor(styleStr, FORCE_JUSTIFY);
      if (al) styleStr = _applyTextAlign(styleStr, al);
    }
    // 防溢出：长 URL / 长单词超出列宽时断行（微信安全属性 word-wrap 一并写入）
    if (BREAK_TAGS[tag] && !/overflow-wrap|word-break|word-wrap/i.test(styleStr)) {
      styleStr = "overflow-wrap:break-word;word-wrap:break-word;" + styleStr;
    }
    if (tag === "a" && !/word-break/i.test(styleStr)) {
      styleStr = "word-break:break-all;" + styleStr;
    }
    // 保证每个文本元素都有显式 px 行高（微信校验按元素内联值判读）
    if (!/line-height:/i.test(styleStr)) {
      const ratio = Math.max(baseRatio, isHeading ? 1.2 : 1.5);
      styleStr = "line-height:" + (Math.round(ratio * fontPx * 100) / 100) + "px;" + styleStr;
    }
    el.setAttribute("style", styleStr);
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
  window.setForceJustify = setForceJustify;
  window.getForceJustify = getForceJustify;
}
