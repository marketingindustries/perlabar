# Pubblicare la dashboard su Cloudflare Pages

La cartella `site/` contiene il sito pronto (un solo file, `index.html`, con dati di esempio e logo incorporati).

## Con la riga di comando
Servono Node.js e un account Cloudflare gratuito.

    npx wrangler login
    npx wrangler pages project create perla-bar-dashboard --production-branch main
    npx wrangler pages deploy site --project-name perla-bar-dashboard --branch main

Alla fine compare l'indirizzo pubblico, del tipo `https://perla-bar-dashboard.pages.dev`.

## Dopo una modifica
    node test/run.js
    node tools/build-demo.js demo-src.html
Poi aprire `demo-src.html` in un browser, salvare la pagina già compilata come `site/index.html` e ripetere l'ultimo comando di pubblicazione. Se la modifica riguarda solo i testi o lo stile, basta sostituire `site/index.html` con il nuovo file generato da `node tools/build-demo.js site/index.html` (la pagina carica i dati di esempio all'apertura).

## Testo da incollare in una chat di Claude Code in locale
Apri questa cartella con Claude Code e incolla:

> Leggi PUBBLICAZIONE.md e README.md. Pubblica la cartella site/ su Cloudflare Pages con il progetto perla-bar-dashboard usando wrangler, e dammi l'indirizzo pubblico. Se wrangler chiede di accedere, guidami nel login dal browser. Prima di pubblicare, esegui node test/run.js e dimmi se i test passano.

## Cosa contiene il progetto
- `index.html`, `css/`, `js/`, `img/`: l'applicazione completa (carica un CSV dal gestionale o dalla cassa).
- `site/index.html`: la demo pubblicabile, con la grafica Perla Bar.
- `demo.html`, `demo.pdf`: la stessa demo come file da aprire o inviare.
- `tools/build-demo.js`: unisce pagina, stile, script e logo in un unico file.
- `test/run.js`: test di lettura del CSV e dell'analisi.
- `.github/workflows/deploy-cloudflare.yml`: pubblicazione automatica da GitHub, se preferisci.
- `.claude/skills/prompt-webapp-copy`: la skill per i testi dei prompt.
