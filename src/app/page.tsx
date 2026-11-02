import type { Metadata } from "next";
import LimitReached from "../components/LimitReached";
import PublicSite from "../components/PublicSite";
import { jevLimitReached } from "../server/limit";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "ACME IT — Invia una richiesta",
  description:
    "Applicazioni aziendali, portali web e integrazioni software. Descrivi il tuo progetto e ricevi un riscontro.",
};

export default function Page() {
  return jevLimitReached() ? <LimitReached /> : <PublicSite />;
}