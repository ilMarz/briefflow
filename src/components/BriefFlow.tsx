"use client";

import Link from "next/link";

import { useMemo, useRef, useState, useEffect } from "react";

import {
  ArrowRight,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  SkipForward,
  PanelLeftClose,
  SlidersHorizontal,
  GitBranch,
  Check,
  ChevronDown,
  ExternalLink,
  Plus,
  RefreshCw,
  Send,
  X,
} from "lucide-react";

import {
  DEFAULT_PROFILE,
  NODE_LABELS,
  QUESTIONS,
  ProfileSchema,
  type CompanyProfile,
  type NodeId,
  type RunSnapshot,
  type RunSummary,
  type RunEvent,
  type FieldId,
  type ResumeInput,
} from "../shared/contracts";

import {
  consumeSSE,
  mergeEvents,
  projectEvents,
  currentAnswers,
} from "../client/events";

import { fieldLabels } from "../client/labels";
import { DEFAULT_TEST_EMAIL, validEmail } from "../client/email";
import { contactHref, contactLines, summaryHref } from "../client/requests";
import { rememberRun, storedRunIds } from "../client/storage";

import RunGraph from "./RunGraph";
import Modal from "./Modal";
import RunCard from "./RunCard";
import QuestionField from "./QuestionField";
import ReceivedRequests from "./ReceivedRequests";
import NodeDetail, { type Anchor } from "./NodeDetail";

const statusText: Record<string, string> = {
  ready: "Pronto",
  running: "Percorso in corso",
  interrupted: "In attesa di una persona",
  completed: "Qualificazione completata",
  failed: "Esecuzione interrotta",
};

const eventLabels: Record<RunEvent["type"], string> = {
  node_started: "Avvio nodo",
  node_completed: "Nodo completato",
  state_updated: "Stato aggiornato",
  route_selected: "Percorso selezionato",
  run_interrupted: "Intervento richiesto",
  run_completed: "Scheda pronta",
  run_failed: "Errore tecnico",
};



function download(value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "briefflow-scheda.json";
  a.click();
  URL.revokeObjectURL(url);
}

export default function BriefFlow() {
  const [snapshot, setSnapshot] = useState<RunSnapshot>(),
    [events, setEvents] = useState<RunEvent[]>([]),
    [openNode, setOpenNode] = useState<{
      id: NodeId;
      anchor: Anchor;
      bounds: { w: number; h: number };
    }>(),
    [tab, setTab] = useState("graph"),
    [presentation, setPresentation] = useState(false),
    [left, setLeft] = useState(true),
    [profileOpen, setProfileOpen] = useState(false),
    [profileError, setProfileError] = useState(""),
    [newOpen, setNewOpen] = useState(false),
    [cardOpen, setCardOpen] = useState(false),
    [timelineOpen, setTimelineOpen] = useState(false),
    [dismissedAction, setDismissedAction] = useState<string>(),
    [runs, setRuns] = useState<RunSummary[]>([]),
    [profile, setProfile] = useState<CompanyProfile>(DEFAULT_PROFILE),
    [brief, setBrief] = useState(""),
    [email, setEmail] = useState(DEFAULT_TEST_EMAIL),
    [liveAvailable, setLiveAvailable] = useState(false),
    [mailAvailable, setMailAvailable] = useState(false),
    [notice, setNotice] = useState(""),
    [sendingId, setSendingId] = useState<string>(),
    [contactRun, setContactRun] = useState<RunSummary>(),
    [contactNote, setContactNote] = useState(""),
    [contactBusy, setContactBusy] = useState(false),
    [contactError, setContactError] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [answers, setAnswers] = useState<Partial<Record<FieldId, string>>>({});

  const [runId, setRunId] = useState<string>();
  // Replay of the saved events: null shows the whole run, a number shows the first N events.
  const [cursor, setCursor] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const graphPanel = useRef<HTMLElement>(null);

  const view = useMemo(() => projectEvents(events), [events]);
  const shown = useMemo(
    () => (cursor === null ? events : events.slice(0, cursor)),
    [events, cursor],
  );
  const shownView = useMemo(() => projectEvents(shown), [shown]);
  const replaying = cursor !== null;

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setCursor((c) => (c === null ? 1 : c + 1));
    }, 700);
    return () => clearInterval(timer);
  }, [playing]);

  useEffect(() => {
    if (cursor !== null && cursor >= events.length) {
      setPlaying(false);
      setCursor(null);
    }
  }, [cursor, events.length]);

  function stopReplay() {
    setPlaying(false);
    setCursor(null);
  }

  function togglePlay() {
    if (playing) setPlaying(false);
    else {
      if (cursor === null) setCursor(0);
      setPlaying(true);
    }
  }

  function stepReplay() {
    setPlaying(false);
    setCursor((c) => (c === null ? 1 : c + 1));
  }
  const last = events[events.length - 1];
  const lastEvent = last
    ? last.node
      ? NODE_LABELS[last.node]
      : eventLabels[last.type]
    : "";
  const questions = (view.interrupt?.payload.questions || []) as FieldId[];
  const actionOpen =
    !!view.interrupt &&
    dismissedAction !== view.interrupt.id &&
    !busy &&
    !replaying;
  const recovered =
    snapshot?.status === "running" && view.status === "running" && !busy;

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((body) => {
        setLiveAvailable(body.liveAvailable);
        setMailAvailable(!!body.mailAvailable);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("run");
    if (id) openRun(id);
    refreshRuns();
  }, []);

  async function refreshRuns() {
    try {
      const response = await fetch(
        `/api/runs?ids=${encodeURIComponent(storedRunIds().join(","))}`,
      );
      if (response.ok) setRuns((await response.json()).runs as RunSummary[]);
    } catch {}
  }

  function showNode(id: NodeId, rect?: DOMRect) {
    const panel = graphPanel.current;
    if (!panel) return;
    const box = panel.getBoundingClientRect();
    const node =
      rect ??
      panel
        .querySelector(`.react-flow__node[data-id="${id}"]`)
        ?.getBoundingClientRect();
    setOpenNode({
      id,
      anchor: node
        ? {
            x: node.left - box.left,
            y: node.top - box.top,
            w: node.width,
            h: node.height,
          }
        : { x: box.width / 2 - 60, y: box.height / 2 - 60, w: 120, h: 120 },
      bounds: { w: box.width, h: box.height },
    });
  }

  async function openRun(id: string) {
    setError("");
    stopReplay();
    setRunId(id);
    setOpenNode(undefined);
    setCardOpen(false);
    setDismissedAction(undefined);
    setTab("graph");
    try {
      const response = await fetch(`/api/runs/${encodeURIComponent(id)}`);
      if (!response.ok) throw Error("Esecuzione non recuperabile.");
      const data = (await response.json()) as RunSnapshot;
      setSnapshot(data);
      setEvents(mergeEvents([], data.events));
      setAnswers({});
      const url = new URL(window.location.href);
      url.searchParams.set("run", id);
      window.history.replaceState({}, "", url);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function recover() {
    const id = runId;
    if (!id) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/runs/${encodeURIComponent(id)}`);
      if (!response.ok)
        throw Error("Stato non recuperato. Verifica la connessione.");
      const data = (await response.json()) as RunSnapshot;
      setSnapshot(data);
      setEvents((current) => mergeEvents(current, data.events));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function stream(resume?: Partial<ResumeInput>) {
    if (busy) return;
    setBusy(true);
    setError("");
    stopReplay();
    if (!resume) {
      setEvents([]);
      setSnapshot(undefined);
      setRunId(undefined);
      setOpenNode(undefined);
      setCardOpen(false);
      setDismissedAction(undefined);
      setAnswers({});
    }
    try {
      const response = await fetch(
        resume
          ? `/api/runs/${encodeURIComponent(runId || "")}/resume`
          : "/api/runs",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            resume
              ? { requestId: crypto.randomUUID(), ...resume }
              : {
                  brief,
                  profile,
                  requestId: crypto.randomUUID(),
                  email: email.trim(),
                },
          ),
        },
      );
      await consumeSSE(response, (event) => {
        rememberRun(event.run_id);
        setRunId(event.run_id);
        const url = new URL(window.location.href);
        url.searchParams.set("run", event.run_id);
        window.history.replaceState({}, "", url);
        setEvents((current) => mergeEvents(current, [event]));
        if (event.type === "run_completed") setCardOpen(true);
      });
    } catch (e) {
      setError(`${(e as Error).message} Puoi recuperare lo stato salvato.`);
    } finally {
      setBusy(false);
      refreshRuns();
    }
  }

  function openNew() {
    setBrief("");
    setEmail(DEFAULT_TEST_EMAIL);
    setNewOpen(true);
  }

  function startNew() {
    setNewOpen(false);
    setTab("graph");
    stream();
  }

  function announce(message: string) {
    setNotice(message);
    setTimeout(() => setNotice(""), 7000);
  }

  async function postMail(run: RunSummary, kind: "summary" | "contact", note?: string) {
    const response = await fetch(`/api/runs/${encodeURIComponent(run.id)}/mail`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, ...(note ? { note } : {}) }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error?.message || "Invio non riuscito.");
    }
  }

  // With a mail service configured the server sends; otherwise the mail program opens.
  async function sendSummary(run: RunSummary) {
    if (!run.email) return;
    setSendingId(run.id);
    try {
      if (mailAvailable) {
        await postMail(run, "summary");
        announce(`Resoconto inviato a ${run.email}.`);
      } else {
        window.location.href = await summaryHref(run.email, run, profile.name);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSendingId(undefined);
    }
  }

  function contact(run: RunSummary) {
    if (!run.email) return;
    if (!mailAvailable) {
      window.location.href = contactHref(run.email, run, profile.name);
      return;
    }
    setContactNote("");
    setContactError("");
    setContactRun(run);
  }

  async function sendContact() {
    if (!contactRun) return;
    setContactBusy(true);
    setContactError("");
    try {
      await postMail(contactRun, "contact", contactNote.trim() || undefined);
      announce(`Messaggio inviato a ${contactRun.email}.`);
      setContactRun(undefined);
    } catch (e) {
      setContactError((e as Error).message);
    } finally {
      setContactBusy(false);
    }
  }

  return (
    <div className={`app ${presentation ? "presentation" : ""}`}>
      <header className="topbar">
        <Link className="brand" href="/" aria-label="BriefFlow home">
          <GitBranch size={25} />
          <span>
            Brief<span>Flow</span>
          </span>
        </Link>
        <div className="workspace-name">
          Backoffice<span>/</span> Richieste ricevute
        </div>
        <div className="header-actions">
          <Link className="site-link" href="/" title="Apri il sito pubblico">
            <ExternalLink size={14} />
            <span>Sito pubblico</span>
          </Link>
          <span className="engine">LangGraph + Jev</span>
          <button
            className="profile-chip"
            onClick={() => setProfileOpen(true)}
            title="Profilo aziendale"
          >
            <SlidersHorizontal size={15} />
            <span>Profilo · {profile.name}</span>
          </button>
          <button
            onClick={() => setPresentation(!presentation)}
            title="Modalità presentazione"
          >
            {presentation ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            <span>{presentation ? "Esci" : "Presenta"}</span>
          </button>
        </div>
      </header>

      <Modal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        title="Profilo aziendale"
        subtitle="Servizi, categorie e criteri usati da Jev."
      >
        {profileError && <p className="error-text">{profileError}</p>}
        <ProfileEditor
          profile={profile}
          onChange={(next) => {
            setProfile(next);
            setProfileOpen(false);
          }}
          onError={setProfileError}
        />
      </Modal>

      <Modal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        title="Simula richiesta"
        subtitle="Simula una richiesta come se arrivasse dal sito dell'azienda: Jev la qualifica passo dopo passo."
      >
        <form
          className="new-request"
          onSubmit={(e) => {
            e.preventDefault();
            startNew();
          }}
        >
          <label className="field brief-label">
            Brief di progetto
            <textarea
              autoFocus
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter")
                  e.currentTarget.form?.requestSubmit();
              }}
              maxLength={12000}
              placeholder="Incolla una richiesta di progetto…"
            />
          </label>
          <div className="brief-meta">
            <span>{brief.length} caratteri</span>
            <span>Massimo 12.000</span>
          </div>
          <label className="field email-field">
            Email di contatto
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
              Obbligatoria, precompilata con un indirizzo di test. Serve per i
              pulsanti «Contatta azienda» e «Invia resoconto».
              {!mailAvailable &&
                " Il servizio email (SMTP) è da configurare: finché non lo è, i pulsanti aprono il tuo programma di posta."}
            </span>
          </label>
          <p className="small">
            Profilo: {profile.name} (v{profile.version}). Si modifica dal
            pulsante Profilo nell&apos;header.
          </p>
          {!liveAvailable && (
            <p className="error-text">
              Live non configurato sul server: servono TYPESAFE_API_KEY e
              DATABASE_URL.
            </p>
          )}
          <div className="modal-actions">
            <button type="button" onClick={() => setNewOpen(false)}>
              Annulla
            </button>
            <button
              className="primary"
              disabled={
                !liveAvailable ||
                busy ||
                brief.trim().length < 15 ||
                !validEmail(email)
              }
            >
              Qualifica richiesta
              <ArrowRight size={15} />
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={actionOpen}
        onClose={() => setDismissedAction(view.interrupt?.id)}
        title="La richiesta attende una persona"
        subtitle="Il checkpoint conserva lo stato: puoi anche rispondere più tardi."
      >
        {view.interrupt?.payload.kind === "manual_review" ? (
          <div className="modal-stack">
            <p>Conferma il percorso della richiesta.</p>
            <div className="modal-actions">
              <button
                disabled={busy}
                onClick={() => stream({ decision: "close" })}
              >
                Chiudi come fuori ambito
              </button>
              <button
                className="primary"
                disabled={busy}
                onClick={() => stream({ decision: "continue" })}
              >
                Prosegui la valutazione
              </button>
            </div>
          </div>
        ) : (
          <form
            className="modal-stack"
            onSubmit={(e) => {
              e.preventDefault();
              stream({ answers: currentAnswers(questions, answers) });
            }}
          >
            {questions.map((id) => (
              <QuestionField
                key={id}
                id={id}
                value={answers[id]}
                onChange={(value) => setAnswers({ ...answers, [id]: value })}
              />
            ))}            <p className="small">
              Le risposte predefinite sono già selezionate: cambiale se serve.
            </p>
            <div className="modal-actions">
              <button className="primary" disabled={busy}>
                Invia e riprendi
                <ArrowRight size={14} />
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        open={cardOpen && !!view.card}
        onClose={() => setCardOpen(false)}
        title="Scheda finale"
        subtitle="Esito strutturato della qualificazione."
        wide
      >
        {view.card && (
          <RunCard
            card={view.card}
            events={events}
            runId={runId}
            onExportJson={() => download(view.card)}
          />
        )}
      </Modal>

      <Modal
        open={!!contactRun}
        onClose={() => setContactRun(undefined)}
        locked={contactBusy}
        title="Contatta azienda"
        subtitle={contactRun ? `Scrivi a ${contactRun.email}` : undefined}
      >
        {contactRun && (
          <form
            className="new-request"
            onSubmit={(e) => {
              e.preventDefault();
              sendContact();
            }}
          >
            <label className="field brief-label">
              Il tuo messaggio (facoltativo)
              <textarea
                autoFocus
                maxLength={500}
                value={contactNote}
                onChange={(e) => setContactNote(e.target.value)}
                placeholder="Es. Possiamo sentirci domani per capire meglio le integrazioni?"
              />
            </label>
            <div className="brief-meta">
              <span>{contactNote.length} caratteri</span>
              <span>Massimo 500</span>
            </div>
            <p className="small">Anteprima dell&apos;email che verrà inviata:</p>
            <pre className="mail-preview">
              {contactLines(
                contactRun.brief,
                contactNote,
                profile.name,
              ).join("\n")}
            </pre>
            {contactError && <p className="error-text">{contactError}</p>}
            <div className="modal-actions">
              <button
                type="button"
                disabled={contactBusy}
                onClick={() => setContactRun(undefined)}
              >
                Annulla
              </button>
              <button className="primary" disabled={contactBusy}>
                {contactBusy ? "Invio in corso…" : "Invia email"}
                <Send size={15} />
              </button>
            </div>
          </form>
        )}
      </Modal>

      <main className="sheet">
        <div className="titlebar">
          <div>
            <h1>Backoffice · richieste ricevute</h1>
            <p>
              Cosa è successo a ogni richiesta, passo dopo passo, e l&apos;esito
              da gestire.
            </p>
          </div>
          <button className="primary" disabled={busy} onClick={openNew}>
            <Plus size={15} />
            Simula richiesta
          </button>
        </div>
        <div className="disclosure">
          <span className={`signal ${view.status}`} />
          <strong aria-live="polite">{statusText[view.status]}</strong>
          <span>Esecuzione live · decisioni Jev reali</span>
          <div className="disclosure-actions">
            {view.interrupt && !actionOpen && !busy && (
              <button
                className="attention"
                onClick={() => setDismissedAction(undefined)}
              >
                Rispondi
              </button>
            )}
            <button
              className="icon-only"
              aria-label={left ? "Nascondi richieste" : "Mostra richieste"}
              onClick={() => setLeft(!left)}
            >
              <PanelLeftClose size={15} />
            </button>
          </div>
        </div>
        {notice && (
          <div className="error-banner notice" role="status">
            <span>{notice}</span>
            <button aria-label="Chiudi messaggio" onClick={() => setNotice("")}>
              <X size={15} />
            </button>
          </div>
        )}
        {error && (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            {runId && (
              <button onClick={recover} disabled={busy}>
                <RefreshCw size={14} />
                Recupera stato
              </button>
            )}
            <button aria-label="Chiudi messaggio" onClick={() => setError("")}>
              <X size={15} />
            </button>
          </div>
        )}
        {view.failure && (
          <div className="error-banner" role="alert">
            <span>
              Errore tecnico:{" "}
              {String(
                view.failure.payload.message || "Esecuzione non completata.",
              )}
            </span>
            {view.failure.payload.retryable === true && (
              <button disabled={busy} onClick={() => stream({ retry: true })}>
                Riprova dal checkpoint
              </button>
            )}
          </div>
        )}
        {recovered && (
          <div className="error-banner notice" role="status">
            <span>
              Esecuzione recuperata: riprendi dal checkpoint salvato. Se il
              server sta ancora lavorando, la protezione impedisce un secondo
              avvio.
            </span>
            <button onClick={() => stream({ retry: true })}>
              Riprendi dal checkpoint
            </button>
          </div>
        )}
        <section className="timeline" aria-label="Cronologia degli eventi">
          <button
            className="timeline-toggle"
            aria-expanded={timelineOpen}
            aria-controls="event-track"
            onClick={() => setTimelineOpen(!timelineOpen)}
          >
            <ChevronDown size={14} className={timelineOpen ? "open" : ""} />
            <strong>Cronologia</strong>
            <span>
              {events.length === 0
                ? "Nessun evento"
                : `${events.length} eventi · ultimo: ${lastEvent}`}
            </span>
          </button>
          {timelineOpen && (
          <div id="event-track" className="event-track">
            {events.length === 0 ? (
              <p className="timeline-empty">
                Premi «Simula richiesta» per seguire le decisioni, un evento
                alla volta.
              </p>
            ) : (
              events
                .slice(-12)
                .reverse()
                .map((event) => (
                  <button
                    className="event-item"
                    key={event.id}
                    onClick={() => {
                      if (event.node) showNode(event.node);
                    }}
                  >
                    <span className="mono">
                      {String(event.seq).padStart(2, "0")}
                    </span>
                    <div>
                      <strong>
                        {event.node
                          ? NODE_LABELS[event.node]
                          : eventLabels[event.type]}
                      </strong>
                      <span>
                        {event.type === "route_selected"
                          ? `${event.payload.label || "Percorso"} → ${NODE_LABELS[event.payload.target as NodeId] || event.payload.target}`
                          : eventLabels[event.type]}
                      </span>
                    </div>
                    <time>
                      {new Date(event.timestamp).toLocaleTimeString("it-IT", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </time>
                  </button>
                ))
            )}
          </div>
          )}
        </section>
        <nav className="mobile-tabs" aria-label="Viste">
          {[
            ["graph", "Grafo"],
            ["runs", "Richieste"],
          ].map(([id, label]) => (
            <button
              key={id}
              aria-current={tab === id ? "page" : undefined}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className={`workbench ${left ? "" : "hide-left"}`}>
          <div
            className={`left-slot ${tab === "runs" ? "mobile-active" : ""}`}
          >
            <ReceivedRequests
              runs={runs}
              activeId={runId}
              busy={busy}
              mailAvailable={mailAvailable}
              sendingId={sendingId}
              cardReady={!!view.card}
              onCard={() => setCardOpen(true)}
              onOpen={openRun}
              onNew={openNew}
              onSummary={sendSummary}
              onContact={contact}
            />
          </div>
          <section
            ref={graphPanel}
            className={`graph-panel ${tab === "graph" ? "mobile-active" : ""}`}
            aria-label="Grafo del percorso"
          >
            <div className="graph-heading">
              <div>
                <GitBranch size={16} />
                <h2>Percorso di qualificazione</h2>
              </div>
              <div className="replay-controls">
                <button
                  disabled={busy || events.length === 0}
                  onClick={togglePlay}
                  aria-label={playing ? "Pausa" : "Riproduci il percorso"}
                >
                  {playing ? <Pause size={14} /> : <Play size={14} />}
                  {playing ? "Pausa" : "Play"}
                </button>
                <button
                  disabled={busy || events.length === 0}
                  onClick={stepReplay}
                  aria-label="Evento successivo"
                >
                  <SkipForward size={14} />
                  Step
                </button>
                {replaying && (
                  <button onClick={stopReplay} aria-label="Esci dal replay">
                    <X size={14} />
                    Fine
                  </button>
                )}
              </div>
              <span>
                {replaying
                  ? `${shown.length} / ${events.length} eventi`
                  : `${events.length} eventi`}
              </span>
            </div>
            <div className="graph-canvas">
              <RunGraph
                events={shown}
                selected={openNode?.id}
                onSelect={showNode}
                onDismiss={() => setOpenNode(undefined)}
              />
            </div>
            <div className="graph-legend">
              <span>
                <i className="legend-line" />
                Percorso attraversato
              </span>
              <span>
                <i />
                In attesa
              </span>
              <span>
                <i className="human" />
                Intervento umano
              </span>
              <span className="legend-hint">Clicca un nodo per i dettagli</span>
            </div>
            {openNode && (
              <NodeDetail
                key={openNode.id}
                node={openNode.id}
                detail={shownView.nodes[openNode.id]}
                anchor={openNode.anchor}
                bounds={openNode.bounds}
                onClose={() => setOpenNode(undefined)}
              />
            )}
          </section>
        </div>
        <footer className="footer">
          <span>
            BriefFlow<span className="footer-dot">·</span>Orchestrazione
            visibile, decisioni verificabili.
          </span>
          <span>LangGraph → Jev → Persona</span>
        </footer>
      </main>
    </div>
  );
}

function ProfileEditor({
  profile,
  onChange,
  onError,
}: {
  profile: CompanyProfile;
  onChange: (p: CompanyProfile) => void;
  onError: (e: string) => void;
}) {
  const [draft, setDraft] = useState(profile);
  return (
    <form
      className="profile-editor"
      onSubmit={(e) => {
        e.preventDefault();
        const result = ProfileSchema.safeParse(draft);
        if (!result.success) {
          onError(
            "Verifica il profilo: almeno due categorie e un campo obbligatorio.",
          );
          return;
        }
        onChange({ ...result.data, version: profile.version + 1 });
        onError("");
      }}
    >
      <label className="field">
        Nome azienda
        <input
          required
          maxLength={120}
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
      </label>
      <label className="field">
        Servizi (uno per riga)
        <textarea
          required
          value={draft.services.join("\n")}
          onChange={(e) =>
            setDraft({ ...draft, services: e.target.value.split("\n") })
          }
        />
      </label>
      <label className="field">
        Categorie (una per riga)
        <textarea
          required
          value={draft.categories.join("\n")}
          onChange={(e) =>
            setDraft({ ...draft, categories: e.target.value.split("\n") })
          }
        />
      </label>
      <label className="field">
        Criteri di compatibilità
        <textarea
          required
          maxLength={2000}
          value={draft.criteria}
          onChange={(e) => setDraft({ ...draft, criteria: e.target.value })}
        />
      </label>
      <fieldset>
        <legend>Informazioni obbligatorie</legend>
        {(Object.keys(QUESTIONS) as FieldId[]).map((id) => (
          <label className="checkbox" key={id}>
            <input
              type="checkbox"
              checked={draft.requiredFields.includes(id)}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  requiredFields: e.target.checked
                    ? [...draft.requiredFields, id]
                    : draft.requiredFields.filter((f) => f !== id),
                })
              }
            />
            {fieldLabels[id]}
          </label>
        ))}
      </fieldset>
      <label className="field">
        Soglia compatibilità
        <input
          type="number"
          min="0"
          max="1"
          step="0.05"
          value={draft.confidenceThreshold}
          onChange={(e) =>
            setDraft({ ...draft, confidenceThreshold: Number(e.target.value) })
          }
        />
      </label>
      <label className="field">
        Soglia presenza
        <input
          type="number"
          min="0"
          max="1"
          step="0.05"
          value={draft.presenceThreshold}
          onChange={(e) =>
            setDraft({ ...draft, presenceThreshold: Number(e.target.value) })
          }
        />
      </label>
      <button type="submit">
        Applica profilo <Check size={14} />
      </button>
      <p className="small">
        Versione attiva: {profile.version}. Applicato alla prossima esecuzione
        live.
      </p>
    </form>
  );
}
