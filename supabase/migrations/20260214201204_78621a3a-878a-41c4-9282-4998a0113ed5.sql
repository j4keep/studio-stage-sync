
-- Fix overly permissive conversation creation - only authenticated users
DROP POLICY "Users can create conversations" ON public.conversations;
CREATE POLICY "Authenticated users can create conversations" ON public.conversations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Fix overly permissive participant addition - only allow adding self or if you're in the conversation
DROP POLICY "Users can add participants" ON public.conversation_participants;
CREATE POLICY "Users can add participants to conversations they belong to" ON public.conversation_participants
  FOR INSERT WITH CHECK (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.conversation_participants cp WHERE cp.conversation_id = conversation_id AND cp.user_id = auth.uid())
  );
