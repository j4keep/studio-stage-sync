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
          </ul>
          <p className="mt-2">
            Artist payouts are handled via Stripe Connect. WHEUAT is not responsible for payment disputes between users outside of the platform's dispute resolution process.
          </p>
        </section>

        <section>
          <h2 className="text-base font-display font-bold text-foreground mb-2">6. Pro Artist Subscription</h2>
          <p>
            Pro Artist subscription is available at <strong className="text-foreground">$10/month</strong> or <strong className="text-foreground">$100/year</strong>. Pro Artists receive access to: Direct Messaging, Store management, Analytics &amp; Earnings dashboards, Studio Listings, Legal Vault, Boosts &amp; Promotions, Ask Jhi AI Assistant, and a Zero Ads experience. Subscriptions auto-renew and can be canceled at any time.
          </p>
        </section>

        <section>
          <h2 className="text-base font-display font-bold text-foreground mb-2">7. Content Ownership</h2>
          <p>
            Artists retain full ownership of their content. By uploading to WHEUAT, artists grant the platform a non-exclusive license to display, stream, and promote content within the App.
          </p>
        </section>

        <section>
          <h2 className="text-base font-display font-bold text-foreground mb-2">8. Studio Bookings & Sessions</h2>
          <p>
            Studio bookings are facilitated through the platform. Both artists and engineers are expected to honor confirmed bookings. The following rules apply:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Bookings require a unique 6-character session code for joining sessions.</li>
            <li>Pending bookings that are not confirmed by the engineer within the approval window will automatically expire.</li>
            <li>Session time is tracked with a live countdown timer visible to both parties.</li>
            <li>Artists may request time extensions (+15, +30, or +60 minutes), which require engineer approval.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-display font-bold text-foreground mb-2">9. Cancellation Policy</h2>
          <p>
            Users may cancel confirmed studio bookings, subject to the following:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>A <strong className="text-foreground">10% cancellation fee</strong> will be charged based on the total booking amount.</li>
            <li>The remaining 90% will be refunded to the artist.</li>
            <li>Cancelled bookings are marked permanently and cannot be reinstated.</li>
            <li>Repeated cancellations may result in account review or suspension.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-display font-bold text-foreground mb-2">10. Session Completion & Two-Sided Confirmation</h2>
          <p>
            To ensure fairness, session completion requires agreement from both parties:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>When a session ends, the <strong className="text-foreground">engineer marks the session as completed</strong>.</li>
            <li>The <strong className="text-foreground">artist must confirm the session was completed</strong> or report a no-show within 48 hours.</li>
            <li>If the artist confirms, payment is released to the engineer.</li>
            <li>If the artist does not respond within <strong className="text-foreground">48 hours</strong>, the session is automatically confirmed and payment is released.</li>
            <li>If the artist disputes the session, the booking enters <strong className="text-foreground">"Disputed"</strong> status and a support ticket is automatically created for admin review.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-display font-bold text-foreground mb-2">11. No-Show Policy & Accountability</h2>
          <p>
            Engineers who fail to show up for confirmed sessions are subject to the following accountability measures:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Artists may report a no-show for any confirmed booking whose session date has passed.</li>
            <li>Each confirmed no-show results in a <strong className="text-foreground">strike</strong> against the engineer's studio.</li>
            <li>Studios with <strong className="text-foreground">3 or more no-show strikes</strong> will display a public warning badge visible to all users.</li>
            <li>The artist receives a <strong className="text-foreground">full refund</strong> for confirmed no-show incidents.</li>
            <li>Excessive no-shows may result in studio delisting or account suspension.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-display font-bold text-foreground mb-2">12. Fraud, False Accusations & False Reporting</h2>
          <p>
            WHEUAT has a <strong className="text-foreground">zero-tolerance policy</strong> for fraud, false accusations, and false reporting. The following actions are strictly prohibited:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li><strong className="text-foreground">False no-show reports:</strong> Filing a no-show report when the engineer did show up and provide the agreed-upon service.</li>
            <li><strong className="text-foreground">Fraudulent completion claims:</strong> Engineers marking sessions as completed when they did not provide the service.</li>
            <li><strong className="text-foreground">Payment fraud:</strong> Manipulating the booking, dispute, or payout system to receive payments not earned.</li>
            <li><strong className="text-foreground">False dispute claims:</strong> Disputing a legitimate session to avoid payment or obtain an unwarranted refund.</li>
            <li><strong className="text-foreground">Identity fraud:</strong> Impersonating another user, artist, or engineer.</li>
          </ul>
          <p className="mt-2">
            Users found guilty of any of the above may face the following consequences:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li><strong className="text-foreground">First offense:</strong> Written warning and temporary suspension of booking/studio privileges.</li>
            <li><strong className="text-foreground">Second offense:</strong> Account suspension for 30 days and forfeiture of pending payouts.</li>
            <li><strong className="text-foreground">Third offense:</strong> Permanent account deactivation with no right to create a new account.</li>
          </ul>
          <p className="mt-2">
            WHEUAT reserves the right to investigate all disputes and take action at its sole discretion. All decisions made during dispute resolution are final.
          </p>
        </section>

        <section>
          <h2 className="text-base font-display font-bold text-foreground mb-2">13. Dispute Resolution</h2>
          <p>
            When an artist and engineer disagree on whether a session was completed:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>The booking is placed in <strong className="text-foreground">"Disputed"</strong> status.</li>
            <li>Payment is <strong className="text-foreground">held</strong> — neither released nor refunded — until resolved.</li>
            <li>A support ticket is automatically created for admin review.</li>
            <li>Both parties may be contacted to provide evidence (screenshots, session logs, communications).</li>
            <li>An admin will make the final determination: either release payment to the engineer or issue a refund to the artist.</li>
            <li>Abuse of the dispute system is considered false reporting and is subject to the penalties outlined in Section 12.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-display font-bold text-foreground mb-2">14. Account Suspension & Deactivation</h2>
          <p>
            WHEUAT reserves the right to suspend or permanently deactivate any account for the following reasons:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Violation of these Terms of Use.</li>
            <li>Fraudulent activity or false reporting as outlined in Section 12.</li>
            <li>Excessive no-show strikes (engineers) or excessive cancellations.</li>
            <li>Uploading harmful, hateful, illegal, or copyrighted content.</li>
            <li>Impersonation, harassment, spamming, or any abusive behavior.</li>
            <li>Circumventing platform fees or payment systems.</li>
          </ul>
          <p className="mt-2">
            Suspended accounts lose access to all platform features. Deactivated accounts are permanent and all associated data may be deleted after 90 days.
          </p>
        </section>

        <section>
          <h2 className="text-base font-display font-bold text-foreground mb-2">15. Prohibited Conduct</h2>
          <p>
            Users may not upload harmful, hateful, or illegal content. Impersonation, fraud, harassment, and spamming are strictly prohibited. Violations may result in account termination.
          </p>
        </section>

        <section>
          <h2 className="text-base font-display font-bold text-foreground mb-2">16. Limitation of Liability</h2>
          <p>
            WHEUAT provides the platform "as is" and makes no warranties regarding uptime, content accuracy, or transaction outcomes. The platform is not liable for losses arising from use of the App.
          </p>
        </section>

        <section>
          <h2 className="text-base font-display font-bold text-foreground mb-2">17. Privacy Policy</h2>
          <p>
            WHEUAT collects and processes personal data necessary to provide platform services, including account information, uploaded content metadata, booking records, payment information, and usage analytics. Your data is handled as follows:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Personal information is used solely for providing platform services and is never sold to third parties.</li>
            <li>Payment data is processed securely through Stripe and is not stored on WHEUAT servers.</li>
            <li>Session and booking records are retained for dispute resolution and accountability purposes.</li>
            <li>No-show strikes and dispute history are retained as part of your account record.</li>
            <li>Users may request data export or account deletion by contacting support, subject to legal retention requirements.</li>
            <li>WHEUAT may share data with law enforcement if required by law or to prevent fraud.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-display font-bold text-foreground mb-2">18. Contact</h2>
          <p>
            For questions about these Terms, contact us through the app's Help section or Ask Jhi AI assistant.
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
