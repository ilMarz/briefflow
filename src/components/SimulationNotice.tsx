import { Info } from "lucide-react";

/** Says plainly that this is a demo: nothing real is sent and the outcome lives in the backoffice. */
export default function SimulationNotice({
  mailAvailable,
}: {
  mailAvailable: boolean;
}) {
  return (
    <div className="sim-notice" role="note">
      <Info size={16} aria-hidden />
      <p>
        <strong>Questa è solo una simulazione.</strong>{" "}
        {!mailAvailable &&
          "Il servizio email (SMTP) è da configurare: non verrà inviata nessuna email. "}
        I risultati sono visibili nel{" "}
        <a href="/backoffice" target="_blank" rel="noopener noreferrer">
          backoffice
        </a>
        .
      </p>
    </div>
  );
}