ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS created_by uuid;

UPDATE public.conversations c
SET created_by = first_participant.user_id
FROM (
  SELECT DISTINCT ON (conversation_id) conversation_id, user_id
  FROM public.conversation_participants
  ORDER BY conversation_id, joined_at ASC
) AS first_participant
WHERE c.id = first_participant.conversation_id
  AND c.created_by IS NULL;

ALTER TABLE public.conversations
  ALTER COLUMN created_by SET DEFAULT auth.uid();

DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.conversations;
DROP POLICY IF EXISTS "Members can view conversations" ON public.conversations;
DROP POLICY IF EXISTS "Members can update conversations" ON public.conversations;

CREATE POLICY "Authenticated users can create own conversations"
ON public.conversations
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Creators and members can view conversations"
ON public.conversations
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid()
  OR public.is_conversation_member(id, auth.uid())
);

CREATE POLICY "Creators and members can update conversations"
ON public.conversations
FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid()
  OR public.is_conversation_member(id, auth.uid())
)
WITH CHECK (
  created_by = auth.uid()
  OR public.is_conversation_member(id, auth.uid())
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;