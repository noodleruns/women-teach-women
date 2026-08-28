import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { claimInvite, fetchMembership } from "@/lib/community";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const messages: Record<string, string> = {
  invalid: "We don't recognize that code.",
  already_used: "That invite has already been claimed.",
  own_code: "That's your own invite code.",
  unauthenticated: "Please sign in again.",
};

/** Wrap member-only surfaces. Waitlisted women see the waitlist screen instead. */
export function MemberGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");

  const { data: membership, isLoading } = useQuery({
    queryKey: ["membership", user?.id],
    enabled: !!user,
    queryFn: () => fetchMembership(user!.id),
  });

  const claim = useMutation({
    mutationFn: () => claimInvite(code),
    onSuccess: (result) => {
      if (result === "ok") {
        toast.success("You're in — welcome to Kindred.");
        queryClient.invalidateQueries();
      } else {
        toast.error(messages[result] ?? "Could not use that code.");
      }
    },
    onError: () => toast.error("Could not use that code."),
  });

  if (isLoading || !membership) {
    return <p className="px-5 pt-10 text-sm text-muted-foreground">Loading…</p>;
  }

  if (membership.status === "member") return <>{children}</>;

  return (
    <div className="px-5 pt-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Waitlist</p>
      <h1 className="mt-1 text-3xl leading-tight text-foreground">You're on the list</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Kindred grows friend of a friend. You can join right now with an invite code from a member —
        or sit tight until someone in the circle vouches for you.
      </p>

      <form
        className="mt-6 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim()) claim.mutate();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="invite-code">Invite code</Label>
          <Input
            id="invite-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 12))}
            placeholder="ABC-123"
            autoCapitalize="characters"
            className="h-12 rounded-xl bg-card tracking-[0.2em]"
          />
        </div>
        <Button
          type="submit"
          disabled={claim.isPending || !code.trim()}
          className="h-12 w-full rounded-full text-base"
        >
          {claim.isPending ? "Checking…" : "Join with invite"}
        </Button>
      </form>

      <div className="mt-8 rounded-2xl border border-border bg-card p-4">
        <h2 className="text-base text-foreground">Waiting to be vouched for?</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Fill in your name, zip code and a short bio on your profile — members browse the waitlist
          and are far more likely to vouch for someone they recognize.
        </p>
      </div>
    </div>
  );
}
