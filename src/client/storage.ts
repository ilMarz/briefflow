const RUN_KEY = "briefflow.runs";

/** Ids of the requests started from this browser (the list endpoint never enumerates the database in production). */
export function storedRunIds(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RUN_KEY) || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((id) => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

export function rememberRun(id: string) {
  try {
    const ids = storedRunIds();
    if (!ids.includes(id))
      localStorage.setItem(RUN_KEY, JSON.stringify([id, ...ids].slice(0, 50)));
  } catch {}
}
