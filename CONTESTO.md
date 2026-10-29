# Contesto del progetto (passaggio a una sessione locale)

Leggi questo file per intero prima di fare qualsiasi cosa. Riassume quello che è stato deciso e costruito finora.

## Obiettivo
Una dashboard web per **Perla Bar** (bar), pensata per leggere le vendite esportate dalla cassa e mostrare: prodotti più venduti, fasce orarie migliori, scontrino medio, giorni peggiori, confronto settimana/mese, prodotti poco redditizi e suggerimenti semplici (esempio: "Dalle 15 alle 18 vendi poco: prova una promo aperitivo").
Il software è creato da **Automated by You**: la riga "Software creato da Automated by You" compare in fondo a ogni schermata.

## Stato attuale
- Applicazione completa in HTML, CSS e JavaScript senza dipendenze, che gira nel browser. Si apre `index.html`.
- Grafica Perla Bar: bianco e nero, logo in `img/perla-bar-logo.png` (ritagliato e con sfondo trasparente), font Jost, un accento color champagne.
- Il file CSV si carica a mano, trascinandolo nella pagina. Le colonne vengono riconosciute da sole e si possono correggere nel pannello "Colonne riconosciute".
- `js/parser.js` legge CSV (separatori `; , tab`), numeri all'italiana, date `gg/mm/aaaa` o `aaaa-mm-gg`, codifica UTF-8 o Windows-1252.
- `js/analytics.js` calcola le statistiche e i suggerimenti. `js/demo.js` genera dati di esempio. `js/app.js` è l'interfaccia.
- Test: `node test/run.js` (deve stampare OK).
- Demo: `demo.html` (file unico), `demo.pdf`, `site/index.html` (pronto per Cloudflare Pages). Si rigenera con `node tools/build-demo.js <uscita.html>`.
- Pubblicazione: vedi `PUBBLICAZIONE.md` (Cloudflare Pages con wrangler) e `.github/workflows/deploy-cloudflare.yml`. Non è ancora stata pubblicata.
- Branch di lavoro: `claude/festive-carson-2sgvh1` nel repository `marketingindustries/perlabar`.

## La cassa e il gestionale
- Il gestionale è **ilConto di Zucchetti** (versione ristorazione o retail da confermare). Non ho trovato documentazione pubblica di API per ilConto. Zucchetti ha API pubbliche sul portale Servizi-IT, ma non è confermato che includano le vendite di ilConto. I report risultano consultabili online se ilConto è collegato a Business Coach, Tieni il Conto o Digital Hub. Va chiesto a Zucchetti o al tecnico.
- Dalle foto del computer della cassa (Windows 10, utente `POS`, PC `DESKTOP-CASO7TV`): la cartella `C:\Users\POS\Desktop\export dati` contiene due esportazioni CSV create a mano da ilConto:
  - `PERLABAR-2026-10-27-09-11-54-Vendite.csv` (2,07 MB, creata il 27/10/2026 alle 09:12)
  - `PERLABAR-2026-10-29-11-04-49-Vendite.csv` (creata il 29/10/2026 alle 11:04)
  Il nome ha il formato `PERLABAR-AAAA-MM-GG-HH-MM-SS-Vendite.csv`. **Non ho ancora visto il contenuto**: colonne, separatore, codifica e formato dei numeri sono da verificare. Serve data e ora per ogni articolo, altrimenti le fasce orarie non si calcolano.
- Non è chiaro se ilConto può programmare l'esportazione ogni sera. Da chiedere.

## Piano di integrazione scelto
Versione con Google Drive: Google Drive per computer sincronizza la cartella `export dati` della cassa, e la dashboard legge i CSV dalla cartella (con login Google), li unisce ed elimina i doppioni. Serve un progetto Google gratuito con un client OAuth, da creare insieme all'utente. I dati restano nel Drive del bar e nel browser, non su un nostro server.
Alternativa più completa ma più laboriosa: un programma sul PC della cassa che invia i dati a un servizio online.

## Google Drive
- Account del bar: `perlabar60@gmail.com`. Cartella sincronizzata "Desktop": id `10SYUNMnhjRW7deaoc4Ai5AYxkPCWTEsJ`. Cartella "export dati": id `16_bh2DtnZRGFBfM5wnF7ndFs5lGPcOJb`.
- L'account Google collegato alla sessione precedente era `dealerfuel@gmail.com`. Dalla sessione precedente la cartella risultava condivisa solo con "chiunque abbia il link, lettore" e il contenuto non compariva nelle ricerche. L'utente vedeva i CSV su Drive.
- **Attenzione alla privacy:** una cartella con le vendite del bar condivisa a chiunque abbia il link è accessibile pubblicamente. Va ristretta, condividendola solo con gli account necessari.
- Da fare: far condividere la cartella (o i link dei singoli file) con l'account usato dalla sessione, poi leggere i CSV e adattare `js/parser.js`.

## Prossimi passi, in ordine
1. Leggere uno dei CSV (da Drive o caricato a mano) e verificare le colonne reali.
2. Adattare il riconoscimento delle colonne in `js/parser.js` e aggiungere un test con un estratto del file (senza dati sensibili).
3. Costruire la lettura da Drive con login Google, unione dei file ed eliminazione dei doppioni (la chiave di uno scontrino è data + numero scontrino).
4. Pubblicare `site/` su Cloudflare Pages e aggiungere un login prima di caricare dati reali.
5. Chiedere a Zucchetti: esportazione programmata ogni sera, API di Servizi-IT, collegamento con Business Coach.

## Regole di lavoro
- Lingua: italiano.
- Testi dell'interfaccia e dei prompt: naturali, concreti, da prodotto SaaS professionale. Evita frasi spezzate su più righe, slogan generici, micro-frasi enfatiche, strutture "Da X a Y" non necessarie, incisi con trattini lunghi, emoji al posto delle icone. La skill è in `.claude/skills/prompt-webapp-copy/SKILL.md`.
- Non chiedere né salvare password, ID AnyDesk o token nella chat o nel repository. Per Cloudflare, il login si fa dal browser con `wrangler login`.
- Non toccare il database di ilConto e non installare altro sul PC della cassa oltre a Google Drive per computer. Gli interventi sulla cassa vanno fatti a bar chiuso.
- Dopo ogni modifica: `node test/run.js`, poi rigenera `site/index.html`, `demo.html` e `demo.pdf` se la grafica o i testi sono cambiati.

## Limiti emersi nella sessione precedente
- Un controllo automatico su Drive era stato programmato dalla sessione cloud e non vale in locale.
- Non è stato possibile pubblicare su Cloudflare dall'ambiente cloud, per mancanza di credenziali. Provarci in locale con `PUBBLICAZIONE.md`.
