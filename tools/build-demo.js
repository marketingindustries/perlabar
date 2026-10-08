// Unisce index.html, CSS e JS in un unico file con i dati di esempio già caricati.
// Uso: node tools/build-demo.js <file-di-uscita.html>
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const css = read('css/style.css');
const js = ['parser', 'analytics', 'demo', 'app'].map(f => read('js/' + f + '.js')).join('\n');
let body = read('index.html').match(/<body>([\s\S]*?)<script src/)[1];
body = body.replace('</header>', '</header>\n<p class="demo-note">Versione dimostrativa con dati di esempio generati al computer (un bar, 120 giorni). Per usare i tuoi dati carica un CSV con “Cambia dati”.</p>');
fs.writeFileSync(process.argv[2], '<title>Dashboard incassi e prodotti</title>\n<style>\n:root{color-scheme:dark}\n' + css +
  '\n.demo-note{max-width:1080px;margin:0 auto;padding:0 16px 4px;color:#bfd0c6;font-size:.85rem}\n#btn-export,#btn-sample{display:none!important}\n</style>\n' +
  body + '<script>\n' + js + '\ndocument.getElementById("btn-demo").click();\n</script>\n');
