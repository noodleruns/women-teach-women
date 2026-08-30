import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Copy, UserPlus } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { MemberGate } from "@/components/MemberGate";
import { useAuth } from "@/hooks/useAuth";
import { createInvite, fetchMyInvites, fetchWaitlist, vouchFor } from "@/lib/community";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/invites")({
  head: () => ({
    meta: [
      { title: "Invites & vouching — Kindred" },
      {
        name: "description",
        content:
          "Kindred grows friend of a friend. Create invite codes for women you know and vouch for someone waiting to join.",
      },
      { property: "og:title", content: "Invites & vouching — Kindred" },
      {
        property: "og:description",
        content: "Create invite codes and vouch for women on the Kindred waitlist.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InvitesPage,
});

function InvitesPage() {
  return (
    <AppShell>
      <AuthGate>
        <MemberGate>
          <Invites />
        </MemberGate>
      </AuthGate>
    </AppShell>
  );
}

function Invites() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const { data: invites = [] } = useQuery({
    queryKey: ["invites", user?.id],
    enabled: !!user,
    queryFn: () => fetchMyInvites(user!.id),
  });

  const { data: waitlist = [] } = useQuery({
    queryKey: ["waitlist"],
    enabled: !!user,
    queryFn: fetchWaitlist,
  });

  const create = useMutation({
    mutationFn: () => createInvite(user!.id, note),
    onSuccess: () => {
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["invites"] });
      toast.success("Invite code created.");
    },
    onError: () => toast.error("Could not create an invite."),
  });

  const vouch = useMutation({
    mutationFn: (candidateId: string) => vouchFor(user!.id, candidateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["waitlist"] });
      toast.success("Vouched — she's in.");
    },
    onError: () => toast.error("Could not vouch right now."),
  });

  function inviteLink(code: string) {
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    return `${origin}/join/${code}`;
  }

  async function copy(code: string) {
    const link = inviteLink(code);
    try {
      await navigator.clipboard.writeText(link);
      setCopied(code);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error(`Copy failed — share this link instead: ${link}`);
    }
  }

  async function share(code: string) {
    const link = inviteLink(code);
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({
          title: "You're invited to Kindred",
          text: "Join me on Kindred — a circle of women sharing skills.",
          url: link,
        });
        return;
      } catch {
        /* fall through to copy */
      }
    }
    void copy(code);
  }

  const open = invites.filter((i) => !i.claimed_by);
  const used = invites.filter((i) => i.claimed_by);

  return (
    <>
      <PageHeader
        eyebrow="Friend of a friend"
        title="Invites"
        subtitle="Kindred only grows through people we know. Send a link to a woman you'd happily sit next to."
      />


      <form
        className="space-y-3 px-5"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="note">Who is this for? (just for you)</Label>
          <Input
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Maya from book club"
            maxLength={80}
            className="h-12 rounded-xl bg-card"
          />
        </div>
        <Button
          type="submit"
          disabled={create.isPending}
          className="h-12 w-full rounded-full text-base"
        >
          {create.isPending ? "Creating…" : "Create invite link"}
        </Button>
      </form>

      <section className="mt-8 px-5">
        <h2 className="text-lg text-foreground">Unclaimed links</h2>
        {open.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No open invites yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {open.map((invite) => (
              <li
                key={invite.id}
                className="space-y-2 rounded-2xl border border-border bg-card p-3"
              >
                <div>
                  <p className="break-all font-mono text-xs text-foreground">
                    {inviteLink(invite.code)}
                  </p>
                  {invite.note && (
                    <p className="mt-1 text-xs text-muted-foreground">For {invite.note}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 rounded-full"
                    onClick={() => share(invite.code)}
                  >
                    <Share2 className="size-4" />
                    Share link
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => copy(invite.code)}
                  >
                    {copied === invite.code ? (
                      <Check className="size-4" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                    {copied === invite.code ? "Copied" : "Copy"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>


      {used.length > 0 && (
        <section className="mt-8 px-5">
          <h2 className="text-lg text-foreground">Already used</h2>
          <ul className="mt-3 space-y-2">
            {used.map((invite) => (
              <li key={invite.id} className="rounded-2xl border border-border bg-muted/40 p-3">
                <p className="font-mono text-sm tracking-[0.2em] text-muted-foreground line-through">
                  {invite.code}
                </p>
                <p className="text-xs text-muted-foreground">
                  Claimed{invite.note ? ` — ${invite.note}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10 px-5">
        <h2 className="text-lg text-foreground">Waiting to join</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Vouch for someone you know and she becomes a full member right away.
        </p>
        {waitlist.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nobody is waiting right now.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {waitlist.map((person) => (
              <li
                key={person.id}
                className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-card p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {person.display_name || "New member"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {person.zip_code ? `Zip ${person.zip_code}` : "No zip code yet"}
                  </p>
                  {person.bio && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{person.bio}</p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  className="rounded-full"
                  disabled={vouch.isPending}
                  onClick={() => vouch.mutate(person.id)}
                >
                  <UserPlus className="size-4" />
                  Vouch
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
