import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <p className="px-5 pt-10 text-sm text-muted-foreground">Loading…</p>;
  }

  if (!user) {
    return (
      <div className="px-5 pt-16 text-center">
        <h1 className="text-3xl leading-tight text-foreground">Join the circle</h1>
        <p className="mx-auto mt-3 max-w-xs text-sm text-muted-foreground">
          Kindred is a members-only community of women sharing what they know. Sign in to browse and
          offer classes.
        </p>
        <Button asChild className="mt-6 h-12 w-full rounded-full text-base">
          <Link to="/auth">Sign in or create account</Link>
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
