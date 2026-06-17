import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function IdVerificationPage() {
  const navigate = useNavigate();
  
  return (
    <>
      <Helmet>
        <title>ID Verification & Age Policy • Atchup</title>
        <meta name="description" content="How Atchup verifies identity and age for Verified+ members." />
      </Helmet>
      
      <main className="mx-auto max-w-screen-md px-5 py-10 prose prose-slate">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-4 not-prose"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        
        <h1>Atchup ID Verification & Age Policy</h1>
        <p><strong>Effective Date:</strong> January 2025</p>

        <h2>Purpose</h2>
        <p>
          We verify user identity to protect the Savings Circle community, reduce fraud, and build trust 
          between circle members who rely on each other for financial commitments.
        </p>

        <h2>Verification Process</h2>
        <ul>
          <li>Upload a valid government-issued ID (e.g., driver's license, passport).</li>
          <li>A selfie may be requested to match the ID photo.</li>
          <li>Upon approval, your profile displays a <strong>"✅ Verified+"</strong> badge.</li>
        </ul>

        <h2>Verified+ Benefits</h2>
        <ul>
          <li>Create up to <strong>5 Savings Circles</strong> (vs 1 for free users)</li>
          <li>Allow up to <strong>100 members per circle</strong> (vs 10 for free users)</li>
          <li>Join circles that require Verified+ status</li>
          <li>Enhanced trust and reputation visibility</li>
        </ul>

        <h2>Age Requirement</h2>
        <ul>
          <li>You must be <strong>18 years or older</strong> to use Atchup and participate in Savings Circles.</li>
          <li>Financial commitments in circles require adult responsibility and legal capacity.</li>
        </ul>

        <h2>Data Protection</h2>
        <ul>
          <li>Verification data is encrypted and accessible only to authorized Atchup staff or vendors.</li>
          <li>We retain verification info only as long as needed for compliance and platform safety.</li>
        </ul>

        <h2>Misrepresentation</h2>
        <ul>
          <li>False, altered, or misleading IDs will result in denial of Verified+ status and potential account suspension.</li>
          <li>Repeated violations may result in permanent account termination.</li>
        </ul>

        <h2>Subscription</h2>
        <p>
          Verified+ membership costs <strong>$10/month</strong>. You can upgrade from your Profile page. 
          The subscription unlocks enhanced circle creation limits and community features.
        </p>

        <hr />
        <p className="text-sm">
          See also: <Link to="/m/terms" className="text-sky-600 hover:underline">Terms & Conditions</Link> and <Link to="/m/privacy" className="text-sky-600 hover:underline">Privacy Policy</Link>.
        </p>

        <div className="mt-8 not-prose">
          <Link
            to="/m/profile"
            className="inline-block rounded-xl border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50"
          >
            ← Back to Profile
          </Link>
        </div>
      </main>
    </>
  );
}