import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Check } from "lucide-react";
import { Banknote, CreditCard, Wallet, DollarSign, Building2 } from "lucide-react";

function CheckIndicator({ checked }: { checked: boolean }) {
  return (
    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
      checked ? 'bg-purple-600 border-purple-600' : 'border-gray-500'
    }`}>
      {checked && <Check className="h-3 w-3 text-white" />}
    </div>
  );
}

export interface PaymentMethod {
  id: string;
  label: string;
  icon: React.ReactNode;
}

export interface PaymentMethodDef {
  id: string;
  label: string;
  iconName: "wallet" | "dollar" | "credit" | "building" | "banknote";
  iconColor: string;
}

const PAYMENT_METHOD_DEFS: PaymentMethodDef[] = [
  { id: "venmo", label: "Venmo", iconName: "wallet", iconColor: "text-blue-400" },
  { id: "cashapp", label: "Cash App", iconName: "dollar", iconColor: "text-green-400" },
  { id: "zelle", label: "Zelle", iconName: "credit", iconColor: "text-purple-400" },
  { id: "paypal", label: "PayPal", iconName: "wallet", iconColor: "text-blue-500" },
  { id: "bank", label: "Bank Transfer", iconName: "building", iconColor: "text-gray-400" },
  { id: "cash", label: "Cash", iconName: "banknote", iconColor: "text-green-500" },
];

function PaymentIcon({ name, color }: { name: PaymentMethodDef["iconName"]; color: string }) {
  const cls = `h-5 w-5 ${color}`;
  switch (name) {
    case "wallet": return <Wallet className={cls} />;
    case "dollar": return <DollarSign className={cls} />;
    case "credit": return <CreditCard className={cls} />;
    case "building": return <Building2 className={cls} />;
    case "banknote": return <Banknote className={cls} />;
  }
}

// Keep backward compat export
export const PAYMENT_METHODS: PaymentMethod[] = PAYMENT_METHOD_DEFS.map(d => ({
  id: d.id,
  label: d.label,
  icon: <PaymentIcon name={d.iconName} color={d.iconColor} />,
}));

export function getPaymentMethodIcon(methodId: string | null): React.ReactNode {
  if (!methodId) return null;
  const method = PAYMENT_METHODS.find(m => m.id === methodId);
  return method?.icon || null;
}

export function getPaymentMethodLabel(methodId: string | null): string {
  if (!methodId) return "Not set";
  const method = PAYMENT_METHODS.find(m => m.id === methodId);
  return method?.label || "Unknown";
}

interface PaymentMethodSelectorProps {
  open: boolean;
  onSelect: (methodId: string) => void;
  onCancel?: () => void;
  title?: string;
  description?: string;
  allowedMethods?: string[] | null; // If null/empty, all methods are allowed
}

export default function PaymentMethodSelector({ 
  open, 
  onSelect, 
  onCancel,
  title = "Select Your Payment Method",
  description = "Choose how you'll send/receive payments when it's your turn. This will be visible to other circle members.",
  allowedMethods
}: PaymentMethodSelectorProps) {
  const [selected, setSelected] = useState<string>("");
  const [hasConfirmed, setHasConfirmed] = useState(false);

  // Filter methods if restrictions exist
  const availableMethods = allowedMethods && allowedMethods.length > 0
    ? PAYMENT_METHODS.filter(m => allowedMethods.includes(m.id))
    : PAYMENT_METHODS;

  const handleConfirm = () => {
    if (selected) {
      setHasConfirmed(true);
      onSelect(selected);
      setSelected("");
      // Reset after selection is complete
      setTimeout(() => setHasConfirmed(false), 100);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      // Only call onCancel if the dialog is closing AND user hasn't confirmed a selection
      if (!isOpen && onCancel && !hasConfirmed) {
        onCancel();
      }
    }}>
      <DialogContent className="bg-gray-900 border-gray-800 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">{title}</DialogTitle>
          <DialogDescription className="text-gray-400">
            {description}
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value={selected} onValueChange={setSelected} className="grid gap-3 py-4">
          {availableMethods.map((method) => (
            <div 
              key={method.id}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                selected === method.id 
                  ? 'border-purple-500 bg-purple-500/10' 
                  : 'border-gray-700 hover:border-gray-600 bg-gray-800/50'
              }`}
              onClick={() => setSelected(method.id)}
            >
              <RadioGroupItem value={method.id} id={method.id} className="sr-only" />
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-800">
                {method.icon}
              </div>
              <Label htmlFor={method.id} className="text-white font-medium cursor-pointer flex-1">
                {method.label}
              </Label>
            </div>
          ))}
        </RadioGroup>

        <DialogFooter className="gap-2">
          {onCancel && (
            <Button variant="outline" onClick={onCancel} className="border-gray-700 text-gray-300">
              Cancel
            </Button>
          )}
          <Button 
            onClick={handleConfirm}
            disabled={!selected}
            className="bg-purple-600 hover:bg-purple-700"
          >
            Confirm Selection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Multi-select component for circle creators
interface AllowedPaymentMethodsSelectorProps {
  selectedMethods: string[];
  onChange: (methods: string[]) => void;
}

export function AllowedPaymentMethodsSelector({ selectedMethods, onChange }: AllowedPaymentMethodsSelectorProps) {
  const isAnySelected = selectedMethods.length === 0;

  const toggleMethod = (methodId: string) => {
    if (isAnySelected) {
      // Switching from "Any" to a specific method
      onChange([methodId]);
    } else if (selectedMethods.includes(methodId)) {
      const newMethods = selectedMethods.filter(id => id !== methodId);
      // If removing the last method, stay with empty array (goes back to "Any")
      onChange(newMethods);
    } else {
      onChange([...selectedMethods, methodId]);
    }
  };

  const handleAnyToggle = () => {
    // Always allow clicking "Any" to clear specific selections
    onChange([]);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400 mb-1">Tap multiple methods to select more than one</p>
      {/* "Any" option */}
      <div 
        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
          isAnySelected 
            ? 'border-purple-500 bg-purple-500/10' 
            : 'border-gray-700 hover:border-gray-600 bg-gray-800/50'
        }`}
        onClick={handleAnyToggle}
      >
        <CheckIndicator checked={isAnySelected} />
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-800">
          <Wallet className="h-5 w-5 text-gray-400" />
        </div>
        <div className="flex-1">
          <Label className="text-white font-medium cursor-pointer">Any Method</Label>
          <p className="text-xs text-gray-400">Members can choose any payment method</p>
        </div>
      </div>

      {/* Individual methods */}
      {PAYMENT_METHOD_DEFS.map((method) => (
        <div 
          key={method.id}
          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
            selectedMethods.includes(method.id)
              ? 'border-purple-500 bg-purple-500/10' 
              : 'border-gray-700 hover:border-gray-600 bg-gray-800/50'
          }`}
          onClick={() => toggleMethod(method.id)}
        >
          <CheckIndicator checked={selectedMethods.includes(method.id)} />
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-800">
            <PaymentIcon name={method.iconName} color={method.iconColor} />
          </div>
          <Label className="text-white font-medium cursor-pointer flex-1">
            {method.label}
          </Label>
        </div>
      ))}
    </div>
  );
}
