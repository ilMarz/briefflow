import type { Metadata } from "next";
import BriefFlow from "../../components/BriefFlow";
import LimitReached from "../../components/LimitReached";
import { jevLimitReached } from "../../server/limit";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "BriefFlow — Backoffice",
  description: "Richieste ricevute, percorso di qualificazione e schede finali.",
};

export default function Page() {
  return jevLimitReached() ? <LimitReached /> : <BriefFlow />;
}