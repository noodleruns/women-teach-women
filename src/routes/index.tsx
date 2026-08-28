import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { MapPin, Users, Clock, Search } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { MemberGate } from "@/components/MemberGate";
import { fetchUpcomingClasses, formatPrice, formatWhen } from "@/lib/community";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Browse classes — Kindred" },
      {
        name: "description",
        content:
          "Browse small in-person classes taught by women in your community, from bread baking to personal finance. Filter by skill or zip code.",
      },
      { property: "og:title", content: "Browse classes — Kindred" },
      {
        property: "og:description",
        content: "Small in-person classes taught by women in your neighborhood.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <AppShell>
      <AuthGate>
        <MemberGate>
          <ClassFeed />
        </MemberGate>
      </AuthGate>
    </AppShell>
  );
}

function ClassFeed() {
  const [q, setQ] = useState("");
  const { data: classes = [], isLoading } = useQuery({
    queryKey: ["classes"],
    queryFn: fetchUpcomingClasses,
  });

  const term = q.trim().toLowerCase();
  const filtered = classes.filter((c) =>
    !term
      ? true
      : [c.title, c.skill_name, c.zip_code, c.teacher?.display_name ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(term),
  );

  return (
    <>
      <PageHeader
        eyebrow="Kindred"
        title="Classes near you"
        subtitle="Small, in-person sessions taught by women in your community."
      />

      <div className="px-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search skill, teacher or zip code"
            className="h-11 rounded-full bg-card pl-9"
            maxLength={80}
          />
        </div>
      </div>

      <div className="mt-5 space-y-3 px-5">
        {isLoading && <p className="text-sm text-muted-foreground">Loading classes…</p>}
        {!isLoading && filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">
              No classes yet. Be the first to{" "}
              <Link to="/teach" className="font-semibold text-primary underline">
                offer one
              </Link>
              , or add the skills you want to learn under Interests.
            </p>
          </div>
        )}
        {filtered.map((c) => (
          <Link
            key={c.id}
            to="/classes/$classId"
            params={{ classId: c.id }}
            className="block rounded-2xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <Badge variant="secondary" className="rounded-full">
                  {c.skill_name}
                </Badge>
                <h2 className="mt-2 text-lg leading-snug text-foreground">{c.title}</h2>
              </div>
              <span className="shrink-0 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                {formatPrice(c)}
              </span>
            </div>
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5" /> {formatWhen(c.starts_at)}
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" /> {c.zip_code}
              </span>
              <span className="inline-flex items-center gap-1">
                <Users className="size-3.5" /> {c.signupCount}/{c.capacity}
              </span>
            </div>
            {c.teacher && (
              <p className="mt-3 text-xs font-medium text-foreground">
                with {c.teacher.display_name || "a member"}
              </p>
            )}
          </Link>
        ))}
      </div>
    </>
  );
}
