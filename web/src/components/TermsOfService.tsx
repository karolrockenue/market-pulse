import { FileText, ArrowLeft } from 'lucide-react';
import { Button } from './ui/button';

interface TermsOfServiceProps {
  onBack: () => void;
}

export function TermsOfService({ onBack }: TermsOfServiceProps) {
  return (
    // [FIX] Background set to solid #1a1a18
    <div className="min-h-screen bg-[#1a1a18] text-[#e5e5e5]">
      {/* Header */}
      {/* [FIX] Removed bg opacity (/80) and backdrop-blur-sm to make the header opaque */}
      <div className="border-b border-[#3a3a35] bg-[#1a1a18] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Button
            onClick={onBack}
            variant="ghost"
            className="text-[#9ca3af] hover:text-[#faff6a] hover:bg-transparent"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-2 text-[#9ca3af] text-sm">
            <FileText className="w-4 h-4" />
            <span>Legal Document</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Title Section */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#faff6a]/10 border border-[#faff6a]/30 rounded-full text-[#faff6a] text-sm mb-6">
            <FileText className="w-4 h-4" />
            <span>Legal Agreement</span>
          </div>
          <h1 className="text-4xl text-[#e5e5e5] mb-4">Terms of Service</h1>
          <p className="text-[#9ca3af]">
            {/* [MERGE] Updated Last Updated date from old file */}
            Last updated: <span className="text-[#e5e5e5]">July 9, 2025</span>
          </p>
        </div>

        {/* Content Sections */}
        <div className="space-y-8 text-[#9ca3af] leading-relaxed">
          {/* Introduction */}
          <section className="space-y-4">
            <h2 className="text-2xl text-[#e5e5e5]">Agreement to Terms</h2>
            <p>
              {/* [MERGE] Added legal entity name from old file */}
              Welcome to Market Pulse. These Terms of Service ("Terms") govern
              your access to and use of the services, websites, and
              applications offered by Market Pulse ("Service"), operated by
              <strong> ROCKENUE INTERNATIONAL GROUP</strong>.
            </p>
            <p>
              {/* [MERGE] Merged content from old file */}
              By accessing or using our Service, you agree to be bound by
              these Terms and our Privacy Policy. If you do not agree to these
              Terms, you may not use the Service.
            </p>
          </section>

          {/* Service Description */}
          <section className="space-y-4">
            <h2 className="text-2xl text-[#e5e5e5]">Service Description</h2>
            <p>
              {/* [MERGE] Content from old file */}
              The Service provides hotel operators with a performance
              analytics dashboard, market benchmarking tools, and other data
              insights by accessing data from your connected Property
              Management System (PMS) on a <strong>read-only basis</strong>.
            </p>

            <div className="bg-[#faff6a]/10 border border-[#faff6a]/30 rounded-lg p-4 mt-4">
              <p className="text-[#faff6a]">
                <strong>Fees and Changes to Service</strong>
              </p>
              <p className="text-[#e5e5e5] mt-2">
                {/* [MERGE] Merged 30-day notice clause from old file */}
                The core features of the Service are currently provided to you
                free of charge. However, we reserve the right to introduce fees
                for the use of the Service or for new premium features in the
                future. We will provide you with at least
                <strong> 30 days' advance notice</strong> of any such changes.
              </p>
            </div>
          </section>

          {/* Account Registration */}
          <section className="space-y-4">
            <h2 className="text-2xl text-[#e5e5e5]">Account Registration and Use</h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-lg text-[#e5e5e5] mb-2">Eligibility</h3>
                <p>
                  You must be at least 18 years old and authorized to represent the hotel property you register. 
                  By creating an account, you represent and warrant that you have the authority to bind your 
                  organization to these Terms.
                </p>
              </div>

              <div>
                <h3 className="text-lg text-[#e5e5e5] mb-2">Acceptable Use</h3>
                <p>
                  {/* [MERGE] Combined rules from old file into new structure */}
                  You are responsible for all activities that occur under your
                  account. You agree NOT to:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                  <li>Use the platform for any illegal or unauthorized purpose</li>
                  <li>Attempt to de-anonymize, reverse-engineer, scrape, or otherwise steal the data, source code, or core business ideas of the Service</li>
                  <li>Resell or sublicense your access to the Service</li>
                  <li>Interfere with or disrupt the platform's functionality</li>
                  <li>Upload malicious code, viruses, or harmful content</li>
                  <li>Impersonate another user or provide false information</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Data and Privacy */}
          <section className="space-y-4">
            <h2 className="text-2xl text-[#e5e5e5]">Data Usage and Privacy</h2>
            
            <div className="bg-[#1a1a18] border border-[#3a3a35] rounded-lg p-6 space-y-4">
              <div>
                <h3 className="text-lg text-[#faff6a] mb-2">Your Property Data</h3>
                <p>
                  You retain all ownership rights to your hotel's performance data. By using Market Pulse, you 
                  grant us a limited license to process this data solely to provide our services.
                </p>
              </div>

              <div>
                {/* [MERGE] This entire section is replaced with the critical 'commercial rights' clause from the old file */}
                <h3 className="text-lg text-[#faff6a] mb-2">License to Your Data</h3>
                <p>
                  To operate and improve the Service, you grant us a worldwide,
                  perpetual, irrevocable, royalty-free license to use, host,
                  store, reproduce, modify, and create derivative works from the
                  data provided by your PMS. Specifically, you agree that:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                  <li>
                    We will use your hotel's performance data to power your
                    private dashboard.
                  </li>
                  <li>
                    We will use your hotel's performance data in an
                    <strong> anonymized and aggregated</strong> form, combined with
                    data from other hotels, to create market analytics, reports,
                    and other data-driven products.
                  </li>
                  <li>
                    These aggregated and anonymized data products may be used to
                    create new tools or be part of <strong>commercial offerings sold to
                    third parties</strong> (such as developers, research agencies, or other
                    businesses).
                  </li>
                  <li>
                    In any public or commercial use of this aggregated data, your
                    hotel's name, confidential information, or any other
                    personally identifiable information will
                    <strong> never</strong> be disclosed.
                  </li>
                </ul>
              </div>
            </div>
          </section>
          
          {/* [NEW SECTION] Added Data Withdrawal from old file */}
          <section className="space-y-4">
            <h2 className="text-2xl text-[#e5e5e5]">Data Withdrawal</h2>
            <p>
              In addition to your rights under our Privacy Policy, you may
              request the removal of your specific hotel's historical
              performance data from our active databases. To do so, you must
              send a formal request to our support email. We will process this
              request and remove the data as is commercially reasonable.
              Please note that data already included in historical,
              anonymized, and aggregated market sets cannot be retroactively
              removed.
            </p>
          </section>

          {/* Intellectual Property */}
          <section className="space-y-4">
            <h2 className="text-2xl text-[#e5e5e5]">Intellectual Property Rights</h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-lg text-[#e5e5e5] mb-2">Our Rights</h3>
                <p>
                  {/* [MERGE] Added legal entity name from old file */}
                  The Service and its original content, features, and
                  functionality are and will remain the exclusive property of
                  <strong> ROCKENUE INTERNATIONAL GROUP</strong> and its licensors.
                </p>
              </div>
            </div>
          </section>

          {/* Disclaimers */}
          <section className="space-y-4">
            <h2 className="text-2xl text-[#e5e5e5]">Disclaimers and Limitations</h2>
            
            <div className="bg-[#2C2C2C] border border-[#3a3a35] rounded-lg p-6 space-y-4">
              <div>
                <h3 className="text-lg text-[#faff6a] mb-2">"AS IS" Basis</h3>
                <p>
                  {/* [MERGE] Using old file's text */}
                  The Service is provided on an "AS IS" and "AS AVAILABLE" basis.
                  We do not warrant that the service will be uninterrupted,
                  secure, or error-free.
                </p>
              </div>
            </div>
          </section>

          {/* Limitation of Liability */}
          <section className="space-y-4">
            <h2 className="text-2xl text-[#e5e5e5]">Limitation of Liability</h2>
            
            <p>
              {/* [MERGE] Added legal entity name from old file */}
              In no event shall <strong>ROCKENUE INTERNATIONAL GROUP</strong> be liable for
              any indirect, incidental, or consequential damages resulting
              from your use of the Service.
            </p>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, MARKET PULSE AND ITS AFFILIATES, OFFICERS, EMPLOYEES, AND 
              PARTNERS SHALL NOT BE LIABLE FOR:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Loss of profits, revenue, data, or business opportunities</li>
              <li>Service interruptions or data loss</li>
            </ul>
          </section>

          {/* Termination */}
          <section className="space-y-4">
            <h2 className="text-2xl text-[#e5e5e5]">Termination</h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-lg text-[#e5e5e5] mb-2">By You</h3>
                <p>
                  {/* [MERGE] Added termination method from old file */}
                  You may terminate these Terms at any time by
                  <strong> disconnecting the Market Pulse application from within
                  your PMS settings</strong> or by contacting our support team.
                </p>
              </div>

              <div>
                <h3 className="text-lg text-[#e5e5e5] mb-2">By Us</h3>
                <p>
                  We may suspend or terminate your access immediately, without notice, if you:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                  <li>Violate these Terms (especially "Acceptable Use")</li>
                  <li>Engage in fraudulent or illegal activities</li>
                  <li>Pose a security risk to our platform or other users</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Dispute Resolution */}
          <section className="space-y-4">
            <h2 className="text-2xl text-[#e5e5e5]">Dispute Resolution</h2>
            
            <div className="space-y-4">
              <div className="bg-[#1a1a18] border border-[#3a3a35] rounded-lg p-4">
                <h3 className="text-[#e5e5e5] mb-2">Informal Resolution</h3>
                <p>
                  {/* [MERGE] Using support@ email */}
                  Before filing a formal claim, please contact us at{' '}
                  <a href="mailto:support@market-pulse.io" className="text-[#faff6a] hover:underline">
                    support@market-pulse.io
                  </a>{' '}
                  to attempt to resolve the dispute informally.
                </p>
              </div>

              <div className="bg-[#1a1a18] border border-[#3a3a35] rounded-lg p-4">
                <h3 className="text-[#e5e5e5] mb-2">Governing Law</h3>
                <p>
                  {/* [FIX] Updated jurisdiction per user request */}
                  These Terms are governed by the laws of the United Arab Emirates, without regard to conflict of law 
                  principles. Any legal action must be brought in the courts located in Dubai.
                </p>
              </div>
            </div>
          </section>

          {/* Contact */}
          <section className="space-y-4">
            <h2 className="text-2xl text-[#e5e5e5]">Contact Information</h2>
            <p>
              If you have any questions about these Terms, please contact us at:
            </p>
            
            <div className="bg-[#1a1a18] border border-[#3a3a35] rounded-lg p-6">
              <div className="space-y-2">
                <p>
                  {/* [MERGE] Using old file's simple contact block */}
                  <strong>support@market-pulse.io</strong>
                </p>
              </div>
            </div>
          </section>

          {/* Acknowledgment */}
          <section className="space-y-4">
            <div className="bg-[#faff6a]/10 border border-[#faff6a]/30 rounded-lg p-6">
              <p className="text-[#e5e5e5]">
                BY CREATING AN ACCOUNT OR USING MARKET PULSE, YOU ACKNOWLEDGE THAT YOU HAVE READ, UNDERSTOOD, 
                AND AGREE TO BE BOUND BY THESE TERMS OF SERVICE.
              </p>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-[#3a3a35] text-center">
          <p className="text-[#6b7280] text-sm">
            © 2025 Market Pulse. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}