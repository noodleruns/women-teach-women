import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { claimInvite } from "@/lib/community";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/hero-women.jpg";

export const PENDING_INVITE_KEY = "kindred.pendingInvite";

const messages: Record<string, string> = {
  invalid: "We don't recognize that invite link.",
  already_used: "That invite link has already been used.",
  own_code: "That's your own invite link.",
  unauthenticated: "Please sign in again.",
};

export const Route = createFileRoute("/join/$code")({
  head: () => ({
    meta: [
      { title: "You're invited to Kindred" },
      {
        name: "description",
        content:
          "A friend invited you to Kindred, a members-only community of women sharing skills and teaching simple classes.",
      },
      { property: "og:title", content: "You're invited to Kindred" },
      {
        property: "og:description",
        content: "Accept your invite and join a circle of women teaching and learning together.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JoinPage,
});

function JoinPage() {
  const { code } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const attempted = useRef(false);
  const [status, setStatus] = useState<"idle" | "claiming" | "error">("idle");

  useEffect(() => {
    if (loading || attempted.current) return;
    if (!user) {
      try {
        sessionStorage.setItem(PENDING_INVITE_KEY, code);
      } catch {
        /* ignore */
      }
      return;
    }
    attempted.current = true;
    setStatus("claiming");
    claimInvite(code)
      .then((result) => {
        if (result === "ok") {
          try {
            sessionStorage.removeItem(PENDING_INVITE_KEY);
          } catch {
            /* ignore */
          }
          queryClient.invalidateQueries();
          toast.success("You're in — welcome to Kindred.");
          navigate({ to: "/" });
        } else {
          setStatus("error");
          toast.error(messages[result] ?? "Could not use that invite link.");
        }
      })
      .catch(() => {
        setStatus("error");
        toast.error("Could not use that invite link.");
      });
  }, [loading, user, code, navigate, queryClient]);

  return (
    <AppShell>
      <div className="px-5 pt-8 text-center">
        <img
          src={heroImage}
          alt="A group of happy women crafting together with drinks at a workshop"
          width={1536}
          height={1024}
          className="w-full rounded-3xl object-cover shadow-md"
          style={{ aspectRatio: "3 / 2" }}
        />
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Friend of a friend
        </p>
        <h1 className="mt-1 text-3xl leading-tight text-foreground">You're invited to Kindred</h1>
        <p className="mx-auto mt-3 max-w-xs text-sm text-muted-foreground">
          Invite code <span className="font-mono tracking-[0.2em] text-foreground">{code}</span>
        </p>

        {!user ? (
          <>
            <p className="mx-auto mt-3 max-w-xs text-sm text-muted-foreground">
              Create your account and we'll apply this invite automatically.
            </p>
            <Button asChild className="mt-6 h-12 w-full rounded-full text-base">
              <Link to="/auth">Sign in or create account</Link>
            </Button>
          </>
        ) : status === "error" ? (
          <>
            <p className="mx-auto mt-3 max-w-xs text-sm text-muted-foreground">
              This link couldn't be used. Ask your friend for a fresh invite.
            </p>
            <Button asChild variant="outline" className="mt-6 h-12 w-full rounded-full text-base">
              <Link to="/">Browse Kindred</Link>
            </Button>
          </>
        ) : (
          <p className="mt-6 text-sm text-muted-foreground">Applying your invite…</p>
        )}
      </div>
    </AppShell>
  );
}
