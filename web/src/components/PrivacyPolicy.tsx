import { Shield, ArrowLeft } from 'lucide-react';
import { Button } from './ui/button';

interface PrivacyPolicyProps {
  onBack: () => void;
}

export function PrivacyPolicy({ onBack }: PrivacyPolicyProps) {
  return (
    // [FIX] Changed background color to #1a1a18
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
            <Shield className="w-4 h-4" />
            <span>Legal Document</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Title Section */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#faff6a]/10 border border-[#faff6a]/30 rounded-full text-[#faff6a] text-sm mb-6">
            <Shield className="w-4 h-4" />
            <span>Privacy & Security</span>
          </div>
          <h1 className="text-4xl text-[#e5e5e5] mb-4">Privacy Policy</h1>
          <p className="text-[#9ca3af]">
            Last updated: <span className="text-[#e5e5e5]">October 20, 2025</span>
          </p>
        </div>

        {/* Content Sections */}
        <div className="space-y-8 text-[#9ca3af] leading-relaxed">
 {/* Introduction */}
          <section className="space-y-4">
            <h2 className="text-2xl text-[#e5e5e5]">Introduction</h2>
            {/* [NEW] Added legal entity name and address */}
            <p>
              Welcome to Market Pulse, operated by <strong>ROCKENUE INTERNATIONAL GROUP</strong> ("we", "us", or "our"). 
              Our registered address is 5842+632 Grand Stand, Nad Al Sheba 1, Dubai, United Arab Emirates.
            </p>
            <p>
              We respect your privacy and are committed to protecting your personal data. 
              This privacy policy will inform you about how we look after your personal data when you visit our 
              platform and tell you about your privacy rights and how the law protects you.
            </p>
            <p>
              Market Pulse is a free hotel performance analytics platform that helps hoteliers benchmark their 
              performance against their competitive set. We take data privacy seriously and are transparent about 
              how we collect, use, and protect your information.
            </p>
          </section>

          {/* Information We Collect */}
          <section className="space-y-4">
            <h2 className="text-2xl text-[#e5e5e5]">Information We Collect</h2>
            <p>We collect and process the following types of information:</p>
            
            <div className="bg-[#1a1a18] border border-[#3a3a35] rounded-lg p-6 space-y-4">
              <div>
                <h3 className="text-lg text-[#faff6a] mb-2">Account Information</h3>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Email address (for magic link authentication)</li>
                  <li>Hotel property details (name, location, room count)</li>
                  <li>User profile information (name, role, preferences)</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg text-[#faff6a] mb-2">Property Management System (PMS) Data</h3>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Occupancy rates and room night statistics</li>
                  <li>Average Daily Rate (ADR) and revenue data</li>
                  <li>Booking patterns and reservation information</li>
                  <li>Property performance metrics</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg text-[#faff6a] mb-2">Usage Information</h3>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Platform usage statistics and feature interactions</li>
                  <li>Report generation and export activities</li>
                  <li>Dashboard preferences and settings</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg text-[#faff6a] mb-2">Technical Information</h3>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>IP address and browser information</li>
                  <li>Device type and operating system</li>
                  <li>Cookies and similar tracking technologies</li>
                </ul>
              </div>
            </div>
          </section>

          {/* How We Use Your Information */}
          <section className="space-y-4">
            <h2 className="text-2xl text-[#e5e5e5]">How We Use Your Information</h2>
            <p>We use your information for the following purposes:</p>
            
            <ul className="list-disc list-inside space-y-3 ml-4">
              <li>
                <span className="text-[#e5e5e5]">Provide our services:</span> To deliver market analytics, 
                competitive benchmarking, and performance reporting
              </li>
              <li>
                <span className="text-[#e5e5e5]">Account management:</span> To create and manage your account, 
                process authentication, and provide customer support
              </li>
              <li>
                <span className="text-[#e5e5e5]">Market intelligence:</span> To aggregate anonymized data for 
                market-level insights and benchmarking (your individual property data remains private)
              </li>
              <li>
                <span className="text-[#e5e5e5]">Platform improvement:</span> To analyze usage patterns and 
                improve our features and user experience
              </li>
              <li>
                <span className="text-[#e5e5e5]">Communications:</span> To send you important updates, security 
                alerts, and feature announcements (you can opt out of marketing communications)
              </li>
              <li>
                <span className="text-[#e5e5e5]">Security:</span> To protect against fraud, unauthorized access, 
                and other security risks
              </li>
            </ul>
          </section>

          {/* Data Sharing */}
          <section className="space-y-4">
            <h2 className="text-2xl text-[#e5e5e5]">Data Sharing and Disclosure</h2>
            <p>
              We do not sell your personal data. We may share your information in the following limited circumstances:
            </p>
            
            <div className="space-y-3 ml-4">
              <div className="bg-[#1a1a18] border border-[#3a3a35] rounded-lg p-4">
                <h3 className="text-[#e5e5e5] mb-2">PMS Integration Partners</h3>
                <p>
                  We connect with your PMS provider (Cloudbeds, Mews, etc.) to retrieve performance data. 
                  This integration is secured through OAuth and API keys you authorize.
                </p>
              </div>

              <div className="bg-[#1a1a18] border border-[#3a3a35] rounded-lg p-4">
                <h3 className="text-[#e5e5e5] mb-2">Anonymized Market Data</h3>
                <p>
                  We aggregate data from multiple properties to create market-level insights. This data is 
                  fully anonymized and cannot be traced back to individual properties.
                </p>
              </div>

              <div className="bg-[#1a1a18] border border-[#3a3a35] rounded-lg p-4">
                <h3 className="text-[#e5e5e5] mb-2">Service Providers</h3>
                <p>
                  We use trusted third-party service providers for hosting, analytics, and email delivery. 
                  These providers are bound by strict data processing agreements.
                </p>
              </div>

              <div className="bg-[#1a1a18] border border-[#3a3a35] rounded-lg p-4">
                <h3 className="text-[#e5e5e5] mb-2">Legal Requirements</h3>
                <p>
                  We may disclose information when required by law, court order, or government regulation, 
                  or to protect our rights and the safety of our users.
                </p>
              </div>
            </div>
          </section>

          {/* Data Security */}
          <section className="space-y-4">
            <h2 className="text-2xl text-[#e5e5e5]">Data Security</h2>
            <p>
              We implement industry-standard security measures to protect your data:
            </p>
            
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>End-to-end encryption for data transmission (TLS/SSL)</li>
              <li>Encrypted data storage with secure database infrastructure</li>
              <li>Regular security audits and vulnerability assessments</li>
              <li>Access controls and authentication mechanisms</li>
              <li>Secure API integrations with PMS providers</li>
              <li>Regular backups and disaster recovery procedures</li>
            </ul>

            <div className="bg-[#faff6a]/10 border border-[#faff6a]/30 rounded-lg p-4 mt-4">
              <p className="text-[#faff6a]">
                <strong>Important:</strong> While we implement robust security measures, no system is 100% secure. 
                We encourage you to use strong passwords and keep your login credentials confidential.
              </p>
            </div>
          </section>

          {/* Data Retention */}
          <section className="space-y-4">
            <h2 className="text-2xl text-[#e5e5e5]">Data Retention</h2>
            <p>
              We retain your information for as long as necessary to provide our services and comply with legal obligations:
            </p>
            
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Account data: Retained while your account is active, plus 30 days after account closure</li>
              <li>Performance data: Retained for historical analysis and trend reporting (typically 3-5 years)</li>
              <li>Anonymized market data: Retained indefinitely for market intelligence purposes</li>
              <li>Usage logs: Retained for 12 months for security and analytics purposes</li>
            </ul>
          </section>

          {/* Your Rights */}
          <section className="space-y-4">
            <h2 className="text-2xl text-[#e5e5e5]">Your Privacy Rights</h2>
            <p>
              You have the following rights regarding your personal data:
            </p>
            
            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <div className="bg-[#1a1a18] border border-[#3a3a35] rounded-lg p-4">
                <h3 className="text-[#faff6a] mb-2">Access</h3>
                <p className="text-sm">Request a copy of the personal data we hold about you</p>
              </div>
              
              <div className="bg-[#1a1a18] border border-[#3a3a35] rounded-lg p-4">
                <h3 className="text-[#faff6a] mb-2">Correction</h3>
                <p className="text-sm">Request corrections to inaccurate or incomplete data</p>
              </div>
              
              <div className="bg-[#1a1a18] border border-[#3a3a35] rounded-lg p-4">
                <h3 className="text-[#faff6a] mb-2">Deletion</h3>
                <p className="text-sm">Request deletion of your personal data (subject to legal requirements)</p>
              </div>
              
              <div className="bg-[#1a1a18] border border-[#3a3a35] rounded-lg p-4">
                <h3 className="text-[#faff6a] mb-2">Export</h3>
                <p className="text-sm">Request a portable copy of your data in a common format</p>
              </div>
              
              <div className="bg-[#1a1a18] border border-[#3a3a35] rounded-lg p-4">
                <h3 className="text-[#faff6a] mb-2">Opt-out</h3>
                <p className="text-sm">Unsubscribe from marketing communications at any time</p>
              </div>
              
              <div className="bg-[#1a1a18] border border-[#3a3a35] rounded-lg p-4">
                <h3 className="text-[#faff6a] mb-2">Object</h3>
                <p className="text-sm">Object to certain types of data processing activities</p>
              </div>
            </div>

       <p className="mt-4">
              To exercise any of these rights, please contact us at{' '}
              {/* [FIX] Standardized email to support@ */}
              <a href="mailto:support@market-pulse.io" className="text-[#faff6a] hover:underline">
                support@market-pulse.io
              </a>
            </p>
          </section>

          {/* Cookies */}
          <section className="space-y-4">
            <h2 className="text-2xl text-[#e5e5e5]">Cookies and Tracking Technologies</h2>
            <p>
              We use cookies and similar technologies to enhance your experience and analyze platform usage:
            </p>
            
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><span className="text-[#e5e5e5]">Essential cookies:</span> Required for authentication and basic functionality</li>
              <li><span className="text-[#e5e5e5]">Preference cookies:</span> Remember your settings and preferences</li>
              <li><span className="text-[#e5e5e5]">Analytics cookies:</span> Help us understand how users interact with our platform</li>
            </ul>

            <p>
              You can control cookie settings through your browser, but disabling certain cookies may limit 
              platform functionality.
            </p>
          </section>

          {/* International Transfers */}
          <section className="space-y-4">
            <h2 className="text-2xl text-[#e5e5e5]">International Data Transfers</h2>
            <p>
              Your data may be processed and stored in countries outside your jurisdiction. We ensure appropriate 
              safeguards are in place for international transfers, including:
            </p>
            
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Standard contractual clauses approved by regulatory authorities</li>
              <li>Adequacy decisions recognizing equivalent data protection standards</li>
   
            </ul>
          </section>

          {/* Children's Privacy */}
          <section className="space-y-4">
            <h2 className="text-2xl text-[#e5e5e5]">Children's Privacy</h2>
            <p>
              Market Pulse is intended for business use by hotel professionals. We do not knowingly collect 
              personal information from individuals under 18 years of age.
            </p>
          </section>

          {/* Changes to Policy */}
          <section className="space-y-4">
            <h2 className="text-2xl text-[#e5e5e5]">Changes to This Policy</h2>
            <p>
              We may update this privacy policy from time to time to reflect changes in our practices or legal 
              requirements. We will notify you of significant changes via email or prominent platform notice. 
              Your continued use of Market Pulse after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          {/* Contact */}
          <section className="space-y-4">
            <h2 className="text-2xl text-[#e5e5e5]">Contact Us</h2>
            <p>
              If you have questions, concerns, or requests regarding this privacy policy or our data practices, 
              please contact us:
            </p>
            
   <div className="bg-[#1a1a18] border border-[#3a3a35] rounded-lg p-6">
              <div className="space-y-2">
                <p>
                  <span className="text-[#e5e5e5]">Email:</span>{' '}
                  {/* [FIX] Standardized email to support@ */}
                  <a href="mailto:support@market-pulse.io" className="text-[#faff6a] hover:underline">
                    support@market-pulse.io
                  </a>
                </p>
                {/* [REMOVE] Removed DPO and response time per request */}
              </div>
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
