import { useState } from 'react';
import { ArrowLeft, Send, Mail, MessageSquare, Lightbulb, Plug, CheckCircle2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card } from './ui/card';
import { toast } from 'sonner';

interface SupportPageProps {
  onBack: () => void;
}

export function SupportPage({ onBack }: SupportPageProps) {
  const [requestType, setRequestType] = useState('feedback');
  const [subject, setSubject] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
const [pmsType, setPmsType] = useState('');
// [MODIFIED] Use a state to track the submission loading status
const [isSubmitting, setIsSubmitting] = useState(false);

// [MODIFIED] This function now calls the backend API
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setIsSubmitting(true); // Disable the form

  try {
    // 1. Send the form data to the new API endpoint
    const response = await fetch('/api/support/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        subject,
        message,
        requestType,
        pmsType: requestType === 'pms' ? pmsType : undefined, // Only send pmsType if relevant
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      // If the server returns an error, show it
      throw new Error(result.error || 'Failed to submit request.');
    }

    // 2. Show success toast and reset the form
    toast.success('Your request has been submitted successfully!');
    setSubject('');
    setEmail('');
    setMessage('');
    setPmsType('');
    // We don't reset the requestType, as the user might want to send another

  } catch (error: any) {
    // 3. Show error toast
    console.error('Support form submission error:', error);
    toast.error('Submission Failed', {
      description: error.message || 'Please try again later.',
    });
  } finally {
    // 4. Re-enable the form
    setIsSubmitting(false);
  }
};
  const requestTypes = [
    { value: 'feedback', label: 'General Feedback', icon: MessageSquare },
    { value: 'feature', label: 'Feature Request', icon: Lightbulb },
    { value: 'pms', label: 'PMS Integration Request', icon: Plug },
  ];

  const pmsOptions = [
    'Opera Cloud',
    'Mews',
    'Cloudbeds',
    'Stayntouch',
    'RoomKeyPMS',
    'Hotelogix',
    'Little Hotelier',
    'eZee Absolute',
    'Maestro PMS',
    'Other',
  ];

return (
  <div className="bg-[#252522] p-6">
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
    {/* [FIX] Updated background color per user request */}
    {/* [FIX] Removed min-h-screen (now handled by App.tsx) */}

        {/* Header */}
        <div className="mb-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-[#9ca3af] hover:text-[#faff6a] transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back</span>
          </button>

          <div className="flex items-center gap-3 mb-2">
            <div className="w-1 h-8 bg-[#faff6a]" />
            <h1 className="text-[#e5e5e5] tracking-wide">Support Center</h1>
          </div>
          <p className="text-[#9ca3af] ml-4">
            We're here to help. Submit your feedback, request features, or reach out for assistance.
          </p>
        </div>
{/* [FIX] Use a 3-column grid to create a 2/3 + 1/3 split */}
        {/* [FIX] Replaced 'md:grid-cols-3' with 'grid-cols-12' to use classes
            known to be in the static CSS build, matching the main Dashboard. */}
        <div className="grid grid-cols-12 gap-6">
          {/* Main Form */}
          {/* [FIX] Main form now spans 8 of 12 columns */}
          <div className="col-span-8">
   <Card className="bg-[#1a1a18] border-[#2C2C2C] p-6">
  {/* [REMOVED] The 'submitted' success screen is no longer needed; toasts handle this. */}
  <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Request Type Selection */}
                  <div>
                    <Label className="text-[#e5e5e5] mb-3 block">
                      What can we help you with?
                    </Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {requestTypes.map((type) => {
                        const Icon = type.icon;
                        return (
                          <button
                            key={type.value}
                            type="button"
                            onClick={() => setRequestType(type.value)}
                            className={`p-4 rounded-lg border-2 transition-all ${
                              requestType === type.value
                                ? 'border-[#faff6a] bg-[#faff6a]/5'
                                : 'border-[#2C2C2C] bg-[#252521] hover:border-[#3a3a35]'
                            }`}
                          >
                            <Icon
                              className={`w-6 h-6 mx-auto mb-2 ${
                                requestType === type.value ? 'text-[#faff6a]' : 'text-[#9ca3af]'
                              }`}
                            />
                            <div
                              className={`text-sm ${
                                requestType === type.value ? 'text-[#e5e5e5]' : 'text-[#9ca3af]'
                              }`}
                            >
                              {type.label}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <Label htmlFor="email" className="text-[#e5e5e5] mb-2 block">
                      Your Email Address
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@hotel.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="bg-[#252521] border-[#2C2C2C] text-[#e5e5e5] placeholder:text-[#6b7280]"
                    />
                  </div>

                  {/* Subject */}
                  <div>
                    <Label htmlFor="subject" className="text-[#e5e5e5] mb-2 block">
                      Subject
                    </Label>
                    <Input
                      id="subject"
                      type="text"
                      placeholder={
                        requestType === 'feedback'
                          ? 'Tell us what you think...'
                          : requestType === 'feature'
                          ? 'Describe the feature you need...'
                          : 'Which PMS system would you like integrated?'
                      }
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      required
                      className="bg-[#252521] border-[#2C2C2C] text-[#e5e5e5] placeholder:text-[#6b7280]"
                    />
                  </div>

                  {/* PMS Type Selection (only for PMS requests) */}
                  {requestType === 'pms' && (
                    <div>
                      <Label htmlFor="pms-type" className="text-[#e5e5e5] mb-2 block">
                        PMS System
                      </Label>
                      <Select value={pmsType} onValueChange={setPmsType} required>
                        <SelectTrigger
                          id="pms-type"
                          className="bg-[#252521] border-[#2C2C2C] text-[#e5e5e5]"
                        >
                          <SelectValue placeholder="Select your PMS" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1a1a18] border-[#2C2C2C] text-[#e5e5e5]">
                          {pmsOptions.map((pms) => (
                            <SelectItem key={pms} value={pms}>
                              {pms}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Message */}
                  <div>
                    <Label htmlFor="message" className="text-[#e5e5e5] mb-2 block">
                      {requestType === 'feedback'
                        ? 'Your Feedback'
                        : requestType === 'feature'
                        ? 'Feature Details'
                        : 'Integration Details'}
                    </Label>
                    <Textarea
                      id="message"
                      placeholder={
                        requestType === 'feedback'
                          ? 'Share your thoughts, suggestions, or concerns...'
                          : requestType === 'feature'
                          ? 'Describe how this feature would help your business...'
                          : 'Tell us about your current setup and integration needs...'
                      }
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      required
                      rows={6}
                      className="bg-[#252521] border-[#2C2C2C] text-[#e5e5e5] placeholder:text-[#6b7280] resize-none"
                    />
                  </div>
{/* Submit Button */}
<Button
  type="submit"
  className="w-full bg-[#faff6a] text-[#1f1f1c] hover:bg-[#f0f055] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
  disabled={isSubmitting} // [NEW] Disable button while submitting
>
  {isSubmitting ? (
    // [NEW] Show a loading spinner
    <div className="w-4 h-4 border-2 border-[#1f1f1c] border-t-transparent border-solid rounded-full animate-spin mr-2" />
  ) : (
    // [MODIFIED] Show the icon only when not loading
    <Send className="w-4 h-4 mr-2" />
  )}
  {isSubmitting ? 'Submitting...' : 'Submit Request'}
</Button>
                </form>
    
            </Card>
          </div>

{/* Contact Information Sidebar */}
          {/* [FIX] Sidebar now spans the remaining 4 of 12 columns */}
          <div className="col-span-4 space-y-6">
            {/* Direct Contact */}
            <Card className="bg-[#1a1a18] border-[#2C2C2C] p-6">
              <div className="flex items-center gap-2 mb-4">
                <Mail className="w-5 h-5 text-[#faff6a]" />
                <h3 className="text-[#e5e5e5]">Direct Contact</h3>
              </div>
              <p className="text-[#9ca3af] text-sm mb-4">
                Need immediate assistance? Reach out directly to our support team.
              </p>
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-[#6b7280] mb-1">Email Support</div>
                  <a
                    href="mailto:support@market-pulse.io"
                    className="text-[#faff6a] hover:text-[#f0f055] transition-colors text-sm"
                  >
                   support@market-pulse.io
                  </a>
                </div>
              
              </div>
            </Card>

            {/* Response Time */}
            <Card className="bg-[#1a1a18] border-[#2C2C2C] p-6">
              <h3 className="text-[#e5e5e5] mb-3">Response Time</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#faff6a] mt-1.5" />
                  <span className="text-[#9ca3af]">
                    <span className="text-[#e5e5e5]">General inquiries:</span> Within 24 hours
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#faff6a] mt-1.5" />
                  <span className="text-[#9ca3af]">
                    <span className="text-[#e5e5e5]">Feature requests:</span> 2-3 business days
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#faff6a] mt-1.5" />
                  <span className="text-[#9ca3af]">
                    <span className="text-[#e5e5e5]">PMS integrations:</span> 3-5 business days
                  </span>
                </li>
              </ul>
            </Card>

            {/* Popular Requests */}
            <Card className="bg-[#1a1a18] border-[#2C2C2C] p-6">
              <h3 className="text-[#e5e5e5] mb-3">Popular Requests</h3>
              <ul className="space-y-2 text-sm text-[#9ca3af]">
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#3a3a35] mt-1.5" />
                  <span>Custom report templates</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#3a3a35] mt-1.5" />
                  <span>Mobile app for iOS/Android</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#3a3a35] mt-1.5" />
                  <span>Multi-property dashboards</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#3a3a35] mt-1.5" />
                  <span>Advanced forecasting tools</span>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </div>
        </div> 

  );
}
