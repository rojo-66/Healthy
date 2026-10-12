# Healthy App – Specifica

Versione 1.0 · 11 ottobre 2026 · stato: V1 sviluppata (M0–M9), da verificare sul telefono

## 1. Obiettivo e vincoli

App che unisce **allenamento** (schede, sessioni, storico) e **alimentazione** (piano del nutrizionista, spesa, ricette), ispirata a Ellim.

| Vincolo | Decisione |
|---|---|
| Utenti | Io e pochi amici, tutti con **iPhone** (Safari). Uno degli amici è il mio **personal trainer** (PT). |
| Costi | **Zero**, nessun abbonamento. |
| Hosting | **GitHub Pages** (repo pubblico), app statica. |
| Rete | **Funziona offline** dopo la prima apertura (PWA installata in Home). |
| Dati | Restano **sul telefono** (IndexedDB). Niente server, niente account. |
| Condivisione | Solo **schede** e **diete**, tramite link, QR o file. Nessun dato in tempo reale. |
| App esistente | **MyDiet** resta separata e continua a funzionare. La nuova app sa importare il suo JSON. |

Fuori scope: intelligenza artificiale, login/account, sincronizzazione in tempo reale, Apple Salute, notifiche push, funzioni social, vendita.

## 2. Architettura

```
GitHub Pages (file statici) ──prima visita / aggiornamenti──▶ iPhone: PWA installata
                                                              ├─ IndexedDB "healthy-app" (Dexie)
                                                              ├─ Cache "healthy-*" (service worker)
                                                              └─ Condivisione: link #import=…, QR, file .json
```

- **Local-first**: ogni lettura/scrittura avviene su IndexedDB. Nessuna chiamata di rete obbligatoria.
- **Unica eccezione online**: i link video degli esercizi (si aprono solo con la rete; offline compare un riquadro con nome e note).
- **Storage persistente**: all'avvio chiamare `navigator.storage.persist()`.
- **Installazione**: se l'app è aperta in Safari (non in standalone) mostrare un avviso "Aggiungi alla schermata Home prima di inserire dati": su iPhone Safari e app installata hanno memorie separate.
- **Aggiornamenti**: quando c'è una nuova versione del service worker mostrare "Nuova versione disponibile · Aggiorna".
- **Convivenza con MyDiet** (stessa origine `rojo-66.github.io`): database e cache con nomi propri, service worker con scope sulla cartella dell'app, pulizia **solo** delle cache `healthy-*`.

## 3. Design system

### Stile
Cyberpunk + graffiti, molti colori ma **mai più di un neon dominante per schermata**. Base scura grafite.

### Colori (token)
| Token | Valore | Uso |
|---|---|---|
| `--bg` | `#12141a` | sfondo |
| `--surface` | `#1b1e27` | card |
| `--line` | `#2c3040` | bordi, tracce dei grafici |
| `--line-strong` | `#3a3f52` | bordi pulsanti secondari |
| `--text` | `#ece8df` | testo |
| `--text-2` | `#c9c5d3` | testo secondario |
| `--muted` | `#a9a6b5` | etichette |
| `--training` | `#f0559f` | **allenamento** (magenta) |
| `--food` | `#a9e34b` | **alimentazione** (verde acido) |
| `--progress` | `#4cc9e6` | **progressi**, navigazione, link, corsa (ciano) |
| `--tip` | `#f2c94c` | **consigli, note di PT/nutrizionista, avvisi** (giallo) |
| `--partial` | `#5a2a45` | parte "non fatta" di un elemento iniziato |
| `--data-alt` | `#8a7fa8` | seconda serie di un dato (parte FM della barra FFM/FM del Profilo), mai testo (M7) |
| `--fat` | `#9d7bf0` | **massa grassa (FM)** nei grafici di Progressi (M9) |
| `--heat-low` · `--heat-60` · `--heat-80` · `--heat-100` | `#2c3a20` · `#6b9a33` · `#86b83c` · `--food` | livelli del calendario "Pasti segnati" (meno di 60 · 60 · 80 · 100 %) |

### Colori nei grafici (M9)
- Ogni colore conserva il suo significato: **ciano** = corpo/progressi, **magenta** = allenamento, **verde** = alimentazione, **giallo** = da tenere d'occhio (oltre soglia, variazione nella direzione sbagliata) e adesivo **PR**, **viola** `--fat` = massa grassa (unica serie con un colore "di dato"), **grigio** = neutro, tracce, griglia, assi, "prossima misura".
- Le variazioni usano la stessa regola del Profilo: ciano = direzione giusta, giallo = da tenere d'occhio, grigio = neutra, sempre con la freccia ▲/▼ (o ■ / = se non cambia).
- **Verde e giallo non bastano mai da soli** (deuteranopia): lo stato "oltre soglia" ha sempre anche il **contorno giallo**, il **tratteggio** e il simbolo **▲/▼**; nel testo la percentuale è sempre scritta. La legenda è presente su ogni grafico con 2 o più serie o simboli.
- Classe `.tone-fat` (solo per i grafici): imposta `--tone` sul viola come le classi di sezione.

### Tipografia
- **Permanent Marker**: titoli graffiti (nome schermata, nome scheda, nome pasto), leggera rotazione −2°/−3°.
- **Space Grotesk**: testo.
- **JetBrains Mono**: numeri, kg, timer, etichette in maiuscolo con spaziatura.
- Font **self-hosted** (offline).

### Forme
- Card con **angoli tagliati** (`clip-path: polygon(...)`, 12–18 px), bagliore leggero sul colore della sezione.
- Note di PT/nutrizionista: riquadro **tratteggiato giallo**.
- Badge/adesivi (PR, "Fatto!") leggermente ruotati.

### Navigazione principale
Barra in basso a 5 voci: **Oggi · Allena · Dieta · Progressi · Profilo**. La voce attiva prende il colore della sua sezione.
L'indicatore **SYNC OFFLINE ✓** compare **solo nella Home**, sulla riga della data. Senza server "sincronizzato" vuol dire: dati salvati sul telefono in modo persistente, app installata e pronta offline (dettagli nelle note M6). Niente "ONLINE ✓": la rete non cambia nulla.

## 4. Animazioni e gesti

Ogni elemento toccabile ha un'animazione. Solo `transform`/`opacity`, 60–120 fps, `prefers-reduced-motion` rispettato.

| Elemento | Comportamento |
|---|---|
| Pulsanti | Pressione: scala 0.92–0.96 con ritorno "a molla" (`cubic-bezier(.2,.9,.3,1.4)`). |
| Spunte | Riempimento + piccolo "pop". |
| Selettori a schede (Schede/Storico, Piano/Spesa/Ricette, Corpo/Forza/Dieta) | Evidenziatore che scorre sotto l'etichetta. Swipe orizzontale sul contenuto o sulla barra: il contenuto segue il dito, l'evidenziatore si sposta in proporzione, il nuovo pannello entra dal lato del gesto. In Dieta › Piano lo swipe cambia giorno (vince sul cambio di tab); in Spesa le voci non hanno swipe propri. |
| Pannelli dal basso (bottom sheet) | Entrata dal basso, sfondo che si scurisce, chiusura toccando fuori o trascinando giù. |
| Fisarmoniche | Apertura con discesa + freccia che ruota. |
| Swipe giorno (Home, Dieta) | Il contenuto segue il dito; al rilascio si assesta a molla su ieri/oggi/domani. In Dieta anche sulla striscia dei giorni (la striscia resta ferma). |
| Swipe esercizio (sessione live) | Sul corpo dell'esercizio: ← successivo, → precedente (le frecce restano). Non parte dai campi kg/rip; sull'ultimo esercizio ← resiste e torna a posto (resta "Termina allenamento"). |
| Swipe riga scheda (Allena › Schede) | ← rivela **Duplica** ed **Elimina** (con conferma); → o un tocco fuori la richiude. Una riga aperta per volta. |
| Swipe indietro | Dal bordo sinistro torna alla schermata precedente (in standalone iOS non c'è quello di Safari): Readiness, Intro, Riepilogo, Vedi scheda, Editor (con la sua conferma se ci sono modifiche), Nuova misura, Completa dieta, Importa. Mai nella sessione live. |
| Stepper | Tocco sul numero = campo da scrivere (virgola o punto; il valore non viene agganciato al passo, +/− proseguono da lì); pressione lunga su +/− = ripetizione che accelera, si ferma al rilascio. |
| Transizioni tra schermate | View Transitions API dove disponibile, altrimenti dissolvenza + scorrimento. |
| Cerchi e barre | Riempimento animato al cambio di valore. |

**Regole comuni degli swipe** (un solo modulo: `src/lib/design/swipe.ts` + `swipe-action.ts`): Pointer Events; `touch-action: pan-y pinch-zoom` (scroll verticale e pizzico restano al sistema); asse deciso dopo 10 px (un gesto verticale annulla lo swipe); soglia ¼ della larghezza o colpo veloce > 0,5 px/ms; mai da campi di testo, grafici o strisce che scorrono (`data-swipe-ignore`), con la tastiera aperta o entro 24 px dai bordi dello schermo (il sinistro è dello swipe indietro); con zone annidate vince la più interna che gestisce quella direzione; con "Riduci movimento" il contenuto non segue il dito (cambia e basta).

## 5. Schermate

I mockup sono in `docs/mockups/` (file `.dc.html`). Nomi file tra parentesi.

### 5.1 Oggi / Home (`Main.dc.html`)
- Riga in alto: data a sinistra, stato connessione a destra (una riga, mai a capo).
- Titolo giorno in graffiti + badge tipo giornata (Giorno palestra / Corsa / Riposo).
- Striscia 7 giorni (L–D), swipe per ieri/domani.
- Card calorie: anello kcal mangiate / target + barre proteine, carboidrati, grassi. Fonte del target indicata.
- Card **pasto del momento** (in base all'orario): alimenti con grammi, "Segna come fatto", link ricetta.
- Card **allenamento del giorno**: nome scheda, orario, "Avvia allenamento" → flusso sessione.
- Timeline della giornata (pasti, palestra, integratori) con stati fatto/adesso/dopo.
- Tip del giorno (giallo).

### 5.2 Allena (`Allena.dc.html`)
- Titolo + pulsante **Importa** (link, QR, file).
- **Settimana**: 7 giorni con sigla della scheda assegnata (PET, GAM…), stati fatto ✓ / prossimo (contorno luminoso) / riposo (tratteggiato). Tocco su un giorno → dettaglio sotto.
- Tab **Schede**: card "Prossimo" con Avvia / Vedi scheda; elenco schede (nome, esercizi, serie, durata stimata, giorno, ultima esecuzione, etichetta origine **PT · vN** gialla o **TUA** grigia, pulsante condividi); **+ Nuova scheda**.
- Tab **Storico**: calendario del mese (magenta palestra, ciano corsa, grigio riposo, oggi evidenziato), elenco sessioni (durata, volume o distanza/passo, readiness R, adesivo PR) → apre il Riepilogo.

### 5.3 Crea / modifica scheda (`Editor.dc.html`)
Stessa schermata per creare e modificare. Deve essere **semplice per il PT**: tutto con il pollice.
- Banner superiore fisso: indietro, **nome scheda modificabile nel titolo**, versione (v3 → v4 al salvataggio), contatori esercizi/serie/durata ricalcolati in tempo reale.
- Giorni assegnati (multi-selezione).
- **Introduzione** per il cliente (testo) + lista **Riscaldamento e mobilità** (nome, suggerimento, dose).
- **Esercizi**: righe compatte riassuntive; tocco → apertura con stepper grandi **Serie / Ripetizioni / Kg (passo 2,5)**, **Recupero** 60/90/120/180 s, "Serie diverse tra loro" (piramidali), **Nota per il cliente**, **Link video**, Su/Giù/Duplica/Elimina. Riordino anche con pressione lunga sulla maniglia ⠿.
- **+ Aggiungi esercizio** → libreria dal basso: ricerca, filtri per muscolo, "+" per aggiungere, ✓ se già presente, "Crea esercizio personalizzato".
- Cardio finale.
- Banner inferiore fisso: **Anteprima** (come la vedrà il cliente) + **Salva e invia** (incrementa versione, apre condivisione).
- Durata stimata = Σ(serie × (recupero + 45 s)) + cardio.
- V2: "note salvate" riutilizzabili per il PT.

### 5.4 Flusso sessione
Avvio da Home ("Avvia allenamento") o da Allena ("Avvia"). Ordine fisso:

**1. Readiness survey** (`Readiness.dc.html`): 5 voci con punteggio 1–5, **5 = meglio per tutte** (Sonno, Umore, Energia, Stress 5 = rilassato, Affaticamento muscolare 5 = nessun dolore). Totale /25. "Avanti" attivo solo con tutte le risposte. Indicatore passi Readiness → Intro PT → Esercizi.

**2. Introduzione del PT** (`IntroPT.dc.html`): riepilogo (esercizi, serie, cardio), messaggio del PT, lista riscaldamento spuntabile, **Inizia allenamento**.

**3. Sessione live** (`Allenamento.dc.html`), **un esercizio per volta**:
- **Banner superiore fisso**: freccia sottile (senza sfondo) per tornare alla scheda; **nome scheda su una sola riga** che si rimpicciolisce se lungo (mai a capo); **tempo della sessione**; **barra a segmenti** (uno per esercizio) riempita in proporzione alle serie fatte: pieno = completo, parziale = magenta + `--partial`, grigio = non iniziato, contorno luminoso = esercizio corrente.
- Corpo (scorre solo questo): nome esercizio, schema (4 × 10 · rec. 90 s), muscoli, pulsante **Video** (link, serve rete), **Nota del PT** (lunghezza variabile, si adatta), tabella serie: SET · ULTIMA VOLTA · KG · RIP · ✓. Nell'intestazione della colonna ✓ un pulsante **doppia spunta** che segna/toglie **tutte** le serie. "+ Aggiungi serie". Sezione **Le tue note per il PT** (testo libero). Solo sull'ultimo esercizio: **Termina allenamento**.
- **Banner inferiore fisso**: rettangolo con **semicerchio al centro**; a sinistra freccia **PREC**, a destra **SUCC**, al centro il **cerchio del recupero** (più grande delle frecce) con conto alla rovescia.
- Ogni spunta (singola o tutte) **avvia automaticamente il recupero** con il tempo dell'esercizio.
- Tocco sul cerchio → pannello dal basso: tempo grande, preset 60/90/120/180 s, ±15 s, Pausa/Riprendi, Salta, recupero predefinito del PT.
- Fine recupero: suono breve + animazione (su iPhone niente vibrazione; l'audio va "sbloccato" dal primo tocco della sessione).
- Schermo sempre acceso (Wake Lock) durante la sessione.
- Il contenuto non visibile (altri esercizi) **non** è in questa schermata.

**4. Riepilogo** (`Riepilogo.dc.html`), sempre riapribile dallo Storico:
- Banner superiore fisso: indietro, nome scheda, data e orario inizio → fine.
- Numeri: durata, volume (Σ kg × rip), serie fatte/previste, record; adesivo "Fatto!".
- Readiness pre-allenamento (5 barre + totale).
- Esercizi: badge serie fatte (stesso riempimento della barra), serie migliore, volume, confronto con l'ultima volta (ciano se meglio, giallo se mancano serie), adesivo **PR**; tocco → dettaglio serie (anche "saltata") + nota scritta per il PT.
- Cardio.
- **Sforzo percepito RPE 1–10**.
- Collegamento alla dieta: prossimo pasto (es. post-workout).
- Banner inferiore fisso: **Invia al PT** (foglio di condivisione iOS, file/link) + **Fine** (Home).

### 5.5 Dieta (`Dieta.dc.html`)
- Titolo + pulsante col nome del **piano attivo** (es. "Ottobre 2026") → pannello: stato completezza (target, macro per alimento, ricette, integratori), **Importa** (JSON), **Modello per Claude** (§ 8.2), **Esporta**, **Modifica**, **Condividi** (link, QR, file), archivio piani precedenti con "Ripristina".
- Stato vuoto: "Importa il tuo piano" e, sotto, "Non hai un piano? **Fallo preparare a Claude**" (foglio "Prepara il piano con Claude", § 8.2).
- Tab **Piano**:
  - 7 giorni con kcal e rombo del tipo giornata (magenta palestra, ciano corsa, grigio riposo); oggi con bordo verde.
  - Card riepilogo: **un solo anello per giorno** (il testo dentro l'anello non deve mai uscire dal cerchio). Oggi: kcal mangiate / target; altri giorni: kcal del piano / target. Barre P/C/G. Riga "PIANO xxxx kcal · FIBRE xx g · TARGET: NUTRIZIONISTA".
  - Pasti: orario, nome, alimenti con grammi, macro, **Ricetta N** (apre la ricetta nella tab Ricette), spunta "mangiato" (solo oggi). Pasto attuale evidenziato.
  - Integratori del giorno (anche quelli "non serve oggi", barrati).
  - **Nota del nutrizionista** del giorno.
  - **Osservazione dell'app** (gialla): confronto piano/target, segnala lo scarto maggiore se ≥ 5%. "L'app non modifica il piano: segnala soltanto."
  - "Oggi seguo il piano di un altro giorno".
- Tab **Spesa**: lista della settimana calcolata sommando il piano, raggruppata per reparto, spuntabile, barra di avanzamento, esclusi i prodotti con `spesa: false`. **Spesa finita ✓** azzera tutte le spunte. Condividi lista.
- Tab **Ricette**: elenco a fisarmonica (numero, nome, tempi/attrezzatura, quantità totali, passaggi, consiglio).

### 5.6 Profilo (`Profilo.dc.html`)
- Nome, età, altezza, badge obiettivo.
- Confronto tra due date di misurazione (es. 14/08 → 25/09).
- Card: Peso, BMI, BMR, Angolo di fase.
- **Composizione**: barra FFM/FM + righe FM (kg, %), FFM (kg, %), BCM (kg, %), BCMI.
- **Acqua**: TBW (L), ECW (L), ECW/TBW (%).
- **Circonferenze (cm)**: torace, vita, addome, fianchi, coscia, braccio, polpaccio.
- Variazioni colorate: ciano = direzione giusta, giallo = da tenere d'occhio, grigio = neutra (la direzione "giusta" dipende dal parametro e dall'obiettivo).
- Lettura del nutrizionista, condizioni per la prossima bioimpedenza.
- **+ Nuova misura**, **Grafici**.
- Sezioni di servizio (M7): **Backup e dati** (esporta, importa, promemoria, memoria del telefono), **Impostazioni** delle schede, **Installazione**, **Informazioni** (versione e build).

### 5.7 Progressi (`Progressi.dc.html`)
Schermata in sola lettura: legge i dati di Profilo (misure), sessioni e dieta e li mostra nel tempo. Non crea dati.
- Intestazione "Progressi" (ciano) e riga "DAL <prima data> · N SETTIMANE DI DATI". Niente SYNC OFFLINE.
- Selettore **periodo** (4 sett · 3 mesi · Tutto) valido per Corpo e Forza. La tab Dieta parte sempre dal primo giorno del piano attivo.
- Tab **Corpo · Forza · Dieta** con indicatore scorrevole che cambia colore (ciano, magenta, verde).
- Ogni grafico: un solo asse (mai due scale), griglia e assi discreti, linee 2px, punti ≥ 8px, **punto selezionato** con tooltip (data, valore, variazione), toccando o trascinando sul grafico. Legenda sempre presente se ci sono 2 o più serie. Tutto rispetta `prefers-reduced-motion`.
- Colori: ciano = corpo/progressi, magenta = allenamento, verde = alimentazione, giallo = da tenere d'occhio, viola `#9d7bf0` = massa grassa (FM). Verde e giallo NON bastano da soli a distinguere due stati (deuteranopia): lo stato "oltre soglia" usa sempre anche contorno, tratteggio e simbolo ▲/▼.
- Ogni grafico ha una vista **Tabella** equivalente (nel mockup solo sul Peso; in M9 su ogni card: peso, composizione, circonferenze, esercizio, settimane, calendario, scarto).
- Asse orizzontale dei grafici a linea **proporzionale al tempo** (le pause si vedono); le barre partono sempre da zero, le linee no.

**Tab Corpo**
- Card Peso: valore attuale, variazione dall'inizio del periodo colorata con la tabella delle direzioni per obiettivo del Profilo (grigia senza obiettivo o con obiettivo "ricomposizione"), grafico a linea con area leggera, vista Grafico/Tabella.
- Card Composizione: 6 piccoli grafici (FFM, FM, BCM, angolo di fase, TBW, ECW/TBW), ciascuno con la sua scala, valore, variazione colorata come nel Profilo (ciano = direzione giusta, giallo = da tenere d'occhio, grigio = neutra) e un punto tratteggiato "prossima misura" (data prevista dal Profilo). Dalla bioimpedenza arrivano pochi punti: con 1 sola misura si mostra il punto senza linea, con 0 un invito a inserirla.
- Card Circonferenze: 7 righe (torace, vita, addome, fianchi, coscia, braccio, polpaccio) con mini-grafico, valore e variazione.
- Collegamento "+ Aggiungi una misura nel Profilo".

**Tab Forza**
- Scelta esercizio (chip scorrevoli, solo esercizi con almeno 2 sessioni) e interruttore **Carico / Volume**.
- Grafico dell'esercizio: carico migliore per sessione (valore = serie col carico più alto, con le ripetizioni) oppure volume (Σ kg × ripetizioni delle serie fatte). I **record personali** sono rombi pieni e nel tooltip mostrano l'adesivo giallo "PR". Regola dei PR: quella decisa in M5.
- Tre numeri: sessioni, record, valore migliore.
- Allenamenti a settimana: barre (sessioni fatte) con linea tratteggiata "obiettivo" = somma dei giorni assegnati nelle schede attuali; la settimana in corso è tratteggiata; tooltip con volume della settimana in tonnellate.
- Record recenti: elenco con adesivo PR, esercizio, data, valore precedente (record del periodo scelto, al massimo 5).

**Tab Dieta**
- Aderenza: anello verde (media % di pasti segnati sui giorni conclusi, oggi escluso), giorni al 100 %, pasto più saltato.
- Calendario "Pasti segnati": righe per settimana (L–D), ogni cella mostra la percentuale; scala a 4 livelli (meno di 60 · 60 · 80 · 100) con numero sempre visibile; celle senza dati tratteggiate; oggi con contorno tratteggiato (giorno in corso).
- Scarto dal target: barre divergenti (kcal mangiate rispetto al target del giorno, in %) con fascia ±5 %; fuori fascia = barra tratteggiata con contorno giallo e simbolo ▲/▼.
- Macro medi (proteine, carboidrati, grassi) rispetto al target, con tacca al 100 %.
- Osservazione dell'app (riquadro giallo): solo segnalazioni, mai modifiche al piano.

**Stati particolari**
- Meno di 2 misure/sessioni/giorni: il grafico mostra il punto singolo e un invito ("Con un'altra misura vedrai l'andamento") invece di una linea.
- Nessun piano alimentare: la tab Dieta invita a importarlo. Nessuna scheda o sessione: la tab Forza invita a fare il primo allenamento.
- I dati intermedi del mockup (peso settimanale, sessioni, aderenza) sono **di esempio**.

## 6. Logica

### 6.1 Target nutrizionali (priorità)
1. **Target del nutrizionista** presenti nel piano (per tipo di giornata) → usati così come sono, mai modificati.
2. **Calcolati dal piano**: somma degli alimenti (valori per 100 g o per pezzo).
3. **Stimati**: BMR con Mifflin-St Jeor × fattore attività (tipo di giornata + livello di vita quotidiana scelto nel Profilo), solo se mancano 1 e 2.

Ogni numero mostra la sua origine (nutrizionista / calcolato / stimato).
**Completamento guidato** dopo l'import: checklist dei dati mancanti (alimenti senza valori, target assenti), compilabili a mano o accettando la stima.
Limiti di sicurezza (solo per target stimati): calorie minime, deficit massimo, avviso per obiettivi irrealistici.

### 6.2 Osservazioni e consigli
- Su un piano del nutrizionista: **solo osservazioni**, mai modifiche (es. scarto > 5% tra piano e target, giorni senza verdura).
- Su piani propri o stimati: suggerimenti (proteine per kg, distribuzione nei pasti, idratazione).

### 6.3 Profilo
- BMI = peso / altezza²; BCMI = BCM / altezza² (altezza in metri, dal Profilo).
- FM% e FFM% calcolati **sul peso** se non forniti; FFM = peso − FM e FM = peso − FFM (o peso × FM%) quando manca uno dei due.
- **BCM% = BCM / FFM × 100**: riferito alla **massa magra**, non al peso (deciso in M7).
- ECW/TBW in %.
- Ogni valore dichiara l'origine: **misurato** (inserito), **calcolato** (dagli altri valori della stessa misura) o **stimato** (solo il BMR con Mifflin-St Jeor, se la bioimpedenza non lo dà). Un valore misurato non viene mai sostituito; il BMR stimato non si confronta con quello misurato.
- Età = anno corrente (o della misura) − anno di nascita.

### 6.4 Allenamento
- Volume = Σ kg × ripetizioni delle serie fatte.
- **PR**: carico più alto a parità o superiore di ripetizioni rispetto allo storico dell'esercizio (in alternativa 1RM stimato con Epley; da decidere in sviluppo).
- "Ultima volta" = serie corrispondenti dell'ultima sessione con la stessa scheda.
- Recupero predefinito per esercizio, avvio automatico alla spunta.

## 7. Modello dati (IndexedDB, Dexie)

| Tabella | Campi principali |
|---|---|
| `profile` | id, name, birthYear, sex, heightCm, goal, activityLevel (M7) |
| `measurements` | id, date, weightKg, fmKg, fmPct, ffmKg, bcmKg, tbwL, ecwL, phaDeg, bmrKcal, chestCm, waistCm, abdomenCm, hipsCm, thighCm, armCm, calfCm, notes |
| `exercises` | id, name, muscles[], equipment, videoUrl, custom |
| `workouts` (schede) | id (uuid), version, author, source ('pt' \| 'own'), name, weekdays[], time (HH:MM \| null, M6), intro, warmup[], items[{exerciseId, name, sets, reps, kg, restSec, note, videoUrl, setsDetail?}], cardio, updatedAt, received ({version, hash, at} \| null, M8), previousVersions[] (ultime 3 sostituite, M8) |
| `sessions` | id, workoutId, workoutVersion, startedAt, endedAt, readiness{sleep,mood,energy,stress,soreness}, sets[{exerciseId, setIndex, kg, reps, done}], userNotes{exerciseId: text}, rpe, cardioDone |
| `dietPlans` | id, version, title, author, validFrom, active, archived, importedAt, origin (`file` \| `mydiet`), payload (formato § 8.2) |
| `dietLog` | date, planId, mealKey, eaten, swappedFromWeekday |
| `shopping` | weekStart, checked{productKey: bool} |
| `settings` | key, value (es. ultimo backup, autore delle schede, prossima bioimpedenza) |

## 8. Formati di file

Tutti i file condivisi hanno `app`, `kind`, `schemaVersion`. Validazione con zod; in caso di errore messaggio chiaro, nessun salvataggio parziale.

### 8.1 Scheda
```json
{
  "app": "healthy-app", "kind": "workout", "schemaVersion": 1,
  "id": "uuid", "version": 4, "author": "Nome PT",
  "name": "Petto + Schiena", "weekdays": [1], "time": "18:00",
  "intro": "testo", "warmup": [{ "name": "...", "hint": "...", "dose": "2 × 15" }],
  "items": [{ "name": "Lat machine presa larga", "muscles": ["Dorsali","Bicipiti"],
              "sets": 4, "reps": 10, "kg": 57.5, "restSec": 90,
              "note": "testo PT", "videoUrl": "https://..." }],
  "cardio": { "type": "tapis roulant", "minutes": 12 }
}
```
`time` (orario abituale, uno per scheda) è facoltativo (M6, `schemaVersion` invariata).
`source` (`pt` \| `own`) è facoltativo (M8, `schemaVersion` invariata): come l'ha creata chi la manda ("Come PT" o scheda personale di un amico); senza il campo vale `pt`. Decide il colore dell'etichetta di chi la riceve.
Import di una scheda con lo stesso `id`: se `version` è maggiore chiedere **Sostituisci / Salva come copia** (dettagli in § 8.4).

### 8.2 Piano alimentare (esteso)
```json
{
  "app": "healthy-app", "kind": "diet", "schemaVersion": 2,
  "id": "uuid", "version": 1, "title": "Ottobre 2026", "author": "Nutrizionista", "validFrom": "2026-10-01",
  "dayTypes": { "gym": { "label": "Palestra", "targets": { "kcal": 1819, "protein": 141, "carbs": 227, "fat": 39, "fiber": 27 } } },
  "categories": ["Carne e pesce", "..."],
  "products": { "pollo": { "name": "Petto di pollo", "cat": "Carne e pesce", "unit": "g", "shop": true,
                           "per100": { "kcal": 110, "protein": 22, "carbs": 0, "fat": 2.5, "fiber": 0 }, "pieceGrams": null } },
  "days": [{ "weekday": 1, "type": "gym", "note": "...",
             "supplements": [{ "name": "Vitamina D3", "when": "cena", "dose": "2.000 UI", "skip": false }],
             "meals": [{ "key": "pranzo", "label": "Pranzo", "time": "13:00", "window": ["12:00","13:30"],
                         "name": "Pollo e patate", "recipe": 5, "items": [{ "p": "pollo", "q": 185 }] }] }],
  "recipes": [{ "n": 5, "name": "...", "meta": "35 min · friggitrice", "dose": "...", "steps": ["..."], "tip": "..." }]
}
```
Facoltativo in `dayTypes[x]`: `targetsSource` (`plan` \| `manual` \| `estimated`, predefinito `plan`): i target vengono dal piano (nutrizionista), sono inseriti a mano o sono una stima accettata nel completamento guidato (M3).
Facoltativo: `generalNotes` (testo, massimo 4.000 caratteri, predefinito `""`): indicazioni del nutrizionista valide per tutti i giorni, mostrate nella tab Piano come "Indicazioni generali del nutrizionista" (`schemaVersion` invariata; DB v6 mette `""` ai piani già salvati).
Valori mancanti: `targets` è `null` oppure ha `kcal` (gli altri possono essere `null`); `per100` è `null` oppure ha `kcal`, `protein`, `carbs`, `fat` (`fiber` può essere `null`); `type` di un giorno può essere `null` (lo si sceglie nel completamento guidato).

**Modello per Claude** (`src/lib/diet/template/healthy-dieta-modello.json`): il piano esteso vuoto, con `_modello: true`, `_generato` (data del download), `_istruzioni` (rivolte a Claude: non inventare, `null` per i dati mancanti, 7 giorni, 5 pasti fissi, chiavi dei prodotti, alternative nella `note`, `generalNotes`…) ed `_esempio` (forma di prodotto, tipo di giornata, pasto, integratore, ricetta con valori finti). Non contiene e non deve mai contenere dati reali; è importato nel codice, quindi si scarica anche offline. Un test controlla che campi ed esempi combacino con lo schema zod.
- **Flusso "Prepara il piano con Claude"** (foglio dallo stato vuoto della Dieta, da "Modello per Claude" nel pannello del piano e da Importa se si carica il modello vuoto): 1. **Scarica il modello** (`healthy-dieta-modello.json`, Web Share con file, altrimenti download); 2. "Apri una chat con Claude, allega la tua dieta (PDF o foto) e il modello, e invia questo messaggio:" + testo da **Copia**re (appunti, altrimenti testo da copiare a mano); 3. "Scarica il file che ti restituisce e importalo qui" → Importa. Nota: "La dieta la invii tu a Claude: l'app non manda niente da sola. Controlla sempre i numeri con il piano originale." Nessun link esterno.
- **Import tollerante** (solo piano esteso, prima di zod; il resto è segnalato, mai indovinato): campi che iniziano con `_` ignorati; modello ancora vuoto (`_modello: true`, nessun prodotto, pasti tutti vuoti) → "Questo è il modello vuoto: compilalo prima con Claude" + "Apri la guida"; `id` vuoto → uuid nuovo; `version` assente → 1; `title` vuoto → "Piano del GG/MM/AAAA"; `""` = mancante per `validFrom`, `time`, `window`, `recipe`, `pieceGrams`, `type` e per i numeri di `targets`/`per100`; `targets`/`per100` con tutti i valori `null` → `null` (completamento guidato), compilati a metà → errore ("Petto di pollo: valori per 100 g incompleti (mancano kcal e grassi)…", "Palestra: target senza kcal…"); fascia oraria con un solo estremo → ignorata con avviso; tipi di giornata non usati da nessun giorno e senza target → tolti (con i target del nutrizionista restano: servono quando il tipo si assegna nel completamento); meno di 7 giorni → avviso "Mancano giovedì e domenica: in quei giorni il piano sarà vuoto". Errori con messaggio dedicato: giorno duplicato, weekday fuori 1–7, prodotto assente da `products`, numero scritto con la virgola, virgole finali e commenti (con la riga).

### 8.3 Compatibilità MyDiet (schemaVersion 1)
Importare anche il file di MyDiet (`"app": "dieta-e-spesa"`): `giorni[i]` → `days` (indice 0 = lunedì), `pasti.{colazione,spuntino1,pranzo,spuntino2,cena}` → `meals`, `abilita`/`fine` → `window`, `nota` → `note`, `prodotti` → `products` (`unita`, `spesa`, `cat`). Tollerare categorie non elencate (es. Integratori, Pasto libero) e pasti vuoti (`nome: ""`, `items: []`). Dopo l'import parte il completamento guidato (mancano valori nutrizionali e target).

### 8.4 Condivisione
Si condividono **solo schede e diete**: mai sessioni, progressi, misure, diario, note personali o dati in tempo reale. Nessun server: il contenuto viaggia nel link, nel QR o nel file.

- **Link**: `<origine><base>#import=<payload>`, con l'URL dell'app ricavato da `location.origin` + `import.meta.env.BASE_URL` (mai scritto a mano). Payload = JSON canonico (chiavi in ordine, senza spazi) compresso con lz-string `compressToEncodedURIComponent`. Per link e QR si usa la **forma compatta**: senza i campi vuoti (`null`, `""`, `[]`, `{}`) che lo schema rimette da solo (se togliendoli il file non tornasse identico, resta la forma completa). Il frammento `#…` non arriva mai al server di GitHub Pages.
- **Soglie** (`src/lib/share/limits.ts`): link intero **≤ 4.000 caratteri**, QR **≤ 1.500 caratteri** (correzione d'errore L, al massimo ≈ versione 28–30). Sopra la soglia il metodo resta visibile con il motivo ("Troppo lungo per un link (N caratteri, massimo 4.000): nei messaggi verrebbe tagliato. Usa il file."). Misurato: scheda tipica del PT (6 esercizi con note) ≈ 1.300 caratteri → link e QR; scheda da 30 esercizi → solo link e file; piano di esempio ≈ 6.200 → solo file.
- **QR** del link, generato sul telefono (`uqr`): scuro su bianco, margine di 4 moduli, largo fino a 340 px; "Alza la luminosità…". Si legge **dall'app** (Importa › Scansiona QR): la fotocamera di iPhone aprirebbe Safari.
- **File** `.json` (`healthy-scheda-<nome>-v<N>.json`, `healthy-dieta-<titolo>.json`, nomi normalizzati) con Web Share API (`navigator.share({ files })`), alternativa "Scarica". Chiudere il foglio di condivisione di iOS non è un errore.
- **Lista bianca** dei campi: scheda = app, kind, schemaVersion, id, version, author, source, name, weekdays, time, intro, warmup[name, hint, dose], items[name, muscles, sets, reps, kg, restSec, note, videoUrl, setsDetail], cardio; dieta = § 8.2. Niente `exerciseId`, `updatedAt`, `received`, `previousVersions`, stato del piano (attivo, archivio, importazione). Per una **mia scheda personale** `author` è il mio nome del Profilo (se c'è).
- **Pannello Condividi** unico (riga della scheda e menu in Allena, "Salva e invia" nell'Editor, "Condividi" nel pannello del piano): Link (Copia + Condividi), QR (Mostra il QR), File (Scarica + Condividi), dimensioni. Per le diete prima un avviso: "Questo piano può contenere target personali…" con Continua / Annulla.
- **Import**: schermata `#/importa` (da Allena, dal pannello piano e dallo stato vuoto della Dieta) con tre ingressi verso la stessa anteprima: **incolla** link, codice o JSON; **scansiona QR** con la fotocamera dell'app (`getUserMedia`, jsQR); **scegli file** (`<input type="file">`: su iPhone le PWA non si registrano per aprire file). Il tipo si riconosce dal contenuto (`app`, `kind`, `schemaVersion`; anche il file MyDiet). Da file e testo incollato si toglie **solo** il contorno del JSON (blocco ```` ```json ````, frasi prima e dopo: risposte copiate da una chat); se il JSON non è valido, virgole finali, decimali con la virgola e commenti sono spiegati con la riga. Backup e resoconti di sessione sono rifiutati con un messaggio che dice cosa sono e dove si usano. Dopo il salvataggio si va in Allena o in Dieta.
- **Decodifica difensiva**: payload ≤ 6.000 caratteri prima di decomprimere → solo caratteri dell'alfabeto URL di lz-string → decompressione con **tetto** (1 MB, si ferma appena lo supera: protezione dalle "bombe" di espansione) → `JSON.parse` senza `__proto__` → zod con messaggi in italiano. Nessun salvataggio parziale. Link tagliato: "Il link è incompleto: probabilmente è stato tagliato dal messaggio. Chiedi di rimandarlo o usa il file."
- **`#import=` e router**: l'hash viene letto **prima del router** (primo import di `main.ts`), il codice resta in memoria e l'indirizzo diventa `#/importa?da=link` (`history.replaceState` all'avvio, `location.replace` con l'app già aperta), così ricaricare non reimporta.
- **Safari / app installata**: un link toccato in Messaggi o WhatsApp si apre in **Safari**, che ha una memoria separata. Se la pagina non è in standalone e arriva da `#import=`, si mostra l'anteprima ma **non si salva**: due righe di spiegazione, "Copia link" e "Copia codice" da incollare nell'app installata. In standalone si importa normalmente.
- **Versioni** (chiave `id` + `version`): id nuovo → Importa; in arrivo maggiore → **Sostituisci** o **Salva come copia**; uguale → "già presente", solo copia; minore → "più vecchia", solo copia. La copia ha un nuovo `id`, nome "… (copia)" e lo stesso autore. Una scheda ricevuta ricorda versione e impronta del contenuto (`received`); se è stata **modificata qui** (succede solo se l'autore sono io: le schede di altri diventano una mia copia, regola M4) il confronto usa la versione ricevuta, "Sostituisci" avvisa che le modifiche verranno tolte e la scelta proposta è la copia. Sostituire non tocca le sessioni (hanno la copia della scheda, M5); la versione sostituita va in `previousVersions` (ultime 3) con **Ripristina versione precedente** nel menu della scheda. Diete: stessa logica, la versione sostituita va nell'archivio (Ripristina). Identico per file, link e QR.
- **Etichetta** delle schede ricevute: **"NOME · vN"** (autore in maiuscolo, al massimo 14 caratteri), gialla se creata "Come PT", grigia se è la scheda personale di un amico; senza autore "RICEVUTA · vN". Le mie restano **TUA** (grigia) e **PT · vN** (gialla).
- Sempre **anteprima** e conferma esplicita prima di salvare; tutto come testo, mai HTML. I link video (solo `https://`) si aprono solo su tocco, `rel="noopener noreferrer"`.

### 8.5 Backup
Esporta/importa tutto il database in un unico file JSON. Promemoria se l'ultimo backup ha più di 14 giorni.

## 9. Video degli esercizi
V1: **solo link**. Online si apre il video; offline riquadro con nome, muscoli e note. Il modello dati resta predisposto per un futuro download dei video della scheda (V3).

## 10. Vincoli iPhone (Safari / PWA)
- Storage separato tra Safari e app installata → avviso di installazione.
- **Link di condivisione**: su iPhone un link non apre mai l'app installata (niente "link capturing" per le PWA), si apre in Safari. Per questo il link porta all'anteprima con "Copia link" e si importa incollandolo nell'app (§ 8.4). Link oltre 4.000 caratteri → solo file.
- **Fotocamera** (Scansiona QR): `getUserMedia` funziona anche nell'app installata, ma iOS può chiedere il permesso a ogni avvio; niente `BarcodeDetector` → jsQR. Si spegne sempre a fine scansione, alla chiusura e in background.
- **File**: le PWA non si registrano per aprire i `.json` (né "Apri con"): si sceglie il file da Importa.
- Niente vibrazione, niente push affidabili, niente Apple Salute.
- Barcode (V2): libreria JS (ZXing), il rilevatore nativo non c'è.
- Wake Lock API per la sessione; audio da sbloccare con un gesto.
- **Altezza dello schermo**: `100dvh` su iOS può restare vecchio dopo il blocco del telefono o la chiusura della tastiera (sotto la barra restava una fascia vuota). L'altezza è in `--app-h`, scritta da `window.innerHeight` (`src/lib/design/viewport.svelte.ts`) e ricalcolata, con lo scroll del documento riportato a 0, al ritorno in primo piano (`visibilitychange`, `pageshow`), alla chiusura della tastiera (`focusout`, `visualViewport`), a rotazione e ridimensionamento. Safe area con `env(safe-area-inset-*)` e `viewport-fit=cover`.
- **Barra di navigazione** `position: fixed` in fondo (non dipende dall'altezza calcolata); con la tastiera aperta scivola via, come i banner inferiori, e ricompare alla chiusura.
- **Zoom**: niente doppio tocco (`touch-action: manipulation` su tutti gli elementi: i contenitori che scorrono interrompono l'ereditarietà); campi di testo sempre ≥ 16 px (sotto, Safari ingrandisce al tocco); `-webkit-text-size-adjust: 100%`. Il pizzico a due dita resta (niente `user-scalable=no`).
- **Diagnostica**: Profilo › Informazioni › Strumenti tecnici (`#/dev-data`): innerHeight, visualViewport, `--app-h`, scrollY, safe area, display-mode, tastiera e ultimi eventi.
- **Aggiornamenti**: mai ricarica automatica; il banner "Nuova versione disponibile" aspetta la fine della sessione, dei moduli (Editor, misura, Completa dieta, Importa), dei pannelli e della tastiera.

## 11. Funzioni per versione
- **V1** (completata con M9): Home, Allena, Editor schede, flusso sessione completo, Riepilogo, Dieta (piano del nutrizionista, spesa, ricette, import MyDiet/JSON), Profilo e misurazioni, **Progressi** (corpo, forza, dieta nel tempo), condivisione schede/diete, backup, offline.
- **V2**: generatore schede a regole, completamento guidato avanzato, "note salvate" per il PT, sostituzioni alimenti, barcode, promemoria integratori e backup, diario alimentare completo (database alimenti); in Progressi: readiness e RPE nel tempo, calorie bruciate, esportazione dei grafici (immagine o file).
- **V3**: download video per scheda, import da PDF, calcolatore dischi/1RM, regista della cena e svuota-frigo.

## 12. Milestone di sviluppo
| # | Contenuto | Fatto quando |
|---|---|---|
| M0 | Progetto Vite + Svelte + TS, PWA, deploy GitHub Pages con Actions, avviso installazione | L'app vuota si installa su iPhone e si apre offline |
| M1 | Design system (token, font, componenti: card, pulsanti, stepper, bottom sheet, tab con indicatore, barra navigazione), animazioni base | Pagina di prova con tutti i componenti |
| M2 | Database Dexie + validazione zod + backup/ripristino | Test unitari verdi |
| M3 | Dieta: import MyDiet e formato esteso, Piano, Spesa, Ricette, pannello piano | Il file di ottobre si importa e si usa offline |
| M4 | Allena + Editor schede + libreria esercizi | Creo, modifico e riordino una scheda |
| M5 | Flusso sessione (Readiness, Intro, Live, Riepilogo) + Storico | Una sessione completa finisce nello storico |
| M6 | Home "Oggi" che collega dieta e allenamento | La Home mostra pasto e scheda del giorno |
| M7 | Profilo e misurazioni | Inserisco due misure e vedo il confronto |
| M8 | Condivisione link/QR/file + gestione versioni | Il PT mi manda una scheda e la importo |
| M9 | Progressi: corpo, forza, dieta nel tempo | Dai dati inseriti vedo gli andamenti, anche offline; schermate vuote o con pochi dati senza grafici rotti |

## 13. Punti aperti
- Readiness: confermare con il PT la scala "5 = meglio" per stress e affaticamento.
- Diete: con "Sostituisci" (stesso `id`, M8) il diario dei giorni passati punta al contenuto nuovo del piano; Progressi ricalcola quei giorni con il piano sostituito. Valutare se conservare il contenuto per data.
- Progressi su iPhone: verificare che il trascinamento sul grafico e lo scroll verticale convivano bene col pollice (`touch-action: pan-y`).
- Nome definitivo dell'app (provvisorio: **Healthy**; repository `rojo-66/Healthy`, URL `https://rojo-66.github.io/Healthy/`).

## Stato
- [x] M0 · [x] M1 · [x] M2 · [x] M3 · [x] M4 · [x] M5 · [x] M6 · [x] M7 · [x] M8 · [x] M9 → **V1 completa**
- [x] Dopo V1: **modello del piano per Claude** e import tollerante (note in fondo)
- [x] **Rifinitura iPhone 1**: barra in fondo, niente zoom involontario, titoli di Nuova misura, Stepper scritti a mano, più gesti (note in fondo)

### Note M1 · design system
- **Pagina di prova** `#/showcase`, collegata dalla Home provvisoria con "Componenti (prova)" (il link sparisce in M6). È un chunk caricato a richiesta, ma è nel precache: funziona offline.
- **Rotte hash** con un router minimo (`src/lib/routes.ts`, `src/lib/router.svelte.ts`). Sono rotte solo gli hash `#/…`; `#import=…` (§ 8.4) resta libero. Una rotta sconosciuta porta alla Home.
- **Componenti** (`src/lib/components/`): Card, NoteBox, Button, Stepper, CheckButton, Tabs, BottomSheet, BottomNav, TopBanner (+ SegmentBar), BottomBanner, ProgressRing, ProgressBar, Icon. Il colore di sezione si passa con `tone`.
- **Font**: solo sottoinsieme latin, Permanent Marker 400, Space Grotesk 400/500/700, JetBrains Mono 500/700 (≈ 113 KB in woff2, tutti nel precache; i `.woff` di riserva non entrano nel precache).
- **Animazioni**: solo transform/opacity. **Eccezione voluta**: gli anelli animano `stroke-dashoffset`. Barre e segmenti si riempiono con `translateX`, non con `width` come nei mockup. Il colore delle etichette dei tab cambia senza transizione.
- **BottomSheet** usa `<dialog>` nativo con `showModal()` (focus bloccato, sfondo inerte, Esc), overlay e pannello disegnati da noi. Si chiude toccando fuori, trascinando giù la maniglia (oltre 1/4 dell'altezza o con un colpo veloce), con Esc o con ✕.
- **Bordo delle card**: segue anche gli angoli tagliati (nei mockup il bordo `inset` spariva sulla diagonale). Il bagliore sta su un contenitore con `drop-shadow`, perché `clip-path` taglierebbe un `box-shadow`.
- **BottomNav**: Oggi = verde come in `Main.dc.html`; Allena magenta, Dieta verde, Progressi e Profilo ciano.
- TopBanner, BottomBanner e BottomNav non sono `position: fixed`: li tiene fermi il layout dello schermo (header, corpo `.scroll`, footer), come nei mockup.
- Da verificare su iPhone dopo il deploy: app installata → "Componenti (prova)" → modalità aereo.

### Note M2 · database, validazione, backup
- **Codice** in `src/lib/data/`: `db.ts` (Dexie, database **`healthy-app`**), `versions.ts` (versioni dello schema), `schemas/` (zod, un file per tabella + file condivisi + backup), `repo/` (accesso ai dati), `backup.ts`, `read-file.ts`, `deliver-file.ts`, `storage.ts`, `limits.ts`, `errors.ts`. Nessuna dipendenza da Svelte tranne `live.svelte.ts`.
- **Convenzioni**: id = UUID (`crypto.randomUUID()`), slug per gli esercizi della libreria; giorni `AAAA-MM-GG` (locale); istanti ISO 8601 UTC. Testi liberi sempre stringhe (vuoto = `''`); `null` solo per numeri, enum e oggetti facoltativi. Giorni della settimana 1 = lunedì … 7 = domenica.
- **Chiavi e indici** (v1): `profile` `id` (sempre `"me"`) · `measurements` `id, date` · `exercises` `id, name, *muscles` · `workouts` `id, updatedAt, *weekdays` · `sessions` `id, startedAt, [workoutId+startedAt]` · `dietPlans` `id, validFrom` · `dietLog` `date, planId` · `shopping` `weekStart` · `settings` `key`. I booleani (`active`, `archived`, `custom`) non sono indicizzabili in IndexedDB: si filtrano in memoria.
- **Scostamenti da § 7** (confermati):
  - `dietLog`: **una riga per giorno** `{ date, planId, swappedFromWeekday, eaten: { mealKey: bool } }` invece di una riga per pasto.
  - `sessions`: + `workoutName` (copia del nome della scheda); `sets[]` + `itemIndex` (la stessa scheda può contenere due volte lo stesso esercizio); `userNotes` è un elenco `[{ itemIndex, exerciseId, text }]` invece di un record per `exerciseId`; `cardioDone` è `{ type, minutes, distanceKm } | null`; `endedAt: null` = sessione in corso.
  - `workouts.items[]`: + `muscles[]` (come § 8.1), `exerciseId` può essere `null` (esercizio arrivato da file, non ancora collegato alla libreria), `setsDetail` `[{ reps, kg }] | null` con una voce per serie.
  - `profile.goal`: enum `lose | gain | maintain | recomp`; `sex`: `M | F | null`.
  - `measurements`: FFM%, BCM%, BMI, ECW/TBW non si salvano, si calcolano (§ 6.3).
  - `settings`: `lastBackupAt` e `storagePersist { granted, checkedAt }` sono **impostazioni del telefono**: non entrano nel backup, non contano nei conteggi e restano dopo "Svuota tutto" e dopo un ripristino.
- **Piano alimentare** (§ 8.2, `schemaVersion 2`): pronto per MyDiet (M3): categorie libere, `products[].cat` anche fuori da `categories`, pasti con `name: ""` e `items: []`, `per100`/`targets`/`dayTypes`/`recipes` facoltativi, `unit` `g | pz | ml`. Controlla i riferimenti (prodotti, ricette, tipi di giornata) con messaggi tipo "Lunedì › Pranzo usa il prodotto «xyz» che non è nell'elenco dei prodotti".
- **Validazione**: ogni scrittura nel database e ogni file passano da zod; errori in italiano "campo › motivo" (al massimo 10, poi "… e altri N errori"), mai stack trace; nessun salvataggio parziale. Chiavi dei dizionari solo `[a-z0-9_-]`, vietate `__proto__`, `constructor`, `prototype` (un file con `__proto__` viene rifiutato già alla lettura); link video solo `https://`.
- **Limiti** (`limits.ts`): file scheda/dieta ≤ 1 MB, backup ≤ 20 MB (controllati prima di leggere il file); nomi ≤ 120 caratteri, note ≤ 2.000, introduzione e passaggi ≤ 4.000, URL ≤ 2.048; elenchi limitati (es. 60 esercizi per scheda, 20 serie, 1.000 prodotti; nel backup 20.000 sessioni).
- **Versioni del database**: si aggiunge sempre una versione in fondo a `DB_VERSIONS` (`stores` + `upgrade`), mai si modificano quelle esistenti. Testato: v1 → v2 di prova con dati conservati e trasformati; se l'`upgrade` fallisce il database resta alla v1 con i dati intatti.
- **Backup** (§ 8.5, `schemaVersion 1`): `{ app, kind: "backup", schemaVersion, createdAt, dbVersion, counts, tables }`, file `healthy-backup-AAAA-MM-GG.json` (in `.gitignore`). I conteggi devono coincidere con le righe (file troncato → errore). Formati vecchi migrati con `backup-migrations.ts`, formati più nuovi rifiutati. Ripristino in **una transazione** su tutte le tabelle: se una scrittura fallisce i dati attuali restano intatti. `isBackupStale(lastBackupAt, now)`: oltre 14 giorni (o mai) → `true`; il promemoria arriva nel Profilo (M7).
- **Consegna del file**: Web Share API con file se disponibile, altrimenti download. Annullare il foglio di condivisione non è un errore. Se Safari rifiuta la condivisione perché è passato troppo tempo dal tocco (`NotAllowedError`), compare "Condividi il backup" per riprovare con un nuovo tocco.
- **Persistenza**: a ogni avvio `navigator.storage.persist()` (se non è già persistente) con l'esito salvato in `settings`; `getStorageStatus()` legge persistenza e spazio usato (`null` dove il browser non lo dice). Dexie e zod sono in un chunk caricato dopo l'avvio (nel precache).
- **Reattività**: `liveQuery` di Dexie avvolto in `liveState()` (`live.svelte.ts`): le liste si aggiornano da sole quando cambiano i dati letti, anche dopo un ripristino o da un'altra scheda.
- **Pagina tecnica** `#/dev-data` (link "Dati (prova)" in `#/showcase`): conteggi, dati di prova (da `tests/fixtures/backup-valid.json`, finti), esporta, importa con anteprima e conferma, svuota con conferma, persistenza, spazio usato, ultimo backup. Da rimuovere o riusare nel Profilo (M7).
- Da verificare su iPhone dopo il deploy: app installata → Componenti (prova) → Dati (prova) → Carica dati di prova → Esporta backup (Salva su File) → Svuota tutto → Importa backup dal file salvato.

### Note M3 · Dieta
- **Codice**: logica pura in `src/lib/diet/` (`import/` riconoscimento, adattatore MyDiet, anteprima, esportazione · `calc/` nutrienti, target, stima, osservazioni, completezza, spesa, pasto attuale, calendario · `edit.ts` completamento guidato · `swipe.ts` · `view.ts` cosa mostra la tab Piano). Schermate `src/routes/Diet.svelte` (`#/dieta`) e `src/routes/DietComplete.svelte` (`#/dieta/completa`), componenti in `src/routes/diet/`; layout con barra di navigazione in `src/routes/Screen.svelte` (usato anche dalla Home provvisoria). Nuova icona `file` in `Icon`.
- **Import**: il tipo si riconosce dal contenuto (`app`). MyDiet: validato com'è arrivato (`mydiet-schema.ts`), convertito e validato di nuovo come piano esteso; errori in italiano con il percorso, nessun salvataggio parziale. `giorni[i]` → `weekday i+1`; pasti in ordine colazione, spuntino1, pranzo, spuntino2, cena (etichette Colazione/Spuntino/Pranzo/Spuntino/Cena; altre chiavi dopo, con un nome leggibile); `abilita`/`fine` → `window` (orari non validi: ignorati con avviso), `time: null`; categorie fuori elenco e pasti vuoti ammessi. Valori nutrizionali, target, tipi di giornata e ricette restano mancanti.
- **Metadati MyDiet** (il file non li ha): id `mydiet-` + impronta FNV-1a del contenuto (lo stesso file reimportato viene riconosciuto), `version 1`, titolo dal mese di `esportato` ("Ottobre 2026", modificabile nell'anteprima; senza data "Piano MyDiet"), `validFrom` = data di `esportato`, autore vuoto ("Da MyDiet").
- **Integratori MyDiet**: i prodotti di categoria "Integratori" usati in un pasto diventano anche `supplements` del giorno (`when` = pasto, `dose` = quantità) e restano nel pasto per i calcoli. Si aggiungono e tolgono a mano nel completamento guidato.
- **Salvataggio**: in una transazione; il nuovo piano diventa attivo, quello attivo prima va in archivio (`archived: true`, mai cancellato). Stesso `id`: versione maggiore → "Sostituisci" o "Salva come copia"; uguale o minore → avviso e solo "Salva come copia" (nuovo UUID, titolo "… (copia)"). "Ripristina" dall'archivio riattiva un piano e archivia quello attivo.
- **Esporta**: file esteso `healthy-dieta-<titolo>.json`, validato prima della consegna; Web Share con file, altrimenti download. **Condividi** (link, QR) è visibile ma dichiarato "in arrivo" (M8): al tocco spiega che arriverà e rimanda a "Esporta".
- **Calcoli**: grammi da `g`, da `ml` (1 ml ≈ 1 g) e da `pz` × `pieceGrams`. Alimenti senza valori (o pezzi senza `pieceGrams`) mai contati come zero: totali "≥ …" con "* senza valori", "—" se non si sa niente. Target: quelli del tipo di giornata, con l'origine (`TARGET: NUTRIZIONISTA` / `INSERITO DA TE` / `STIMATO`); altrimenti `CALCOLATO` dal piano, solo se tutti gli alimenti hanno valori; altrimenti `TARGET: MANCANTE`.
- **Stima** (solo kcal, solo se accettata): Mifflin-St Jeor × 1,2 riposo / 1,45 corsa / 1,55 palestra; dimagrire −15% (max −500), aumentare +10%; minimo 1.200 kcal (F) / 1.500 (M) con avviso. Servono anno di nascita, sesso, altezza (profilo) e un peso (misure): fino a M7 il pulsante dice cosa manca.
- **Osservazioni** (tutti i piani importati sono del nutrizionista): scarto maggiore tra kcal/P/C/G e target se ≥ 5% (non con target calcolati; con valori mancanti "Non posso confrontare…"); giorni senza verdura (radici dei nomi in `calc/vegetables.ts`: la categoria non basta). Sempre con "L'app non modifica il piano: segnala soltanto."
- **Completezza**: % = giorni con tipo + tipi usati con target + alimenti usati con valori; ricette e integratori in elenco ma fuori dalla %. Tipi predefiniti `gym`/`run`/`rest` (Palestra/Corsa/Riposo, rombo magenta/ciano/grigio; altre chiavi grigie). I target del nutrizionista non si modificano; gli alimenti già compilati si correggono solo nei piani MyDiet. L'editor completo (pasti, grammi) non è in M3.
- **Tab Piano**: un solo `ProgressRing` nel riepilogo, mai ricreato (cambiano solo i valori); solo l'elenco del giorno è in un `{#key}`, con sola transizione di entrata. Il testo dell'anello resta nel foro (testato). Oggi: kcal mangiate / target; altri giorni: kcal del piano / target. Pasto attuale: primo pasto non vuoto e non mangiato la cui finestra contiene l'ora (senza finestra: da `time` al pasto successivo); si mostra `time` o la finestra. Pasti vuoti nascosti. Swipe orizzontale tra i giorni (segue il dito, molla al rilascio, resistenza su lunedì e domenica; con "Riduci movimento" cambio secco); `touch-action: pan-y` lascia lo scroll verticale.
- **Scambio del giorno**: salvato in `dietLog.swappedFromWeekday`; cambiandolo le spunte di oggi si azzerano (con conferma se ce ne sono). La spesa ignora gli scambi.
- **Spesa**: somma dei 7 giorni per prodotto (mai conversioni tra prodotti); reparti nell'ordine di `categories`, poi gli altri, "Altro" per i prodotti senza reparto; `g` → "1,6 kg" da 1.000, `ml` → "1,5 L", pezzi solo il numero; riga "Esclusi dalla lista: …" per `shop: false`. Spunte in `shopping` per settimana (lunedì). "Condividi" manda come testo ciò che resta da comprare (Web Share di testo → appunti → testo da copiare a mano).
- **Scostamenti dal mockup**: il pannello del piano è un bottom sheet (non un riquadro che scende); negli altri giorni la didascalia dell'anello è "su 1.900" invece di "target 1.900" (non stava nel foro), "target —" se manca; la nota del nutrizionista è nel riquadro giallo tratteggiato (`NoteBox`) come le altre note.
- **Correzioni di M2**: `listDietPlans()` ordinava con l'indice `validFrom`, che salta i `null`: ora ordina in memoria (`importedAt`, poi `validFrom`). `activateDietPlan()` ora archivia il piano attivo precedente.
- **Test**: fixture finte `tests/fixtures/mydiet.json` (stessa struttura del file vero), `diet-extended.json`, `invalid/mydiet-bad.json`. `tests/unit/diet/private-file.test.ts` prova il file vero solo dove esiste `private/` (in CI viene saltato). Playwright `tests/e2e/diet.spec.ts` con l'ora fissata a lunedì 12/10/2026 13:00.
- Prova fatta con il file vero di ottobre nella build (`npm run preview`): import, Piano, Spesa, ricarica offline. Da verificare su iPhone dopo il deploy: app installata → Dieta → Importa il file MyDiet (da File) → completa almeno un giorno → modalità aereo.

### Note M4 · Allena, editor schede, libreria esercizi
- **Codice**:
  - **logica pura** in `src/lib/workouts/`: `calc/` (durata e contatori, regole sui valori, serie piramidali, versioni, settimana e prossimo allenamento, validazione dell'editor, riordino), `draft.ts` (bozza dell'editor), `format.ts`, `library/` (dati, liste chiuse, ricerca, caricamento, esercizi personalizzati);
  - **supporto all'interfaccia**: `drag-reorder.ts`, `flip.ts`, `keyboard.svelte.ts`, `debounce.ts`;
  - **schermate**: `src/routes/Train.svelte` (`#/allena`), `WorkoutEditor.svelte` (`#/allena/editor`, `?id=` per modificare, `bozza=1` per riprendere la bozza senza chiedere), `WorkoutView.svelte` (`#/allena/vedi?id=`); componenti in `src/routes/train/` e `src/routes/train/editor/`;
  - **router**: `parseQuery`/`routeHref` per i parametri; le pagine con parametri si ricreano su `route.nav` (navigazioni vere); `replaceRoute` corregge l'indirizzo senza ricrearle (es. `?id=` dopo il primo salvataggio).
- **Libreria esercizi**:
  - **contenuto**: 752 esercizi di forza. 734 vengono da [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (Unlicense, pubblico dominio; commit fissato in `scripts/library/build.mjs`), da cui si prendono solo nome, muscoli e attrezzo, niente istruzioni né immagini. 18 sono macchine aggiunte a mano (`scripts/library/extra.json`). 296 hanno il nome italiano (`scripts/library/names-it.json`), gli altri restano in inglese.
  - **file generato**: `npm run library` produce `src/lib/workouts/library/data.ts`.
  - **muscoli** (14, il primo è il principale): Petto, Dorsali, Trapezi, Spalle, Bicipiti, Tricipiti, Avambracci, Addominali, Lombari, Glutei, Quadricipiti, Femorali, Adduttori, Polpacci.
  - **attrezzi** (12): Bilanciere, Bilanciere EZ, Manubri, Macchina, Multipower, Cavi, Corpo libero, Kettlebell, Elastico, Palla medica, Fitball, Altro.
- **Aggiornamenti della libreria**:
  - `syncLibrary()` gira all'avvio e all'apertura di Allena e dell'editor. È idempotente: scrive solo le righe mancanti o cambiate, in una transazione.
  - Non tocca mai gli esercizi personalizzati e lascia le righe che la libreria non ha più.
  - Gli id (`fx-…` dalla fonte, `it-…` aggiunti) non cambiano e non spariscono: lo script si ferma se un id pubblicato manca.
  - La libreria è dell'app, non dei dati dell'utente: non entra nel backup né nei conteggi, e "Svuota tutto" e il ripristino non la toccano (`isBuiltInExercise`).
- **Ricerca e personalizzati**:
  - **ricerca**: insensibile a maiuscole e accenti; tutte le parole cercate devono comparire nel nome. Il filtro guarda il muscolo principale. Prima i nomi che iniziano con la ricerca, poi gli esercizi comuni (nome italiano o personalizzati), poi alfabetico. Si mostrano 60 risultati alla volta ("Mostra altri"); ricerca e filtro si azzerano a ogni apertura.
  - **personalizzati** (crea, modifica, elimina dal foglio Libreria): muscoli e attrezzo dalle liste chiuse. Prima di eliminare compare l'avviso con le schede che lo usano; le schede restano invariate (nome e muscoli copiati, `exerciseId` conservato).
- **Cambi agli schemi di M2** (solo aggiunte, nessuna nuova versione del database):
  - `settings` ha due chiavi nuove: `workoutAuthor { name, lastSource }` e `workoutDraft { savedAt, draft }`, con lo schema permissivo della bozza in `schemas/workout-draft.ts`;
  - `workoutSchema` ed `exerciseSchema` non cambiano;
  - le regole più severe dell'editor (almeno 1 esercizio, ripetizioni ≥ 1, nome del PT per le schede PT) stanno in `workoutEditorSchema`: le schede importate con 0 ripetizioni restano valide nel database;
  - link video solo `https://`.
- **Valori**: serie 1–20, ripetizioni 1–100. I kg vanno a passi di 2,5 **agganciati ai multipli** (22 → 22,5 / 20); i valori importati restano finché non si toccano. Recupero 60/90/120/180 s, più il valore importato se diverso (es. 75 s). Un esercizio aggiunto parte da 3 × 10, 0 kg, 90 s.
- **Durata** = Σ serie × (recupero + 45 s), in minuti arrotondati, + cardio. Le card dell'elenco mostrano il totale; la card "Prossimo" mostra "~esercizi’ + cardio’ tipo".
- **Serie diverse tra loro**: con il dettaglio attivo, kg e ripetizioni "uniformi" sono quelli della serie 1. Cambiando il numero di serie si copia l'ultima o si tolgono le ultime. Disattivando tornano uniformi con la serie 1 (conferma solo se erano davvero diverse); riattivando nella stessa bozza si ritrovano i valori, purché quelli uniformi non siano cambiati.
- **Versioni e origine**:
  - scheda nuova = v1;
  - scheda mia (TUA, o PT con autore = il mio nome) = stesso id, v+1;
  - scheda di un altro PT = mia copia (nuovo id, v1, TUA), con avviso nell'editor; l'originale resta aggiornabile in M8;
  - "Duplica" = nuovo id, v1, "… (copia)", **senza giorni**, origine come una scheda nuova;
  - l'origine di una scheda nuova si sceglie nell'editor ("Per me / Come PT" + nome del PT). L'ultima scelta salvata diventa il predefinito (`settings.workoutAuthor`); in M7 si sposta nel Profilo;
  - "Salva e invia" senza modifiche non crea una nuova versione ("Nessuna modifica: resta alla v3").
- **Settimana**: 1 = lunedì.
  - **stati dei giorni**: fatto = sessione conclusa quel giorno per una delle sue schede; prossimo = primo giorno da oggi con una scheda non fatta (a settimana finita: primo giorno con scheda della settimana dopo); non fatto (grigio) = passato senza sessione; riposo (tratteggiato) = nessuna scheda.
  - **sigla**: prime 3 lettere o cifre del nome, senza accenti. Con più schede nello stesso giorno compare la sigla della prima per nome e il dettaglio le elenca tutte.
  - **sessioni**: fino a M5 la lista è vuota; si leggono con `recentSessions()`.
- **Editor**:
  - **layout**: a schermo intero come il mockup (niente barra di navigazione). Nome nel titolo su una riga (28 → 16 px), badge "v3 → v4" / "NUOVA · v1" / "COPIA · v1", contatori in tempo reale.
  - **riscaldamento**: in un foglio dal basso (nome, suggerimento, dose, Su/Giù/Elimina).
  - **cardio**: facoltativo, con tipi rapidi.
  - **esercizi**: Elimina mostra "Annulla" per 8 s.
  - **errori**: compaiono dopo il primo tentativo di salvataggio, accanto al campo; la riga con errore si apre e scorre in vista, e sopra il banner c'è il riepilogo "N campi da correggere".
  - **anteprima**: foglio dal basso con la stessa vista di "Vedi scheda" (sola lettura; link video come testo, `target="_blank" rel="noopener noreferrer"`).
  - **"Salva e invia"**: salva, poi mostra "Scheda salvata" e spiega che l'invio arriva in M8 (nessun finto invio).
  - **tastiera iPhone**: campi a 16 px (niente zoom); il campo in focus viene portato in vista; con la tastiera aperta il banner inferiore si nasconde (solo transform/opacity).
- **Riordino**:
  - pressione lunga (350 ms) sulla maniglia ⠿ (44 px, `touch-action: none`), poi trascinamento con Pointer Events;
  - la riga sollevata segue il dito, le altre scivolano (solo `transform`), con scorrimento automatico vicino ai bordi; al rilascio si assesta;
  - Su/Giù/Duplica/Elimina sono animati con FLIP (`transform`);
  - con "Riduci movimento" niente transizioni;
  - annuncio `aria-live` "spostato in posizione N di M".
- **Bozza**:
  - salvataggio automatico 400 ms dopo ogni modifica, e subito quando l'app va in background (`visibilitychange`, `pagehide`) o si esce dall'editor;
  - una sola bozza; alla riapertura dello stesso editor (o di una scheda nuova) chiede "Riprendi / Scarta";
  - Allena mostra "Bozza non salvata · Riprendi la bozza";
  - indietro con modifiche: Salva / Esci senza salvare (cancella la bozza) / Continua;
  - aprire e modificare un'altra scheda sostituisce la bozza precedente.
- **Funzioni "in arrivo"** (Importa, Condividi, Avvia): sono visibili, ma al tocco un foglio spiega che arrivano in M5/M8. Lo Storico ha già il calendario del mese, con lo stato vuoto "Nessun allenamento ancora".
- **Scostamenti dal mockup**:
  - la card "Prossimo" non ha l'orario ("MAR 18:00"): la scheda non ha un campo orario;
  - il menu della scheda è un foglio dal basso (Vedi, Modifica, Duplica, Elimina);
  - niente schede solo cardio (serve almeno un esercizio, come il file § 8.1);
  - i filtri della libreria sono i 14 muscoli, non i gruppi del mockup (Schiena/Gambe/Braccia/Core);
  - una riga aperta mostra il dettaglio delle serie al posto degli stepper Ripetizioni/Kg quando "Serie diverse" è attivo.
- **Correzione di M1**: `Stepper` accetta un passo personalizzato (`next`) per i kg. Nuove icone `qr` ed `edit`.
- **Test**:
  - **fixture finte**: `tests/fixtures/workouts/` (settimana con schede PT e TUE, piramidali, riscaldamento, cardio, recupero 75 s; esercizio personalizzato);
  - **Vitest**: `tests/unit/workouts/` (libreria e caricamento, ricerca, calcoli, piramidali, riordino, versioni, bozza, validazione, salvataggio, personalizzati, settimana);
  - **Playwright**: `tests/e2e/train.spec.ts` (creazione con libreria e personalizzato, stepper, piramidali, Giù e trascinamento, anteprima, salvataggio, ricarica offline, v1 → v2 → v3, duplica ed elimina, errori, bozza, 44 px e nessuno scroll orizzontale, due schede nuove di seguito).
- **Da verificare su iPhone dopo il deploy**: app installata → Allena → + Nuova scheda → trascinamento con il dito sulla maniglia; tastiera sui campi nota/link (banner nascosto, campo visibile); chiudere l'app dal multitasking durante una modifica e riaprire (bozza); modalità aereo.

### Note M5 · Flusso sessione e Storico
- **Codice**:
  - **logica pura** in `src/lib/sessions/`: `readiness`, `create` (nuova sessione con copia della scheda), `items` e `last-time` (abbinamento esercizi, "ultima volta", precompilazione), `edit` (modifiche immutabili), `stats` (volume, serie, durata, serie migliore, segmenti), `rest-timer`, `input` (kg/rip), `records`, `compare`, `summary`, `calendar`, `format`, `share`, `next-meal`, `writer` (coda delle scritture);
  - **browser**: `audio.ts` (Web Audio), `wake-lock.ts`, `edge-swipe.ts`, `flow.svelte.ts` (Readiness e riscaldamento in memoria), `nav.ts`;
  - **schermate** in `src/routes/session/`: `Readiness` (`#/sessione/readiness?scheda=`), `Intro` (`#/sessione/intro?scheda=`), `Live` (`#/sessione/live?id=`), `Summary` (`#/sessione/riepilogo?id=[&da=storico]`); `ResumeCard` e `StartGate` pronti anche per la Home (M6). `#/allena?tab=storico` apre lo Storico.
- **Schema** (DB v2, indici invariati): `sessions` + `snapshot { items, cardio }` (copia della scheda all'avvio: riepilogo e storico restano corretti se la scheda cambia o sparisce) + `live { itemIndex, rest }` (`null` a sessione conclusa). Entrambi `null` di default: i backup v1 restano validi, formato di backup invariato. L'`upgrade` v2 aggiunge i campi alle righe esistenti (testato). Nuovo file `kind: "session"` (`schemas/session-file.ts`, `schemaVersion 1`): sessione conclusa con la copia della scheda, validata prima della consegna; l'import lato PT arriva con M8 o dopo.
- **Regole decise**:
  - **PR** = carico a parità di ripetizioni: una serie fatta con kg > 0 è PR se supera il massimo storico tra le serie fatte con ripetizioni ≥ alle sue, stesso esercizio (id della libreria o nome normalizzato), solo sessioni concluse prima. Senza serie confrontabile niente PR. Un badge per esercizio; "Record" = esercizi con PR. Calcolati, non salvati (eliminare una sessione li ricalcola).
  - **Corsa**: rimandata. Lo Storico mostra solo palestra (magenta) e riposo (grigio); la voce "corsa" non è in legenda.
  - **Recupero**: preset e ±15 s valgono per il recupero in corso; "Predefinito del PT: N s" lo fa ripartire con il tempo dell'esercizio. Timer a istanti (`endsAt`), non a contatore: dopo una sospensione di iOS il tempo è giusto.
  - **Serie fatte/previste**: previste = piano; una serie aggiunta conta se spuntata (può risultare 8/7), se non spuntata non è "saltata" e non compare nel riepilogo. Il segmento non supera il pieno.
  - **"Ultima volta"** = ultima sessione conclusa della stessa scheda; esercizi abbinati per id (o nome) e occorrenza, quindi regge il riordino. Precompila kg/rip dalla serie fatta, altrimenti dal piano (piramidali comprese).
  - **Confronto** nel riepilogo: serie mancanti → giallo "−N serie" (ha la precedenza); altrimenti serie migliore (kg più alti, poi ripetizioni) → ciano "+x kg"/"+n rip", grigio "=" o peggio, "prima volta" senza storico.
- **Persistenza**: la riga nasce su "Inizia allenamento"; prima (Readiness, riscaldamento) tutto resta in memoria. Ogni modifica si salva subito (testo e numeri dopo 300 ms, e subito su `visibilitychange`/`pagehide`/uscita). Una sola sessione in corso: "Avvia" con un'altra in corso chiede Riprendi / Abbandona e inizia. Il flusso naviga con `location.replace`: indietro (o lo swipe di Safari) dal Live non torna mai al Readiness.
- **iPhone**:
  - **audio**: sbloccato su "Inizia allenamento" (dopo "Riprendi", al primo tocco nel Live). Web Audio resta nella sessione "ambient": si mescola alla musica ma **il tasto silenzioso lo azzittisce**; scelta voluta (la sessione "playback" fermerebbe la musica). L'impulso del cerchio, "PRONTO" e l'annuncio `aria-live` bastano da soli; il pannello lo dice. Recupero finito con l'app in background: al ritorno niente suono in ritardo.
  - **Wake Lock**: chiesto su "Inizia"/"Riprendi" e di nuovo a ogni ritorno in primo piano; rilasciato all'uscita dal Live. Senza API non succede nulla.
  - **tastiera**: campi a 16 px (`inputmode="decimal"`/`numeric`), il campo in focus va al centro, il banner inferiore scivola via (come nell'editor M4).
  - **swipe indietro** dal bordo sinistro su Readiness, Intro e Riepilogo; mai nel Live (solo freccia con conferma: Esci / Abbandona / Continua).
- **Invia al PT**: testo leggibile + file `healthy-sessione-<scheda>-AAAA-MM-GG.json` nel foglio di condivisione (Web Share con file, altrimenti solo testo); senza Web Share un pannello con "Copia testo" e "Scarica il file". Testo e file preparati prima del tocco. Mai invio automatico.
- **Prossimo pasto** nel Riepilogo: solo se la sessione è finita oggi e c'è un piano attivo; pasto del momento, altrimenti il prossimo non mangiato (con lo scambio del giorno). Tocco → Dieta.
- **Scostamenti dal mockup**:
  - RPE su 2 righe da 5 (10 in fila sarebbero larghi 32 px, sotto i 44 px);
  - campi kg/rip veri (`<input>`) invece di pulsanti, a 16 px;
  - card DURATA con sottotitolo "N esercizi" (i recuperi effettivi non si registrano: niente "recupero medio");
  - badge parziale del riepilogo con testo chiaro (contrasto);
  - "Elimina sessione" in fondo al Riepilogo (il mockup non la prevedeva);
  - l'elenco dello Storico mostra le sessioni del mese scelto nel calendario;
  - il calendario ha le frecce mese precedente/successivo (la successiva si ferma al mese corrente);
  - transizioni di schermata con Svelte (`in:` scorrimento + dissolvenza), non View Transitions API.
- **Correzioni**: `#app` con `overflow-x: clip` (le schermate che entrano di lato allargavano il layout); `deliver-file.ts` esporta anche `downloadFile`.
- **Test**:
  - **fixture finte** `tests/fixtures/sessions/` (scheda con piramidale, esercizio senza id e cardio; storico di 5 settimane con sessioni complete, parziali, serie aggiunte e PR noti; sessione in corso);
  - **Vitest** `tests/unit/sessions/` (readiness, creazione e copia, ultima volta e riordino, precompilazione, modifiche, volume e serie, segmenti, timer con orologio simulato e sospensione, coda delle scritture, ripresa dal database, una sola sessione in corso, PR, confronto, riepilogo, calendario e mese, formati, file e testo per il PT, condivisione, prossimo pasto, swipe, audio e Wake Lock con oggetti finti) + migrazione v1 → v2 in `tests/unit/data/db.test.ts`;
  - **Playwright** `tests/e2e/session.spec.ts` (390×844, `page.clock`, offline): sessione completa (readiness, intro, spunta, recupero e pannello, doppia spunta, PREC/SUCC, serie aggiunta, nota, ricarica a metà, uscita e "Riprendi", termina con cardio e RPE) → Riepilogo → Invia al PT (foglio simulato) → Fine → Storico dopo ricarica, mesi, swipe indietro, elimina; seconda sessione con "ultima volta", precompilazione, PR e confronto; abbandona e avvio con sessione in corso; 44 px, niente scroll orizzontale, banner fermi.
- **Da verificare su iPhone dopo il deploy**: app installata → Avvia → schermo che resta acceso; suono a fine recupero con e senza tasto silenzioso (e con musica in riproduzione); tastiera sui kg; chiudere l'app dal multitasking a metà e riaprire → "Riprendi allenamento" con recupero giusto; "Invia al PT" verso Messaggi/WhatsApp (testo + file); swipe dal bordo sul Riepilogo; modalità aereo.

### Note M6 · Home "Oggi"
- **Codice**:
  - **logica pura** in `src/lib/today/`: `home.ts` (tutto ciò che la Home mostra per una data, striscia della settimana), `day-type.ts` (tipo di giornata e conflitti), `meal-focus.ts` (pasto della card), `workout-day.ts` (allenamenti del giorno), `timeline.ts`, `tips.ts`, `sync.ts` (indicatore) + `sync-env.ts` (letture dal browser, non pure);
  - **schermata** `src/routes/Home.svelte` (rotta `#/`, ora chunk caricato a richiesta come le altre pagine: Dexie e zod restano fuori dal primo bundle) e componenti in `src/routes/home/` (`HomeScreen`, `HomeHeader`, `CaloriesCard`, `MealFocusCard`, `WorkoutSection`, `DayTimeline`, `WelcomeCard`);
  - **riusati senza copie**: `buildDayView`, `currentMealKey`/`upcomingMealKey`, `effectiveWeekday`, `resolveTargets`, `setMealEaten` (M3); `workoutsOn`, `workoutTotals`, `nextMeta` (M4); `StartGate`, `ResumeCard`, `sessionDate`, `summaryHref` (M5); `Card`, `NoteBox`, `ProgressRing`, `InstallBanner` (M0–M1); `normalize` della ricerca esercizi.
- **Refactor condivisi** (testati): `KcalMacros.svelte` (anello + barre P/C/G, usato da Dieta e Home); azione `daySwipe` (`src/lib/design/day-swipe.ts`, ex codice di `PlanTab`); orologio `nowClock()` (`src/lib/clock.svelte.ts`: ogni 30 s, a mezzanotte e al ritorno in primo piano; usato da Home, Dieta e Allena, che quindi non restano più sul giorno prima); `fnv1a` in `src/lib/hash.ts`; `buildDayView` con `keepEaten` (giorni passati); `mealStartMinutes` esportata; `TARGET_ORIGIN_TEXT`; `dayMonthYear`; link `#/dieta?ricetta=N` (`src/lib/diet/links.ts`) che apre la ricetta nella tab Ricette.
- **Schema** (DB v3, indici invariati): `workouts.time` (`HH:MM | null`), un orario per scheda valido in tutti i giorni assegnati. L'`upgrade` mette `null` nelle righe esistenti (testato v2 → v3); backup v1 e file § 8.1 restano validi (campo facoltativo, anche nella bozza). Editor: "Orario (facoltativo)" accanto a Giorni (`<input type="time">`, "Togli orario"); cambiarlo crea una nuova versione. La card "Prossimo" di Allena ora mostra l'orario (chiuso lo scostamento di M4).
- **Regole decise**:
  - **SYNC OFFLINE ✓** solo con quattro condizioni: database apribile e leggibile, app installata (standalone), service worker che controlla la pagina, storage persistente. Altrimenti una sola etichetta, in ordine: `NON SALVATO` (giallo) › `SOLO BROWSER` (giallo) › `OFFLINE NON PRONTO` (grigio) › `NON PROTETTO` (giallo); `VERIFICO…` durante il controllo. Non dipende dalla rete. Si ricontrolla al ritorno in primo piano, su `controllerchange` e poco dopo l'avvio (la persistenza viene chiesta in `main.ts`). Data e stato sempre su una riga (sotto i 360 px le lettere si stringono).
  - **Tipo di giornata**: vince il piano (del giorno seguito, scambio compreso), perché decide i target. Piano riposo/corsa con una scheda: la scheda si mostra con la riga gialla "Il piano alimentare … è da giorno di riposo: i target restano quelli del piano". Piano palestra senza scheda: riga gialla e riquadro riposo. Senza piano o senza tipo: "Giorno palestra" se c'è una scheda, altrimenti "Riposo". Tipi del piano diversi da gym/run/rest: etichetta del piano, nessun conflitto.
  - **Pasto della card**: quello del momento (stesse funzioni della Dieta); appena segnato resta nella card con "✓ Mangiato" (si annulla con un secondo tocco) finché è ancora il pasto di quell'ora, poi passa al prossimo ("Prossimo · …"). Prima del primo pasto e tra due finestre: il prossimo non segnato. Dopo l'ultimo: "Giornata chiusa · hai segnato N pasti su M". Pasti vuoti (MyDiet) esclusi; "Pasto libero" senza alimenti mostrato con "Nessun alimento indicato". Giorno senza pasti, giorno fuori dal piano, nessun piano: messaggi dedicati. Altri giorni: il pasto di quella stessa ora (domani "Anteprima", ieri "✓ Mangiato"/"Non segnato"), **sola lettura**.
  - **Calorie**: oggi e giorni passati kcal mangiate / target, domani kcal del piano / target; origine come frase ("Target del nutrizionista · giorno palestra", "Target calcolato dal piano", "Target mancante · completa il piano").
  - **Allenamenti del giorno**: schede assegnate (ordine per nome, tutte in elenco) più le sessioni concluse quel giorno con schede non assegnate ("Fuori programma"). Oggi: "Avvia allenamento" (passa da `StartGate`: con un'altra sessione in corso chiede Riprendi / Abbandona) e "Vedi scheda"; sessione in corso: la `ResumeCard` di M5 con "Riprendi allenamento"; fatta: adesivo "Fatto ✓" e "Vedi riepilogo". Orario: "18:00–19:15" (fine = durata stimata) oppure l'inizio reale della sessione; accanto "tra 5 h 20 min" / "adesso" / "fatto alle 19:10" / "non fatto" / "in programma".
  - **Timeline**: pasti (orario del pasto, ordinati per inizio della finestra), allenamento e integratori. Allenamento: orario della scheda o inizio reale; senza orario subito prima di un pasto "post-workout" o dopo un "pre-workout" (riconosciuti da chiave, etichetta o nome), altrimenti in fondo senza orario. Integratori: dopo il pasto indicato in `when` (chiave o etichetta, senza badare a maiuscole e accenti), prima/dopo l'allenamento se `when` parla di palestra/allenamento/workout, altrimenti in fondo con il testo di `when`; seguono lo stato del pasto o dell'allenamento a cui sono legati.
  - **Stati**: fatto (barrato), adesso (rombo verde, magenta per l'allenamento, più grande), dopo (ciano), **non segnato** (contorno grigio, non barrato: pasti e allenamenti passati non fatti), saltato (integratori "non serve oggi", barrati). Lo stato è letto anche dallo screen reader.
  - **Tip del giorno**: `fnv1a(data) % n` sull'elenco che unisce le osservazioni M3 di quel giorno (scarto ≥ 5%, verdura; con "L'app non modifica il piano: segnala soltanto.") e 15 consigli generici originali, filtrati per tipo di giornata. Con un piano niente consigli su cosa mangiare (uno solo è riservato a chi non ha un piano); nessuno parla di quantità né fa promesse.
- **Giorni**: oggi di default; striscia L–D della settimana corrente (oggi con contorno ciano, selezionato pieno nel colore del suo tipo) e swipe orizzontale sul contenuto (`daySwipe`: segue il dito, molla al rilascio, resistenza su lunedì e domenica, `touch-action: pan-y`, tocchi nei primi 24 px dal bordo sinistro lasciati allo swipe indietro di Safari, niente drag nativo né selezione del testo durante lo swipe). Il contenitore che ascolta resta fermo e si sposta solo il contenuto interno: uno swipe fatto mentre il contenuto torna a posto non va perso. "Torna a oggi" sugli altri giorni. A mezzanotte e al ritorno in primo piano la Home si ricrea sul nuovo giorno.
- **Anti-doppioni**: la card calorie (unico anello) resta montata e cambiano solo i valori; i contenuti del giorno sono in `{#key selectedDate}` con sola transizione d'entrata; timeline con chiavi stabili e `animate:flip`; spunta con due rami `{#if}` e transizione `pop`. Mai classe di animazione + key. Testato cambiando giorno più di dieci volte di fila (striscia, swipe, "Riduci movimento").
- **Stati vuoti**: primo avvio (niente piano e niente schede) con benvenuto e i due passi; l'`InstallBanner` di M0 resta in cima alla Home, non duplicato. Senza piano: "Nessun piano alimentare" → Dieta. Senza schede: "Nessuna scheda" → editor. Giorno senza scheda: riquadro "Riposo" tratteggiato. Database non disponibile: "Dati non disponibili".
- **Scostamenti dal mockup**:
  - badge del tipo di giornata scuro con il rombo colorato (come in Dieta) invece del badge verde pieno;
  - "TIP DEL GIORNO" fisso invece di "TIP DELLA SERA";
  - striscia con 4 px tra i giorni (6 nel mockup): su iPhone SE (375 px) ogni giorno resta largo almeno 44 px;
  - titolo del giorno nel colore del suo tipo (magenta palestra, ciano corsa, testo chiaro riposo); si rimpicciolisce invece di andare a capo e, se serve, il badge scende sotto;
  - "Avvia allenamento" a tutta larghezza come nel mockup, con il link "Vedi scheda" sotto;
  - swipe e striscia restano nella settimana L–D (come la Dieta): il lunedì "ieri" non c'è;
  - il link "Componenti (prova)" non c'è più (`#/showcase` e `#/dev-data` restano raggiungibili dall'indirizzo).
- **Test**:
  - **fixture finte** `tests/fixtures/home/`: `diet-partial.json` (solo lun–ven, pasti vuoti, pasto libero senza alimenti, pre-workout, pasti solo con `time`, integratori non collegati e "prima della palestra", tipo nullo, riposo senza target), `log-swap.json` (scambio di oggi, spunte di ieri, diario di un altro piano), `backup-home.json` e `backup-workouts-only.json` (piano esteso + schede M4 con orario, per gli e2e); riusate `diet-extended.json` e `workouts/week.json`;
  - **Vitest** `tests/unit/today/` (pasto del momento con orari limite, scambio, calorie e origine, tipo di giornata e conflitti, timeline e stati, allenamento in corso/fatto/fuori programma, tip deterministico, `syncStatus`/`isSyncOk`, mezzanotte, settimana, fixture validate), più `clock.test.ts`, `workouts/time.test.ts`, migrazione v3 in `data/db.test.ts`, `keepEaten` e link ricetta in `diet/view.test.ts`;
  - **Playwright** `tests/e2e/home.spec.ts` (390×844, `page.clock` su lun 12/10/2026 13:00): primo avvio, SYNC OFFLINE ✓ da app installata emulata (stessa riga della data a 390 e 320 px), NON SALVATO, pasto e allenamento, segna/annulla con anello e timeline, ricarica, ricetta, striscia e swipe senza doppioni, conflitto, Avvia → Readiness → Live → "Riprendi allenamento", mezzanotte, stati vuoti, offline, 44 px a 390 e 375 px. Aggiornati `pwa.spec.ts`, `showcase.spec.ts` e `session.spec.ts` (la Home dopo "Fine" mostra "Fatto ✓").
- **Da verificare su iPhone dopo il deploy**: app installata → Home con "SYNC OFFLINE ✓" (in Safari deve dire "SOLO BROWSER"); swipe tra i giorni con il pollice mentre si scorre in verticale; swipe dal bordo sinistro in Safari (non deve cambiare giorno); "Segna come fatto" e Dieta allineate; lasciare l'app aperta oltre la mezzanotte (o riaprirla dal multitasking il giorno dopo); modalità aereo.

### Note M7 · Profilo e misurazioni
- **Codice**:
  - **logica pura** in `src/lib/profile/`: `number` (numeri all'italiana), `age`, `metrics` (valori misurati/calcolati/stimati), `consistency` (errori e avvisi), `goals`, `direction` (colori delle variazioni), `compare`, `selection` (date a confronto), `format`, `form` (modulo misura), `profile-form`, `view` (testi pronti per la schermata); `src/lib/app-info.ts` (versione e build);
  - **schermate**: `src/routes/Profile.svelte` (`#/profilo`), `src/routes/Measurement.svelte` (`#/profilo/misura`, `?id=` per modificare); componenti in `src/routes/profile/`;
  - **riusati senza copie**: `mifflinStJeor`/`estimateKcal` (M3), `formatDecimal`/`formatInt`, `dayMonthYear`, backup e `isBackupStale` (M2), `getStorageStatus`, `InstallBanner` (M0), `keyboardState`/`keepFocusedVisible` (M4), `InfoSheet`, `ConfirmSheet`, `ActionBar` (M4, ora con `tone`), `Card`, `NoteBox`, `ProgressBar`, `BottomSheet`.
- **Schema** (DB v4, indici invariati):
  - `profile.activityLevel` (`sedentary` | `active`, predefinito `sedentary`): l'`upgrade` lo aggiunge alle righe esistenti (testato v3 → v4), i backup v1 senza il campo restano validi; formato di backup invariato;
  - `settings.nextMeasurement { text, date | null }` (entra nel backup);
  - `measurements` invariata: `notes` è la **lettura del nutrizionista** di quella misura;
  - `settings.workoutAuthor` resta con la stessa chiave e forma (nessuna migrazione): nome come PT e origine predefinita delle nuove schede (`lastSource`) si scelgono nel Profilo. L'editor non cambia più l'origine predefinita; il nome lo ricorda solo se è vuoto (serve a riconoscere le schede "mie").
- **Regole decise**:
  - **obiettivi**: Dimagrimento, Ricomposizione, Massa, Mantenimento (badge ciano pieno); senza obiettivo badge giallo "Scegli obiettivo";
  - **colori delle variazioni** (`direction.ts`, tabella confermata): ↑ / ↓ / = (banda) / — per parametro e obiettivo, con soglia neutra (es. peso 0,5 kg, FM 0,3 kg, PhA 0,1°, BMR 10 kcal, circonferenze 0,3–0,5 cm). Senza obiettivo restano colorati solo i parametri uguali per tutti (FFM, BCM, BCM%, BCMI, PhA, BMR, ECW, ECW/TBW). Si confrontano i valori arrotondati come a video. Non è una valutazione medica;
  - **coerenza**: avviso giallo (non blocca) se FM + FFM differisce dal peso più di max(1 kg; 1,5 % del peso), o se FM % misurata e FM / peso differiscono più di 1 punto. **Errori** (bloccano): FM o FFM > peso, BCM > FFM (anche calcolata), ECW > TBW, TBW > peso, data nel futuro o già usata, nessun valore;
  - **una misura per data**; solo la data è obbligatoria (oggi di default) più almeno un valore; i vuoti restano `null`, mai zero;
  - **numeri**: "76,4" e "76.4" valgono uguale, al massimo 2 decimali, niente negativi né testo; nei soli campi interi (kcal) "1.720" = 1720; a video sempre la virgola;
  - **età** = anno − anno di nascita (per il BMR di una misura, l'anno della misura): prima del compleanno risulta 1 anno in più, al massimo 5 kcal di differenza nel BMR. Anno nel futuro = errore; età < 14 o > 100 e altezza < 120 o > 220 cm = avviso che non blocca; altezza scritta in metri ("1,78") = errore con spiegazione;
  - **confronto**: variazione assoluta e in % del valore precedente (in "pt" per le percentuali), solo per i parametri presenti in entrambe le misure; il BMR stimato non si confronta con quello misurato e la sua variazione è sempre grigia;
  - **date a confronto**: predefinito ultima e precedente; la scelta resta dal lato toccato e l'altra si sposta sulla misura vicina (la precedente è sempre la più vecchia); se una misura scelta viene eliminata si torna al predefinito; con una misura sola niente confronto;
  - **stima nella Dieta**: fattore = tipo di giornata + livello (Sedentario: riposo 1,2 · corsa 1,45 · palestra 1,55, come M3; Attivo: +0,15 → 1,35 · 1,6 · 1,7). Peso = ultima misura che ha un peso. Avvisi in più: "formula pensata per gli adulti" (< 18 anni) e dati fuori dai valori abituali. Senza dati: "mancano …" con il link "Completa il Profilo". Sempre un'opzione: si applica solo con "Usa la stima" e non tocca i target del nutrizionista.
- **Sezioni di servizio**: `BackupPanel`, `RestoreConfirmSheet` e `StorageFacts` estratti da `DevData.svelte` e usati nel Profilo; promemoria giallo oltre 14 giorni o se il backup non è mai stato fatto. **`#/dev-data` ridotta** a strumenti di sviluppo (conteggi, "Carica dati di prova", "Svuota tutto"), raggiungibile solo dall'indirizzo e da `#/showcase`. Installazione: `InstallBanner` riusato (in standalone "App installata ✓"). Informazioni: "Versione 0.7.0 · build N (commit)" dal `define` di Vite (`GITHUB_RUN_NUMBER`, `GITHUB_SHA`; in locale "build locale"); `package.json` passa a `0.7.0`.
- **Anti-doppioni**: card e righe montate una volta con chiavi stabili, cambiano solo i testi; nessun `{#key}` sulle date. Barre con `translateX` (`ProgressBar`, barra FFM/FM). Testato cambiando date più di dieci volte, anche con "Riduci movimento".
- **Correzioni e aggiunte al design system**:
  - `BottomSheet`: (1) con la tastiera di iPhone il pannello si appoggia sopra la tastiera (`visualViewport`, posizione senza animazione) e il campo in focus va in vista; (2) **bug preesistente**: l'evento `close` del dialog nativo arriva in ritardo e chiudeva un pannello riaperto subito dopo (es. "Duplica" e poi il menu della copia; rendeva instabile `train.spec.ts` anche su M6). Ora l'evento si ignora se il dialog è di nuovo aperto, e una riapertura durante l'uscita riparte dal dialog ancora aperto;
  - `InfoSheet`, `ConfirmSheet`, `ActionBar` accettano `tone` (predefinito allenamento); `Card` accetta il tono neutro;
  - nuovo token `--data-alt` (`#8a7fa8`, dal mockup) per la parte FM della barra: mai testo.
- **Scostamenti dal mockup**:
  - nessuna frase di interpretazione (PESO senza "quasi tutta acqua"); nessuna riga "media kcal/giorno";
  - legenda con anche il grigio "neutra"; variazioni con freccia anche nelle circonferenze;
  - barre delle circonferenze in scala sulla circonferenza più grande della misura (non su 110 cm);
  - etichette "calc." e "STIMATO" sui valori non misurati;
  - "PROSSIMA BIOIMPEDENZA · ~6 NOV" solo con una data inserita; lettura e condizioni partono vuote con un invito a scriverle;
  - "Grafici" dichiarato "in arrivo" (foglio che rimanda a Progressi, M9); da M9 apre `#/progressi?tab=corpo`;
  - sotto il confronto: storico misure e sezioni di servizio, che il mockup non prevedeva.
- **Test**:
  - **fixture finte** `tests/fixtures/profile/backup-profile.json` (profilo, 3 misure di cui l'ultima solo con vita e addome, impostazioni);
  - **Vitest** `tests/unit/profile/` (formule con numeri noti: BMI 24,7, BCM% 50 %, BCMI 9,3; FM/FFM mancanti; origine; coerenza e impossibilità; numeri; età e caso limite; confronto con parametri mancanti; tabella delle direzioni, soglie e dati del mockup; date a confronto; moduli), più stima con livello e avvisi in `diet/calc.test.ts`, migrazione v4 in `data/db.test.ts`, misure e prossima bioimpedenza in `data/repo.test.ts`, autore in `workouts/editor.test.ts`, contrasto delle variazioni, versione;
  - **Playwright** `tests/e2e/profile.spec.ts` (390×844): profilo con errore e correzione, due misure con virgola e punto, confronto e colori, date cambiate più volte senza doppioni, modifica ed eliminazione con conferma, lettura come testo (`<b>`, `<img>` non interpretati), condizioni con data tolta, esporta → svuota → reimporta, file non valido, offline (anche una nuova misura), stima nel completamento guidato, 44 px e niente scroll orizzontale a 390 e 375 px, "Riduci movimento". Aggiornati `dev-data.spec.ts`, `home.spec.ts` (fixture importate dal Profilo) e `diet.spec.ts`.
- **Da verificare su iPhone dopo il deploy**: app installata → Profilo → modifica del profilo e "+ Nuova misura" con la tastiera decimale (virgola, campo visibile, Salva non coperto); foglio "Lettura del nutrizionista" con la tastiera aperta; Esporta backup verso File e Importa dallo stesso file; in Safari l'avviso di installazione nel Profilo; modalità aereo.

### Note M8 · Condivisione link/QR/file e versioni
- **Codice**:
  - **logica pura** in `src/lib/share/`: `limits` (soglie), `canonical` (lista bianca, JSON canonico, forma compatta, impronta), `lz-decompress` (decompressore di lz-string con tetto, MIT), `codec` (link e decodifica difensiva), `availability`, `file-name`, `prepare` (pannello pronto prima del tocco), `web-share` (link e appunti); `import/` (`entry` riconosce link/codice/JSON ed è leggero, `pending.svelte` + `boot` intercettano `#import=` prima del router, `detect` riconosce il tipo, `workout` matrice delle versioni e conversione file → scheda, `diet` stessa logica per i piani); `qr/` (`encode` con uqr, `decode` con jsQR, `camera` messaggi e spegnimento);
  - **schermate e componenti**: rotta `#/importa` (`src/routes/Import.svelte`) e `src/routes/share/` (`ImportScreen`, `WorkoutImportPreview`, `DietImportPreview` ex `ImportSheet` di M3, `VersionNotice`, `SafariNotice`, `QrScanner`, `QrCode`, `ShareSheet`);
  - **riusati senza copie**: `readJsonFile` (ora con `parseJsonText` condiviso), `checkEnvelope`/`parseWorkoutFile`, `parseDietImport` e `previewDietImport`/`findConflict` (M3), `planToDietFile`, `saveImportedPlan`/`activateDietPlan`, `deliverFile`/`downloadFile` (M2), `WorkoutPreview`, `copyName`, `isOwnWorkout`, `normalize` della libreria (M4), `isStandalone` (M0), `fnv1a` (M6), `BottomSheet`, `NoteBox`, `Button`, `ActionBar`. "Invia al PT" (M5) è invariato; `safeSlug` ora fa i nomi dei file di dieta, sessione e scheda.
- **Dipendenze** (tutte nel precache, quindi offline): `lz-string` 1.5.0 (MIT, solo compressione; chunk condiviso ≈ 7,5 KB), `uqr` 0.1.3 (MIT, chunk ≈ 10 KB caricato con "Mostra il QR"), `jsqr` 1.4.0 (Apache-2.0, chunk ≈ 130 KB / 48 KB gzip, caricato solo con "Scansiona QR"). Precache da ≈ 995 KiB a ≈ 1.140 KiB; il bundle d'avvio non cambia (contiene solo il riconoscimento di `#import=`).
- **Schema** (DB v5, indici invariati): `workouts.received { version, hash, at } | null` (scheda ricevuta: versione e impronta `fnv1a` del contenuto condivisibile all'import) e `workouts.previousVersions` (ultime 3 versioni sostituite, senza annidamento). L'`upgrade` mette `null` e `[]` (testato v4 → v5); backup v1 validi; formato di backup invariato. File § 8.1: `source` facoltativo (predefinito `pt`). `prepareSave` porta avanti `received` e cronologia; copia e "Duplica" li azzerano.
- **Regole decise**:
  - **soglie**: link ≤ 4.000, QR ≤ 1.500 caratteri (EC L), payload ≤ 6.000 prima di decomprimere, testo ≤ 1 MB dopo;
  - **modifiche locali**: resta la regola M4 (modificare una scheda di un altro crea la mia copia, l'originale resta aggiornabile); "modificata qui" = ricevuta e versione o impronta diverse da quelle dell'import, possibile solo se l'autore sono io. In quel caso si confronta con la versione ricevuta (la mia v4 locale non "nasconde" la v4 del PT) e la scelta proposta è la copia;
  - **cronologia**: N = 3, nella riga della scheda; "Ripristina versione precedente" rimette la versione scelta e sposta l'attuale nella cronologia (reversibile);
  - **etichetta**: "NOME · vN" (giallo da PT, grigio da amico), "RICEVUTA · vN" senza autore; "TUA" / "PT · vN" per le mie;
  - **autore nel file**: per una mia scheda personale il nome del Profilo; per una ricevuta quello originale (mai inventato);
  - **Safari**: con `#import=` fuori dallo standalone si mostra l'anteprima senza salvare (Copia link / Copia codice). Incollare o scegliere un file dentro Safari resta possibile, come ogni altro inserimento di dati (avviso di installazione M0);
  - **QR letti**: un QR che non è di Healthy non chiude la scansione ("Questo QR non è un link di Healthy…").
- **Correzione di M3**: "Sostituisci" su un piano con lo stesso `id` sovrascriveva la versione precedente; ora la copia nell'archivio (nuovo id, stesso titolo, la sua versione), così "Ripristina" funziona come promesso.
- **Collegamenti**: tolti i segnaposto "in arrivo" di Importa e Condividi (Allena), "Salva e invia" (Editor: salva, incrementa la versione e apre il pannello; "Nessuna modifica: resta alla vN" apre comunque il pannello sulla versione attuale) e Condividi della Dieta. L'Importa della Dieta (pannello e stato vuoto) porta a `#/importa`; "Esporta" resta il download/condivisione diretta del file (M3). Allena ha "Condividi" e "Ripristina versione precedente" anche nel menu della scheda.
- **Scostamenti dal mockup** (nessun mockup per Importa e Condividi): schermata Importa a tutto schermo come l'Editor, titolo ciano (navigazione) e anteprima nel colore del contenuto; pannello Condividi come bottom sheet con tre riquadri (Link, QR, File); QR mostrato con "Mostra il QR"; due azioni di pari peso (Salva come copia / Sostituisci) con colonne uguali in `ActionBar` (nuova opzione `even`); token `--qr-dark`/`--qr-light`.
- **Test**:
  - **fixture finte** `tests/fixtures/share/workout-typical.json` (scheda tipica del PT);
  - **Vitest** `tests/unit/share/` (decompressore contro lz-string su testi vari, "bomba" fermata dal tetto, round-trip scheda e dieta anche compatti, soglie misurate, rifiuti con messaggi, lista bianca con campi in più anche annidati, nomi dei file, impronta, matrice delle versioni compresa la collisione v4/v4, salvataggio con cronologia e sessioni intatte, ripristino, `prepareSave`, intercettazione di `#import=` con un `window` finto, QR generato e riletto anche alla soglia, fotocamera) + migrazione v5 e archivio della dieta sostituita;
  - **Playwright** `tests/e2e/share.spec.ts` (due contesti = due iPhone): il PT crea e condivide (link e file), il link aperto in Safari mostra solo l'anteprima, nell'app si importa ("MARCO · v1"), la ricarica non reimporta, `hashchange` con l'app aperta, v2 → Sostituisci, cronologia e Ripristina; v2 → Salva come copia, import da file, doppione, backup rifiutato, link tagliato, tutto **offline**; dieta solo file con avviso; QR mostrato dal PT e letto con una fotocamera simulata (canvas con lo screenshot del QR) e fotocamera spenta dopo; permesso negato; 44 px, niente scroll orizzontale, "Riduci movimento". Aggiornati `train`, `session`, `diet`, `home`, `profile` (pannello Condividi dopo "Salva e invia", import dalla schermata unica).
- **Guida**: `docs/condivisione.md` ("Come mandare una scheda a un amico").
- **Da verificare su iPhone dopo il deploy**: QR della scheda tipica letto da un altro iPhone con l'app (anche con luminosità bassa: se fatica, abbassare `QR_MAX_CHARS`); link mandato con Messaggi e con WhatsApp (non deve spezzarsi) e toccato con l'app installata (deve aprirsi Safari con l'avviso, poi Copia link → app → Importa → Incolla); permesso della fotocamera negato e poi concesso; fotocamera spenta (spia verde) dopo la lettura e passando in background; "Condividi file" verso AirDrop/File e import dallo stesso file; modalità aereo.

### Note M9 · Progressi
- **Codice**:
  - **logica pura** in `src/lib/progress/`: `period` (periodi su date locali, settimane L–D, mesi di calendario), `scale` (scala "bella" e scala delle barre divergenti), `series` (punti, variazione, pallini delle serie lunghe, asse sul tempo), `body` (serie del Corpo, variazione colorata, prossima misura, righe delle tabelle), `strength` (indice per esercizio, scelte, vista Carico/Volume, settimane, record recenti), `diet` (giorni del piano, aderenza, calendario, scarto, macro medi, osservazione), `format` (testi italiani, riassunti per lo screen reader); `state.svelte.ts` è lo stato in memoria della vista (unico file con Svelte);
  - **grafici** in `src/lib/charts/` (SVG fatto a mano, nessuna libreria): `ChartFrame` (tocco, trascinamento, tastiera, `aria-live`), `LineChart`, `MiniLine`, `BarChart`, `DivergingBars`, `Heatmap`, `ChartTable` (vista Tabella), `ViewToggle` (Grafico/Tabella, Carico/Volume), `Legend`; geometria pura in `geometry.ts`, trascinamento in `scrub.ts`;
  - **schermata** `src/routes/Progress.svelte` (`#/progressi`, `?tab=corpo` dal Profilo) e componenti in `src/routes/progress/` (`ProgressScreen`, `BodyTab`, `StrengthTab`, `DietTab`, `BodyTables`, `Delta`); sezione "Grafici" nella pagina di prova `#/showcase`;
  - **riusati senza copie**: `deriveMetrics`, `METRICS`, `CIRCUMFERENCES`, `roundFor`, `deltaTone`, `deltaText`, `deltaSpoken`, `metricText`, `dayMonth`, `daysBetween`, `getNextMeasurement` (M7); `bestSet`, `volume`, `sessionItems`, `exerciseKey`, `sessionDate`, regola dei record (M5); `buildDayView` con `keepEaten`, `effectiveWeekday`, `deviations`, `DEVIATION_THRESHOLD_PCT`, `OBSERVATION_DISCLAIMER` (M3); `logFor` (M6); `addDays`, `weekStartOf`, `fromIsoDate`, `toIsoDate`, `shortDate`, `MONTHS`, `formatInt`, `formatDecimal`; `Tabs`, `Card`, `ProgressRing`, `NoteBox`, `Button`, `Screen`, `liveState`, `nowClock`, transizioni `rise`/`fade`.
- **Refactor minimi** (testati, comportamento invariato): `sessions/records.ts` esporta `recordTimeline` (record di tutto lo storico in un passaggio, con il valore precedente) e `sessionItemKeys`, costruiti con gli stessi pezzi di `sessionRecords` (test: stesse serie sessione per sessione, conteggi dello Storico invariati); `diet/calc/observations.ts` esporta `DEVIATION_FIELDS` e `signed`; `today/home.ts` esporta `logFor`.
- **Dati**: nessuna tabella e nessuna chiave nuove, nessuna nuova versione del database, formato di backup invariato. Progressi non scrive mai. Versione `0.9.0`.
- **Regole decise** (confermate prima dello sviluppo):
  - **periodi**: "4 sett" = le 4 settimane L–D compresa quella in corso; "3 mesi" = dal lunedì della settimana di "oggi − 3 mesi di calendario"; "Tutto" = dal lunedì della settimana del primo dato. Mai prima della settimana del primo dato della tab (misure per Corpo, sessioni per Forza). Conti sulle date, mai sui millisecondi (testato col fuso `Europe/Rome` attorno al 25/10 e al 29/03, e a cavallo dell'anno). La tab Dieta non ha il periodo;
  - **riga in alto**: prima data tra misure, sessioni concluse e diario; N = max(1, ⌊giorni / 7⌋) settimane; senza dati "NESSUN DATO ANCORA";
  - **obiettivo settimanale** = somma dei giorni assegnati nelle schede attuali (due schede il lunedì = 2), linea costante "obiettivo N", assente se nessuna scheda ha giorni. Le schede non conservano la storia dei giorni;
  - **prossima misura** = `settings.nextMeasurement.date` del Profilo, solo se è dopo l'ultima misura del grafico e non è passata;
  - **serie lunghe**: nessuna aggregazione; oltre 120 punti i pallini restano solo su selezionato, minimo e massimo (i PR restano rombi); si sceglie trascinando, la Tabella resta completa. Testato con 600+ sessioni e 730 pesi giornalieri;
  - **scelte della vista** (tab, periodo, esercizio, Carico/Volume, Grafico/Tabella) in memoria finché l'app è aperta; `?tab=corpo` dal pulsante "Grafici" del Profilo sceglie la tab all'apertura;
  - **Corpo**: valori misurati o calcolati dalla stessa misura (M7); un valore mancante salta il punto; variazione = ultimo − primo del periodo arrotondati come a video, colorata con `deltaTone`; nella Tabella "calc." sui valori calcolati;
  - **Forza**: identità dell'esercizio come i record M5 (id della libreria o nome); per sessione la serie migliore tra quelle fatte (kg più alti, a parità più ripetizioni) e il volume Σ kg × rip delle serie fatte; un esercizio ripetuto nella stessa sessione dà un punto solo. Nei chip solo esercizi con almeno 2 sessioni con una serie fatta con carico, ordinati per numero di sessioni, poi i più recenti, poi l'ordine nella scheda. Rombo PR = sessione con un record di quell'esercizio (regola M5), con il più pesante nel tooltip. Variazione del carico ciano se sale, altrimenti grigia (mai gialla: non è una valutazione);
  - **Dieta**: primo giorno = il più tardo tra `validFrom` e il giorno di importazione del piano attivo (se mancano entrambi, la prima spunta). Ogni giorno usa il piano del suo diario (`dietLog.planId`, se esiste ancora) con lo scambio del giorno; senza riga il piano attivo e 0 pasti segnati. Pasti previsti = non vuoti (`isEmptyMeal`), "Pasto libero" senza alimenti compreso. Oggi è "in corso": nel calendario con contorno tratteggiato, fuori dalle medie. Pasto più saltato: a parità vince il primo nell'ordine dei pasti;
  - **scarto e macro medi**: solo giorni conclusi con almeno un pasto segnato, alimenti segnati tutti con valori e un target (anche calcolato); gli esclusi sono contati e detti. "Oltre soglia" da **5 % compreso**, come le osservazioni M3. L'osservazione usa `deviations()` sui medi e dice sempre "L'app non modifica il piano: segnala soltanto.".
- **Accessibilità e gesti**: ogni grafico è un gruppo con `aria-roledescription="grafico"` e il riassunto ("Peso: da 87,5 a 88,8 kg dal 17/07 al 09/10"), si usa con frecce/Home/Fine e annuncia il punto con `aria-live="polite"`; tutta l'area del grafico è toccabile (tocco e trascinamento con Pointer Events, `touch-action: pan-y`); tooltip misurato e tenuto dentro il grafico; i piccoli grafici sono immagini con etichetta; calendario e tabelle sono `<table>` vere; contrasto ≥ 4,5:1 testato anche per viola, livelli del calendario e tooltip.
- **Animazioni**: entrata dei grafici con `rise` (opacity + transform), pallino selezionato con scala a molla (transform), riempimento dei macro con `translateX`, anello con `stroke-dashoffset` (eccezione già esistente). Anti-doppioni: contenuto delle tab in `{#key}` con sola transizione d'entrata (dal componente `Tabs`), grafici che non si ricreano cambiando periodo o esercizio, elementi con chiavi stabili (date, id delle sessioni). Testato cambiando periodo, tab ed esercizio più di dieci volte di fila, anche con "Riduci movimento".
- **Prestazioni**: gli indici pesanti (serie del Corpo, indice della Forza con i record, giorni della dieta) si ricalcolano solo quando cambiano i dati letti con `liveQuery`; periodo, tab ed esercizio filtrano risultati pronti. Chunk della schermata ≈ 42 KB (nel precache).
- **Scostamenti dal mockup**:
  - variazione del peso colorata per obiettivo (il mockup la teneva grigia); vista Tabella su ogni card;
  - interruttore Grafico/Tabella sulla riga del sottotitolo nelle card con titolo lungo (Allenamenti a settimana, Pasti segnati, Scarto dal target) e accanto al valore nella card dell'esercizio;
  - asse orizzontale sul tempo; i piccoli grafici non sono interattivi (i valori esatti sono nella Tabella);
  - legenda delle variazioni (▲▼ ciano/giallo, ■ neutra) sotto le circonferenze, come nel mockup;
  - riga "dal 1 ottobre · oggi escluso" con la data vera del piano; scarto "dal target del giorno" (non sempre "del nutrizionista": il target può essere inserito o calcolato);
  - selettore del periodo nascosto nella tab Dieta (che parte sempre dal piano attivo).
- **Test**:
  - **fixture finte** `tests/fixtures/progress/backup-progress.json`, generata da `make-backup.mjs` (deterministico): 3 mesi fino a lun 12/10/2026 con misure irregolari (una senza peso, settimana senza misure, 3 bioimpedenze), 36 sessioni di 2 schede (settimana di vacanza a zero, sessione parziale, esercizio fatto una volta, plank a 0 kg, record noti), piano attivo e archiviato, diario con scambio, giorno senza riga e un giorno del piano precedente;
  - **Vitest** `tests/unit/progress/` (periodi e cambio d'ora, scala, serie, testi, Corpo, Forza con `recordTimeline` contro `sessionRecords`, Dieta con `buildDayView` come riferimento, fixture, prestazioni), `tests/unit/share/no-progress.test.ts` (nessun dato di Progressi in scheda, dieta, link decodificati, QR, "Invia al PT", lista della spesa; nessun modulo di condivisione importa, nemmeno indirettamente, `progress/` o `charts/`; tabelle del database invariate), contrasto, rotte;
  - **Playwright** `tests/e2e/progress.spec.ts` (390×844, orologio simulato, backup importato dal Profilo): andamenti delle tre tab, periodo/tab/esercizio cambiati più volte senza doppioni, tocco + trascinamento + tastiera con tooltip dentro il grafico, vista Tabella di ogni card, "Grafici" del Profilo e scelte ricordate, stati vuoti senza NaN né "SYNC OFFLINE", una misura sola, tutto offline, 44 px e niente scroll orizzontale a 390 e 375 px, "Riduci movimento".
- **Da verificare su iPhone dopo il deploy**: app installata → Progressi con dati veri: trascinare sul peso col pollice mentre si scorre la pagina (lo scroll verticale non deve bloccarsi), tooltip leggibile, chip degli esercizi che scorrono di lato, "Grafici" dal Profilo, modalità aereo, "Riduci movimento" da Impostazioni › Accessibilità.

### Note · Modello del piano per Claude (dopo V1)
- **Scopo**: chi non ha un piano in JSON scarica il modello vuoto, lo fa compilare in una chat di Claude insieme alla propria dieta (PDF, foto, testo) e importa il risultato con il flusso esistente; i dati mancanti finiscono nel completamento guidato (M3). L'app non manda niente a nessuno.
- **Codice**: `src/lib/diet/template/` (`healthy-dieta-modello.json` + `template.ts`: copia del modello, file, messaggio per Claude, riconoscimento del modello vuoto), `src/lib/diet/import/tolerant.ts` (normalizzazione prima di zod, chiamata da `parseDietImport`), `src/lib/data/json-text.ts` (contorno del JSON e diagnosi degli errori di sintassi, usati da `readJsonFile` con `unwrap` e dal testo incollato in `entry.ts`); foglio `src/routes/diet/ClaudeGuideSheet.svelte` (Dieta, pannello del piano, Importa).
- **Riusati**: `deliverFile`, `copyText`, `BottomSheet`, `Button`, `NoteBox`, `parseDietImport` → `previewDietImport` → `saveImportedPlan`, `planCompleteness` (il dettaglio dei giorni senza tipo ora li nomina: "Martedì: manca il tipo di giornata"), `setDayType`.
- **Modello allineato allo schema** (fonte di verità: zod): `targets: null` e `per100: null` invece di oggetti con tutti i valori `null`; `type: null` invece di `""` (se la dieta non lo dice, si sceglie nell'app); orari sempre a 2 cifre; chiavi dei prodotti `a-z 0-9 _ -` (massimo 40); nuovi `_generato` ed `_esempio.dayType`.
- **Schema**: `generalNotes` nel piano (§ 8.2), DB **v6** (mette `""` ai piani salvati; indici invariati); messaggi nuovi per il giorno fuori 1–7 e per i numeri scritti come testo con la virgola. Backup e formato dei file invariati (campo facoltativo).
- **Decisioni confermate**: `generalNotes` nello schema; tipo di giornata vuoto = mancante (completamento guidato), non "Riposo"; meno di 7 giorni = avviso, non errore (i piani MyDiet con giorni mancanti restano ricondivisibili); valori compilati a metà = errore. Tipi di giornata inutilizzati: tolti solo se senza target (con i target del nutrizionista restano, altrimenti assegnando il tipo nel completamento quei target andrebbero persi).
- **Test**: fixture finta `tests/fixtures/diet-claude-filled.json` (come compilata da Claude: `id` vuoto, `_modello` rimasto, martedì senza tipo, riposo senza target, corsa vuota, alimenti senza valori, alternativa nella `note`, `generalNotes`); **Vitest** `tests/unit/diet/template.test.ts` (modello valido, vuoto e con le stesse chiavi degli schemi; modello compilato con dati finti; modello vuoto rifiutato; `_…` ignorati; id/versione/titolo; mancanti nel completamento; ogni errore tipico; blocco ```` ```json ````; import completo con salvataggio, esportazione e link) e `tests/unit/data/json-text.test.ts`, migrazione v6 in `db.test.ts`; **Playwright** `tests/e2e/claude-template.spec.ts` (Dieta vuota → guida → download del modello → Copia → import della fixture → completamento guidato, anche offline; modello vuoto → "Apri la guida"; risposta della chat incollata; decimale con la virgola; pannello del piano, 44 px, niente scroll orizzontale).
- **Da verificare su iPhone dopo il deploy**: "Scarica il modello" apre il foglio di condivisione (Salva su File), allegare il modello in una chat di Claude dall'app Claude o da Safari, scaricare il JSON restituito e importarlo da Importa › Scegli file; "Copia" e incolla nella chat; modalità aereo.

### Note · Rifinitura iPhone 1
- **Scopo**: correzioni e usabilità dopo l'uso vero sul telefono. Nessun cambio al modello dati, nessuna dipendenza nuova, MyDiet non toccata.
- **Barra di navigazione**: `src/lib/design/viewport.svelte.ts` (avviato in `main.ts`) scrive `--app-h` e riporta a 0 lo scroll del documento quando la pagina non dovrebbe scorrere (le pagine lunghe di prova non vengono toccate); stato unico della tastiera (`keyboardState()` ne è un alias). `Screen.svelte` fissa la barra in fondo (`position: fixed`, contenitore `nav-dock`) e la nasconde con la tastiera aperta; tutte le schermate a tutto schermo usano `var(--app-h)` invece di `100dvh`. Token nuovi: `--app-h`, `--nav-h`.
- **Zoom**: `:where(*) { touch-action: manipulation }` e campi a 16 px in `app.css`; unico campo sotto i 16 px trovato: il testo della lista della spesa (sola lettura). Dopo questi interventi resta solo il pizzico volontario (se si pizzica, nell'app installata si torna a 1× pizzicando indietro).
- **Fieldset**: reset globale (`legend` che galleggia dentro il riquadro, mai fieldset flex/grid se ha sfondo o bordo). Nuova misura: fieldset a blocco con `.group-body`, titolo come i titoli delle card. Gli altri fieldset (Profilo, Impostazioni, esercizio personale, readiness) non hanno riquadro: nessun difetto visibile.
- **Stepper** (`src/lib/components/Stepper.svelte`, logica in `stepper.ts`, pressione lunga in `press-repeat.ts`): il numero è un `input` `role="spinbutton"` (aria-valuenow/min/max, 16 px o più) coperto dal numero animato finché non lo si tocca; Invio, Fine o tocco fuori confermano, Esc annulla, frecce su/giù = passo. Valore libero dal passo, decimali fino a 2, interi per serie/ripetizioni/minuti; fuori limite → avviso giallo e ritorno all'ultimo valido; sopra la soglia → "280 kg?" con Conferma/Annulla (soglie in `workouts/calc/values.ts`: kg > 250, ripetizioni > 50, cardio > 120 minuti). Pressione lunga: attesa 400 ms, poi da 180 a 40 ms; si ferma al rilascio, se il dito esce dal pulsante, se la pagina scorre o al limite. Variante `layout="inline"` al posto di `MiniStepper` (serie diverse dell'Editor, eliminato). `kgStep` prosegue dal valore scritto (22 → 24,5).
- **Swipe**: modulo unico `src/lib/design/swipe.ts` (logica) + `swipe-action.ts` (`trackSwipe`, azione `use:swipe`); `edge-swipe.ts` usa lo stesso tracciamento; eliminati `day-swipe.ts` e `diet/swipe.ts`. Grafici e chip degli esercizi di Forza hanno `data-swipe-ignore`.
- **Aggiornamenti**: `src/lib/pwa/update-guard.ts` decide quando il banner può comparire; il banner sta sopra la barra di navigazione.
- **Decisioni confermate**: in Dieta › Piano vince il giorno; kg scritti fuori passo proseguono col passo; link "Strumenti tecnici" nel Profilo; swipe riga scheda e indietro dal bordo ovunque; niente swipe sulle voci della Spesa. In Schede lo swipe ← su una riga apre le sue azioni: per passare a Storico col dito si trascina fuori dalle righe o sulla barra delle tab.
- **Test**: **Vitest** `tests/unit/stepper.test.ts` (parsing con virgola, limiti, conferma, interi, passo dopo valore libero, ripetizione accelerata con orologio simulato), `tests/unit/swipe.test.ts` (asse, direzioni, bordi, soglie, zone annidate, azioni della riga, indicatore frazionario), `tests/unit/viewport.test.ts`, `tests/unit/update-guard.test.ts`; **Playwright** `tests/e2e/iphone.spec.ts` (Stepper scritto a mano e pressione lunga, swipe nella sessione live, swipe tra tab e Piano, riga scheda, titoli dentro i riquadri, barra in fondo e nascosta con la tastiera simulata, nessun campo sotto i 16 px su tutte le pagine principali).
- **Da verificare su iPhone dopo il deploy** (barra di navigazione, a mano): 1) Oggi, blocca il telefono 10 s e sblocca: barra al fondo, nessuna fascia vuota; 2) app in background per un minuto e riaperta, su Oggi, Allena e Dieta; 3) Profilo › dati del profilo, scrivi e tocca "Fine": la barra sparisce con la tastiera e ricompare al fondo; 4) Importa › campo del link, chiudi la tastiera trascinandola giù o toccando fuori; 5) ruota e torna in verticale; 6) dopo ogni prova in Strumenti tecnici: innerHeight = altezza dello schermo, scrollY 0, `--app-h` = innerHeight, display-mode standalone. Poi: swipe tra esercizi con il pollice (anche mentre si scorre), doppio tocco rapido su +, tocco su un campo (niente zoom).
