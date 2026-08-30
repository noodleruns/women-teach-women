import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Clock, MapPin, Users, Video } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { MemberGate } from "@/components/MemberGate";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { fetchClass, formatPrice, formatWhen, isGauging, scheduleClass } from "@/lib/community";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const gauging = isGauging(cls);
  const full = cls.signupCount >= cls.capacity && !mySignup;

  return (
    <div className="px-5 pt-6">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="size-4" /> All classes
      </Link>

      <div className="mt-5 flex flex-wrap gap-1.5">
        <Badge variant="secondary" className="rounded-full">
          {cls.skill_name}
        </Badge>
        {gauging && (
          <Badge className="rounded-full bg-accent text-accent-foreground">Interest list</Badge>
        )}
      </div>
      <h1 className="mt-2 text-3xl leading-tight text-foreground">{cls.title}</h1>
      <p className="mt-1 text-lg font-semibold text-primary">{formatPrice(cls)}</p>

      <div className="mt-5 space-y-2 rounded-2xl border border-border bg-card p-4 text-sm">
        <p className="flex items-center gap-2">
          <Clock className="size-4 text-primary" />{" "}
          {gauging
            ? "Date to be scheduled once enough women are interested"
            : `${formatWhen(cls.starts_at)} · ${cls.duration_minutes} min`}
        </p>
        {cls.format === "online" ? (
          <p className="flex items-center gap-2">
            <Video className="size-4 text-primary" /> Online — link shared with attendees
          </p>
        ) : (
          <p className="flex items-center gap-2">
            <MapPin className="size-4 text-primary" /> Zip {cls.zip_code} — exact address shared
            with attendees
          </p>
        )}
        <p className="flex items-center gap-2">
          <Users className="size-4 text-primary" /> {cls.signupCount}{" "}
          {gauging
            ? `interested · ${cls.capacity} spots planned`
            : `of ${cls.capacity} spots taken`}
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
          gauging ? (
            <ScheduleForm cls={cls} />
          ) : (
            <p className="rounded-2xl bg-muted p-4 text-center text-sm text-muted-foreground">
              You're teaching this class.
            </p>
          )
        ) : (
          <Button
            onClick={() => toggleSignup.mutate()}
            disabled={toggleSignup.isPending || (!gauging && full)}
            variant={mySignup ? "outline" : "default"}
            className="h-12 w-full rounded-full text-base"
          >
            {gauging
              ? mySignup
                ? "Remove my interest"
                : "I'm interested"
              : mySignup
                ? "Cancel my spot"
                : full
                  ? "Class is full"
                  : "Sign up"}
          </Button>
        )}
        {gauging && !isTeacher && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            No date yet — you'll be notified when {cls.teacher?.display_name || "the teacher"}{" "}
            schedules it.
          </p>
        )}
      </div>
    </div>
  );
}

/** Teacher picks a date and turns an interest list into a real class. */
function ScheduleForm({ cls }: { cls: NonNullable<Awaited<ReturnType<typeof fetchClass>>> }) {
  const queryClient = useQueryClient();
  const [startsAt, setStartsAt] = useState("");
  const [meetingUrl, setMeetingUrl] = useState(cls.meeting_url ?? "");
  const [zip, setZip] = useState(cls.zip_code ?? "");

  const publish = useMutation({
    mutationFn: async () => {
      if (!startsAt) throw new Error("Pick a date and time");
      if (cls.format === "in_person" && !/^\d{5}$/.test(zip)) {
        throw new Error("Enter a 5-digit zip code");
      }
      await scheduleClass(cls.id, {
        starts_at: startsAt,
        ...(cls.format === "online" ? { meeting_url: meetingUrl } : { zip_code: zip }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["class", cls.id] });
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      toast.success("Scheduled — interested members can now sign up.");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not schedule this class"),
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-sm font-semibold text-foreground">
        {cls.signupCount} {cls.signupCount === 1 ? "woman is" : "women are"} interested
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Ready to run it? Pick a date and everyone on the list gets notified.
      </p>
      <div className="mt-4 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="schedule-when">Date & time</Label>
          <Input
            id="schedule-when"
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className="h-12 rounded-xl bg-background"
          />
        </div>
        {cls.format === "online" ? (
          <div className="space-y-1.5">
            <Label htmlFor="schedule-link">Meeting link</Label>
            <Input
              id="schedule-link"
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              placeholder="Zoom or Meet link"
              maxLength={500}
              className="h-12 rounded-xl bg-background"
            />
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="schedule-zip">Zip code</Label>
            <Input
              id="schedule-zip"
              inputMode="numeric"
              value={zip}
              onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
              className="h-12 rounded-xl bg-background"
            />
          </div>
        )}
        <Button
          onClick={() => publish.mutate()}
          disabled={publish.isPending}
          className="h-12 w-full rounded-full text-base"
        >
          {publish.isPending ? "Scheduling…" : "Schedule the class"}
        </Button>
      </div>
    </div>
  );
}
