export default function LimitReached() {
  return (
    <main
      role="alert"
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        textAlign: "center",
      }}
    >
      <div style={{ maxWidth: "32rem" }}>
        <h1 style={{ fontSize: "1.75rem", marginBottom: "0.75rem" }}>
          Limite Jev raggiunto
        </h1>
        <p>
          Il limite di utilizzo di Jev per questa demo è stato raggiunto.
          BriefFlow non è al momento disponibile. Riprova più tardi.
        </p>
      </div>
    </main>
  );
}
