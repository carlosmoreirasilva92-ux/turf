import { createFileRoute } from "@tanstack/react-router";
import { LiveList } from "@/components/live-list";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <LiveList variant="hoje" />;
}
