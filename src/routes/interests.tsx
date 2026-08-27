import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { fetchSkills } from "@/lib/community";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/interests")({
  head: () => ({
    meta: [
      { title: "What you want to learn — Kindred" },
      {
        name: "description",
        content:
          "Mark the skills you'd love to learn. When a member offers a class on one of them, Kindred notifies you.",
      },
      { property: "og:title", content: "What you want to learn — Kindred" },
      {
        property: "og:description",
        content: "Get notified when a class you want is offered nearby.",
      },
    ],
  }),
  component: InterestsPage,
});

function InterestsPage() {
  return (
    <AppShell>
      <AuthGate>
        <Interests />
      </AuthGate>
    </AppShell>
  );
}

function Interests() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [custom, setCustom] = useState("");

  const { data: skills = [] } = useQuery({ queryKey: ["skills"], queryFn: fetchSkills });
  const { data: mine = [] } = useQuery({
    queryKey: ["interests", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_interest")
        .select("id, skill_name")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const mineByName = new Map(mine.map((i) => [i.skill_name.toLowerCase(), i]));

  const toggle = useMutation({
    mutationFn: async (skillName: string) => {
      const existing = mineByName.get(skillName.toLowerCase());
      if (existing) {
        const { error } = await supabase.from("class_interest").delete().eq("id", existing.id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from("class_interest")
        .insert({ user_id: user!.id, skill_name: skillName });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["interests"] }),
    onError: () => toast.error("Could not update your interests."),
  });

  const addCustom = useMutation({
    mutationFn: async () => {
      const name = custom.trim().slice(0, 80);
      if (name.length < 2) throw new Error("Enter a skill name");
      await supabase.from("skills").insert({ name }).select().maybeSingle();
      const { error } = await supabase
        .from("class_interest")
        .insert({ user_id: user!.id, skill_name: name });
      if (error && !error.message.includes("duplicate")) throw error;
      setCustom("");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["interests"] });
      queryClient.invalidateQueries({ queryKey: ["skills"] });
      toast.success("Added to your interests.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not add that"),
  });

  const allNames = [
    ...new Set([...skills.map((s) => s.name), ...mine.map((i) => i.skill_name)]),
  ].sort((a, b) => a.localeCompare(b));

  return (
    <>
      <PageHeader
        eyebrow="Interests"
        title="What do you want to learn?"
        subtitle="Tap a skill to follow it. We'll alert you the moment someone offers that class."
      />

      <div className="px-5">
        <div className="flex gap-2">
          <Input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Add something else…"
            maxLength={80}
            className="h-11 rounded-full bg-card"
          />
          <Button
            onClick={() => addCustom.mutate()}
            disabled={addCustom.isPending}
            size="icon"
            className="size-11 shrink-0 rounded-full"
            aria-label="Add interest"
          >
            <Plus className="size-5" />
          </Button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {allNames.map((name) => {
            const active = mineByName.has(name.toLowerCase());
            return (
              <button
                key={name}
                type="button"
                onClick={() => toggle.mutate(name)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:border-primary/50",
                )}
              >
                {active && <Check className="size-3.5" />}
                {name}
              </button>
            );
          })}
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          Following {mine.length} {mine.length === 1 ? "skill" : "skills"}.
        </p>
      </div>
    </>
  );
}
