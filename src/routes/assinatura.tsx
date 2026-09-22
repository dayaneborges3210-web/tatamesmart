import { Navigate, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/assinatura")({ component: AssinaturaPage });

function AssinaturaPage() {
  return <Navigate to="/" />;
}
