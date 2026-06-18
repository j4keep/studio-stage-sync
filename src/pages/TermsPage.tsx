import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const TermsPage = () => {
  const navigate = useNavigate();

  return (
    <div className="px-4 pt-6 pb-24 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-xl font-display font-bold text-foreground">Terms of Use & Privacy Policy</h1>
      </div>

      <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
        <section>
          <p className="italic">
            WHEUAT is a unified platform that combines the creator app (Feed, TV, music, projects, store) and the <strong className="text-foreground">Catch Up Circle</strong> (community savings rotations & fundraisers). One account, one set of terms — these apply across the entire platform.
          </p>
        </section>

        <section>
          <h2 className="text-base font-display font-bold text-foreground mb-2">1. Acceptance of Terms</h2>
          <p>
            By accessing or using WHEUAT ("App"), you agree to be bound by these Terms of Use and Privacy Policy. If you do not agree, you may not use the App.
          </p>
        </section>

        <section>
          <h2 className="text-base font-display font-bold text-foreground mb-2">2. Eligibility</h2>
          <p>
            You must be at least 13 years old to create an WHEUAT account. The <strong className="text-foreground">Catch Up Circle (savings rotations, fundraisers, payouts, donations)</strong> is restricted to users <strong className="text-foreground">18 years of age or older</strong>. By entering the Circle area you confirm you meet this age requirement. We may require identity verification before releasing funds.
          </p>
        </section>

        <section>
          <h2 className="text-base font-display font-bold text-foreground mb-2">3. Unified Account</h2>
          <p>
            One WHEUAT account works across the platform — Feed, TV, Circle, and creator tools. There is no separate Circle login or profile picture. Your display name, avatar, and credentials are shared across all features.
          </p>
        </section>

        <section>
          <h2 className="text-base font-display font-bold text-foreground mb-2">4. Catch Up Circle</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>Circles are community savings rotations organised by a host. Members contribute on a schedule and receive payouts in turn.</li>
            <li>Fundraisers allow members to raise money for causes, projects, or individuals.</li>
            <li>Members are responsible for honoring contribution commitments. Missed contributions may result in removal and account review.</li>
            <li>WHEUAT is not a bank or licensed money transmitter. We provide tooling to coordinate community savings; funds are held and moved by our payment processor (Stripe).</li>
            <li>Identity verification (KYC) may be required for hosts and high-value participants.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-display font-bold text-foreground mb-2">5. Creator Content (Feed, TV, Music)</h2>
          <p>
            Creators must upload only original or properly licensed content (audio, video, podcasts, short films, music videos). No external copyrighted music is allowed on Radio. Creators retain ownership of their content and grant WHEUAT a non-exclusive license to display, stream, and promote it within the App.
          </p>
        </section>

        <section>
          <h2 className="text-base font-display font-bold text-foreground mb-2">6. Payments & Fees</h2>
          <p>All payments are processed through Stripe. Fees:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>8% project funding fee</li>
            <li>15% digital download fee</li>
            <li>Standard Stripe processing fees on Circle contributions, fundraisers, and donations</li>
          </ul>
          <p className="mt-2">
            Creator payouts are handled via Stripe Connect. WHEUAT is not responsible for payment disputes outside of the platform's dispute resolution process.
          </p>
        </section>

        <section>
          <h2 className="text-base font-display font-bold text-foreground mb-2">7. Pro Subscription</h2>
          <p>
            The Pro tier is <strong className="text-foreground">$10/month</strong> and unlocks Direct Messaging, Store management, Analytics & Earnings, Legal Vault, Boosts & Promotions, the Ask Jhi AI assistant, and an ad-free experience. Subscriptions auto-renew and may be cancelled at any time.
          </p>
        </section>

        <section>
          <h2 className="text-base font-display font-bold text-foreground mb-2">8. Prohibited Conduct</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>Uploading harmful, hateful, illegal, or copyrighted content.</li>
            <li>Impersonation, harassment, fraud, or spamming.</li>
            <li>Circumventing platform fees, payment systems, or the 18+ Circle requirement.</li>
            <li>False reporting, false accusations, or manipulating disputes.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-display font-bold text-foreground mb-2">9. Account Suspension</h2>
          <p>
            WHEUAT may suspend or permanently deactivate accounts for any violation of these Terms, fraudulent activity, or repeated abuse. Deactivated accounts are permanent and associated data may be deleted after 90 days, subject to legal retention requirements.
          </p>
        </section>

        <section>
          <h2 className="text-base font-display font-bold text-foreground mb-2">10. Limitation of Liability</h2>
          <p>
            WHEUAT provides the platform "as is" with no warranties regarding uptime, content accuracy, or transaction outcomes. We are not liable for losses arising from use of the App.
          </p>
        </section>

        <section id="privacy">
          <h2 className="text-base font-display font-bold text-foreground mb-2">11. Privacy Policy</h2>
          <p>
            WHEUAT collects and processes personal data necessary to provide platform services, including account information, uploaded content metadata, Circle membership and contribution records, payment information, and usage analytics.
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Personal information is used solely for providing platform services and is never sold to third parties.</li>
            <li>Payment data is processed securely through Stripe and is not stored on WHEUAT servers.</li>
            <li>Identity verification documents submitted for the Circle are stored encrypted and used only for KYC/anti-fraud purposes.</li>
            <li>Circle contribution history and dispute records are retained for accountability and legal compliance.</li>
            <li>You may request data export or account deletion by contacting support, subject to legal retention requirements.</li>
            <li>WHEUAT may share data with law enforcement when required by law or to prevent fraud.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-display font-bold text-foreground mb-2">12. Contact</h2>
          <p>
            For questions about these Terms or your data, contact us through the app's Help section or the Ask Jhi assistant.
          </p>
          <p className="mt-2">
            By using WHEUAT, you acknowledge that you have read, understood, and agree to these Terms of Use and Privacy Policy.
          </p>
        </section>
      </div>
    </div>
  );
};

export default TermsPage;
