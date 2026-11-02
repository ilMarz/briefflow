# Product
<!-- impeccable:product-schema 1 -->
## Platform
web
## Users
Consultanti IT che qualificano richieste e pubblico professionale LinkedIn che osserva una registrazione di 60–90 secondi.
## Product Purpose
Rendere osservabile la qualificazione di un brief: decisioni strutturate Jev, percorsi LangGraph, chiarimenti umani, scheda finale.
## Operating Context
Desktop con elenco delle richieste ricevute, grafo e cronologia; nuova richiesta, domande e scheda finale in modali; dettaglio del nodo animato al click; mobile con viste dedicate. Solo esecuzione live, senza autenticazione, fermabile con l'interruttore JEV_LIMIT_REACHED.
## Capabilities and Constraints
Profilo configurabile, richieste ricevute con esito, email obbligatoria e azioni «Contatta azienda» / «Invia resoconto» (invio email dal server, con ripiego su mailto), interrupt/resume persistente, export JSON. Nessun modello generativo aggiuntivo. Contratti in src/shared/contracts.ts.
## Brand Commitments
BriefFlow, interfaccia italiana, professionale e leggibile in video. Nessuna identità visiva precedente.
## Evidence on Hand
PLAN.md e docs/contracts.md sono il brief approvato. Nessuna prova cliente o risultato Jev reale inventato.
## Product Principles
Stati derivati dagli eventi. Separare esito aziendale e errore tecnico. Mostrare evidenze. Rendere la ripresa comprensibile.
## Accessibility & Inclusion
Focus visibile, tastiera, stati testuali oltre al colore, movimento ridotto.
## Assumptions
Come sottoagente senza canale decisionale diretto, uso il piano esplicito come intervista strutturata. Nessuna preferenza permanente di processo inferita.
