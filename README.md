# BriefFlow

Qualificazione di brief di progetto con **LangGraph.js + Jev**. Un grafo osservabile mostra codice, decisioni strutturate e interventi umani: dall'input alla scheda finale, con checkpoint persistenti, cronologia, elenco delle richieste ricevute e modalità presentazione.

L'app non usa modelli generativi aggiuntivi. Jev sceglie categorie, valuta compatibilità e presenza di informazioni; domande e testo della scheda provengono da template nel codice. Nessun preventivo, blueprint o riassunto libero.

## Avvio

Richiede Node.js **22 o superiore**, npm e, per il live, Postgres (Neon tramite Vercel Marketplace è la scelta di deploy).

```sh
npm ci
npm run dev
```

Aprire [localhost:3000](http://localhost:3000). L'app funziona solo in live: servono la chiave Jev e il database descritti sotto. Senza di essi la pagina si apre ma «Qualifica richiesta» resta disabilitata.

## Configurazione live

Copiare `.env.example` in `.env.local` e inserire i valori **solo sul server**:

| Variabile | Scopo |
| --- | --- |
| `TYPESAFE_API_KEY` | Chiave Jev dalla console TypeSafe |
| `DATABASE_URL` | Connessione Postgres diretta con TLS; su Neon usare URL unpooled |
| `JEV_LIMIT_REACHED` | Interruttore: se `true` (o `1`) l'intera app mostra la pagina «Limite Jev raggiunto» e il live è disabilitato |
| `SMTP_URL` | Opzionale. Server SMTP per l'invio email, es. `smtps://UTENTE:PASSWORD@smtp.provider.it:465` (qualsiasi provider). In locale: Mailpit, `smtp://127.0.0.1:1025` |
| `MAIL_FROM` | Mittente, es. `ACME IT <richieste@acme-it.it>`. Serve insieme a `SMTP_URL` |
| `MAIL_REPLY_TO` | Opzionale. Indirizzo a cui rispondono i clienti |
| `MAIL_NOTIFY_TO` | Opzionale. Indirizzo che riceve un avviso per ogni nuova richiesta (una sola volta per richiesta) |
| `APP_URL` | Indirizzo pubblico dell'app, usato nei link delle email di avviso (default `http://localhost:3000`) |

Non usare nomi `NEXT_PUBLIC_*`. `.env.local`, `.vercel` e output locali sono esclusi dal versionamento. Non incollare credenziali in issue, chat, screenshot o log.

```sh
npm run db:migrate
npm run dev
```

La migrazione carica `.env.local`, applica tutti i file di `migrations/` e crea le tabelle del checkpointer LangGraph. Non viene eseguita durante la build.

### Le due pagine

- **`/` — sito pubblico dell'azienda (ACME IT).** Il visitatore descrive il progetto e lascia la propria **email** (obbligatoria), risponde alle eventuali domande a scelta chiusa (solo il gestionale accetta un nome personalizzato) e vede l'esito in linguaggio semplice. Non vede grafo, Jev o dettagli interni.
- **`/backoffice` — la vista dell'azienda.** Elenco **Richieste ricevute** (per ognuna: cosa è successo e l'output), grafo con dettaglio dei nodi, scheda finale con export PDF/JSON e **Simula richiesta** per provare il flusso come se arrivasse dal sito. Il profilo aziendale si apre dal pulsante **Profilo** e vale solo per le simulazioni: le richieste del sito usano il profilo predefinito.

### Email

**Non è attivo di default**: l'invio email si abilita solo impostando le variabili qui sotto, e ognuno può collegare il servizio che preferisce. Con `SMTP_URL` e `MAIL_FROM` configurati i pulsanti **Contatta azienda** (modale con anteprima e messaggio facoltativo) e **Invia resoconto** inviano davvero l'email dal server, e se è impostato `MAIL_NOTIFY_TO` l'azienda riceve un avviso per ogni nuova richiesta conclusa o che richiede una revisione manuale. Senza configurazione i due pulsanti ripiegano sui link `mailto:` e si apre il tuo programma di posta. Ogni invio è registrato nella tabella `bf_mail` (destinatario, oggetto, esito: mai il testo). Le richieste salvate prima che l'email fosse obbligatoria non l'hanno: per quelle i pulsanti restano spenti con «Email non presente». L'email non va mai a Jev e non finisce negli eventi.

In locale basta un contenitore che intercetta la posta, senza account né credenziali:

```sh
docker run -d --name briefflow-mail -p 127.0.0.1:1025:1025 -p 127.0.0.1:8025:8025 axllent/mailpit
```

poi `SMTP_URL=smtp://127.0.0.1:1025` e un `MAIL_FROM` qualsiasi in `.env.local`; i messaggi si leggono su [localhost:8025](http://localhost:8025). In produzione serve il server SMTP di un provider (Resend, Brevo, Mailgun, il tuo dominio…) e, per consegnare bene, i record SPF/DKIM del dominio del mittente.

### Accesso e limiti di invio

Non c'è autenticazione: chiunque apra l'app può avviare esecuzioni Jev, e chiunque conosca l'ID di una richiesta può chiedere l'invio del resoconto. Per questo il destinatario non è mai scelto da chi chiama: è sempre l'email salvata con la richiesta; il testo è quello dei modelli (più al massimo 500 caratteri di messaggio); ogni richiesta può generare al massimo 5 email e ogni indirizzo 10 al giorno. Questo riduce l'abuso ma non lo elimina: prima di un uso reale conviene proteggere `/backoffice` e gli endpoint di invio. Per fermare i consumi impostare `JEV_LIMIT_REACHED=true` (su Vercel serve un nuovo deploy): l'app mostra solo la pagina «Limite Jev raggiunto» e gli endpoint rispondono 503.

Per Neon tramite Vercel: vedere [configurazione e isolamento degli ambienti](docs/deployment.md). La URL transaction-pooled non è adatta ai lock di sessione del processo. Preview e produzione devono usare database/branch Neon e segreti separati.

## Percorso e interfaccia

```text
Valida → Classifica [Jev] → Compatibilità [Jev]
                             ├─ fuori ambito/incerta → Persona → chiudi o prosegui
                             └─ in linea → Completezza [Jev]
                                             ├─ completa → Scheda
                                             └─ mancante → Domande → interrupt
                                                              ↓ risposte
                                                        Aggiorna → Completezza
```

Massimo due giri di chiarimento e cinque tentativi Jev per esecuzione, inclusi quelli falliti. Le chiamate hanno timeout; i risultati completati vengono memorizzati per evitare ripetizioni in recupero. Il brief originale, le risposte strutturate, i criteri, la versione del profilo e il modello restituito da Jev accompagnano lo stato.

Il grafo desktop usa React Flow con nodi circolari e frecce, identificativi e topologia condivisi con il backend. Mobile offre viste dedicate e percorsi leggibili. Colore, icone e testo distinguono stato operativo ed esito aziendale. Cliccando un nodo, il suo dettaglio si apre con un'animazione accanto al nodo (su mobile come foglio dal basso) e mostra input, output, differenze, durata e visite; la cronologia in alto elenca gli ultimi eventi e apre il nodo corrispondente. «Nuova richiesta» apre una modale per il brief; le domande di chiarimento sono a scelta chiusa con risposta predefinita (solo il gestionale accetta un nome personalizzato) e la scheda finale compare in una modale. La scheda riassume esito, prossimo passo, informazioni raccolte, punti di attenzione e percorso seguito, ed è esportabile in **PDF** (generato nel browser) e in JSON. **Presenta** adatta l'interfaccia alla registrazione; `prefers-reduced-motion` disabilita il movimento decorativo.

L'interruzione termina la richiesta HTTP e conserva lo stato su Postgres. La ripresa usa `Command` e lo stesso `thread_id`. Dopo un refresh l'URL `?run=...` recupera l'esecuzione. In caso di connessione interrotta, usare **Recupera stato**.

## Architettura

| Percorso | Responsabilità |
| --- | --- |
| `src/shared/contracts.ts` | Schemi Zod, stato, nodi, topologia, domande e API |
| `src/server/graph.ts` | StateGraph reale e interruzioni umane |
| `src/server/jev.ts` | SDK ufficiale `@typesafe-ai/sdk`: Choice, Noul, Score |
| `src/server/runs.ts` | Eventi persistiti, checkpoint, lock, idempotenza e cache decisioni |
| `src/app/api/` | Configurazione, SSE, elenco e recupero run |
| `src/client/events.ts` | Lettura SSE e proiezione eventi nel grafo |
| `src/components/` | Pagina, grafo, questionario, scheda e cronologia |
| `migrations/` | Tabelle applicative; setup checkpointer tramite script |

Postgres contiene esecuzioni, snapshot del profilo, risposte nello stato, eventi ordinati, schede finali, cache delle decisioni e checkpoint. Il live non ha fallback in memoria o su filesystem. `MemorySaver` è usato solo nei test.

I contratti dettagliati sono in [docs/contracts.md](docs/contracts.md). L'identità visiva e i criteri UX sono in [PRODUCT.md](PRODUCT.md) e [DESIGN.md](DESIGN.md).

## Verifiche

```sh
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Il test Postgres richiede `TEST_DATABASE_URL` verso un database **dedicato ai test**. Crea schema e checkpoint e cancella solo le proprie esecuzioni; non puntarlo a produzione. CI GitHub Actions avvia Postgres 17 e non riceve chiavi Jev. I test coprono diramazioni, limite chiarimenti, interrupt/resume, schema eventi, deduplicazione, interruttore del limite e persistenza; Playwright verifica la pagina desktop/mobile senza avviare run e il movimento ridotto. Vedere [report di revisione indipendente](docs/review.md) e [verifiche eseguite](docs/verification.md) per l'evidenza effettiva e i limiti.

Lo smoke Jev è separato dalla CI e consuma una chiamata reale, da eseguire esplicitamente dopo aver configurato la chiave:

```sh
npm run smoke:jev
```


## Registrazione e deploy

[Copione di 75–90 secondi](docs/demo-script.md): brief completo, chiarimenti con ripresa, fuori ambito, tutti in live. [Guida Vercel + Neon](docs/deployment.md): variabili, migrazioni controllate, isolamento preview/produzione e smoke test sul deploy. GitHub Actions verifica ogni push/PR; collegare il repository a Vercel per preview delle PR e produzione da main.

## Limiti dichiarati

- Le decisioni mostrate sono quelle reali di Jev: non vengono inventati costi, consumi o ragionamenti interni, e l'esito può variare tra una run e l'altra su brief ambigui.
- Resta una finestra tra risposta Jev e commit del risultato sul database: un crash in quel momento può ripetere quella decisione. Il budget persistito limita comunque i tentativi; l'interruzione umana ordinaria non ripete le chiamate precedenti.
- Il modello viene fissato al valore restituito dalla prima risposta SDK. Se il fornitore restituisce un alias mobile, non è garantita l'immutabilità dei pesi.
- Nessuna autenticazione: il live e l'invio email sono aperti a chiunque raggiunga l'app, con l'interruttore `JEV_LIMIT_REACHED`, i limiti di invio e il destinatario fisso come unici freni; niente multi-tenancy, CRM, trascrizione o documenti PDF/DOCX.
- La cronologia contiene il brief e le risposte: trattare il database come dati privati. Chiunque conosca l'ID di una run può leggerla. Per rimuovere dati, prevedere la retention operativa sul database.
- Hosting, limiti Functions, quote Jev e costi Neon dipendono dagli account effettivamente collegati. Le verifiche locali non sostituiscono uno smoke test sul deploy reale.

Fonti: [Jev](https://docs.typesafe.ai/introduction/quickstart), [LangGraph interrupt/resume](https://docs.langchain.com/oss/javascript/langgraph/interrupts), [React Flow](https://reactflow.dev/), [Vercel](https://vercel.com/docs/functions/limitations).
