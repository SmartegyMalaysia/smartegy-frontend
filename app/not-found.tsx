import Link from "next/link";
import { EmptyState } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="page-content">
      <EmptyState
        title="Page not found"
        description="The page you’re looking for doesn’t exist or may have moved."
        action={<Link className="button button-secondary" href="/dashboard">Return to dashboard</Link>}
      />
    </main>
  );
}
