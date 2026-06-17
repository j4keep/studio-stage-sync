import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function TermsConditions() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="text-white hover:bg-white/20 mb-4"
        >
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-3xl font-bold">Terms & Conditions</h1>
        <p className="text-white/90 mt-2">Effective Date: March 13, 2026</p>
      </div>

      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>TERMS & CONDITIONS FOR ATCHUP</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px] pr-4">
              <div className="space-y-6 text-sm">
                <p>
                  Welcome to Atchup ("Atchup," "the App," "we," "us," "our").
                  These Terms & Conditions ("Terms") govern your access to and use of the Atchup mobile application and any services, tools, content, or features provided by Atchup.
                </p>
                
                <p className="font-semibold">
                  By using Atchup, creating an account, participating in Atchup features, or continuing to access the app, you agree to these Terms. If you do not agree, you must stop using the App immediately.
                </p>

                <div>
                  <h3 className="text-lg font-bold text-primary mb-3">🔹 1. ABOUT ATCHUP</h3>
                  <p className="mb-2">Atchup is a community-based savings coordination and trust-building platform that helps users:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Create and participate in Savings Circles (rotating savings groups)</li>
                    <li>Build and track financial reliability through reputation scores</li>
                    <li>Create and donate to community fundraising campaigns</li>
                    <li>Connect with trusted circle members via messaging</li>
                    <li>Manage their Verified+ premium membership</li>
                  </ul>
                  <p className="mt-3">
                    Atchup provides coordination, tracking, and organizational tools only.
                    Atchup does NOT engage in: banking, lending, money transmission, credit services, escrow services, or financial guarantees.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-primary mb-3">🔹 2. ELIGIBILITY</h3>
                  <p className="mb-2">To use Atchup, you must:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Be at least 18 years old</li>
                    <li>Create a valid account with accurate information</li>
                    <li>Verify your email address</li>
                    <li>Not be previously banned from Atchup</li>
                  </ul>
                  <p className="mt-3">
                    If you create an account on behalf of another person or organization, you confirm you have the legal authority to do so.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-primary mb-3">🔹 3. USER ACCOUNTS</h3>
                  <p className="mb-2">You agree to:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Keep your login credentials secure</li>
                    <li>Not share your account with others</li>
                    <li>Provide accurate profile information</li>
                    <li>Notify Atchup of suspicious activity immediately</li>
                  </ul>
                  <p className="mt-3">
                    Atchup may suspend or terminate accounts at its discretion for safety, misuse, or violation of these Terms.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-primary mb-3">🔹 4. SAVINGS CIRCLES (IMPORTANT SECTION)</h3>
                  
                  <h4 className="font-semibold mt-3 mb-2">4.1 How Savings Circles Work</h4>
                  <p className="mb-2">
                    Savings Circles follow a Rotating Savings and Credit Association (ROSCA) model. A group of members each contribute a fixed amount per period, and one member receives the full pot each round on a rotating basis. Atchup coordinates the schedule, tracks participation, and manages reputation — but does NOT handle any money.
                  </p>

                  <h4 className="font-semibold mt-3 mb-2">4.2 Atchup Only Tracks and Organizes</h4>
                  <p className="mb-2">Atchup does NOT:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Process, hold, or transfer money</li>
                    <li>Handle payments between members</li>
                    <li>Store or custody any funds</li>
                    <li>Guarantee payments or payouts</li>
                    <li>Act as a lender, bank, or financial institution</li>
                  </ul>

                  <h4 className="font-semibold mt-3 mb-2">4.3 Payments Occur Outside the App</h4>
                  <p>
                    All contributions and payouts are sent directly between members through third-party payment platforms (Zelle, Cash App, Venmo, bank transfer, etc.). Members select and coordinate their preferred payment methods privately.
                  </p>

                  <h4 className="font-semibold mt-3 mb-2">4.4 Atchup Is Not Responsible For:</h4>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Missed or late payments by members</li>
                    <li>Fraud committed by members</li>
                    <li>Disputes between members</li>
                    <li>Defaults or unpaid contributions</li>
                    <li>Any money lost between users</li>
                    <li>Member identity or payment verification</li>
                  </ul>
                  <p className="mt-2 font-semibold">Members participate at their own risk.</p>

                  <h4 className="font-semibold mt-3 mb-2">4.5 Participation Agreement</h4>
                  <p>
                    By creating or joining a Savings Circle, you agree to the Atchup Savings Circle Participation Agreement, which includes: default policy, code of conduct, legal remedies, and electronic signature consent. This agreement must be accepted each time you create or join a new circle.
                  </p>

                  <h4 className="font-semibold mt-3 mb-2">4.6 Circle Limits</h4>
                  <p><p>Free users may create 1 active circle with up to 10 members. Verified+ subscribers may create up to 5 active circles with up to 100 members each. These limits are subject to change.</p></p>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-primary mb-3">🔹 5. FUNDRAISING CAMPAIGNS</h3>
                  
                  <h4 className="font-semibold mt-3 mb-2">5.1 Creating Fundraisers</h4>
                  <p className="mb-2">Verified+ members may create fundraising campaigns to raise money for personal or community causes. Atchup provides the platform for listing campaigns but:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Does not verify the legitimacy of campaigns</li>
                    <li>Does not guarantee fundraising goals will be met</li>
                    <li>Is not responsible for how funds are used by campaign creators</li>
                  </ul>

                  <h4 className="font-semibold mt-3 mb-2">5.2 Donations</h4>
                  <p>Donations are processed through third-party payment processors. Atchup is not responsible for refunds, chargebacks, or disputes related to donations. All donations are voluntary.</p>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-primary mb-3">🔹 6. VERIFIED+ SUBSCRIPTION</h3>
                  
                  <h4 className="font-semibold mt-3 mb-2">6.1 Subscription Details</h4>
                  <p className="mb-2">Verified+ is a premium monthly subscription ($10/month) that unlocks additional features including:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Gold Verified+ badge on your profile</li>
                    <li>Up to 5 active Savings Circles</li>
                    <li><li>Up to 100 members per circle</li></li>
                    <li>Create and donate to fundraising campaigns</li>
                    <li>Profile visibility boost</li>
                    <li>Early access to new features</li>
                  </ul>

                  <h4 className="font-semibold mt-3 mb-2">6.2 Billing and Cancellation</h4>
                  <p className="mb-2">Subscriptions auto-renew monthly unless canceled at least 24 hours before the renewal date. You may manage or cancel your subscription through your profile settings. If your payment method fails, your Verified+ benefits will be paused until payment is updated.</p>

                  <h4 className="font-semibold mt-3 mb-2">6.3 Paused Subscriptions</h4>
                  <p>If your payment method is declined or expires, all Verified+ features will be temporarily restricted. You will revert to free-tier limits until payment is resolved. No refunds are provided for partial billing periods.</p>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-primary mb-3">🔹 7. REPUTATION AND RATINGS</h3>
                  <p className="mb-2">Atchup uses a reputation scoring system to help members assess trustworthiness within Savings Circles:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>All users start with a default score of 5.0 out of 5.0</li>
                    <li>Only circle creators may rate members within their circles</li>
                    <li>Ratings reflect on-time payments, reliability, and communication</li>
                    <li>Your reputation score is visible on your profile to other members</li>
                    <li>This is NOT a credit score and has no impact outside of Atchup</li>
                  </ul>
                  <p className="mt-3">
                    Atchup does not guarantee the accuracy of reputation scores and is not liable for any decisions made based on them.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-primary mb-3">🔹 8. MESSAGING AND COMMUNICATION</h3>
                  <p className="mb-2">Atchup provides in-app messaging between circle members. You agree to:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Use messaging respectfully and lawfully</li>
                    <li>Not send spam, threats, or harassing messages</li>
                    <li>Not share others' personal information without consent</li>
                  </ul>
                  <p className="mt-3">
                    Atchup may monitor messages for safety purposes and may restrict messaging access for users who violate these Terms.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-primary mb-3">🔹 9. USER-GENERATED CONTENT</h3>
                  <p className="mb-2">Users may post: messages, images, profile info, reviews, and comments.</p>
                  <p className="mb-2">You agree that:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>You own or have rights to your content</li>
                    <li>Your content does not violate any laws</li>
                    <li>Atchup may remove or restrict content at any time</li>
                  </ul>
                  <p className="mt-3">
                    You grant Atchup a license to host, display, and modify (for formatting only) your content for use within the app.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-primary mb-3">🔹 10. PROHIBITED BEHAVIOR</h3>
                  <p className="mb-2">Users may NOT:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Engage in fraud or scams within Savings Circles</li>
                    <li>Harass, threaten, or bully other members</li>
                    <li>Use fake identities or impersonate others</li>
                    <li>Intentionally default on circle contributions</li>
                    <li>Create fraudulent fundraising campaigns</li>
                    <li>Use the app for illegal activity</li>
                    <li>Send harmful or malicious content</li>
                    <li>Violate the privacy of other members</li>
                    <li>Manipulate reputation scores or ratings</li>
                  </ul>
                  <p className="mt-3">Violations may result in: account deletion, permanent ban, and reporting to authorities.</p>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-primary mb-3">🔹 11. DISCLAIMERS (VERY IMPORTANT)</h3>
                  
                  <h4 className="font-semibold mt-3 mb-2">11.1 No Guarantees</h4>
                  <p className="mb-2">Atchup makes no guarantees regarding:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Payments between circle members</li>
                    <li>User behavior or reliability</li>
                    <li>Fundraiser campaign legitimacy</li>
                    <li>Accuracy of user information or reputation scores</li>
                    <li>Continuous availability of the app</li>
                  </ul>

                  <h4 className="font-semibold mt-3 mb-2">11.2 Not a Financial Service</h4>
                  <p className="mb-2">Atchup is NOT: a bank, a lender, a credit service, a money transmitter, or a payment processor.</p>
                  <p>Atchup provides coordination and tracking tools only.</p>

                  <h4 className="font-semibold mt-3 mb-2">11.3 At Your Own Risk</h4>
                  <p>You use Atchup at your own risk, including: participation in Savings Circles, donations to fundraisers, and interactions with other members.</p>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-primary mb-3">🔹 12. LIMITATION OF LIABILITY</h3>
                  <p className="mb-2">To the maximum extent allowed by law:</p>
                  <p className="mb-3">
                    Atchup, its owners, employees, developers, and affiliates are NOT liable for: lost money, missed payments, fraud by other users, defaults in Savings Circles, failed fundraiser campaigns, emotional distress, technical errors, data loss, unauthorized account access, or any dispute between users.
                  </p>
                  <p className="font-bold">Total liability of Atchup is limited to $0.00.</p>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-primary mb-3">🔹 13. INDEMNIFICATION</h3>
                  <p>
                    You agree to indemnify, defend, and hold harmless Atchup from any claims, losses, damages, legal actions, or liabilities arising from: your use of the app, your interactions with other members, disputes in Savings Circles, disputes related to fundraiser campaigns, or violation of these Terms.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-primary mb-3">🔹 14. TERMINATION</h3>
                  <p>Atchup may suspend, restrict, or permanently delete your account at any time for safety or violation of Terms. Active Savings Circle obligations remain your responsibility even after account termination.</p>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-primary mb-3">🔹 15. PRIVACY POLICY</h3>
                  <p>Your use of Atchup is also governed by the Atchup Privacy Policy, which details how we collect, use, and protect your personal and financial participation data.</p>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-primary mb-3">🔹 16. MODIFICATIONS</h3>
                  <p>Atchup may update these Terms at any time. Changes will be posted in the app with the updated effective date. Continued use of the App means you accept the updated Terms.</p>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-primary mb-3">🔹 17. GOVERNING LAW</h3>
                  <p>These Terms are governed by the laws of the United States, without regard to conflict-of-law principles.</p>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-primary mb-3">🔹 18. CONTACT INFORMATION</h3>
                  <p className="mb-2">For questions or support:</p>
                  <p>Atchup Support Team</p>
                  <p>Email: support@atchup.com</p>
                </div>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}