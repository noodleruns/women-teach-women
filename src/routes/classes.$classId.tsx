import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Clock, MapPin, Users } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { MemberGate } from "@/components/MemberGate";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { fetchClass, formatPrice, formatWhen } from "@/lib/community";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/classes/$classId")({
  head: () => ({
    meta: [
      { title: "Class details — Kindred" },
      {
        name: "description",
        content:
          "See what this Kindred class covers, when and where it meets, who is teaching, and reserve your spot.",
      },
      { property: "og:title", content: "Class details — Kindred" },
      { property: "og:description", content: "Reserve your spot in this community class." },
    ],
  }),
  component: ClassDetailPage,
});

function ClassDetailPage() {
  return (
    <AppShell>
      <AuthGate>
          <MemberGate>
            <ClassDetail />
          </MemberGate>
        </AuthGate>
    </AppShell>
  );
}

function ClassDetail() {
  const { classId } = Route.useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: cls, isLoading } = useQuery({
    queryKey: ["class", classId],
    queryFn: () => fetchClass(classId),
  });

  const { data: mySignup } = useQuery({
    queryKey: ["signup", classId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("signups")
        .select("id")
        .eq("class_id", classId)
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const toggleSignup = useMutation({
    mutationFn: async () => {
      if (mySignup) {
        const { error } = await supabase.from("signups").delete().eq("id", mySignup.id);
        if (error) throw error;
        return "left";
      }
      const { error } = await supabase
        .from("signups")
        .insert({ class_id: classId, user_id: user!.id });
      if (error) throw error;
      return "joined";
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["signup", classId] });
      queryClient.invalidateQueries({ queryKey: ["class", classId] });
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      toast.success(result === "joined" ? "You're signed up!" : "Spot released.");
    },
    onError: () => toast.error("Could not update your spot. Please try again."),
  });

  if (isLoading) return <p className="px-5 pt-10 text-sm text-muted-foreground">Loading…</p>;
  if (!cls) return <p className="px-5 pt-10 text-sm text-muted-foreground">Class not found.</p>;

  const isTeacher = cls.teacher_id === user?.id;
  const full = cls.signupCount >= cls.capacity && !mySignup;

  return (
    <div className="px-5 pt-6">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="size-4" /> All classes
      </Link>

      <Badge variant="secondary" className="mt-5 rounded-full">
        {cls.skill_name}
      </Badge>
      <h1 className="mt-2 text-3xl leading-tight text-foreground">{cls.title}</h1>
      <p className="mt-1 text-lg font-semibold text-primary">{formatPrice(cls)}</p>

      <div className="mt-5 space-y-2 rounded-2xl border border-border bg-card p-4 text-sm">
        <p className="flex items-center gap-2">
          <Clock className="size-4 text-primary" /> {formatWhen(cls.starts_at)} ·{" "}
          {cls.duration_minutes} min
        </p>
        <p className="flex items-center gap-2">
          <MapPin className="size-4 text-primary" /> Zip {cls.zip_code} — exact address shared with
          attendees
        </p>
        <p className="flex items-center gap-2">
          <Users className="size-4 text-primary" /> {cls.signupCount} of {cls.capacity} spots taken
        </p>
      </div>

      {cls.description && (
        <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-foreground">
          {cls.description}
        </p>
      )}

      {cls.teacher && (
        <div className="mt-6 rounded-2xl border border-border bg-secondary/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-secondary-foreground">
            Your teacher
          </p>
          <p className="mt-1 text-base font-semibold text-foreground">
            {cls.teacher.display_name || "Kindred member"}
          </p>
          {cls.teacher.bio && (
            <p className="mt-1 text-sm text-muted-foreground">{cls.teacher.bio}</p>
          )}
        </div>
      )}

      <div className="mt-8">
        {isTeacher ? (
          <p className="rounded-2xl bg-muted p-4 text-center text-sm text-muted-foreground">
            You're teaching this class.
          </p>
        ) : (
          <Button
            onClick={() => toggleSignup.mutate()}
            disabled={toggleSignup.isPending || full}
            variant={mySignup ? "outline" : "default"}
            className="h-12 w-full rounded-full text-base"
          >
            {mySignup ? "Cancel my spot" : full ? "Class is full" : "Sign up"}
          </Button>
        )}
      </div>
    </div>
  );
}
