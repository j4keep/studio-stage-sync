import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function PrivacyPolicy() {
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
        <h1 className="text-3xl font-bold">Privacy Policy</h1>
        <p className="text-white/90 mt-2">Effective Date: March 13, 2026</p>
      </div>

      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>PRIVACY POLICY FOR ATCHUP</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px] pr-4">
              <div className="space-y-6 text-sm">
                <p>
                  At Atchup, we take your privacy seriously. This Privacy Policy explains how we collect, use, store, and protect your personal information when you use our Savings Circles application.
                </p>

                <div>
                  <h3 className="text-lg font-bold text-primary mb-3">1. Information We Collect</h3>
                  
                  <h4 className="font-semibold mt-3 mb-2">Personal Information</h4>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Name, email address, and username</li>
                    <li>Profile photo (optional)</li>
                    <li>Phone number (for verification)</li>
                    <li>Government ID (for Verified+ users)</li>
                  </ul>

                  <h4 className="font-semibold mt-3 mb-2">Savings Circle Data</h4>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Circle membership and participation history</li>
                    <li>Payment tracking records (dates, status)</li>
                    <li>Reputation scores and ratings</li>
                  </ul>

                  <h4 className="font-semibold mt-3 mb-2">Usage Data</h4>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>App activity and interactions</li>
                    <li>Device information (device type, OS version)</li>
                    <li>Log data and analytics</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-primary mb-3">2. How We Use Your Information</h3>
                  <p className="mb-2">We use your information to:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Facilitate Savings Circle creation and participation</li>
                    <li>Track payment schedules and member turns</li>
                    <li>Calculate and display reputation scores</li>
                    <li>Send notifications about circle activity</li>
                    <li>Verify identity for Verified+ users</li>
                    <li>Ensure safety and prevent fraud</li>
                    <li>Comply with legal obligations</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-primary mb-3">3. Information Sharing</h3>
                  <p className="mb-2">We may share your information with:</p>
                  
                  <h4 className="font-semibold mt-3 mb-2">Circle Members</h4>
                  <p>Your name, profile photo, and payment status are visible to other members in your circles.</p>

                  <h4 className="font-semibold mt-3 mb-2">Service Providers</h4>
                  <p>Third-party services that help us operate the app (hosting, analytics, identity verification).</p>

                  <h4 className="font-semibold mt-3 mb-2">Legal Requirements</h4>
                  <p>When required by law, court order, or government request.</p>

                  <p className="mt-3 font-semibold">We do NOT sell your personal information to third parties.</p>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-primary mb-3">4. Data Security</h3>
                  <p className="mb-2">We implement security measures to protect your data, including:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Encryption of sensitive data</li>
                    <li>Secure servers and databases</li>
                    <li>Regular security audits</li>
                    <li>Access controls and authentication</li>
                  </ul>
                  <p className="mt-3">
                    However, no method of transmission over the internet is 100% secure. You use the app at your own risk.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-primary mb-3">5. Data Retention</h3>
                  <p>
                    We retain your information for as long as your account is active or as needed to provide services. Circle participation history may be retained for reputation scoring purposes. You may request deletion of your account and data at any time.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-primary mb-3">6. Your Rights</h3>
                  <p className="mb-2">You have the right to:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Access your personal information</li>
                    <li>Correct inaccurate data</li>
                    <li>Request deletion of your data</li>
                    <li>Opt out of marketing communications</li>
                    <li>Withdraw consent for data processing</li>
                    <li>Export your data</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-primary mb-3">7. Cookies and Tracking</h3>
                  <p>
                    We may use cookies and similar technologies to improve your experience, analyze usage, and provide personalized content. You can manage cookie preferences in your device settings.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-primary mb-3">8. Age Requirements</h3>
                  <p>
                    Atchup is intended for users 18 years of age and older. We do not knowingly collect data from minors. If we discover we have collected information from someone under 18, we will delete it immediately.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-primary mb-3">9. Third-Party Links</h3>
                  <p>
                    Our app may contain links to external websites or services. We are not responsible for the privacy practices of third-party sites. Please review their privacy policies before sharing information.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-primary mb-3">10. Changes to Privacy Policy</h3>
                  <p>
                    We may update this Privacy Policy from time to time. Changes will be posted in the app with the updated date. Continued use of Atchup after changes constitutes acceptance of the new policy.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-primary mb-3">11. International Users</h3>
                  <p>
                    If you are accessing Atchup from outside the United States, your information may be transferred to and stored in the U.S. By using the app, you consent to this transfer.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-primary mb-3">12. Contact Us</h3>
                  <p className="mb-2">If you have questions about this Privacy Policy or how we handle your data:</p>
                  <p>Atchup Support Team</p>
                  <p>Email: privacy@atchup.com</p>
                  <p>We will respond to your inquiry within 30 days.</p>
                </div>

                <div className="mt-8 p-4 bg-muted rounded-lg">
                  <p className="font-semibold">Your Privacy Matters</p>
                  <p className="mt-2">
                    By using Atchup, you acknowledge that you have read and understood this Privacy Policy and agree to the collection, use, and sharing of your information as described.
                  </p>
                </div>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}