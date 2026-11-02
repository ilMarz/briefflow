# Deployment: Vercel + Neon

## Isolamento e segreti

Usare Neon attraverso Vercel Marketplace. Creare/collegare il progetto Neon al progetto Vercel `briefflow`. Non creare una nuova sottoscrizione a pagamento senza verificare il piano scelto. Utilizzare due database o branch Neon separati: `preview` e `production`. I brief sono dati privati; una preview non deve leggere il database di produzione.

Variabili server-only per ciascun ambiente:

| Nome | Valore |
| --- | --- |
| TYPESAFE_API_KEY | Chiave Jev, possibilmente distinta per ambiente |
| DATABASE_URL | URL Neon **diretto**, TLS richiesto (`sslmode=require`) |
| SMTP_URL | Opzionale. Server SMTP del provider, es. `smtps://UTENTE:PASSWORD@smtp.provider.it:465` (segreto: solo variabili Vercel) |
| MAIL_FROM | Mittente, es. `ACME IT <richieste@dominio.it>`; senza `SMTP_URL` e `MAIL_FROM` l'invio è disattivato e i pulsanti usano `mailto:` |
| MAIL_REPLY_TO / MAIL_NOTIFY_TO | Opzionali: indirizzo di risposta dei clienti / indirizzo che riceve un avviso per ogni nuova richiesta |
| APP_URL | Indirizzo pubblico dell'app (link nelle email di avviso), es. `https://acme-it.vercel.app` |
| JEV_LIMIT_REACHED | Opzionale. `true` mostra «Limite Jev raggiunto» e disabilita l'app (richiede nuovo deploy) |

Neon/Vercel può fornire una URL pooled con `-pooler` nell'host. Il backend usa advisory lock di sessione su una connessione dedicata per run: scegliere la URL diretta Neon, tipicamente esposta come `DATABASE_URL_UNPOOLED`, e assegnarla a `DATABASE_URL` di BriefFlow. Non usare un pool in modalità transaction. Non stampare URL o valori delle variabili nei log. In locale copiare `.env.example` in `.env.local`; non inviare chiavi in chat.

## Preparazione controllata

1. Verificare l'identità con `npx vercel whoami --format json` e il progetto con `npx vercel project inspect --non-interactive`. Se manca il collegamento, collegare esplicitamente il progetto `briefflow` nell'account desiderato.
2. Importare il repository GitHub `briefflow` in Vercel: framework Next.js, Node 22+, `npm ci`, `npm run build`, main per produzione. Preview per PR. Vercel usa `package-lock.json`.
3. Collegare Neon e impostare le variabili per ambiente, senza valori `NEXT_PUBLIC_*`. Senza i segreti il live resta disabilitato.
4. Eseguire `npm run db:migrate` esplicitamente prima sulla URL preview e solo dopo sulla URL produzione. Lo script crea schema applicativo e checkpointer LangGraph. Nessuna migrazione viene eseguita durante build o richieste HTTP.
5. Creare una preview; verificare una run live completa, interruttore JEV_LIMIT_REACHED, SSE, interruzione, refresh, risposte, ripresa e JSON finale. Solo allora promuovere la configurazione live in produzione.

## Limiti di esecuzione

Runtime Node, streaming SSE tramite fetch, nessun WebSocket. Durata massima richiesta 120 secondi; le chiamate Jev sono limitate e hanno timeout. Verificare la durata consentita dal piano Vercel corrente e il budget Neon/Jev prima del rilascio. La disconnessione non implica che l'esecuzione continui: usare Recupera stato e ripresa da checkpoint. L'accesso live è senza autenticazione; per fermarlo impostare JEV_LIMIT_REACHED=true. I brief inseriti restano nel database: trattarli come dati privati.

## Verifica dopo deploy

- `/api/config`: disponibilità e stato del limite Jev, senza dettagli credenziali; nessuna chiave nel bundle.
- Email: configurare `SMTP_URL`/`MAIL_FROM` del provider, configurare SPF/DKIM del dominio del mittente, poi da `/backoffice` inviare un resoconto a un indirizzo proprio e controllare la tabella `bf_mail`. Verificare anche l'avviso a `MAIL_NOTIFY_TO` e che il numero di invii per richiesta (5) e per indirizzo (10/giorno) risponda 429 oltre il limite.
- Con `JEV_LIMIT_REACHED=true`: la pagina mostra «Limite Jev raggiunto» e POST `/api/runs`, GET run e POST resume rispondono 503.
- Esecuzione Jev reale: classificazione e rotta coerenti con eventi e consumi effettivi.
- Interruzione: richiesta HTTP termina; refresh e ripresa mantengono stesso run/thread.
- Doppio invio: nessuna seconda esecuzione contemporanea; checkpoint persistiti nel DB corretto.
- Verificare CI GitHub e logs Vercel senza contenuti privati.

Fonti ufficiali verificate durante l'implementazione: [limiti Functions](https://vercel.com/docs/functions/limitations), [integrazione GitHub](https://vercel.com/docs/git/vercel-for-github), [Neon su Vercel](https://vercel.com/marketplace/neon).
