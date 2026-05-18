-- 1. Coluna username (case-insensitive via índice em lower())
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_unique
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL;

-- 2. Trigger de validação de formato
CREATE OR REPLACE FUNCTION public.validate_username()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.username IS NULL THEN
    RETURN NEW;
  END IF;
  NEW.username := lower(trim(NEW.username));
  IF NEW.username !~ '^[a-z0-9_.]{3,20}$' THEN
    RAISE EXCEPTION 'Username inválido. Use 3 a 20 caracteres: letras minúsculas, números, "_" ou ".".';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_profile_username ON public.profiles;
CREATE TRIGGER validate_profile_username
  BEFORE INSERT OR UPDATE OF username ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.validate_username();

-- 3. Função RPC para checar disponibilidade
CREATE OR REPLACE FUNCTION public.is_username_available(_username text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _username IS NOT NULL
    AND _username ~ '^[a-z0-9_.]{3,20}$'
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE lower(username) = lower(_username)
    );
$$;

-- 4. Permitir que usuários autenticados vejam username/display_name de outros perfis
--    (necessário para ranking, lista de amigos, busca por código).
DROP POLICY IF EXISTS "Public profile basics viewable" ON public.profiles;
CREATE POLICY "Public profile basics viewable"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);
