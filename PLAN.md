# BriefFlow — Piano di implementazione

## Stato e obiettivo

Piano concordato il 1 novembre 2026. Nessuna implementazione avviata, nessun repository remoto creato e nessun deploy effettuato.

BriefFlow è una demo interattiva per LinkedIn che mostra come LangGraph orchestra un processo aziendale con Jev. Il caso d’uso è la qualificazione delle richieste di progetto ricevute da una società di consulenza IT o sviluppo software. Il grafo animato è il protagonista: deve rendere osservabili stato, decisioni, diramazioni e intervento umano.

L’utente possiede già una chiave API Jev. Non serve un modello generativo aggiuntivo: niente OpenAI, Anthropic o Gemini nell’MVP. Jev restituisce decisioni strutturate; domande e testi di output vengono da template predefiniti.

> **Aggiornamento 2 novembre 2026:** il replay con scenari dimostrativi è stato rimosso; l'app funziona solo in live. Non c'è più autenticazione proprietario: un interruttore `JEV_LIMIT_REACHED` mostra la pagina «Limite Jev raggiunto». Dove questo piano parla di replay, scenari demo o accesso riservato, vale quanto descritto in README.md.

## Esperienza e risultato

Input: testo incollato, brief o trascrizione già disponibile.

Esempio: «Ci serve un portale per assegnare interventi ai tecnici. Deve funzionare offline e integrarsi con il nostro gestionale. Vorremmo partire entro tre mesi.»

Output illustrativo, da verificare con Jev reale:

| Campo | Risultato |
| --- | --- |
| Categoria | Applicazione aziendale |
| Compatibilità | In linea con i servizi configurati |
| Informazioni mancanti | Budget, nome del gestionale, numero di utenti |
| Aspetti da approfondire | Operazioni offline e integrazione |
| Prossima azione | Richiedere chiarimenti |

Domande selezionate dal catalogo: «Qual è la fascia di budget?», «Quale gestionale utilizzate?», «Quanti tecnici useranno il portale?».

L’utente risponde, il processo riprende e aggiorna la scheda. Non generare blueprint, preventivi o riassunti liberi.

## Perimetro MVP

- Inserimento di testo e tre esempi precaricati.
- Profilo aziendale configurabile: servizi, categorie, criteri e informazioni obbligatorie.
- Processo LangGraph reale con Jev.
- Grafo animato, dettagli dei nodi, stato e cronologia degli eventi.
- Interruzione persistente per chiarimenti e ripresa dopo la risposta.
- Scheda finale strutturata ed esportazione JSON.
- Replay senza nuove chiamate API; velocità regolabile e avanzamento per eventi.
- Modalità presentazione per registrazioni di 60–90 secondi.
- Replay pubblico con dati dimostrativi; esecuzione live inizialmente riservata al proprietario.

Fuori dall’MVP: PDF/DOCX, trascrizione audio, CRM, invio email, editor arbitrario di grafi, preventivi, generazione di testi e sistema multi-tenant completo.

## Stack proposto

| Parte | Tecnologia |
| --- | --- |
| Frontend e API | Next.js, TypeScript, runtime Node.js |
| Orchestrazione | LangGraph.js |
| Decisioni | SDK ufficiale Jev, @typesafe-ai/sdk |
| Grafo UI | React Flow |
| Stili | Tailwind CSS |
| Persistenza | Postgres gestito, per esempio Neon |
| Repository e CI | GitHub e GitHub Actions |
| Deploy | Vercel |

Verificare versioni e API correnti all’inizio dell’implementazione e fissare le dipendenze nel lockfile. Non presumere l’esistenza di un adattatore Jev per LangChain: usare il client ufficiale nei nodi. LangChain non è necessario salvo una dipendenza effettiva di LangGraph.

## Processo

```text
START
  -> Valida input [Codice]
  -> Classifica richiesta [Jev]
  -> Valuta compatibilità [Jev]
       -> Fuori ambito / incerta: Revisione manuale [Persona]
            -> Chiudi come fuori ambito oppure prosegui
       -> Compatibile: Verifica completezza [Jev]
            -> Completa: Componi scheda [Codice] -> END
            -> Incompleta: Seleziona domande [Codice]
                 -> Attendi risposte [interrupt / Persona]
                 -> Aggiorna stato [Codice]
                 -> Verifica completezza
```

- Massimo due giri di chiarimento, poi scheda con punti ancora aperti.
- Usare interrupt() e Command per la ripresa, con thread_id stabile e checkpointer Postgres compatibile con la versione scelta.
- L’attesa umana termina la richiesta HTTP e salva lo stato. La ripresa avvia una nuova richiesta.
- Separare le chiamate Jev dal nodo di attesa: una ripresa non deve ripetere inutilmente operazioni precedenti o effetti collaterali.
- Una sola esecuzione/ripresa attiva per richiesta; proteggere dai doppi invii.

## Contratto Jev

Valutazioni piccole, tipizzate e verificabili:

- Categoria tra opzioni configurate.
- Compatibilità: in linea, fuori ambito, da verificare.
- Presenza delle informazioni richieste: budget, utenti, scadenza, integrazioni.
- Ambiguità rispetto a criteri espliciti.
- Presenza di vincoli predefiniti, per esempio lavoro offline.

Usare Choice, Score e Noul secondo la documentazione corrente. Le soglie devono essere configurabili e valutate su esempi; confidenza non significa certezza. Gestire anche risposte sconosciute o insufficienti.

Inviare a Jev il brief originale e le risposte raccolte. Non chiedere estrazione arbitraria di testo libero. I campi numerici o nominativi acquisiti dal questionario vengono conservati direttamente. Usare codice per verifiche deterministiche come soglie e campi obbligatori già strutturati.

Salvare criteri, versione del profilo e modello impiegati per rendere interpretabile ogni esecuzione. Mostrare consumi solo se disponibili dalla risposta; non inventare costi o ragionamenti interni.

## Frontend: elemento centrale del progetto

Desktop: pannello richiesta a sinistra, grafo ampio al centro, dettaglio nodo a destra e cronologia/replay in basso. Pannelli richiudibili. Su mobile usare viste o tab dedicate per richiesta, grafo e dettagli, senza comprimere tre colonne.

Stati dei nodi: in attesa, in esecuzione, completato, in attesa dell’utente, errore. Distinguere stato operativo del nodo ed esito aziendale: una richiesta fuori ambito non è un errore tecnico.

Animazioni guidate dagli eventi reali:

- Evidenza del nodo attivo e transizione al completamento.
- Collegamento percorso animato; rami non attraversati attenuati.
- Durata reale, input/output e differenze di stato nel pannello dettagli.
- Questionario al momento dell’interruzione.
- Errori e tentativi successivi comprensibili e localizzati.

Condividere identificativi e topologia tra definizione backend e rappresentazione UI; verificare che il grafo disegnato corrisponda a quello eseguito.

Live e replay devono essere espliciti. Il replay usa eventi salvati e non chiama Jev. Pausa e avanzamento del replay non sospendono una funzione backend. Non introdurre ritardi artificiali nelle chiamate per rendere l’animazione più lenta.

## Skill frontend richieste dall’utente

Leggere e applicare le skill installate prima di implementare le rispettive parti:

1. C:/Users/marzu/.codex/skills/design-taste-frontend/SKILL.md
   - Seguire il percorso per app screen, incluso references/app-screens.md.
   - Curare composizione, gerarchia, tipografia e identità del prodotto; il grafo deve dominare.
2. C:/Users/marzu/.codex/skills/impeccable/SKILL.md
   - Curare flussi, responsive, accessibilità, stati vuoti/caricamento/errore e revisione finale.
   - Preparare PRODUCT.md e DESIGN.md secondo il processo della skill, riutilizzando le decisioni già presenti in questo piano.
3. C:/Users/marzu/.codex/skills/emil-design-eng/SKILL.md
   - Curare movimento, feedback dei controlli, transizioni e fluidità.

Non sono ancora stati scelti palette, tema o font definitivi. La direzione deve servire una demo tecnica professionale, leggibile e comprensibile anche in video. Stati riconoscibili con testo e icone oltre al colore; navigazione da tastiera, focus visibile e rispetto di prefers-reduced-motion.

Verificare il risultato nel browser a dimensioni desktop e mobile, correggendo screenshot e interazioni. Non dichiarare verifiche mai eseguite. La modalità presentazione deve mantenere testi e collegamenti leggibili in una registrazione.

## Eventi, streaming e persistenza

Trasmettere gli aggiornamenti attraverso una risposta HTTP in streaming, per esempio SSE tramite fetch. Non usare un server WebSocket persistente su Vercel.

Adattare gli eventi del runtime LangGraph a un contratto UI stabile:

```text
node_started
node_completed
state_updated
route_selected
run_interrupted
run_completed
run_failed
```

Ogni evento include identificativo univoco, run_id, sequenza, timestamp, nodo quando applicabile e payload validato. Distinguere visite ripetute allo stesso nodo. Salvare gli eventi per ricostruzione e replay, con deduplicazione lato client.

Persistenza proposta: profili/versioni, esecuzioni, risposte, eventi ordinati, schede finali e tabelle del checkpointer. Lo stato di lavoro non può essere solo in memoria o sul filesystem della funzione.

Se lo streaming cade, rileggere lo stato persistito e proporre una ripresa quando necessaria. Non assumere che il backend continui dopo una disconnessione. Impostare timeout, retry limitati e durata massima compatibili con il piano Vercel scelto.

## Accesso e segreti

- TYPESAFE_API_KEY esclusivamente server-side, in .env.local locale e nelle variabili Vercel; mai NEXT_PUBLIC_*.
- DATABASE_URL server-side e credenziali del meccanismo di accesso scelto.
- .env.example con nomi e valori vuoti; escludere file segreti dal versionamento.
- Replay pubblici solo con contenuti dimostrativi esplicitamente selezionati.
- Proteggere esecuzione live, lettura dei dati privati e resume con controlli lato server; un ID non equivale ad autorizzazione.
- Limiti di input, budget di chiamate per esecuzione e controlli contro invii ripetuti.
- Non inserire brief o chiavi nei log pubblici.

## Fasi di lavoro

1. Fondamenta: Next.js, schema dati, profilo aziendale, client Jev; verificare una chiamata reale.
2. Processo: nodi e diramazioni, checkpointer, interruzione e ripresa; verificare sopravvivenza al refresh.
3. Frontend: design documentato, React Flow, streaming, dettagli, stati e cronologia.
4. Demo: tre scenari, scheda finale, export, replay e modalità presentazione.
5. Pubblicazione: test, README, repository GitHub, anteprima Vercel e produzione.

Scenari demo: brief completo; brief incompleto con chiarimenti e ripresa; richiesta fuori ambito. Usare dati sintetici dichiarati. I percorsi attesi devono essere verificati con il modello reale, senza forzare o falsificare risultati live.

## Verifiche e criteri di accettazione

- Test delle diramazioni e limite dei chiarimenti con client Jev simulato.
- Test integrazione di interrupt/resume con persistenza, inclusi doppio invio e refresh.
- Test del contratto eventi: ordine, deduplicazione, visite ripetute e replay senza chiamate API.
- Test end-to-end dei tre percorsi e di un errore Jev.
- Test di accesso: esecuzioni private e resume non accessibili senza autorizzazione.
- Smoke test reale Jev separato dalla CI e avviato esplicitamente.
- Typecheck, lint e build; verifica visiva desktop/mobile e movimento ridotto.
- Smoke test sul deploy Vercel per streaming, checkpoint, accesso e ripresa.

Completato quando la demo pubblica funziona, l’esecuzione live è protetta, il grafo corrisponde agli eventi reali e la ripresa conserva lo stato. Non limitarsi a un mockup animato.

## GitHub e Vercel

L’utente ha autorizzato la creazione e il push di un repository GitHub pubblico chiamato briefflow nel proprio account già autenticato. Durante l’implementazione verificare l’identità autenticata tramite gli strumenti GitHub disponibili e usare quell’account personale; non richiedere nuovamente proprietario, visibilità o permesso di pubblicare il codice previsto dal piano. Se l’autenticazione manca o l’account è ambiguo, chiedere solo il chiarimento necessario. Se esiste già un repository omonimo, ispezionarlo prima di procedere e non sovrascrivere contenuti estranei. Prima del push verificare che chiavi, file .env, dati privati e credenziali non siano inclusi nel codice né nella cronologia da pubblicare. La configurazione dell’account/progetto Vercel resta da verificare separatamente.

- Versionare codice, lockfile, migrazioni, esempi, test, documentazione e .env.example.
- GitHub Actions: typecheck, lint, test con Jev simulato e build, senza chiave Jev di produzione.
- Collegare repository a Vercel; anteprime per pull request e produzione dal branch main.
- Separare credenziali e database/schema di preview e produzione.
- Eseguire migrazioni come passo controllato, evitando scritture sul database di produzione dalle preview.
- Verificare limiti e costi correnti dei servizi prima del rilascio.

## Documentazione finale attesa

README con descrizione, architettura, avvio locale, variabili richieste, database, test, istruzioni GitHub/Vercel e spiegazione delle modalità live/replay. Includere un breve copione demo dei tre percorsi e limiti noti.

## Fonti tecniche da verificare durante l’implementazione

- https://docs.typesafe.ai/introduction/quickstart
- https://docs.langchain.com/oss/javascript/langgraph/overview
- https://docs.langchain.com/oss/javascript/langgraph/interrupts
- https://docs.langchain.com/oss/javascript/langgraph/streaming
- https://reactflow.dev/
- https://vercel.com/docs/functions/limitations
- https://vercel.com/docs/git/vercel-for-github

## Implementazione con più agenti e modelli

L’utente ha richiesto e autorizzato l’uso di più agenti per implementare BriefFlow, con modelli diversi quando l’ambiente lo permette. Questa scelta riguarda gli agenti di sviluppo, non il runtime dell’app: BriefFlow continua a usare LangGraph + Jev senza un modello generativo aggiuntivo.

### Ruoli

| Agente | Responsabilità | Modello assegnato |
| --- | --- | --- |
| Coordinatore | Architettura, contratti condivisi, assegnazioni, integrazione, documentazione e verifica finale | GPT-6.1 Terra (`gpt-6.1-terra`), selezionato nella chat di implementazione |
| Backend | LangGraph, client Jev, persistenza, streaming, interrupt/resume e relativi test | GPT-6.1 Terra (`gpt-6.1-terra`) |
| Frontend | Interfaccia, React Flow, animazioni, replay, responsive e applicazione delle skill frontend | GPT-6.1 Sol (`gpt-6.1-sol`) |
| Revisore | Revisione indipendente, test end-to-end, gestione errori, accessi e compatibilità Vercel | GPT-6 Astra (`gpt-6-astra`) |

Queste assegnazioni sono state approvate dall’utente. I tre identificativi erano disponibili negli strumenti di delega della chat di pianificazione; verificarne la disponibilità nella chat di implementazione. Usare i modelli indicati e sostituirli soltanto se non disponibili, dichiarando modello previsto, sostituto e motivo. Se l’ambiente non permette la scelta per sottoagente, mantenere i ruoli con i modelli disponibili e comunicare il limite. Non affermare di aver usato modelli distinti se non verificabile.

Il modello del coordinatore dipende da quello selezionato per la chat principale e non viene cambiato da una semplice istruzione nel piano. Per rispettare l’assegnazione, avviare la chat di implementazione con GPT-6.1 Terra, se disponibile. Per gli altri ruoli passare esplicitamente l’identificativo del modello allo strumento di creazione dei sottoagenti. Se lo strumento richiede `fork_turns: "none"` per impostare un modello diverso, usare questa modalità e fornire nel messaggio iniziale il percorso di questo piano, i contratti, i file assegnati, le skill applicabili e i criteri di accettazione.

### Sequenza di lavoro

1. Il coordinatore legge il piano, prepara la struttura iniziale e definisce i contratti: stato del processo, identificativi dei nodi, eventi, API, errori, accesso e schema della scheda finale.
2. Documenta i contratti condivisi, per esempio in docs/contracts.md, e crea tipi/schema riutilizzabili. Assegna a ogni agente file, responsabilità, dipendenze e criteri di accettazione.
3. Backend e frontend lavorano in parallelo su aree separate. Il frontend può usare fixture conformi ai contratti mentre il backend viene completato; le fixture devono essere dichiarate e il percorso live finale deve usare eventi reali.
4. Il coordinatore integra presto un flusso verticale completo: input, chiamata Jev, evento del nodo e aggiornamento del grafo. Integra poi interruzione, risposta e ripresa prima delle rifiniture.
5. Il revisore controlla il flusso integrato e riporta problemi riproducibili con evidenze. Le correzioni tornano all’agente responsabile; il coordinatore risolve problemi trasversali e conflitti.
6. Il coordinatore esegue le verifiche finali, aggiorna la documentazione e completa il percorso di pubblicazione previsto dal piano.

### Confini e coordinamento

- Coordinatore proprietario delle modifiche a package.json, lockfile, configurazione globale, contratti comuni, CI e deploy. Gli altri agenti gli comunicano le dipendenze necessarie.
- Backend proprietario dei moduli server, grafo, persistenza, migrazioni e test backend; frontend proprietario dei componenti UI, stili, grafo, replay e test frontend. Definire i percorsi precisi dopo lo scaffold.
- Il revisore lavora inizialmente in sola lettura; eventuali modifiche gli vengono assegnate esplicitamente per evitare sovrapposizioni.
- Nessuna modifica concorrente allo stesso file. Usare worktree/branch separati se supportati oppure assegnazione esclusiva dei file in workspace condiviso.
- Ogni modifica a un contratto passa dal coordinatore e viene comunicata agli agenti interessati prima di proseguire con il lavoro dipendente.
- Ogni consegna indica file modificati, comportamento ottenuto, test eseguiti e limiti aperti. Non annullare modifiche altrui per risolvere conflitti.
- Le skill frontend indicate restano obbligatorie per l’agente frontend; fornire ai sottoagenti il contesto necessario e i percorsi delle skill.
- Non copiare segreti nei messaggi tra agenti. Le chiamate reali a Jev e le operazioni di deploy vengono coordinate per evitare consumi duplicati o pubblicazioni concorrenti.
- Rispettare i limiti di concorrenza disponibili. Se gli slot sono pochi, eseguire la revisione dopo frontend/backend; non serve che tutti i ruoli siano attivi insieme.
- Il coordinatore mantiene la responsabilità del risultato: i resoconti dei sottoagenti non sostituiscono build, integrazione e verifica nel browser.

## Istruzione per il prossimo modello

Implementa BriefFlow seguendo questo piano e le skill frontend indicate. Usa più agenti secondo la sezione dedicata e assegna modelli diversi se l’ambiente consente di sceglierli. Riutilizza i requisiti già concordati, risolvi autonomamente le scelte tecniche reversibili e segnala gli eventuali limiti concreti. Parti dal processo reale e rendilo osservabile nel frontend. Non aggiungere un modello generativo o cambiare il caso d’uso senza richiesta. La chiave Jev verrà configurata come segreto server-side. Completa verifiche e documentazione prima della pubblicazione.
