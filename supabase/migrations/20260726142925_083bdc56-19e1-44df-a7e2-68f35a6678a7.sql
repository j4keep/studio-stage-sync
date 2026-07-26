CREATE OR REPLACE FUNCTION public.is_conversation_member(_conversation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = _conversation_id AND cp.user_id = _user_id
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_conversation_member(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Users can view participants of their conversations" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can add participants to conversations they belong to" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;

CREATE POLICY "Participants viewable by members"
ON public.conversation_participants FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_conversation_member(conversation_id, auth.uid()));

CREATE POLICY "Members can add participants"
ON public.conversation_participants FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() OR public.is_conversation_member(conversation_id, auth.uid()));

CREATE POLICY "Users can leave conversations"
ON public.conversation_participants FOR DELETE TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Members can view conversations"
ON public.conversations FOR SELECT TO authenticated
USING (public.is_conversation_member(id, auth.uid()));

CREATE POLICY "Members can view messages"
ON public.messages FOR SELECT TO authenticated
USING (public.is_conversation_member(conversation_id, auth.uid()));

CREATE POLICY "Members can send messages"
ON public.messages FOR INSERT TO authenticated
WITH CHECK (sender_id = auth.uid() AND public.is_conversation_member(conversation_id, auth.uid()));

CREATE POLICY "Members can update messages"
ON public.messages FOR UPDATE TO authenticated
USING (public.is_conversation_member(conversation_id, auth.uid()))
WITH CHECK (public.is_conversation_member(conversation_id, auth.uid()));

CREATE POLICY "Senders can delete own messages"
ON public.messages FOR DELETE TO authenticated
USING (sender_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_participants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.conversation_participants TO service_role;
GRANT ALL ON public.conversations TO service_role;
GRANT ALL ON public.messages TO service_role;