import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const TermsPage = () => {
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-xl font-display font-bold text-foreground">Terms of Use & Privacy Policy</h1>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Last updated October 14, 2026</p>
        </div>
      </div>

      <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section>
          <p>
            YAJ is a community and discovery platform with social posts, messaging, local services, opportunities,
            events, Marketplace, Deals, Radio, Games, wellness tools, books, AI assistance, and other connected
            features. These Terms and this Privacy Policy apply to your use of YAJ.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-display font-bold text-foreground">1. Acceptance of Terms</h2>
          <p>
            By creating an account or using YAJ, you agree to these Terms and our Privacy Policy. If you do not agree,
            do not use the service.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-display font-bold text-foreground">2. Eligibility & Accounts</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>You must meet the minimum age required by applicable law to create an account.</li>
            <li>You are responsible for the accuracy of your account information and for protecting your login credentials.</li>
            <li>One YAJ account may be used across the app, including Profile, Feed, Marketplace, Local Help, Jobs, Events, Deals, Radio, Games, and YAJ AI.</li>
            <li>Some features may have additional eligibility, verification, or payment requirements.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-display font-bold text-foreground">3. Community Content</h2>
          <p>
            Users may create posts, photos, videos, comments, messages, listings, events, audio, books, business
            profiles, opportunities, and other content. You keep ownership of content you create, but you grant YAJ a
            limited license to host, display, process, and distribute that content as needed to operate the service.
          </p>
          <p className="mt-2">
            You may only upload content you have the right to use. Copyright infringement, impersonation, harassment,
            threats, scams, spam, unlawful content, and attempts to abuse or manipulate the platform are prohibited.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-display font-bold text-foreground">4. Marketplace, Local Help, Jobs, Gigs, Events & Deals</h2>
          <p>
            YAJ helps users discover and communicate with buyers, sellers, employers, service providers, event hosts,
            and businesses. Unless YAJ expressly states otherwise, users and businesses are responsible for the
            accuracy of their listings, qualifications, prices, availability, work, goods, services, events, and
            agreements with one another.
          </p>
          <p className="mt-2">
            Use reasonable care when meeting, hiring, selling, buying, or exchanging information with another user.
            Report suspicious activity through the available reporting tools or Help Desk.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-display font-bold text-foreground">5. Location & Local Discovery</h2>
          <p>
            If you provide a ZIP code, address, or device location, YAJ may use it to show nearby Marketplace items,
            Deals, Opportunities, Events, Local Help, Gigs, and other local activity. You can change your saved local
            area or choose broader discovery from Settings where available.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-display font-bold text-foreground">6. YAJ AI</h2>
          <p>
            YAJ AI can help with app navigation, writing, ideas, images, files, voice, and other supported requests.
            AI responses may be incomplete or incorrect and should not be treated as professional legal, financial,
            medical, or other expert advice. Do not rely on AI output for emergencies or high-stakes decisions without
            appropriate independent review.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-display font-bold text-foreground">7. Payments, Purchases & Subscriptions</h2>
          <p>
            Some YAJ features may involve purchases, seller transactions, paid services, subscriptions, or third-party
            payment providers. Prices, fees, renewal terms, refund rules, and payment methods are shown at the point of
            purchase where applicable. Purchases made through an app store may also be subject to that store's terms.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-display font-bold text-foreground">8. Safety, Moderation & Enforcement</h2>
          <p>
            YAJ may remove content, limit features, issue warnings, temporarily restrict activity, suspend accounts, or
            permanently disable accounts when needed to protect users, enforce these Terms, prevent fraud, or comply
            with law. Users may use available Report, Block, Safety, and Help Desk tools to raise concerns.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-display font-bold text-foreground">9. Account Deletion</h2>
          <p>
            You can initiate account deletion from Settings. Deletion is permanent once completed. Some limited records
            may be retained when required for security, fraud prevention, dispute handling, legal compliance, or other
            legitimate obligations.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-display font-bold text-foreground">10. Service Availability</h2>
          <p>
            YAJ is provided on an "as available" basis. Features may change, pause, or be removed, and uninterrupted
            availability is not guaranteed. We may update the app and these Terms as the service evolves.
          </p>
        </section>

        <section id="privacy">
          <h2 className="mb-2 text-base font-display font-bold text-foreground">11. Privacy Policy</h2>
          <p>YAJ may process information needed to provide and protect the service, including:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Account and profile information.</li>
            <li>Content you upload, post, send, save, or attach.</li>
            <li>Messages, support requests, reports, and moderation records.</li>
            <li>Marketplace, Deal, Local Help, Job, Gig, Event, Radio, Game, and other feature activity.</li>
            <li>Saved ZIP code, approximate location, or precise location when you choose to provide it.</li>
            <li>Device, usage, performance, security, and diagnostic information.</li>
            <li>AI prompts and attachments needed to provide YAJ AI features.</li>
            <li>Payment or transaction information handled by payment providers where applicable.</li>
          </ul>
          <p className="mt-2">
            YAJ uses this information to operate features, personalize discovery, maintain security, prevent abuse,
            provide support, improve performance, and comply with legal obligations. YAJ does not sell personal
            information to advertisers.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-display font-bold text-foreground">12. Your Choices</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Manage profile, privacy, blocking, local discovery, and app preferences from Settings.</li>
            <li>Use Report and Block tools where available.</li>
            <li>Contact the Help Desk for support, complaints, privacy questions, or account issues.</li>
            <li>Initiate account deletion from Settings.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-display font-bold text-foreground">13. Contact</h2>
          <p>
            For support, complaints, safety concerns, privacy questions, or account issues, use the in-app Help Desk.
          </p>
          <p className="mt-2">
            By continuing to use YAJ, you acknowledge that you have read and understood these Terms of Use and Privacy Policy.
          </p>
        </section>
      </div>
    </div>
  );
};

export default TermsPage;
