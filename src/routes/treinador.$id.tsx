import { createFileRoute } from "@tanstack/react-router";
import { Person } from "@/components/person";

export const Route = createFileRoute("/treinador/$id")({
  component: function Treinador() {
    const { id } = Route.useParams();
    return <Person id={id} back="/treinadores" backLabel="Treinadores" />;
  },
});
