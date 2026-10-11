# Healthy App – Specifica

Versione 1.0 · 11 ottobre 2026 · stato: progettazione completata, sviluppo da iniziare

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
Lo stato connessione (**SYNC OFFLINE ✓ / ONLINE ✓**) compare **solo nella Home**.

## 4. Animazioni e gesti

Ogni elemento toccabile ha un'animazione. Solo `transform`/`opacity`, 60–120 fps, `prefers-reduced-motion` rispettato.

| Elemento | Comportamento |
|---|---|
| Pulsanti | Pressione: scala 0.92–0.96 con ritorno "a molla" (`cubic-bezier(.2,.9,.3,1.4)`). |
| Spunte | Riempimento + piccolo "pop". |
| Selettori a schede (Schede/Storico, Piano/Spesa/Ricette) | Evidenziatore che scorre sotto l'etichetta. |
| Pannelli dal basso (bottom sheet) | Entrata dal basso, sfondo che si scurisce, chiusura toccando fuori o trascinando giù. |
| Fisarmoniche | Apertura con discesa + freccia che ruota. |
| Swipe giorno (Home, Dieta) | Il contenuto segue il dito; al rilascio si assesta a molla su ieri/oggi/domani. |
| Swipe indietro | Dal bordo sinistro torna alla schermata precedente (in standalone iOS non c'è quello di Safari). |
| Transizioni tra schermate | View Transitions API dove disponibile, altrimenti dissolvenza + scorrimento. |
| Cerchi e barre | Riempimento animato al cambio di valore. |

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
- Titolo + pulsante col nome del **piano attivo** (es. "Ottobre 2026") → pannello: stato completezza (target, macro per alimento, ricette, integratori), **Importa** (JSON), **Esporta**, **Modifica**, **Condividi** (link, QR, file), archivio piani precedenti con "Ripristina".
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

### 5.7 Progressi
**Da progettare** (grafici nel tempo di peso, composizione, circonferenze, forza per esercizio, aderenza alla dieta).

## 6. Logica

### 6.1 Target nutrizionali (priorità)
1. **Target del nutrizionista** presenti nel piano (per tipo di giornata) → usati così come sono, mai modificati.
2. **Calcolati dal piano**: somma degli alimenti (valori per 100 g o per pezzo).
3. **Stimati**: BMR con Mifflin-St Jeor × fattore attività, solo se mancano 1 e 2.

Ogni numero mostra la sua origine (nutrizionista / calcolato / stimato).
**Completamento guidato** dopo l'import: checklist dei dati mancanti (alimenti senza valori, target assenti), compilabili a mano o accettando la stima.
Limiti di sicurezza (solo per target stimati): calorie minime, deficit massimo, avviso per obiettivi irrealistici.

### 6.2 Osservazioni e consigli
- Su un piano del nutrizionista: **solo osservazioni**, mai modifiche (es. scarto > 5% tra piano e target, giorni senza verdura).
- Su piani propri o stimati: suggerimenti (proteine per kg, distribuzione nei pasti, idratazione).

### 6.3 Profilo
- BMI = peso / altezza²; BCMI = BCM / altezza².
- FM%, FFM%, BCM% calcolati sul peso se non forniti. **Da confermare** se BCM% va riferito alla massa magra.

### 6.4 Allenamento
- Volume = Σ kg × ripetizioni delle serie fatte.
- **PR**: carico più alto a parità o superiore di ripetizioni rispetto allo storico dell'esercizio (in alternativa 1RM stimato con Epley; da decidere in sviluppo).
- "Ultima volta" = serie corrispondenti dell'ultima sessione con la stessa scheda.
- Recupero predefinito per esercizio, avvio automatico alla spunta.

## 7. Modello dati (IndexedDB, Dexie)

| Tabella | Campi principali |
|---|---|
| `profile` | id, name, birthYear, sex, heightCm, goal |
| `measurements` | id, date, weightKg, fmKg, fmPct, ffmKg, bcmKg, tbwL, ecwL, phaDeg, bmrKcal, chestCm, waistCm, abdomenCm, hipsCm, thighCm, armCm, calfCm, notes |
| `exercises` | id, name, muscles[], equipment, videoUrl, custom |
| `workouts` (schede) | id (uuid), version, author, source ('pt' \| 'own'), name, weekdays[], intro, warmup[], items[{exerciseId, name, sets, reps, kg, restSec, note, videoUrl, setsDetail?}], cardio, updatedAt |
| `sessions` | id, workoutId, workoutVersion, startedAt, endedAt, readiness{sleep,mood,energy,stress,soreness}, sets[{exerciseId, setIndex, kg, reps, done}], userNotes{exerciseId: text}, rpe, cardioDone |
| `dietPlans` | id, version, title, author, validFrom, active, archived, importedAt, origin (`file` \| `mydiet`), payload (formato § 8.2) |
| `dietLog` | date, planId, mealKey, eaten, swappedFromWeekday |
| `shopping` | weekStart, checked{productKey: bool} |
| `settings` | key, value (es. ultimo backup) |

## 8. Formati di file

Tutti i file condivisi hanno `app`, `kind`, `schemaVersion`. Validazione con zod; in caso di errore messaggio chiaro, nessun salvataggio parziale.

### 8.1 Scheda
```json
{
  "app": "healthy-app", "kind": "workout", "schemaVersion": 1,
  "id": "uuid", "version": 4, "author": "Nome PT",
  "name": "Petto + Schiena", "weekdays": [1],
  "intro": "testo", "warmup": [{ "name": "...", "hint": "...", "dose": "2 × 15" }],
  "items": [{ "name": "Lat machine presa larga", "muscles": ["Dorsali","Bicipiti"],
              "sets": 4, "reps": 10, "kg": 57.5, "restSec": 90,
              "note": "testo PT", "videoUrl": "https://..." }],
  "cardio": { "type": "tapis roulant", "minutes": 12 }
}
```
Import di una scheda con lo stesso `id`: se `version` è maggiore chiedere **Sostituisci / Salva come copia**.

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

### 8.3 Compatibilità MyDiet (schemaVersion 1)
Importare anche il file di MyDiet (`"app": "dieta-e-spesa"`): `giorni[i]` → `days` (indice 0 = lunedì), `pasti.{colazione,spuntino1,pranzo,spuntino2,cena}` → `meals`, `abilita`/`fine` → `window`, `nota` → `note`, `prodotti` → `products` (`unita`, `spesa`, `cat`). Tollerare categorie non elencate (es. Integratori, Pasto libero) e pasti vuoti (`nome: ""`, `items: []`). Dopo l'import parte il completamento guidato (mancano valori nutrizionali e target).

### 8.4 Condivisione
- **Link**: `https://rojo-66.github.io/<repo>/#import=<payload>` con payload JSON compresso (lz-string, `compressToEncodedURIComponent`). Se troppo lungo → solo file.
- **QR** del link (generato offline).
- **File** `.json` tramite Web Share API (`navigator.share({ files })`), con download come alternativa.
- Sempre **anteprima** prima di salvare.

### 8.5 Backup
Esporta/importa tutto il database in un unico file JSON. Promemoria se l'ultimo backup ha più di 14 giorni.

## 9. Video degli esercizi
V1: **solo link**. Online si apre il video; offline riquadro con nome, muscoli e note. Il modello dati resta predisposto per un futuro download dei video della scheda (V3).

## 10. Vincoli iPhone (Safari / PWA)
- Storage separato tra Safari e app installata → avviso di installazione.
- Niente vibrazione, niente push affidabili, niente Apple Salute.
- Barcode (V2): libreria JS (ZXing), il rilevatore nativo non c'è.
- Wake Lock API per la sessione; audio da sbloccare con un gesto.
- Layout con `100dvh` e safe area.

## 11. Funzioni per versione
- **V1**: Home, Allena, Editor schede, flusso sessione completo, Riepilogo, Dieta (piano del nutrizionista, spesa, ricette, import MyDiet/JSON), Profilo e misurazioni, condivisione schede/diete, backup, offline.
- **V2**: Progressi con grafici, generatore schede a regole, completamento guidato avanzato, "note salvate" per il PT, sostituzioni alimenti, barcode, promemoria integratori e backup, diario alimentare completo (database alimenti).
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
| M9 | Progressi (dopo il suo design) | — |

## 13. Punti aperti
- Età e altezza (per BMI/BCMI).
- BCM%: sul peso o sulla massa magra?
- Readiness: confermare con il PT la scala "5 = meglio" per stress e affaticamento.
- Schermata Progressi da progettare.
- Nome definitivo dell'app (provvisorio: **Healthy**; repository `rojo-66/Healthy`, URL `https://rojo-66.github.io/Healthy/`).

## Stato
- [x] M0 · [x] M1 · [x] M2 · [x] M3 · [ ] M4 · [ ] M5 · [ ] M6 · [ ] M7 · [ ] M8 · [ ] M9

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
