import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SavingsCircleAgreementDialogProps {
  open: boolean;
  onAccept: () => void;
  onClose?: () => void;
}

export default function SavingsCircleAgreementDialog({ open, onAccept, onClose }: SavingsCircleAgreementDialogProps) {
  const { toast } = useToast();
  const [checks, setChecks] = useState({
    agreement: false,
    defaultPolicy: false,
    conduct: false,
    noMoney: false,
    privatePayments: false,
    memberDisputes: false,
    signature: false,
  });
  const [loading, setLoading] = useState(false);

  const allChecked = Object.values(checks).every(v => v === true);

  const handleAgree = async () => {
    if (!allChecked) {
      toast({
        title: "All boxes must be checked",
        description: "Please read and accept all conditions before proceeding",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Record acceptance
      const { error } = await supabase
        .from('savings_circle_terms_acceptance')
        .insert({
          user_id: user.id,
        });

      if (error && error.code !== '23505') { // Ignore duplicate key error
        throw error;
      }

      toast({
        title: "Agreement Accepted",
        description: "You can now access Savings Circles",
      });

      onAccept();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose?.()}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
        )}
        <DialogHeader>
          <DialogTitle className="text-2xl">Savings Circle Participation Agreement</DialogTitle>
          <DialogDescription>
            Please read carefully and check all boxes to proceed
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-6">
            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-amber-900 dark:text-amber-100 mb-2">⚠️ Warning</p>
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    Once this Circle begins, you are fully committed. If you receive your payout and refuse to pay later periods, 
                    other Members may take legal action against you, including small claims lawsuits.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <p className="font-semibold text-lg">By joining this Circle on Atchup, I confirm the following:</p>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="agreement"
                    checked={checks.agreement}
                    onCheckedChange={(checked) => setChecks({ ...checks, agreement: checked as boolean })}
                    className="mt-1"
                  />
                  <label htmlFor="agreement" className="text-sm cursor-pointer leading-relaxed">
                    I have read and agree to the <span className="font-semibold">Atchup Savings Circle Participation Agreement</span>
                  </label>
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="defaultPolicy"
                    checked={checks.defaultPolicy}
                    onCheckedChange={(checked) => setChecks({ ...checks, defaultPolicy: checked as boolean })}
                    className="mt-1"
                  />
                  <label htmlFor="defaultPolicy" className="text-sm cursor-pointer leading-relaxed">
                    I accept the <span className="font-semibold">Atchup Default Policy</span>
                  </label>
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="conduct"
                    checked={checks.conduct}
                    onCheckedChange={(checked) => setChecks({ ...checks, conduct: checked as boolean })}
                    className="mt-1"
                  />
                  <label htmlFor="conduct" className="text-sm cursor-pointer leading-relaxed">
                    I agree to the <span className="font-semibold">Atchup Member Code of Conduct</span>
                  </label>
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="noMoney"
                    checked={checks.noMoney}
                    onCheckedChange={(checked) => setChecks({ ...checks, noMoney: checked as boolean })}
                    className="mt-1"
                  />
                  <label htmlFor="noMoney" className="text-sm cursor-pointer leading-relaxed">
                    I understand that <span className="font-semibold">Atchup does NOT handle money</span>
                  </label>
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="privatePayments"
                    checked={checks.privatePayments}
                    onCheckedChange={(checked) => setChecks({ ...checks, privatePayments: checked as boolean })}
                    className="mt-1"
                  />
                  <label htmlFor="privatePayments" className="text-sm cursor-pointer leading-relaxed">
                    I understand <span className="font-semibold">payments are made privately between Members</span>
                  </label>
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="memberDisputes"
                    checked={checks.memberDisputes}
                    onCheckedChange={(checked) => setChecks({ ...checks, memberDisputes: checked as boolean })}
                    className="mt-1"
                  />
                  <label htmlFor="memberDisputes" className="text-sm cursor-pointer leading-relaxed">
                    I understand <span className="font-semibold">defaults are handled between Members, not by Atchup</span>
                  </label>
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="signature"
                    checked={checks.signature}
                    onCheckedChange={(checked) => setChecks({ ...checks, signature: checked as boolean })}
                    className="mt-1"
                  />
                  <label htmlFor="signature" className="text-sm cursor-pointer leading-relaxed">
                    <span className="font-semibold">This constitutes my digital signature</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="bg-muted rounded-lg p-4 text-sm">
              <p className="font-semibold mb-2">Important Reminders:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>You only need to accept this agreement once</li>
                <li>This agreement applies to all savings circles you create or join</li>
                <li>Atchup is an organizational tool only - not a financial service</li>
                <li>All members are responsible for their own payments and agreements</li>
              </ul>
            </div>
          </div>
        </ScrollArea>

        <div className="flex gap-3 pt-4 border-t">
          <Button
            onClick={handleAgree}
            disabled={!allChecked || loading}
            className="flex-1"
            size="lg"
          >
            {loading ? "Processing..." : "I Agree - Continue"}
          </Button>
        </div>

        {!allChecked && (
          <p className="text-sm text-destructive text-center">
            All checkboxes must be checked to continue
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
