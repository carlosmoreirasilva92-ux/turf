import { createFileRoute } from "@tanstack/react-router";
import { LiveList } from "@/components/live-list";

export const Route = createFileRoute("/corridas")({ component: Corridas });

function Corridas() {
  return <LiveList title="Corridas de hoje" />;
}
