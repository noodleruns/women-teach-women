import { supabase } from "@/integrations/supabase/client";

export type ClassRow = {
  id: string;
  teacher_id: string;
  title: string;
  description: string;
  skill_name: string;
  zip_code: string;
  starts_at: string | null;
  duration_minutes: number;
  is_free: boolean;
  price_cents: number;
  capacity: number;
  status: string;
  created_at: string;
};

export type ProfileRow = {
  id: string;
  display_name: string;
  bio: string;
  zip_code: string;
  avatar_url: string | null;
  teaches: string[];
};

export type ClassWithMeta = ClassRow & {
  teacher: ProfileRow | null;
  signupCount: number;
};

export function formatPrice(row: Pick<ClassRow, "is_free" | "price_cents">) {
  if (row.is_free) return "Free";
  return `$${(row.price_cents / 100).toFixed(row.price_cents % 100 === 0 ? 0 : 2)}`;
}

export function formatWhen(startsAt: string | null) {
  if (!startsAt) return "Date to be announced";
  return new Date(startsAt).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

async function attachMeta(classes: ClassRow[]): Promise<ClassWithMeta[]> {
  if (classes.length === 0) return [];
  const teacherIds = [...new Set(classes.map((c) => c.teacher_id))];
  const classIds = classes.map((c) => c.id);

  const [{ data: profiles }, { data: signups }] = await Promise.all([
    supabase.from("profiles").select("*").in("id", teacherIds),
    supabase.from("signups").select("class_id").in("class_id", classIds),
  ]);

  const byId = new Map((profiles ?? []).map((p) => [p.id, p as ProfileRow]));
  const counts = new Map<string, number>();
  for (const s of signups ?? []) {
    counts.set(s.class_id, (counts.get(s.class_id) ?? 0) + 1);
  }

  return classes.map((c) => ({
    ...c,
    teacher: byId.get(c.teacher_id) ?? null,
    signupCount: counts.get(c.id) ?? 0,
  }));
}

export async function fetchUpcomingClasses(): Promise<ClassWithMeta[]> {
  const { data, error } = await supabase
    .from("classes")
    .select("*")
    .eq("status", "published")
    .order("starts_at", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return attachMeta((data ?? []) as ClassRow[]);
}

export async function fetchClass(id: string): Promise<ClassWithMeta | null> {
  const { data, error } = await supabase.from("classes").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [withMeta] = await attachMeta([data as ClassRow]);
  return withMeta ?? null;
}

export async function fetchSkills() {
  const { data, error } = await supabase.from("skills").select("*").order("name");
  if (error) throw error;
  return data ?? [];
}

export async function fetchMyProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return (data as ProfileRow) ?? null;
}
