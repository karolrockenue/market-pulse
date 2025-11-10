import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { MarketCalendarPreview } from './MarketCalendarPreview';
import { 
  TrendingUp, 
  BarChart3, 
  Calendar, 
  Zap, 
  Shield, 
  Clock,
  ArrowRight,
  Check,
  Sparkles,
  LineChart,
  Users,
  Target,
  ChevronRight
} from 'lucide-react';
// [FIX] Removed the invalid '@2.0.3' version from the import path
import { toast } from 'sonner';

// [FIX] Renamed to match the component name we will use
interface LandingPageProps {
  onSignIn: () => void;
  onViewChange: (view: string) => void; // [NEW] Add the view change prop
}

export function LandingPage({ onSignIn, onViewChange }: LandingPageProps) { // [NEW] Destructure the new prop
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // [NEW] State to hold the API status message and type
  const [apiStatus, setApiStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });

const handleMagicLink = async (e: React.FormEvent) => {
  e.preventDefault(); 
  setApiStatus({ type: null, message: '' }); // Clear previous status

  if (!email) {
    // [MODIFIED] Set error state instead of toast
    setApiStatus({ type: 'error', message: 'Please enter your email address' });
    return;
  }

  setIsLoading(true);

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email }), 
    });

    const result = await response.json();

    if (response.ok) {
      // [MODIFIED] Set success state instead of toast
      setApiStatus({ type: 'success', message: result.message || 'Magic link sent! Check your inbox.' });
      setEmail(''); 
    } else {
      // Extract error message or default
      const errorMessage = result.error || (response.status === 404 ? 'API endpoint not found. Check server logs.' : 'Failed to send magic link.');
      throw new Error(errorMessage);
    }
  } catch (error: any) {
    console.error("Magic link error:", error);
    // [MODIFIED] Set error state instead of toast
    setApiStatus({ type: 'error', message: error.message });
  } finally {
    setIsLoading(false);
    // [NEW] Clear the status message after 5 seconds
    setTimeout(() => {
      setApiStatus({ type: null, message: '' });
    }, 5000); 
  }
};

  const handlePMSConnect = (provider: string) => {
    toast.info(`Connecting to ${provider}...`);
    setTimeout(onSignIn, 1000);
  };

  return (
    <div className="min-h-screen bg-[#0a0a09] text-[#e5e5e5] overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center px-6 py-20 overflow-hidden">
        {/* Radial Gradient Background */}
        <div className="absolute inset-0">
          {/* Center radial gradient */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#faff6a]/8 via-[#23231F] to-[#0a0a09]" />
          
          {/* Additional accent gradients */}
          <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[radial-gradient(circle,_var(--tw-gradient-stops))] from-[#10b981]/10 via-transparent to-transparent blur-2xl" />
          <div className="absolute bottom-0 left-0 w-[800px] h-[800px] bg-[radial-gradient(circle,_var(--tw-gradient-stops))] from-[#faff6a]/10 via-transparent to-transparent blur-2xl" />
        </div>

        {/* Dot Pattern Overlay */}
        <div className="absolute inset-0 opacity-[0.15]">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle, #faff6a 1px, transparent 1px)`,
            backgroundSize: '40px 40px'
          }} />
        </div>

        {/* Grid Pattern Background (subtle) */}
        <div className="absolute inset-0 opacity-[0.02]">
          <div className="absolute inset-0" style={{
            backgroundImage: `linear-gradient(#faff6a 1px, transparent 1px), linear-gradient(90deg, #faff6a 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }} />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto w-full grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Value Proposition */}
          <div className="space-y-8">
        

            <h1 className="text-5xl lg:text-6xl text-[#e5e5e5] leading-tight">
              The Sharpest View of Your{' '}
              <span className="text-[#faff6a]">Hotel Market.</span>
              <br />
              <span className="text-[#e5e5e5]">For Free.</span>
            </h1>

            <p className="text-xl text-[#9ca3af] leading-relaxed">
              Real-time analytics, competitive benchmarking, and market intelligence — 
              all the insights you need to outperform your comp set.
            </p>

            <div className="space-y-4">
              {[
                'Benchmark KPIs against your market in real-time',
                'Analyze your true competitive set automatically',
                'Access advanced reporting and forecasting tools',
                'Connect your PMS in under 5 minutes',
              ].map((benefit, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className="mt-1 w-5 h-5 rounded-full bg-[#10b981]/20 flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3 text-[#10b981]" />
                  </div>
                  <span className="text-[#e5e5e5]">{benefit}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-4 pt-4">
              <div className="flex -space-x-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="w-10 h-10 rounded-full bg-[#3a3a35] border-2 border-[#1a1a18] flex items-center justify-center">
                    <Users className="w-5 h-5 text-[#9ca3af]" />
                  </div>
                ))}
              </div>
              <div className="text-sm">
                <div className="text-[#e5e5e5]">Trusted by 500+ hotels</div>
                <div className="text-[#9ca3af]">across 25 countries</div>
              </div>
            </div>
          </div>

          {/* Right: Login/Signup Card */}
          <div className="relative">
            {/* Glassmorphism Card */}
            <div className="relative bg-[#1a1a18]/60 backdrop-blur-xl border border-[#3a3a35] rounded-2xl p-8 shadow-2xl">
         <div className="absolute inset-0 bg-gradient-to-br from-[#faff6a]/5 to-transparent rounded-2xl" />
              <div className="relative space-y-6">
                {/* Welcome Back Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[#faff6a]/10 flex items-center justify-center">
                      <Zap className="w-4 h-4 text-[#faff6a]" />
                    </div>
                    <h3 className="text-xl text-[#e5e5e5]">Welcome Back</h3>
                  </div>
                  
                  <form onSubmit={handleMagicLink} className="space-y-3">
                    <Input
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-12 bg-[#2C2C2C] border-[#3a3a35] text-[#e5e5e5] placeholder:text-[#6b7280]"
                    />
<Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 bg-[#faff6a] text-[#1a1a18] hover:bg-[#faff6a]/90 transition-all"
                >
                  {isLoading ? 'Sending...' : 'Send Magic Link'}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </form> {/* <<< Correct end of the form */}

              {/* [NEW] Conditionally display the API status message */}
              {apiStatus.message && (
                <div className={`mt-2 text-center text-sm ${ apiStatus.type === 'success' ? 'text-[#10b981]' : 'text-[#ef4444]' }`}>
                  {apiStatus.message}
                </div>
              )}

              {/* --- Duplicate elements removed --- */}

        </div> {/* <<< Closing div for the "Welcome Back" section */}
            {/* [FIX] This 'div' (line 206) was closing the content wrapper prematurely and has been removed. */}

            {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[#3a3a35]" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-[#1a1a18] text-[#9ca3af]">or connect your hotel</span>
                  </div>
                </div>

                {/* PMS Connect Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[#10b981]/10 flex items-center justify-center">
                      <Target className="w-4 h-4 text-[#10b981]" />
                    </div>
                    <h3 className="text-xl text-[#e5e5e5]">New to Market Pulse?</h3>
                  </div>

                  <div className="space-y-3">
                    <Button
                      onClick={() => handlePMSConnect('Cloudbeds')}
                      className="w-full h-12 bg-[#2C2C2C] border border-[#3a3a35] text-[#e5e5e5] hover:bg-[#3a3a35] hover:border-[#faff6a]/50 transition-all"
                    >
                      <div className="flex items-center justify-center gap-3">
                        <div className="w-6 h-6 rounded bg-[#4a9eff] flex items-center justify-center text-white text-xs font-bold">
                          CB
                        </div>
                        <span>Connect with Cloudbeds</span>
                      </div>
                    </Button>

                    <Button
                      onClick={() => handlePMSConnect('Mews')}
                      className="w-full h-12 bg-[#2C2C2C] border border-[#3a3a35] text-[#e5e5e5] hover:bg-[#3a3a35] hover:border-[#faff6a]/50 transition-all"
                    >
                      <div className="flex items-center justify-center gap-3">
                        <div className="w-6 h-6 rounded bg-[#00c9a7] flex items-center justify-center text-white text-xs font-bold">
                          M
                        </div>
                        <span>Connect with Mews</span>
                      </div>
                    </Button>
                  </div>

                  <p className="text-xs text-[#6b7280] text-center">
                    <Clock className="w-3 h-3 inline mr-1" />
                    Setup takes less than 5 minutes
                  </p>
                </div>
              </div>
            </div>

            {/* Trust Badge */}
            <div className="mt-6 flex items-center justify-center gap-2 text-sm text-[#9ca3af]">
 <Shield className="w-4 h-4 text-[#10b981]" />
        <span>Your data is encrypted and secure</span>
        </div> {/* Closes the Trust Badge div */}
      </div> {/* Closes the Right: Card container div */}
    </div> {/* [FIX] Added missing closing tag for the main grid container (from line 113) */}
    {/* Scroll Indicator */}
    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce">
      <ChevronRight className="w-6 h-6 text-[#faff6a] rotate-90" />
    </div>
      </section>

      {/* Feature Section 1: Live Dashboard */}
      <section className="relative py-32 px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: Mockup */}
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-[#faff6a]/20 to-[#10b981]/20 blur-3xl opacity-50" />
              <div className="relative bg-[#1a1a18] border border-[#3a3a35] rounded-xl p-6 shadow-2xl">
                {/* Mock KPI Cards */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-6">
                    <h4 className="text-[#9ca3af] text-sm uppercase tracking-wider">Today's Performance</h4>
                    <div className="text-xs text-[#faff6a]">Live</div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {/* Occupancy Card */}
                    <div className="bg-[#2C2C2C] border border-[#3a3a35] rounded-lg p-4">
                      <div className="text-[#9ca3af] text-xs mb-2">Occupancy</div>
                      <div className="flex items-end gap-4">
                        <div>
                          <div className="text-[#6b7280] text-xs">You</div>
                          <div className="text-[#e5e5e5] text-2xl">78.5%</div>
                        </div>
                        <div>
                          <div className="text-[#6b7280] text-xs">Market</div>
                          <div className="text-[#9ca3af] text-2xl">72.1%</div>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-1 text-[#10b981] text-xs">
                        <TrendingUp className="w-3 h-3" />
                        <span>+6.4% vs market</span>
                      </div>
                    </div>

                    {/* ADR Card */}
                    <div className="bg-[#2C2C2C] border border-[#3a3a35] rounded-lg p-4">
                      <div className="text-[#9ca3af] text-xs mb-2">ADR</div>
                      <div className="flex items-end gap-4">
                        <div>
                          <div className="text-[#6b7280] text-xs">You</div>
                          <div className="text-[#e5e5e5] text-2xl">$245</div>
                        </div>
                        <div>
                          <div className="text-[#6b7280] text-xs">Market</div>
                          <div className="text-[#9ca3af] text-2xl">$238</div>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-1 text-[#10b981] text-xs">
                        <TrendingUp className="w-3 h-3" />
                        <span>+2.9% vs market</span>
                      </div>
                    </div>

                    {/* RevPAR Card */}
                    <div className="bg-[#2C2C2C] border border-[#3a3a35] rounded-lg p-4">
                      <div className="text-[#9ca3af] text-xs mb-2">RevPAR</div>
                      <div className="flex items-end gap-4">
                        <div>
                          <div className="text-[#6b7280] text-xs">You</div>
                          <div className="text-[#e5e5e5] text-2xl">$192</div>
                        </div>
                        <div>
                          <div className="text-[#6b7280] text-xs">Market</div>
                          <div className="text-[#9ca3af] text-2xl">$172</div>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-1 text-[#10b981] text-xs">
                        <TrendingUp className="w-3 h-3" />
                        <span>+11.6% vs market</span>
                      </div>
                    </div>

                    {/* Market Rank Card */}
                    <div className="bg-gradient-to-br from-[#faff6a]/10 to-transparent border border-[#faff6a]/30 rounded-lg p-4">
                      <div className="text-[#faff6a] text-xs mb-2">Market Rank</div>
                      <div className="text-[#faff6a] text-3xl font-bold">#2</div>
                      <div className="text-[#9ca3af] text-xs">of 15 hotels</div>
                      <div className="mt-2 text-[#6b7280] text-xs">by RevPAR</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Content */}
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#faff6a]/10 border border-[#faff6a]/30 rounded-full text-[#faff6a] text-sm">
                <BarChart3 className="w-4 h-4" />
                <span>Live Dashboards</span>
              </div>

              <h2 className="text-4xl text-[#e5e5e5]">
                See exactly how you stack up.{' '}
                <span className="text-[#faff6a]">Every single day.</span>
              </h2>

              <p className="text-lg text-[#9ca3af] leading-relaxed">
                Your performance metrics benchmarked against your competitive set in real-time. 
                No more waiting for weekly reports or manual data entry. Market Pulse automatically 
                syncs with your PMS and shows you where you stand.
              </p>

              <div className="space-y-4 pt-4">
                {[
                  { icon: TrendingUp, title: 'Real-time KPIs', desc: 'Occupancy, ADR, RevPAR updated every hour' },
                  { icon: Target, title: 'Competitive Benchmarks', desc: 'See how you compare to your true comp set' },
                  { icon: Sparkles, title: 'Market Rankings', desc: 'Know your position in the market instantly' },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#2C2C2C] border border-[#3a3a35] flex items-center justify-center flex-shrink-0">
                      <item.icon className="w-5 h-5 text-[#faff6a]" />
                    </div>
                    <div>
                      <div className="text-[#e5e5e5] mb-1">{item.title}</div>
                      <div className="text-sm text-[#9ca3af]">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Section 2: Advanced Reporting */}
      <section className="relative py-32 px-6 bg-[#0d0d0c]">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: Content */}
            <div className="space-y-6 lg:order-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#10b981]/10 border border-[#10b981]/30 rounded-full text-[#10b981] text-sm">
                <LineChart className="w-4 h-4" />
                <span>Advanced Analytics</span>
              </div>

              <h2 className="text-4xl text-[#e5e5e5]">
                Build reports that actually{' '}
                <span className="text-[#faff6a]">answer your questions.</span>
              </h2>

              <p className="text-lg text-[#9ca3af] leading-relaxed">
                Powerful reporting tools that go beyond basic dashboards. Analyze trends, 
                compare time periods, segment by property attributes, and export custom datasets. 
                All without touching a spreadsheet.
              </p>
<div className="grid grid-cols-2 gap-4 pt-4">
                {[
                  // [NEW] More compelling feature based on the OTA crawler
                  { label: 'Forward-Looking Demand', value: 'From live OTA data' }, 
                  // [NEW] More compelling feature based on the core value prop
                  { label: 'Comp Set Benchmarking', value: 'Track KPIs vs. your market' }, 
                  // [KEPT] This one is a good feature
                  { label: 'Automated Delivery', value: 'Email schedules' }, 
                  // [NEW] More compelling feature based on dashboard
                  { label: 'Market Rank Tracking', value: 'See your rank by RevPAR' }, 
                ].map((stat, idx) => (
                  <div key={idx} className="bg-[#1a1a18] border border-[#3a3a35] rounded-lg p-4">
                    <div className="text-[#9ca3af] text-xs mb-1">{stat.label}</div>
                    <div className="text-[#faff6a]">{stat.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Mockup */}
            <div className="relative lg:order-2">
              <div className="absolute -inset-4 bg-gradient-to-l from-[#10b981]/20 to-[#faff6a]/20 blur-3xl opacity-50" />
              <div className="relative bg-[#1a1a18] border border-[#3a3a35] rounded-xl p-6 shadow-2xl">
                {/* Mock Report Table */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-[#e5e5e5]">Performance Report</h4>
                    <div className="text-xs text-[#9ca3af]">Last 30 days</div>
                  </div>

                  {/* Table Header */}
                  <div className="grid grid-cols-4 gap-2 pb-2 border-b border-[#3a3a35]">
                    <div className="text-[#9ca3af] text-xs">Date</div>
                    <div className="text-[#9ca3af] text-xs text-right">Occ %</div>
                    <div className="text-[#9ca3af] text-xs text-right">ADR</div>
                    <div className="text-[#9ca3af] text-xs text-right">RevPAR</div>
                  </div>

                  {/* Table Rows */}
                  {[
                    { date: 'Dec 15', occ: '82.5%', adr: '$245', revpar: '$202', trend: 'up' },
                    { date: 'Dec 14', occ: '79.2%', adr: '$238', revpar: '$188', trend: 'up' },
                    { date: 'Dec 13', occ: '75.8%', adr: '$242', revpar: '$183', trend: 'down' },
                    { date: 'Dec 12', occ: '88.1%', adr: '$251', revpar: '$221', trend: 'up' },
                    { date: 'Dec 11', occ: '76.4%', adr: '$239', revpar: '$182', trend: 'up' },
                  ].map((row, idx) => (
                    <div key={idx} className="grid grid-cols-4 gap-2 py-2 border-b border-[#3a3a35]/50 hover:bg-[#2C2C2C]/50 transition-colors">
                      <div className="text-[#e5e5e5] text-sm">{row.date}</div>
                      <div className="text-[#e5e5e5] text-sm text-right">{row.occ}</div>
                      <div className="text-[#e5e5e5] text-sm text-right">{row.adr}</div>
                      <div className="text-[#e5e5e5] text-sm text-right flex items-center justify-end gap-1">
                        {row.revpar}
                        <TrendingUp className={`w-3 h-3 ${row.trend === 'up' ? 'text-[#10b981]' : 'text-[#ef4444]'}`} />
                      </div>
                    </div>
                  ))}

{/* Summary Row */}
                  <div className="grid grid-cols-4 gap-2 pt-2 bg-[#2C2C2C] -mx-6 px-6 py-3">
                    <div className="text-[#faff6a] text-sm">Average</div>
                    <div className="text-[#faff6a] text-sm text-right">80.4%</div>
                    <div className="text-[#faff6a] text-sm text-right">$243</div>
                    {/* [FIX] Replicate the flex structure from the data rows for perfect alignment */}
                    <div className="text-[#faff6a] text-sm text-right flex items-center justify-end gap-1">
                      <span>$195</span>
                      {/* This invisible spacer has the same w-3 (width) as the icon, forcing alignment */}
                      <div className="w-3 h-3" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Section 3: Market Intelligence */}
      <section className="relative py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#faff6a]/10 border border-[#faff6a]/30 rounded-full text-[#faff6a] text-sm mb-6">
              <Calendar className="w-4 h-4" />
              <span>Market Intelligence</span>
            </div>
            <h2 className="text-4xl text-[#e5e5e5] mb-4">
              Don't just track the past.{' '}
              <span className="text-[#faff6a]">Predict the future.</span>
            </h2>
            <p className="text-lg text-[#9ca3af] max-w-2xl mx-auto">
              Forward-looking demand data, seasonality trends, and neighborhood performance 
              to help you make smarter pricing decisions.
            </p>
          </div>

          {/* Actual Market Calendar */}
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-r from-[#faff6a]/20 via-[#10b981]/20 to-[#faff6a]/20 blur-3xl opacity-50" />
            <div className="relative">
              <MarketCalendarPreview />
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof / Trust Section */}
      <section className="relative py-32 px-6 bg-[#0d0d0c]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl text-[#e5e5e5] mb-4">
              Trusted by forward-thinking hoteliers
            </h2>
            <p className="text-[#9ca3af]">
              Join hundreds of hotels using Market Pulse to optimize their revenue strategy
            </p>
          </div>

          {/* Testimonials */}
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            {[
              {
                quote: "Market Pulse has become an essential part of our morning revenue meeting. The competitive insights are invaluable.",
                author: "Sarah Chen",
                role: "General Manager",
                type: "Boutique Hotel"
              },
              {
                quote: "Finally, a free tool that actually delivers on its promise. The PMS integration was seamless and the data is incredibly accurate.",
                author: "Michael Rodriguez",
                role: "Revenue Manager",
                type: "Independent Property"
              },
              {
                quote: "The market ranking feature alone is worth it. We've made smarter pricing decisions and seen our RevPAR increase by 12%.",
                author: "Emily Thompson",
                role: "Owner/Operator",
                type: "Urban Hotel"
              }
            ].map((testimonial, idx) => (
              <div key={idx} className="bg-[#1a1a18] border border-[#3a3a35] rounded-xl p-6 space-y-4">
                <div className="text-[#e5e5e5] leading-relaxed">"{testimonial.quote}"</div>
                <div className="flex items-center gap-3 pt-4 border-t border-[#3a3a35]">
                  <div className="w-10 h-10 rounded-full bg-[#3a3a35] flex items-center justify-center">
                    <Users className="w-5 h-5 text-[#9ca3af]" />
                  </div>
                  <div>
                    <div className="text-[#e5e5e5] text-sm">{testimonial.author}</div>
                    <div className="text-[#9ca3af] text-xs">{testimonial.role}, {testimonial.type}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Partner Logos */}
          <div className="text-center">
            <div className="text-[#9ca3af] text-sm mb-6">Integrated with leading PMS providers</div>
            <div className="flex items-center justify-center gap-12 flex-wrap">
              <div className="flex items-center gap-2 px-6 py-3 bg-[#1a1a18] border border-[#3a3a35] rounded-lg">
                <div className="w-8 h-8 rounded bg-[#4a9eff] flex items-center justify-center text-white font-bold">
                  CB
                </div>
                <span className="text-[#e5e5e5]">Cloudbeds</span>
              </div>
              <div className="flex items-center gap-2 px-6 py-3 bg-[#1a1a18] border border-[#3a3a35] rounded-lg">
                <div className="w-8 h-8 rounded bg-[#00c9a7] flex items-center justify-center text-white font-bold">
                  M
                </div>
                <span className="text-[#e5e5e5]">Mews</span>
              </div>
              <div className="flex items-center gap-2 px-6 py-3 bg-[#1a1a18] border border-[#3a3a35] rounded-lg opacity-50">
                <div className="w-8 h-8 rounded bg-[#6b7280] flex items-center justify-center text-white text-xs">
                  More
                </div>
                <span className="text-[#e5e5e5]">Coming Soon</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="relative py-32 px-6 overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#faff6a]/20 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          <h2 className="text-5xl text-[#e5e5e5] mb-6">
            Ready to get the{' '}
            <span className="text-[#faff6a]">sharpest view</span>
            {' '}of your market?
          </h2>
          <p className="text-xl text-[#9ca3af] mb-12">
            Start analyzing your competitive position in under 5 minutes. No credit card required.
          </p>

          {/* Simplified CTA Box */}
          <div className="bg-[#1a1a18]/60 backdrop-blur-xl border border-[#3a3a35] rounded-2xl p-8 max-w-md mx-auto">
            <div className="space-y-4">
              <form onSubmit={handleMagicLink} className="space-y-3">
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 bg-[#2C2C2C] border-[#3a3a35] text-[#e5e5e5] placeholder:text-[#6b7280]"
                />
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 bg-[#faff6a] text-[#1a1a18] hover:bg-[#faff6a]/90 transition-all"
                >
                  Get Started Free
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#3a3a35]" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-[#1a1a18] text-[#9ca3af]">or</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => handlePMSConnect('Cloudbeds')}
                  className="h-11 bg-[#2C2C2C] border border-[#3a3a35] text-[#e5e5e5] hover:bg-[#3a3a35] transition-all text-sm"
                >
                  <div className="w-5 h-5 rounded bg-[#4a9eff] flex items-center justify-center text-white text-xs font-bold mr-2">
                    CB
                  </div>
                  Cloudbeds
                </Button>
                <Button
                  onClick={() => handlePMSConnect('Mews')}
                  className="h-11 bg-[#2C2C2C] border border-[#3a3a35] text-[#e5e5e5] hover:bg-[#3a3a35] transition-all text-sm"
                >
                  <div className="w-5 h-5 rounded bg-[#00c9a7] flex items-center justify-center text-white text-xs font-bold mr-2">
                    M
                  </div>
                  Mews
                </Button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-6 mt-8 text-sm text-[#9ca3af]">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-[#10b981]" />
              <span>100% Free</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-[#10b981]" />
              <span>No Credit Card</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-[#10b981]" />
              <span>5 Min Setup</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative border-t border-[#3a3a35] py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#faff6a] flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-[#1a1a18]" />
              </div>
              <span className="text-[#e5e5e5] text-xl">Market Pulse</span>
            </div>

   <div className="flex items-center gap-8 text-sm text-[#9ca3af]">
              {/* [NEW] Changed to buttons that call the onViewChange handler */}
              <button onClick={() => onViewChange('privacy')} className="hover:text-[#faff6a] transition-colors">Privacy Policy</button>
              <button onClick={() => onViewChange('terms')} className="hover:text-[#faff6a] transition-colors">Terms of Service</button>
              {/* [NEW] Changed contact to a standard mailto link */}
              <a href="mailto:support@marketpulse.com" className="hover:text-[#faff6a] transition-colors">Contact</a>
            </div>

            <div className="text-sm text-[#6b7280]">
              © 2025 Market Pulse. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}