import { createFileRoute } from "@tanstack/react-router";
import { Person } from "@/components/person";

export const Route = createFileRoute("/joquei/$id")({
  component: function Joquei() {
    const { id } = Route.useParams();
    return <Person id={id} back="/joqueis" backLabel="Jóqueis" />;
  },
});
