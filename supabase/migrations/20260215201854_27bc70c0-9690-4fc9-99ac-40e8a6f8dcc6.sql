
-- Create legal_documents table for user-uploaded contracts and templates
CREATE TABLE public.legal_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT,
  file_name TEXT,
  file_type TEXT,
  file_size BIGINT DEFAULT 0,
  is_template BOOLEAN DEFAULT false,
  category TEXT DEFAULT 'contract',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;

-- Users can view their own documents
CREATE POLICY "Users can view their own documents"
ON public.legal_documents FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own documents
CREATE POLICY "Users can insert their own documents"
ON public.legal_documents FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own documents
CREATE POLICY "Users can update their own documents"
ON public.legal_documents FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own documents
CREATE POLICY "Users can delete their own documents"
ON public.legal_documents FOR DELETE
USING (auth.uid() = user_id);

-- Templates are viewable by all authenticated users
CREATE POLICY "Templates are viewable by authenticated users"
ON public.legal_documents FOR SELECT
USING (is_template = true);

-- Trigger for updated_at
CREATE TRIGGER update_legal_documents_updated_at
BEFORE UPDATE ON public.legal_documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
