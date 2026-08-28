import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { fetchMyProfile, formatWhen, type ClassRow } from "@/lib/community";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — Kindred" },
      {
        name: "description",
        content:
          "Update your Kindred profile, the skills you can teach, your zip code, and review the classes you're teaching or attending.",
      },
      { property: "og:title", content: "Your profile — Kindred" },
      { property: "og:description", content: "Manage your Kindred profile and classes." },
    ],
  }),
  component: ProfilePage,
});

const schema = z.object({
  display_name: z.string().trim().min(1, "Add a name").max(60),
  bio: z.string().trim().max(500),
  zip_code: z.string().trim().regex(/^\d{5}$/, "Enter a 5-digit zip code"),
});

function ProfilePage() {
  return (
    <AppShell>
      <AuthGate>
        <Profile />
      </AuthGate>
    </AppShell>
  );
}

function Profile() {
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ display_name: "", bio: "", zip_code: "", teaches: "" });

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: () => fetchMyProfile(user!.id),
  });

  useEffect(() => {
    if (profile) {
      setForm({
        display_name: profile.display_name,
        bio: profile.bio,
        zip_code: profile.zip_code,
        teaches: (profile.teaches ?? []).join(", "),
      });
    }
  }, [profile]);

  const { data: teaching = [] } = useQuery({
    queryKey: ["myTeaching", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("classes")
        .select("*")
        .eq("teacher_id", user!.id)
        .order("created_at", { ascending: false });
      return (data ?? []) as ClassRow[];
    },
  });

  const { data: attending = [] } = useQuery({
    queryKey: ["myAttending", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: signups } = await supabase
        .from("signups")
        .select("class_id")
        .eq("user_id", user!.id);
      const ids = (signups ?? []).map((s) => s.class_id);
      if (ids.length === 0) return [] as ClassRow[];
      const { data } = await supabase.from("classes").select("*").in("id", ids);
      return (data ?? []) as ClassRow[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const parsed = schema.parse(form);
      const teaches = form.teaches
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 20);
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: user!.id, ...parsed, teaches });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Profile saved.");
    },
    onError: (err) =>
      toast.error(
        err instanceof z.ZodError
          ? (err.issues[0]?.message ?? "Check your details")
          : "Could not save profile",
      ),
  });

  return (
    <>
      <PageHeader eyebrow="You" title="Your profile" subtitle={user?.email ?? ""} />

      <form
        className="space-y-4 px-5"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={form.display_name}
            onChange={(e) => setForm({ ...form, display_name: e.target.value })}
            maxLength={60}
            className="h-12 rounded-xl bg-card"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="zip">Zip code</Label>
          <Input
            id="zip"
            inputMode="numeric"
            value={form.zip_code}
            onChange={(e) =>
              setForm({ ...form, zip_code: e.target.value.replace(/\D/g, "").slice(0, 5) })
            }
            placeholder="94110"
            className="h-12 rounded-xl bg-card"
          />
          <p className="text-xs text-muted-foreground">
            We only use your zip code to show nearby classes — never a full address.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bio">Short bio</Label>
          <Textarea
            id="bio"
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            rows={3}
            maxLength={500}
            className="rounded-xl bg-card"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="teaches">Skills you could teach</Label>
          <Input
            id="teaches"
            value={form.teaches}
            onChange={(e) => setForm({ ...form, teaches: e.target.value })}
            placeholder="Bread baking, watercolor, resume writing"
            maxLength={300}
            className="h-12 rounded-xl bg-card"
          />
        </div>
        <Button type="submit" disabled={save.isPending} className="h-12 w-full rounded-full">
          {save.isPending ? "Saving…" : "Save profile"}
        </Button>
      </form>

      <ClassList title="Classes you're teaching" classes={teaching} empty="Nothing posted yet." />
      <ClassList
        title="Classes you're attending"
        classes={attending}
        empty="You haven't signed up for a class yet."
      />

      <div className="space-y-3 px-5 pt-8">
        <Button asChild className="h-11 w-full rounded-full">
          <Link to="/invites">Invites &amp; vouching</Link>
        </Button>
        <Button variant="outline" onClick={signOut} className="h-11 w-full rounded-full">
          Sign out
        </Button>
      </div>
    </>
  );
}

function ClassList({
  title,
  classes,
  empty,
}: {
  title: string;
  classes: ClassRow[];
  empty: string;
}) {
  return (
    <section className="mt-8 px-5">
      <h2 className="text-lg text-foreground">{title}</h2>
      {classes.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {classes.map((c) => (
            <li key={c.id}>
              <Link
                to="/classes/$classId"
                params={{ classId: c.id }}
                className="block rounded-2xl border border-border bg-card p-3"
              >
                <p className="text-sm font-semibold text-foreground">{c.title}</p>
                <p className="text-xs text-muted-foreground">{formatWhen(c.starts_at)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
