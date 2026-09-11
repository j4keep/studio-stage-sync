
CREATE OR REPLACE FUNCTION public.is_deal_business_owner(_business_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.deal_businesses b
    WHERE b.id = _business_id AND b.owner_id = _user_id
  );
$$;

DROP POLICY IF EXISTS "Managers update members" ON public.deal_business_members;
CREATE POLICY "Managers update members"
ON public.deal_business_members
FOR UPDATE
TO authenticated
USING (
  public.is_deal_business_owner(business_id, auth.uid())
  OR (public.can_manage_deal_business(business_id, auth.uid()) AND user_id <> auth.uid())
)
WITH CHECK (
  public.is_deal_business_owner(business_id, auth.uid())
  OR (
    public.can_manage_deal_business(business_id, auth.uid())
    AND user_id <> auth.uid()
    AND role <> 'owner'
  )
);

DROP POLICY IF EXISTS "View circles" ON public.circles;
CREATE POLICY "View circles"
ON public.circles
FOR SELECT
USING (
  COALESCE(is_private, false) = false
  OR (
    auth.uid() IS NOT NULL
    AND (
      owner_id = auth.uid()
      OR public.is_social_circle_member(id, auth.uid())
      OR public.is_social_circle_admin(id, auth.uid())
      OR has_role(auth.uid(), 'admin')
    )
  )
);
