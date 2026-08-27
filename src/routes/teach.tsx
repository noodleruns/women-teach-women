import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { fetchMyProfile, fetchSkills } from "@/lib/community";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/teach")({
  head: () => ({
    meta: [
      { title: "Offer a class — Kindred" },
      {
        name: "description",
        content:
          "Share a skill with your community: post a free or paid in-person class, set a date, capacity and zip code.",
      },
      { property: "og:title", content: "Offer a class — Kindred" },
      {
        property: "og:description",
        content: "Post a small in-person class and teach what you know.",
      },
    ],
  }),
  component: TeachPage,
});

const schema = z.object({
  title: z.string().trim().min(4, "Give your class a title").max(120),
  skill_name: z.string().trim().min(2, "What skill is this?").max(80),
  description: z.string().trim().max(1500),
  zip_code: z.string().trim().regex(/^\d{5}$/, "Enter a 5-digit zip code"),
  capacity: z.coerce.number().int().min(1).max(200),
  starts_at: z.string().optional(),
  price: z.coerce.number().min(0).max(2000),
});

function TeachPage() {
  return (
    <AppShell>
      <AuthGate>
        <TeachForm />
      </AuthGate>
    </AppShell>
  );
}

function TeachForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: skills = [] } = useQuery({ queryKey: ["skills"], queryFn: fetchSkills });
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: () => fetchMyProfile(user!.id),
  });

  const [form, setForm] = useState({
    title: "",
    skill_name: "",
    description: "",
    zip_code: "",
    capacity: "8",
    starts_at: "",
    price: "0",
  });
  const [isFree, setIsFree] = useState(true);

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const create = useMutation({
    mutationFn: async () => {
      const parsed = schema.parse({
        ...form,
        zip_code: form.zip_code || profile?.zip_code || "",
      });
      const { data, error } = await supabase
        .from("classes")
        .insert({
          teacher_id: user!.id,
          title: parsed.title,
          skill_name: parsed.skill_name,
          description: parsed.description,
          zip_code: parsed.zip_code,
          capacity: parsed.capacity,
          starts_at: parsed.starts_at ? new Date(parsed.starts_at).toISOString() : null,
          is_free: isFree,
          price_cents: isFree ? 0 : Math.round(parsed.price * 100),
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      toast.success("Class posted — interested members were notified.");
      navigate({ to: "/classes/$classId", params: { classId: data.id } });
    },
    onError: (err) => {
      const message =
        err instanceof z.ZodError
          ? (err.issues[0]?.message ?? "Check the form")
          : err instanceof Error
            ? err.message
            : "Could not post class";
      toast.error(message);
    },
  });

  return (
    <>
      <PageHeader
        eyebrow="Teach"
        title="Offer a class"
        subtitle="Keep it simple — one skill, one session. You can always add more later."
      />
      <form
        className="space-y-5 px-5"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="title">Class title</Label>
          <Input
            id="title"
            value={form.title}
            onChange={(e) => set("title")(e.target.value)}
            placeholder="Sourdough starter, start to finish"
            maxLength={120}
            className="h-12 rounded-xl bg-card"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="skill">Skill or topic</Label>
          <Input
            id="skill"
            list="skill-options"
            value={form.skill_name}
            onChange={(e) => set("skill_name")(e.target.value)}
            placeholder="Bread baking"
            maxLength={80}
            className="h-12 rounded-xl bg-card"
          />
          <datalist id="skill-options">
            {skills.map((s) => (
              <option key={s.id} value={s.name} />
            ))}
          </datalist>
          <p className="text-xs text-muted-foreground">
            Members who marked interest in this skill get notified right away.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description">What will you cover?</Label>
          <Textarea
            id="description"
            value={form.description}
            onChange={(e) => set("description")(e.target.value)}
            rows={4}
            maxLength={1500}
            className="rounded-xl bg-card"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="zip">Zip code</Label>
            <Input
              id="zip"
              inputMode="numeric"
              value={form.zip_code}
              onChange={(e) => set("zip_code")(e.target.value.replace(/\D/g, "").slice(0, 5))}
              placeholder={profile?.zip_code || "94110"}
              className="h-12 rounded-xl bg-card"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="capacity">Spots</Label>
            <Input
              id="capacity"
              inputMode="numeric"
              value={form.capacity}
              onChange={(e) => set("capacity")(e.target.value.replace(/\D/g, "").slice(0, 3))}
              className="h-12 rounded-xl bg-card"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="starts">Date & time (optional)</Label>
          <Input
            id="starts"
            type="datetime-local"
            value={form.starts_at}
            onChange={(e) => set("starts_at")(e.target.value)}
            className="h-12 rounded-xl bg-card"
          />
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Free class</p>
              <p className="text-xs text-muted-foreground">Turn off to charge a fee</p>
            </div>
            <Switch checked={isFree} onCheckedChange={setIsFree} />
          </div>
          {!isFree && (
            <div className="mt-4 space-y-1.5">
              <Label htmlFor="price">Price per person (USD)</Label>
              <Input
                id="price"
                inputMode="decimal"
                value={form.price}
                onChange={(e) => set("price")(e.target.value.replace(/[^\d.]/g, "").slice(0, 7))}
                className="h-12 rounded-xl bg-background"
              />
              <p className="text-xs text-muted-foreground">
                Collect payment in person for now — online payments can come later.
              </p>
            </div>
          )}
        </div>

        <Button
          type="submit"
          disabled={create.isPending}
          className="h-12 w-full rounded-full text-base"
        >
          {create.isPending ? "Posting…" : "Post class"}
        </Button>
      </form>
    </>
  );
}
