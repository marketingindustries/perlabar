# Dashboard incassi e prodotti

Cruscotto per bar/locali: carichi l'export CSV del gestionale/cassa e ottieni **prodotti più venduti, fasce orarie migliori, scontrino medio, giorni peggiori, confronto settimana/mese, prodotti poco redditizi** e **suggerimenti** del tipo
*"Dalle 15 alle 18 vendi poco: prova una promo aperitivo"*.

## Uso
Apri `index.html` nel browser (nessuna installazione, nessun server). Trascina il CSV oppure usa **Prova con dati di esempio**.
I dati restano nel browser: non viene inviato nulla.

## Formato del file
Una riga per prodotto venduto. Obbligatorie: data (e ora), prodotto, importo (o prezzo × quantità).
Facoltative: n. scontrino (scontrino medio corretto), quantità, categoria, **costo unitario** (margini). Vedi `sample/modello.csv`.
Separatori `; , tab`, numeri `1.234,56`, date `gg/mm/aaaa` o `aaaa-mm-gg`, codifica UTF-8 o Windows-1252 sono riconosciuti; le colonne si possono correggere a mano nel pannello "Colonne riconosciute".

## Note di calcolo
- Le fasce "deboli" sono le ore di apertura con incasso medio < 60% della media oraria.
- L'ultimo giorno viene escluso se risulta incompleto.
- Margini: calcolati solo con la colonna costo; senza, si mostrano i prodotti poco venduti.
- Confronti: ultimi 7 vs 7 e 30 vs 30 giorni precedenti (servono 14 / 60 giorni).

## Sviluppo
`node test/run.js` esegue i test su parser e analisi. Codice: `js/parser.js`, `js/analytics.js`, `js/demo.js`, `js/app.js`.
