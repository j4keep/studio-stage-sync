import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const TermsPage = () => {
  const navigate = useNavigate();

  return (
    <div className="px-4 pt-6 pb-24">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-xl font-display font-bold text-foreground">Terms of Use</h1>
      </div>

      <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
        <section>
          <h2 className="text-base font-display font-bold text-foreground mb-2">1. Acceptance of Terms</h2>
          <p>
            By accessing or using the WHEUAT platform ("App"), you agree to be bound by these Terms of Use. If you do not agree, you may not use the App. All users — both Artists and Fans — must accept these terms during onboarding.
          </p>
        </section>

        <section>
          <h2 className="text-base font-display font-bold text-foreground mb-2">2. Account Types</h2>
          <p>
            WHEUAT supports two account types: <strong className="text-foreground">Artist</strong> and <strong className="text-foreground">Fan</strong>. Each role has specific features, responsibilities, and access levels. You must select your role during registration.
          </p>
        </section>

        <section>
          <h2 className="text-base font-display font-bold text-foreground mb-2">3. Artist Responsibilities</h2>
          <p>
            Artists are responsible for ensuring all uploaded content (songs, podcasts, media) is original or properly licensed. No external copyrighted music is allowed. Artists who list studios must provide accurate information including rates, equipment, and availability. Artists using Radio streaming must accept the radio streaming agreement.
          </p>
        </section>

        <section>
          <h2 className="text-base font-display font-bold text-foreground mb-2">4. Fan Responsibilities</h2>
          <p>
            Fans may browse, follow artists, contribute to projects, book studios, and purchase digital content. Fans agree not to redistribute, resell, or misuse any content acquired through the platform.
          </p>
        </section>

        <section>
          <h2 className="text-base font-display font-bold text-foreground mb-2">5. Payments & Fees</h2>
          <p>
            All payments are processed through Stripe. The platform charges the following fees:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>10% studio booking fee</li>
            <li>8% project funding fee</li>
            <li>15% digital download fee</li>
            <li>$7.99/month Pro Artist subscription</li>
          </ul>
          <p className="mt-2">
            Artist payouts are handled via Stripe Connect. WHEUAT is not responsible for payment disputes between users.
          </p>
        </section>

        <section>
          <h2 className="text-base font-display font-bold text-foreground mb-2">6. Content Ownership</h2>
          <p>
            Artists retain full ownership of their content. By uploading to WHEUAT, artists grant the platform a non-exclusive license to display, stream, and promote content within the App.
          </p>
        </section>

        <section>
          <h2 className="text-base font-display font-bold text-foreground mb-2">7. Pro Artist Subscription</h2>
          <p>
            Pro Artists receive access to: Legal Vault, Verified Badge, Analytics Dashboard, and Featured Placement Priority. Subscriptions auto-renew monthly and can be canceled at any time.
          </p>
        </section>

        <section>
          <h2 className="text-base font-display font-bold text-foreground mb-2">8. Prohibited Conduct</h2>
          <p>
            Users may not upload harmful, hateful, or illegal content. Impersonation, fraud, harassment, and spamming are strictly prohibited. Violations may result in account termination.
          </p>
        </section>

        <section>
          <h2 className="text-base font-display font-bold text-foreground mb-2">9. Limitation of Liability</h2>
          <p>
            WHEUAT provides the platform "as is" and makes no warranties regarding uptime, content accuracy, or transaction outcomes. The platform is not liable for losses arising from use of the App.
          </p>
        </section>

        <section>
          <h2 className="text-base font-display font-bold text-foreground mb-2">10. Contact</h2>
          <p>
            For questions about these Terms, or to agree to terms via phone, call: <strong className="text-primary">954-607</strong>
          </p>
          <p className="mt-2">
            By using WHEUAT, you acknowledge that you have read, understood, and agree to these Terms of Use.
          </p>
        </section>
      </div>
    </div>
  );
};

export default TermsPage;
