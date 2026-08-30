ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS format text NOT NULL DEFAULT 'in_person',
  ADD COLUMN IF NOT EXISTS meeting_url text NOT NULL DEFAULT '';

ALTER TABLE public.classes ALTER COLUMN zip_code SET DEFAULT '';
ALTER TABLE public.classes ALTER COLUMN zip_code DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.validate_class_row()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.format NOT IN ('in_person', 'online') THEN
    RAISE EXCEPTION 'format must be in_person or online';
  END IF;
  IF NEW.status NOT IN ('published', 'gauging_interest', 'cancelled') THEN
    RAISE EXCEPTION 'invalid class status';
  END IF;
  IF NEW.format = 'in_person' AND COALESCE(btrim(NEW.zip_code), '') = '' THEN
    RAISE EXCEPTION 'in-person classes need a zip code';
  END IF;
  IF NEW.format = 'online' THEN
    NEW.zip_code := COALESCE(NEW.zip_code, '');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS classes_validate ON public.classes;
CREATE TRIGGER classes_validate BEFORE INSERT OR UPDATE ON public.classes
FOR EACH ROW EXECUTE FUNCTION public.validate_class_row();

CREATE OR REPLACE FUNCTION public.notify_interested_members()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, body, class_id)
  SELECT ci.user_id,
         CASE WHEN NEW.status = 'gauging_interest'
              THEN 'Interest check: ' || NEW.title
              ELSE 'New class: ' || NEW.title END,
         'A class on ' || NEW.skill_name || ' was just posted'
           || CASE WHEN NEW.format = 'online' THEN ' (online).'
                   ELSE ' near ' || COALESCE(NEW.zip_code, '') || '.' END,
         NEW.id
  FROM public.class_interest ci
  WHERE lower(ci.skill_name) = lower(NEW.skill_name)
    AND ci.user_id <> NEW.teacher_id;
  RETURN NEW;
END;
$$;