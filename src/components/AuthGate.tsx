import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/hero-women.jpg";

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <p className="px-5 pt-10 text-sm text-muted-foreground">Loading…</p>;
  }

  if (!user) {
    return (
      <div className="px-5 pt-8 text-center">
        <img
          src={heroImage}
          alt="A group of happy women crafting together with drinks at a workshop"
          width={1536}
          height={1024}
          className="w-full rounded-3xl object-cover shadow-md"
          style={{ aspectRatio: "3 / 2" }}
        />
        <h1 className="mt-6 text-3xl leading-tight text-foreground">Join the circle</h1>
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
