ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS membership_status text NOT NULL DEFAULT 'waitlisted',
  ADD COLUMN IF NOT EXISTS invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS joined_at timestamptz;

-- existing members are grandfathered in
UPDATE public.profiles SET membership_status = 'member', joined_at = COALESCE(joined_at, created_at)
WHERE membership_status = 'waitlisted';

CREATE OR REPLACE FUNCTION public.is_member(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _user_id AND p.membership_status = 'member')
$$;
REVOKE ALL ON FUNCTION public.is_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_member(uuid) TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  note text NOT NULL DEFAULT '',
  claimed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invites TO authenticated;
GRANT ALL ON public.invites TO service_role;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invites_select_own" ON public.invites FOR SELECT TO authenticated
  USING (auth.uid() = inviter_id OR auth.uid() = claimed_by);
CREATE POLICY "invites_insert_own" ON public.invites FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = inviter_id AND public.is_member(auth.uid()));
CREATE POLICY "invites_delete_own" ON public.invites FOR DELETE TO authenticated
  USING (auth.uid() = inviter_id AND claimed_by IS NULL);

CREATE TABLE IF NOT EXISTS public.vouches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, candidate_id),
  CONSTRAINT no_self_vouch CHECK (member_id <> candidate_id)
);
GRANT SELECT, INSERT ON public.vouches TO authenticated;
GRANT ALL ON public.vouches TO service_role;
ALTER TABLE public.vouches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vouches_select" ON public.vouches FOR SELECT TO authenticated USING (true);
CREATE POLICY "vouches_insert_member" ON public.vouches FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = member_id AND public.is_member(auth.uid()));

-- a vouch instantly promotes the candidate to full member
CREATE OR REPLACE FUNCTION public.promote_on_vouch()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles
  SET membership_status = 'member',
      invited_by = COALESCE(invited_by, NEW.member_id),
      joined_at = COALESCE(joined_at, now())
  WHERE id = NEW.candidate_id AND membership_status <> 'member';

  INSERT INTO public.notifications (user_id, title, body)
  VALUES (NEW.candidate_id, 'You''re in!', 'A member vouched for you. Welcome to Kindred.');
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.promote_on_vouch() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS vouches_promote ON public.vouches;
CREATE TRIGGER vouches_promote AFTER INSERT ON public.vouches
  FOR EACH ROW EXECUTE FUNCTION public.promote_on_vouch();

-- claim an invite code
CREATE OR REPLACE FUNCTION public.claim_invite(_code text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_invite public.invites;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN 'unauthenticated'; END IF;

  SELECT * INTO v_invite FROM public.invites
  WHERE lower(code) = lower(btrim(_code)) FOR UPDATE;

  IF v_invite.id IS NULL THEN RETURN 'invalid'; END IF;
  IF v_invite.claimed_by IS NOT NULL AND v_invite.claimed_by <> v_uid THEN RETURN 'already_used'; END IF;
  IF v_invite.inviter_id = v_uid THEN RETURN 'own_code'; END IF;

  UPDATE public.invites SET claimed_by = v_uid, claimed_at = now() WHERE id = v_invite.id;

  UPDATE public.profiles
  SET membership_status = 'member',
      invited_by = COALESCE(invited_by, v_invite.inviter_id),
      joined_at = COALESCE(joined_at, now())
  WHERE id = v_uid;

  INSERT INTO public.vouches (member_id, candidate_id)
  VALUES (v_invite.inviter_id, v_uid)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.notifications (user_id, title, body)
  VALUES (v_invite.inviter_id, 'Your invite was accepted', 'Someone you invited just joined Kindred.');

  RETURN 'ok';
END;
$$;
REVOKE ALL ON FUNCTION public.claim_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_invite(text) TO authenticated;
