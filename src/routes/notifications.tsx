import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BellOff } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Your alerts — Kindred" },
      {
        name: "description",
        content:
          "Alerts about newly scheduled classes on the skills you follow, so you can grab a spot early.",
      },
      { property: "og:title", content: "Your alerts — Kindred" },
      { property: "og:description", content: "See new classes on the skills you follow." },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  return (
    <AppShell>
      <AuthGate>
        <Notifications />
      </AuthGate>
    </AppShell>
  );
}

function Notifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    const unread = items.filter((i) => !i.read_at).map((i) => i.id);
    if (unread.length === 0) return;
    supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .in("id", unread)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["unread"] });
      });
  }, [items, queryClient]);

  return (
    <>
      <PageHeader
        eyebrow="Alerts"
        title="New for you"
        subtitle="We ping you here whenever a class matches a skill you follow."
      />
      <div className="space-y-3 px-5">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
            <BellOff className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              Nothing yet. Follow a few skills under{" "}
              <Link to="/interests" className="font-semibold text-primary underline">
                Interests
              </Link>{" "}
              to start getting alerts.
            </p>
          </div>
        )}
        {items.map((n) => {
          const body = (
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-semibold text-foreground">{n.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {new Date(n.created_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
          );
          return n.class_id ? (
            <Link key={n.id} to="/classes/$classId" params={{ classId: n.class_id }} className="block">
              {body}
            </Link>
          ) : (
            <div key={n.id}>{body}</div>
          );
        })}
      </div>
    </>
  );
}
