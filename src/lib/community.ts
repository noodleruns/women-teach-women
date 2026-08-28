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

const [{ data: profiles }, { data: signupCounts }] = await Promise.all([
    supabase.from("profiles").select("*").in("id", teacherIds),
    supabase.rpc("class_signup_counts", { class_ids: classIds }),
  ]);

  const byId = new Map((profiles ?? []).map((p) => [p.id, p as ProfileRow]));
  const counts = new Map<string, number>();
  for (const s of (signupCounts ?? []) as { class_id: string; n: number }[]) {
    counts.set(s.class_id, s.n);
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

export type MembershipStatus = "member" | "waitlisted";

export type InviteRow = {
  id: string;
  inviter_id: string;
  code: string;
  note: string;
  claimed_by: string | null;
  claimed_at: string | null;
  created_at: string;
};

export async function fetchMembership(
  userId: string,
): Promise<{ status: MembershipStatus; invited_by: string | null }> {
  const { data, error } = await supabase
    .from("profiles")
    .select("membership_status, invited_by")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return {
    status: ((data?.membership_status as MembershipStatus) ?? "waitlisted") as MembershipStatus,
    invited_by: data?.invited_by ?? null,
  };
}

export async function fetchMyInvites(userId: string): Promise<InviteRow[]> {
  const { data, error } = await supabase
    .from("invites")
    .select("*")
    .eq("inviter_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as InviteRow[];
}

function randomCode() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `${out.slice(0, 3)}-${out.slice(3)}`;
}

export async function createInvite(userId: string, note: string): Promise<InviteRow> {
  const { data, error } = await supabase
    .from("invites")
    .insert({ inviter_id: userId, code: randomCode(), note: note.trim().slice(0, 80) })
    .select("*")
    .single();
  if (error) throw error;
  return data as InviteRow;
}

export async function claimInvite(code: string): Promise<string> {
  const { data, error } = await supabase.rpc("claim_invite", { _code: code });
  if (error) throw error;
  return (data as string) ?? "invalid";
}

/** People still on the waitlist that a member could vouch for. */
export async function fetchWaitlist(): Promise<ProfileRow[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("membership_status", "waitlisted")
    .order("created_at", { ascending: true })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as ProfileRow[];
}

export async function vouchFor(memberId: string, candidateId: string) {
  const { error } = await supabase
    .from("vouches")
    .insert({ member_id: memberId, candidate_id: candidateId });
  if (error) throw error;
}
