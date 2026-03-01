
CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.ticket_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tickets" ON public.support_tickets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create tickets" ON public.support_tickets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own tickets" ON public.support_tickets FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view replies on their tickets" ON public.ticket_replies FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.support_tickets WHERE id = ticket_id AND user_id = auth.uid())
  OR user_id = auth.uid()
);
CREATE POLICY "Users can create replies on their tickets" ON public.ticket_replies FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.support_tickets WHERE id = ticket_id AND user_id = auth.uid())
  OR auth.uid() = user_id
);

-- Admin policies - for now, allow all authenticated users to see all tickets (you'll restrict this later to admin role)
CREATE POLICY "Admin view all tickets" ON public.support_tickets FOR SELECT USING (true);
CREATE POLICY "Admin view all replies" ON public.ticket_replies FOR SELECT USING (true);
CREATE POLICY "Admin reply to any ticket" ON public.ticket_replies FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admin update any ticket" ON public.support_tickets FOR UPDATE USING (auth.uid() IS NOT NULL);
