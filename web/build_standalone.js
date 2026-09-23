// 把网页版打包成自包含单文件：内联 web.css + 所有 <script src> 引擎文件
const fs = require('fs'), path = require('path');
const webDir = 'C:/Users/ga/WorkBuddy/2026-09-19-08-44-39/wechat-formatter/web';
const rootDir = 'C:/Users/ga/WorkBuddy/2026-09-19-08-44-39/wechat-formatter';

let html = fs.readFileSync(webDir + '/index.html', 'utf8');

// 内联 CSS
const css = fs.readFileSync(webDir + '/web.css', 'utf8');
html = html.replace(/<link[^>]*rel="stylesheet"[^>]*href="web.css"[^>]*>/,
  '<style>\n' + css + '\n</style>');

// 内联脚本（处理 ../js/ 与 web/ 两种相对路径；转义 </script> 防截断）
html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => {
  const fp = src.startsWith('../')
    ? path.resolve(rootDir, src.slice(3))
    : path.resolve(webDir, src);
  let code = fs.readFileSync(fp, 'utf8');
  code = code.replace(/<\/script>/gi, '<\\/script>');
  return '<script>\n' + code + '\n</script>';
});

fs.writeFileSync(webDir + '/standalone.html', html);
console.log('standalone.html generated, bytes:', html.length);
