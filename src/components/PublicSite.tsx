"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AppWindow,
  ArrowRight,
  CheckCircle2,
  GitBranch,
  ListChecks,
  LoaderCircle,
  LogIn,
  Plug,
  Globe,
  UserRound,
} from "lucide-react";
import {
  DEFAULT_PROFILE,
  type FieldId,
  type NodeId,
} from "../shared/contracts";
import { currentAnswers } from "../client/events";
import { buildReport } from "../client/report";
import { customerOutcome } from "../client/requests";
import { DEFAULT_TEST_EMAIL, validEmail } from "../client/email";
import { useRunStream } from "../client/useRunStream";
import Modal from "./Modal";
import QuestionField from "./QuestionField";
import SimulationNotice from "./SimulationNotice";
import SiteArt from "./SiteArt";
import "./site.css";

const company = DEFAULT_PROFILE.name;

const services = [
  {
    icon: AppWindow,
    title: "Applicazioni aziendali",
    text: "Strumenti su misura per i processi interni, pensati per chi lavora sul campo.",
    tags: ["Gestione interventi", "App mobile", "Anche offline"],
  },
  {
    icon: Globe,
    title: "Portali web",
    text: "Siti e portali per clienti e utenti esterni, con aree riservate sempre aggiornate.",
    tags: ["Aree riservate", "Portali clienti", "Contenuti"],
  },
  {
    icon: Plug,
    title: "Integrazioni software",
    text: "Colleghiamo i gestionali e i sistemi che già usi, senza ricominciare da zero.",
    tags: ["API", "Sincronizzazione dati", "Gestionali"],
  },
];

const steps = [
  {
    title: "Racconta il progetto",
    text: "Scrivi cosa ti serve, anche in poche righe, e lascia la tua email per ricevere il riscontro.",
  },
  {
    title: "Rispondi a poche domande",
    text: "Solo se servono: scelte rapide, nessun modulo lungo da compilare.",
  },
  {
    title: "Ricevi un riscontro",
    text: "Ti diciamo se possiamo aiutarti e qual è il passo successivo.",
  },
];

const perks = [
  {
    icon: ListChecks,
    title: "Poche domande, a scelta rapida",
    text: "Niente moduli infiniti: rispondi con un tocco.",
  },
  {
    icon: CheckCircle2,
    title: "Un esito chiaro",
    text: "Sai subito se la richiesta rientra nei nostri servizi.",
  },
  {
    icon: UserRound,
    title: "Una persona quando serve",
    text: "Se il caso è dubbio, lo valuta un nostro referente.",
  },
];
// Plain-language description of what is happening, per step of the process.
const progress: Record<NodeId, string> = {
  validate: "Controllo la richiesta",
  classify: "Capisco di che tipo di progetto si tratta",
  compatibility: "Verifico se rientra nei nostri servizi",
  manual_review: "Passo la richiesta a un nostro referente",
  completeness: "Controllo che non manchino informazioni",
  select_questions: "Preparo le domande",
  await_answers: "Preparo le domande",
  update_state: "Aggiorno la richiesta con le tue risposte",
  compose: "Preparo il riscontro",
};

export default function PublicSite() {
  const stream = useRunStream();
  const { view, events, busy, error } = stream;
  const [open, setOpen] = useState(false);
  const [brief, setBrief] = useState("");
  const [email, setEmail] = useState(DEFAULT_TEST_EMAIL);
  const [answers, setAnswers] = useState<Partial<Record<FieldId, string>>>({});
  const [available, setAvailable] = useState(true);
  const [mailAvailable, setMailAvailable] = useState(false);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((body) => {
        setAvailable(!!body.liveAvailable);
        setMailAvailable(!!body.mailAvailable);
      })
      .catch(() => {});
  }, []);

  const questions = (view.interrupt?.payload.questions || []) as FieldId[];
  const phase =
    events.length === 0 && !busy
      ? "form"
      : view.card
        ? "done"
        : view.failure
          ? "failed"
          : view.interrupt && !busy
            ? view.interrupt.payload.kind === "answers"
              ? "questions"
              : "received"
            : "working";
  const last = events[events.length - 1];
  const step = last?.node ? progress[last.node] : "Ricevo la richiesta";
  const report = useMemo(
    () => (view.card ? buildReport(view.card, events, stream.runId) : undefined),
    [view.card, events, stream.runId],
  );

  function close() {
    setOpen(false);
    if (phase === "done" || phase === "failed") {
      stream.reset();
      setBrief("");
      setEmail(DEFAULT_TEST_EMAIL);
      setAnswers({});
    }
  }

  const title =
    phase === "form"
      ? "Invia una richiesta"
      : phase === "questions"
        ? "Ancora qualche informazione"
        : phase === "done"
          ? (report ? customerOutcome(report).title : "Grazie")
          : phase === "received"
            ? "Richiesta ricevuta"
            : phase === "failed"
              ? "Qualcosa non ha funzionato"
              : "Stiamo guardando la tua richiesta";

  return (
    <div className="site">
      <header className="site-header">
        <Link className="site-brand" href="/">
          <span className="site-logo" aria-hidden>
            <GitBranch size={18} />
          </span>
          <span>{company}</span>
        </Link>
        <nav aria-label="Sezioni">
          <a href="#servizi">Servizi</a>
          <a href="#come-funziona">Come funziona</a>
          <a href="#perche">Perché noi</a>
        </nav>
        <Link
          className="site-login"
          href="/backoffice"
          aria-label="Accedi al backoffice"
          title="Accedi al backoffice"
        >
          <LogIn size={16} aria-hidden />
          <span>Accedi al backoffice</span>
        </Link>
        <button className="primary" onClick={() => setOpen(true)}>
          Invia una richiesta
        </button>
      </header>

      <main>
        <section className="site-hero">
          <div className="site-aurora" aria-hidden />
          <div className="site-hero-copy">
            <p className="site-badge">
              <span aria-hidden />
              Applicazioni · Portali · Integrazioni
            </p>
            <h1>
              Raccontaci cosa ti serve.
              <br />
              <em>Ti diciamo se possiamo aiutarti.</em>
            </h1>
            <p className="site-lead">
              Realizziamo software su misura per le aziende. Descrivi il tuo
              progetto: valutiamo la richiesta e ti facciamo subito sapere come
              proseguire.
            </p>
            <div className="site-cta">
              <button className="primary" onClick={() => setOpen(true)}>
                Invia una richiesta
                <ArrowRight size={16} />
              </button>
              <a className="site-ghost" href="#come-funziona">
                Come funziona
              </a>
            </div>
            <ul className="site-checks">
              <li>
                <CheckCircle2 size={15} aria-hidden /> Poche domande
              </li>
              <li>
                <CheckCircle2 size={15} aria-hidden /> Esito chiaro
              </li>
              <li>
                <CheckCircle2 size={15} aria-hidden /> Nessun impegno
              </li>
            </ul>
          </div>
          <figure className="site-hero-art">
            <SiteArt />
            <figcaption>Dalla tua richiesta a un esito chiaro</figcaption>
          </figure>
        </section>

        <section id="servizi" className="site-section">
          <header className="site-head" data-reveal>
            <p className="site-kicker">Servizi</p>
            <h2>Di cosa ci occupiamo</h2>
          </header>
          <ul className="site-services">
            {services.map(({ icon: Icon, title: name, text, tags }) => (
              <li key={name} data-reveal>
                <span className="site-icon" aria-hidden>
                  <Icon size={22} />
                </span>
                <h3>{name}</h3>
                <p>{text}</p>
                <ul className="site-tags">
                  {tags.map((tag) => (
                    <li key={tag}>{tag}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>

        <section id="come-funziona" className="site-section">
          <header className="site-head" data-reveal>
            <p className="site-kicker">Come funziona</p>
            <h2>Tre passi, nessun modulo lungo</h2>
          </header>
          <ol className="site-steps">
            {steps.map((item, index) => (
              <li key={item.title} data-reveal>
                <span className="site-step-dot">{index + 1}</span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="perche" className="site-section">
          <header className="site-head" data-reveal>
            <p className="site-kicker">Perché noi</p>
            <h2>Un modo semplice di chiedere un progetto</h2>
          </header>
          <ul className="site-perks">
            {perks.map(({ icon: Icon, title: name, text }) => (
              <li key={name} data-reveal>
                <Icon size={20} aria-hidden />
                <div>
                  <h3>{name}</h3>
                  <p>{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="site-final" data-reveal>
          <h2>Hai un progetto in mente?</h2>
          <p>Bastano poche righe per iniziare.</p>
          <button className="primary" onClick={() => setOpen(true)}>
            Invia una richiesta
            <ArrowRight size={16} />
          </button>
        </section>
      </main>

      <footer className="site-footer">
        <div>
          <strong>{company}</strong>
          <span>Sito dimostrativo</span>
        </div>
        <nav aria-label="Link utili">
          <a href="#servizi">Servizi</a>
          <a href="#come-funziona">Come funziona</a>
          <Link href="/backoffice">Area azienda</Link>
        </nav>
      </footer>
      <Modal
        open={open}
        onClose={close}
        locked={phase === "working"}
        title={title}
        subtitle={
          phase === "form"
            ? "Descrivi il progetto: ti rispondiamo senza impegno."
            : undefined
        }
      >
        {phase === "form" && (
          <form
            className="new-request"
            onSubmit={(e) => {
              e.preventDefault();
              stream.start(brief.trim(), email.trim());
            }}
          >
            <SimulationNotice mailAvailable={mailAvailable} />
            <label className="field brief-label">
              Di cosa hai bisogno?
              <textarea
                autoFocus
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === "Enter")
                    e.currentTarget.form?.requestSubmit();
                }}
                maxLength={12000}
                placeholder="Es. Ci serve un portale per assegnare gli interventi ai tecnici, anche offline…"
              />
            </label>
            <label className="field email-field">
              Email
              <input
                required
                type="email"
                name="email"
                autoComplete="email"
                inputMode="email"
                maxLength={254}
                placeholder="nome@azienda.it"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <span className="small">
                Precompilata con un indirizzo di test: puoi cambiarla. Vedrai
                comunque l&apos;esito anche qui.
              </span>
            </label>
            {error && <p className="error-text">{error}</p>}
            {!available && (
              <p className="error-text">
                Il servizio non è disponibile al momento. Riprova più tardi.
              </p>
            )}
            <div className="modal-actions">
              <button type="button" onClick={close}>
                Annulla
              </button>
              <button
                className="primary"
                disabled={
                  !available || brief.trim().length < 15 || !validEmail(email)
                }
              >
                Invia richiesta
                <ArrowRight size={15} />
              </button>
            </div>
          </form>
        )}

        {phase === "working" && (
          <div className="site-working" role="status" aria-live="polite">
            <LoaderCircle size={22} className="spin" aria-hidden />
            <p>{step}…</p>
            <span className="small">Ci vuole qualche secondo.</span>
          </div>
        )}

        {phase === "questions" && (
          <form
            className="modal-stack"
            onSubmit={(e) => {
              e.preventDefault();
              stream.resume({ answers: currentAnswers(questions, answers) });
            }}
          >
            <p>
              Per valutare bene la tua richiesta ci servono ancora alcune
              informazioni. Scegli le risposte che ti rappresentano meglio.
            </p>
            {questions.map((id) => (
              <QuestionField
                key={id}
                id={id}
                value={answers[id]}
                onChange={(value) => setAnswers({ ...answers, [id]: value })}
              />
            ))}
            {error && <p className="error-text">{error}</p>}
            <div className="modal-actions">
              <button className="primary" disabled={busy}>
                Invia le risposte
                <ArrowRight size={15} />
              </button>
            </div>
          </form>
        )}

        {phase === "received" && (
          <div className="modal-stack">
            <p>
              Abbiamo ricevuto la tua richiesta. Un nostro referente la
              valuterà con attenzione.
            </p>
            {mailAvailable && <p>Ti scriveremo a {email.trim()}.</p>}
            <SimulationNotice mailAvailable={mailAvailable} />
            <div className="modal-actions">
              <button
                className="primary"
                onClick={() => {
                  stream.reset();
                  setBrief("");
                  setEmail(DEFAULT_TEST_EMAIL);
                  setAnswers({});
                  setOpen(false);
                }}
              >
                Chiudi
              </button>
            </div>
          </div>
        )}

        {phase === "done" && report && (
          <div className="site-done">
            <p className="site-done-lead">
              <CheckCircle2 size={20} aria-hidden />
              {customerOutcome(report).text}
            </p>
            <h3>Cosa abbiamo ricevuto</h3>
            <ul>
              {report.fields.map((field) => (
                <li key={field.label}>
                  <strong>{field.label}</strong>
                  <span>
                    {field.status === "answer"
                      ? field.value
                      : field.status === "brief"
                        ? "indicato nella richiesta"
                        : "da fornire"}
                  </span>
                </li>
              ))}
            </ul>
            {mailAvailable && (
              <p className="small">
                Per qualsiasi aggiornamento ti scriveremo a {email.trim()}.
              </p>
            )}
            <SimulationNotice mailAvailable={mailAvailable} />
            <div className="modal-actions">
              <button className="primary" onClick={close}>
                Chiudi
              </button>
            </div>
          </div>
        )}

        {phase === "failed" && (
          <div className="modal-stack">
            <p>
              Non siamo riusciti a elaborare la richiesta. Puoi riprovare: non
              perdi quello che hai scritto.
            </p>
            <div className="modal-actions">
              <button onClick={close}>Chiudi</button>
              {view.failure?.payload.retryable === true && (
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => stream.resume({ retry: true })}
                >
                  Riprova
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
