import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

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
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

interface LandingPageProps {
  onSignIn: () => void;
  onViewChange: (view: string) => void;
}

// Color constants matching TopNav + Dashboard
const BLUE = "#39BDF8";
const WHITE = "#e5e5e5";
const GRAY = "#9ca3af";
const DIM = "#6b7280";
const BG_PAGE = "#1d1d1c";
const BG_CARD = "#1a1a1a";
const BG_INPUT = "#2C2C2C";
const BORDER = "#2a2a2a";
const GREEN = "#10b981";
const RED = "#ef4444";

export function LandingPage({ onSignIn, onViewChange }: LandingPageProps) {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [apiStatus, setApiStatus] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiStatus({ type: null, message: "" });

    if (!email) {
      setApiStatus({
        type: "error",
        message: "Please enter your email address",
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email }),
      });

      const result = await response.json();

      if (response.ok) {
        setApiStatus({
          type: "success",
          message: result.message || "Magic link sent! Check your inbox.",
        });
        setEmail("");
      } else {
        const errorMessage =
          result.error ||
          (response.status === 404
            ? "API endpoint not found. Check server logs."
            : "Failed to send magic link.");
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      console.error("Magic link error:", error);
      setApiStatus({ type: "error", message: error.message });
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        setApiStatus({ type: null, message: "" });
      }, 5000);
    }
  };

  const handlePMSConnect = (provider: string) => {
    toast.info(`Connecting to ${provider}...`);
    setTimeout(onSignIn, 1000);
  };

  return (
    <div
      className="min-h-screen overflow-x-hidden"
      style={{ backgroundColor: BG_PAGE, color: WHITE }}
    >
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center px-6 py-20 overflow-hidden">
        {/* Background — matches dashboard subtle blue grid + gradient */}
        <div className="absolute inset-0">
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(to bottom right, rgba(57, 189, 248, 0.03), transparent, rgba(57, 189, 248, 0.03))`,
            }}
          />
        </div>
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(rgba(57, 189, 248, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(57, 189, 248, 0.03) 1px, transparent 1px)`,
            backgroundSize: "64px 64px",
            pointerEvents: "none",
          }}
        />

        <div className="relative z-10 max-w-7xl mx-auto w-full grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Value Proposition */}
          <div className="space-y-8">
            {/* Logo — matches TopNav ( MARKET PULSE ) */}
            <div className="flex items-center gap-1 mb-4">
              <span style={{ color: BLUE, fontSize: "32px" }}>(</span>
              <span
                style={{
                  color: WHITE,
                  fontSize: "18px",
                  letterSpacing: "0.025em",
                  position: "relative",
                  top: "2px",
                }}
              >
                MARKET PULSE
              </span>
              <span style={{ color: BLUE, fontSize: "32px" }}>)</span>
            </div>

            <h1 className="text-5xl lg:text-6xl leading-tight" style={{ color: WHITE }}>
              The Sharpest View of Your{" "}
              <span style={{ color: BLUE }}>Hotel Market.</span>
              <br />
              <span style={{ color: WHITE }}>For Free.</span>
            </h1>

            <p className="text-xl leading-relaxed" style={{ color: GRAY }}>
              Real-time analytics, competitive benchmarking, and market
              intelligence — all the insights you need to outperform your comp
              set.
            </p>

            <div className="space-y-4">
              {[
                "Benchmark KPIs against your market in real-time",
                "Analyze your true competitive set automatically",
                "Access advanced reporting and forecasting tools",
                "Connect your PMS in under 5 minutes",
              ].map((benefit, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div
                    className="mt-1 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `rgba(16, 185, 129, 0.2)` }}
                  >
                    <Check className="w-3 h-3" style={{ color: GREEN }} />
                  </div>
                  <span style={{ color: WHITE }}>{benefit}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-4 pt-4">
              <div className="flex -space-x-3">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{
                      backgroundColor: BG_INPUT,
                      border: `2px solid ${BG_PAGE}`,
                    }}
                  >
                    <Users className="w-5 h-5" style={{ color: DIM }} />
                  </div>
                ))}
              </div>
              <div className="text-sm">
                <div style={{ color: WHITE }}>Trusted by 500+ hotels</div>
                <div style={{ color: GRAY }}>across 25 countries</div>
              </div>
            </div>
          </div>

          {/* Right: Login/Signup Card — matches dashboard card style */}
          <div className="relative">
            <div
              className="relative rounded-lg p-8 shadow-2xl"
              style={{
                backgroundColor: BG_CARD,
                border: `1px solid ${BORDER}`,
              }}
            >
              <div className="relative space-y-6">
                {/* Welcome Back Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-md flex items-center justify-center"
                      style={{ backgroundColor: `rgba(57, 189, 248, 0.15)` }}
                    >
                      <Zap className="w-4 h-4" style={{ color: BLUE }} />
                    </div>
                    <h3 className="text-xl" style={{ color: WHITE }}>
                      Welcome Back
                    </h3>
                  </div>
                  <form onSubmit={handleMagicLink} className="space-y-3">
                    <Input
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-12"
                      style={{
                        backgroundColor: BG_INPUT,
                        borderColor: BORDER,
                        color: WHITE,
                      }}
                    />
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="w-full h-12 transition-all"
                      style={{
                        backgroundColor: BLUE,
                        color: BG_PAGE,
                        fontWeight: 600,
                      }}
                    >
                      {isLoading ? "Sending..." : "Send Magic Link"}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </form>
                  {apiStatus.message && (
                    <div
                      className="mt-2 text-center text-sm"
                      style={{
                        color:
                          apiStatus.type === "success" ? GREEN : RED,
                      }}
                    >
                      {apiStatus.message}
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div
                      className="w-full"
                      style={{ borderTop: `1px solid ${BORDER}` }}
                    />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span
                      className="px-4"
                      style={{ backgroundColor: BG_CARD, color: GRAY }}
                    >
                      or connect your hotel
                    </span>
                  </div>
                </div>

                {/* PMS Connect Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-md flex items-center justify-center"
                      style={{ backgroundColor: `rgba(16, 185, 129, 0.15)` }}
                    >
                      <Target className="w-4 h-4" style={{ color: GREEN }} />
                    </div>
                    <h3 className="text-xl" style={{ color: WHITE }}>
                      New to Market Pulse?
                    </h3>
                  </div>

                  <div className="space-y-3">
                    <Button
                      onClick={() => handlePMSConnect("Cloudbeds")}
                      className="w-full h-12 transition-all"
                      style={{
                        backgroundColor: BG_INPUT,
                        border: `1px solid ${BORDER}`,
                        color: WHITE,
                      }}
                    >
                      <div className="flex items-center justify-center gap-3">
                        <div className="w-6 h-6 rounded bg-[#4a9eff] flex items-center justify-center text-white text-xs font-bold">
                          CB
                        </div>
                        <span>Connect with Cloudbeds</span>
                      </div>
                    </Button>

                    <Button
                      onClick={() => handlePMSConnect("Mews")}
                      className="w-full h-12 transition-all"
                      style={{
                        backgroundColor: BG_INPUT,
                        border: `1px solid ${BORDER}`,
                        color: WHITE,
                      }}
                    >
                      <div className="flex items-center justify-center gap-3">
                        <div className="w-6 h-6 rounded bg-[#00c9a7] flex items-center justify-center text-white text-xs font-bold">
                          M
                        </div>
                        <span>Connect with Mews</span>
                      </div>
                    </Button>
                  </div>

                  <p
                    className="text-xs text-center"
                    style={{ color: DIM }}
                  >
                    <Clock className="w-3 h-3 inline mr-1" />
                    Setup takes less than 5 minutes
                  </p>
                </div>
              </div>
            </div>

            {/* Trust Badge */}
            <div
              className="mt-6 flex items-center justify-center gap-2 text-sm"
              style={{ color: GRAY }}
            >
              <Shield className="w-4 h-4" style={{ color: GREEN }} />
              <span>Your data is encrypted and secure</span>
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronRight className="w-6 h-6 rotate-90" style={{ color: BLUE }} />
        </div>
      </section>

      {/* Feature Section 1: Live Dashboard */}
      <section className="relative py-32 px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: Dashboard Mockup — mirrors actual dashboard card style */}
            <div className="relative">
              <div
                className="relative rounded-lg p-6 shadow-2xl"
                style={{
                  backgroundColor: BG_CARD,
                  border: `1px solid ${BORDER}`,
                }}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-6">
                    <span
                      style={{
                        color: DIM,
                        fontSize: "12px",
                        textTransform: "uppercase",
                        letterSpacing: "-0.025em",
                      }}
                    >
                      Today's Performance
                    </span>
                    <span style={{ fontSize: "12px", color: GREEN }}>
                      Live
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Occupancy Card */}
                    <div
                      className="rounded-lg p-4"
                      style={{
                        backgroundColor: "#1D1D1C",
                        border: `1px solid ${BORDER}`,
                      }}
                    >
                      <div
                        style={{
                          color: DIM,
                          fontSize: "10px",
                          textTransform: "uppercase",
                          letterSpacing: "-0.025em",
                          marginBottom: "8px",
                        }}
                      >
                        Occupancy
                      </div>
                      <div className="flex items-end gap-4">
                        <div>
                          <div style={{ color: DIM, fontSize: "10px" }}>You</div>
                          <div style={{ color: BLUE, fontSize: "24px" }}>
                            78.5%
                          </div>
                        </div>
                        <div>
                          <div style={{ color: DIM, fontSize: "10px" }}>
                            Market
                          </div>
                          <div style={{ color: GRAY, fontSize: "24px" }}>
                            72.1%
                          </div>
                        </div>
                      </div>
                      <div
                        className="mt-2 flex items-center gap-1"
                        style={{ color: GREEN, fontSize: "12px" }}
                      >
                        <TrendingUp className="w-3 h-3" />
                        <span>+6.4% vs market</span>
                      </div>
                    </div>

                    {/* ADR Card */}
                    <div
                      className="rounded-lg p-4"
                      style={{
                        backgroundColor: "#1D1D1C",
                        border: `1px solid ${BORDER}`,
                      }}
                    >
                      <div
                        style={{
                          color: DIM,
                          fontSize: "10px",
                          textTransform: "uppercase",
                          letterSpacing: "-0.025em",
                          marginBottom: "8px",
                        }}
                      >
                        ADR
                      </div>
                      <div className="flex items-end gap-4">
                        <div>
                          <div style={{ color: DIM, fontSize: "10px" }}>You</div>
                          <div style={{ color: BLUE, fontSize: "24px" }}>
                            £245
                          </div>
                        </div>
                        <div>
                          <div style={{ color: DIM, fontSize: "10px" }}>
                            Market
                          </div>
                          <div style={{ color: GRAY, fontSize: "24px" }}>
                            £238
                          </div>
                        </div>
                      </div>
                      <div
                        className="mt-2 flex items-center gap-1"
                        style={{ color: GREEN, fontSize: "12px" }}
                      >
                        <TrendingUp className="w-3 h-3" />
                        <span>+2.9% vs market</span>
                      </div>
                    </div>

                    {/* RevPAR Card */}
                    <div
                      className="rounded-lg p-4"
                      style={{
                        backgroundColor: "#1D1D1C",
                        border: `1px solid ${BORDER}`,
                      }}
                    >
                      <div
                        style={{
                          color: DIM,
                          fontSize: "10px",
                          textTransform: "uppercase",
                          letterSpacing: "-0.025em",
                          marginBottom: "8px",
                        }}
                      >
                        RevPAR
                      </div>
                      <div className="flex items-end gap-4">
                        <div>
                          <div style={{ color: DIM, fontSize: "10px" }}>You</div>
                          <div style={{ color: BLUE, fontSize: "24px" }}>
                            £192
                          </div>
                        </div>
                        <div>
                          <div style={{ color: DIM, fontSize: "10px" }}>
                            Market
                          </div>
                          <div style={{ color: GRAY, fontSize: "24px" }}>
                            £172
                          </div>
                        </div>
                      </div>
                      <div
                        className="mt-2 flex items-center gap-1"
                        style={{ color: GREEN, fontSize: "12px" }}
                      >
                        <TrendingUp className="w-3 h-3" />
                        <span>+11.6% vs market</span>
                      </div>
                    </div>

                    {/* Market Rank Card — blue accent instead of yellow */}
                    <div
                      className="rounded-lg p-4"
                      style={{
                        background: `linear-gradient(to bottom right, rgba(57, 189, 248, 0.1), transparent)`,
                        border: `1px solid rgba(57, 189, 248, 0.3)`,
                      }}
                    >
                      <div
                        style={{
                          color: BLUE,
                          fontSize: "10px",
                          textTransform: "uppercase",
                          letterSpacing: "-0.025em",
                          marginBottom: "8px",
                        }}
                      >
                        Market Rank
                      </div>
                      <div style={{ color: BLUE, fontSize: "32px", fontWeight: "bold" }}>
                        #2
                      </div>
                      <div style={{ color: GRAY, fontSize: "12px" }}>
                        of 15 hotels
                      </div>
                      <div
                        className="mt-2"
                        style={{ color: DIM, fontSize: "12px" }}
                      >
                        by RevPAR
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Content */}
            <div className="space-y-6">
              <div
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm"
                style={{
                  backgroundColor: `rgba(57, 189, 248, 0.15)`,
                  color: BLUE,
                }}
              >
                <BarChart3 className="w-4 h-4" />
                <span>Live Dashboards</span>
              </div>

              <h2 className="text-4xl" style={{ color: WHITE }}>
                See exactly how you stack up.{" "}
                <span style={{ color: BLUE }}>Every single day.</span>
              </h2>

              <p className="text-lg leading-relaxed" style={{ color: GRAY }}>
                Your performance metrics benchmarked against your competitive
                set in real-time. No more waiting for weekly reports or manual
                data entry. Market Pulse automatically syncs with your PMS and
                shows you where you stand.
              </p>

              <div className="space-y-4 pt-4">
                {[
                  {
                    icon: TrendingUp,
                    title: "Real-time KPIs",
                    desc: "Occupancy, ADR, RevPAR updated every hour",
                  },
                  {
                    icon: Target,
                    title: "Competitive Benchmarks",
                    desc: "See how you compare to your true comp set",
                  },
                  {
                    icon: Sparkles,
                    title: "Market Rankings",
                    desc: "Know your position in the market instantly",
                  },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-4">
                    <div
                      className="w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0"
                      style={{
                        backgroundColor: `rgba(57, 189, 248, 0.15)`,
                      }}
                    >
                      <item.icon className="w-5 h-5" style={{ color: BLUE }} />
                    </div>
                    <div>
                      <div className="mb-1" style={{ color: WHITE }}>
                        {item.title}
                      </div>
                      <div className="text-sm" style={{ color: GRAY }}>
                        {item.desc}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Section 2: Advanced Reporting */}
      <section
        className="relative py-32 px-6"
        style={{ backgroundColor: "#141414" }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: Content */}
            <div className="space-y-6 lg:order-1">
              <div
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm"
                style={{
                  backgroundColor: `rgba(16, 185, 129, 0.15)`,
                  color: GREEN,
                }}
              >
                <LineChart className="w-4 h-4" />
                <span>Advanced Analytics</span>
              </div>

              <h2 className="text-4xl" style={{ color: WHITE }}>
                Build reports that actually{" "}
                <span style={{ color: BLUE }}>answer your questions.</span>
              </h2>

              <p className="text-lg leading-relaxed" style={{ color: GRAY }}>
                Powerful reporting tools that go beyond basic dashboards.
                Analyze trends, compare time periods, segment by property
                attributes, and export custom datasets. All without touching a
                spreadsheet.
              </p>

              <div className="grid grid-cols-2 gap-4 pt-4">
                {[
                  {
                    label: "Forward-Looking Demand",
                    value: "From live OTA data",
                  },
                  {
                    label: "Comp Set Benchmarking",
                    value: "Track KPIs vs. your market",
                  },
                  { label: "Automated Delivery", value: "Email schedules" },
                  {
                    label: "Market Rank Tracking",
                    value: "See your rank by RevPAR",
                  },
                ].map((stat, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg p-4"
                    style={{
                      backgroundColor: BG_CARD,
                      border: `1px solid ${BORDER}`,
                    }}
                  >
                    <div
                      style={{
                        color: DIM,
                        fontSize: "10px",
                        textTransform: "uppercase",
                        letterSpacing: "-0.025em",
                        marginBottom: "4px",
                      }}
                    >
                      {stat.label}
                    </div>
                    <div style={{ color: BLUE, fontSize: "14px" }}>
                      {stat.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Report Table Mockup */}
            <div className="relative lg:order-2">
              <div
                className="relative rounded-lg p-6 shadow-2xl"
                style={{
                  backgroundColor: BG_CARD,
                  border: `1px solid ${BORDER}`,
                }}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <span style={{ color: WHITE, fontSize: "14px" }}>
                      Performance Report
                    </span>
                    <span style={{ color: DIM, fontSize: "12px" }}>
                      Last 30 days
                    </span>
                  </div>

                  {/* Table Header */}
                  <div
                    className="grid grid-cols-4 gap-2 pb-2"
                    style={{ borderBottom: `1px solid ${BORDER}` }}
                  >
                    <div style={{ color: DIM, fontSize: "10px", textTransform: "uppercase", letterSpacing: "-0.025em" }}>
                      Date
                    </div>
                    <div className="text-right" style={{ color: DIM, fontSize: "10px", textTransform: "uppercase", letterSpacing: "-0.025em" }}>
                      Occ %
                    </div>
                    <div className="text-right" style={{ color: DIM, fontSize: "10px", textTransform: "uppercase", letterSpacing: "-0.025em" }}>
                      ADR
                    </div>
                    <div className="text-right" style={{ color: DIM, fontSize: "10px", textTransform: "uppercase", letterSpacing: "-0.025em" }}>
                      RevPAR
                    </div>
                  </div>

                  {/* Table Rows */}
                  {[
                    { date: "Mar 15", occ: "82.5%", adr: "£245", revpar: "£202", trend: "up" },
                    { date: "Mar 14", occ: "79.2%", adr: "£238", revpar: "£188", trend: "up" },
                    { date: "Mar 13", occ: "75.8%", adr: "£242", revpar: "£183", trend: "down" },
                    { date: "Mar 12", occ: "88.1%", adr: "£251", revpar: "£221", trend: "up" },
                    { date: "Mar 11", occ: "76.4%", adr: "£239", revpar: "£182", trend: "up" },
                  ].map((row, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-4 gap-2 py-2"
                      style={{
                        borderBottom: `1px solid rgba(42, 42, 42, 0.5)`,
                        backgroundColor: "#1D1D1C",
                        padding: "10px 0",
                        transition: "background-color 0.2s",
                      }}
                    >
                      <div style={{ color: WHITE, fontSize: "12px" }}>
                        {row.date}
                      </div>
                      <div className="text-right" style={{ color: WHITE, fontSize: "12px" }}>
                        {row.occ}
                      </div>
                      <div className="text-right" style={{ color: WHITE, fontSize: "12px" }}>
                        {row.adr}
                      </div>
                      <div className="text-right flex items-center justify-end gap-1" style={{ fontSize: "12px" }}>
                        <span style={{ color: WHITE }}>{row.revpar}</span>
                        <TrendingUp
                          className="w-3 h-3"
                          style={{
                            color: row.trend === "up" ? GREEN : RED,
                          }}
                        />
                      </div>
                    </div>
                  ))}

                  {/* Summary Row */}
                  <div
                    className="grid grid-cols-4 gap-2 -mx-6 px-6 py-3"
                    style={{ backgroundColor: BG_INPUT }}
                  >
                    <div style={{ color: BLUE, fontSize: "12px" }}>Average</div>
                    <div className="text-right" style={{ color: BLUE, fontSize: "12px" }}>
                      80.4%
                    </div>
                    <div className="text-right" style={{ color: BLUE, fontSize: "12px" }}>
                      £243
                    </div>
                    <div className="text-right flex items-center justify-end gap-1">
                      <span style={{ color: BLUE, fontSize: "12px" }}>£195</span>
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
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm mb-6"
              style={{
                backgroundColor: `rgba(57, 189, 248, 0.15)`,
                color: BLUE,
              }}
            >
              <Calendar className="w-4 h-4" />
              <span>Market Intelligence</span>
            </div>
            <h2 className="text-4xl mb-4" style={{ color: WHITE }}>
              Don't just track the past.{" "}
              <span style={{ color: BLUE }}>Predict the future.</span>
            </h2>
            <p className="text-lg max-w-2xl mx-auto" style={{ color: GRAY }}>
              Forward-looking demand data, seasonality trends, and neighborhood
              performance to help you make smarter pricing decisions.
            </p>
          </div>

          {/* Calendar Preview */}
          <div className="relative">
            <div
              className="relative rounded-lg overflow-hidden shadow-2xl"
              style={{
                backgroundColor: BG_CARD,
                border: `1px solid ${BORDER}`,
              }}
            >
              {/* Window chrome */}
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{
                  borderBottom: `1px solid ${BORDER}`,
                  backgroundColor: "#1D1D1C",
                }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: RED }} />
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#f59e0b" }} />
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: GREEN }} />
                </div>
                <div
                  className="font-mono"
                  style={{ fontSize: "12px", color: DIM }}
                >
                  market_demand_forecast.pdf
                </div>
              </div>

              {/* Heatmap Grid */}
              <div className="p-6 grid grid-cols-7 gap-1 opacity-75">
                {Array.from({ length: 28 }).map((_, i) => {
                  const intensity = [
                    { bg: "rgba(57, 189, 248, 0.15)", border: "rgba(57, 189, 248, 0.25)" },
                    { bg: "rgba(16, 185, 129, 0.15)", border: "rgba(16, 185, 129, 0.25)" },
                    { bg: "rgba(245, 158, 11, 0.15)", border: "rgba(245, 158, 11, 0.25)" },
                    { bg: "rgba(239, 68, 68, 0.15)", border: "rgba(239, 68, 68, 0.25)" },
                  ][i % 4];

                  return (
                    <div
                      key={i}
                      className="h-12 rounded flex items-center justify-center"
                      style={{
                        backgroundColor: intensity.bg,
                        border: `1px solid ${intensity.border}`,
                      }}
                    >
                      <span
                        style={{
                          fontSize: "10px",
                          color: WHITE,
                          opacity: 0.5,
                        }}
                      >
                        {i + 1}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Overlay Label */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div
                  className="backdrop-blur px-6 py-3 rounded-full text-sm font-medium"
                  style={{
                    backgroundColor: "rgba(26, 26, 26, 0.9)",
                    border: `1px solid rgba(57, 189, 248, 0.3)`,
                    color: BLUE,
                  }}
                >
                  Live Interactive Calendar
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof / Trust Section */}
      <section
        className="relative py-32 px-6"
        style={{ backgroundColor: "#141414" }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl mb-4" style={{ color: WHITE }}>
              Trusted by forward-thinking hoteliers
            </h2>
            <p style={{ color: GRAY }}>
              Join hundreds of hotels using Market Pulse to optimize their
              revenue strategy
            </p>
          </div>

          {/* Testimonials */}
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            {[
              {
                quote:
                  "Market Pulse has become an essential part of our morning revenue meeting. The competitive insights are invaluable.",
                author: "Sarah Chen",
                role: "General Manager",
                type: "Boutique Hotel",
              },
              {
                quote:
                  "Finally, a free tool that actually delivers on its promise. The PMS integration was seamless and the data is incredibly accurate.",
                author: "Michael Rodriguez",
                role: "Revenue Manager",
                type: "Independent Property",
              },
              {
                quote:
                  "The market ranking feature alone is worth it. We've made smarter pricing decisions and seen our RevPAR increase by 12%.",
                author: "Emily Thompson",
                role: "Owner/Operator",
                type: "Urban Hotel",
              },
            ].map((testimonial, idx) => (
              <div
                key={idx}
                className="rounded-lg p-6 space-y-4"
                style={{
                  backgroundColor: BG_CARD,
                  border: `1px solid ${BORDER}`,
                }}
              >
                <div className="leading-relaxed" style={{ color: WHITE }}>
                  "{testimonial.quote}"
                </div>
                <div
                  className="flex items-center gap-3 pt-4"
                  style={{ borderTop: `1px solid ${BORDER}` }}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: BG_INPUT }}
                  >
                    <Users className="w-5 h-5" style={{ color: DIM }} />
                  </div>
                  <div>
                    <div className="text-sm" style={{ color: WHITE }}>
                      {testimonial.author}
                    </div>
                    <div style={{ fontSize: "12px", color: DIM }}>
                      {testimonial.role}, {testimonial.type}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Partner Logos */}
          <div className="text-center">
            <div className="text-sm mb-6" style={{ color: GRAY }}>
              Integrated with leading PMS providers
            </div>
            <div className="flex items-center justify-center gap-12 flex-wrap">
              <div
                className="flex items-center gap-2 px-6 py-3 rounded-lg"
                style={{
                  backgroundColor: BG_CARD,
                  border: `1px solid ${BORDER}`,
                }}
              >
                <div className="w-8 h-8 rounded bg-[#4a9eff] flex items-center justify-center text-white font-bold">
                  CB
                </div>
                <span style={{ color: WHITE }}>Cloudbeds</span>
              </div>
              <div
                className="flex items-center gap-2 px-6 py-3 rounded-lg"
                style={{
                  backgroundColor: BG_CARD,
                  border: `1px solid ${BORDER}`,
                }}
              >
                <div className="w-8 h-8 rounded bg-[#00c9a7] flex items-center justify-center text-white font-bold">
                  M
                </div>
                <span style={{ color: WHITE }}>Mews</span>
              </div>
              <div
                className="flex items-center gap-2 px-6 py-3 rounded-lg"
                style={{
                  backgroundColor: BG_CARD,
                  border: `1px solid ${BORDER}`,
                  opacity: 0.5,
                }}
              >
                <div
                  className="w-8 h-8 rounded flex items-center justify-center text-white text-xs"
                  style={{ backgroundColor: DIM }}
                >
                  More
                </div>
                <span style={{ color: WHITE }}>Coming Soon</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="relative py-32 px-6 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to bottom right, rgba(57, 189, 248, 0.03), transparent, rgba(57, 189, 248, 0.03))`,
          }}
        />

        <div className="relative max-w-4xl mx-auto text-center">
          <h2 className="text-5xl mb-6" style={{ color: WHITE }}>
            Ready to get the{" "}
            <span style={{ color: BLUE }}>sharpest view</span> of your market?
          </h2>
          <p className="text-xl mb-12" style={{ color: GRAY }}>
            Start analyzing your competitive position in under 5 minutes. No
            credit card required.
          </p>

          {/* CTA Box */}
          <div
            className="rounded-lg p-8 max-w-md mx-auto"
            style={{
              backgroundColor: BG_CARD,
              border: `1px solid ${BORDER}`,
            }}
          >
            <div className="space-y-4">
              <form onSubmit={handleMagicLink} className="space-y-3">
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12"
                  style={{
                    backgroundColor: BG_INPUT,
                    borderColor: BORDER,
                    color: WHITE,
                  }}
                />
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 transition-all"
                  style={{
                    backgroundColor: BLUE,
                    color: BG_PAGE,
                    fontWeight: 600,
                  }}
                >
                  Get Started Free
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div
                    className="w-full"
                    style={{ borderTop: `1px solid ${BORDER}` }}
                  />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span
                    className="px-4"
                    style={{ backgroundColor: BG_CARD, color: GRAY }}
                  >
                    or
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => handlePMSConnect("Cloudbeds")}
                  className="h-11 transition-all text-sm"
                  style={{
                    backgroundColor: BG_INPUT,
                    border: `1px solid ${BORDER}`,
                    color: WHITE,
                  }}
                >
                  <div className="w-5 h-5 rounded bg-[#4a9eff] flex items-center justify-center text-white text-xs font-bold mr-2">
                    CB
                  </div>
                  Cloudbeds
                </Button>
                <Button
                  onClick={() => handlePMSConnect("Mews")}
                  className="h-11 transition-all text-sm"
                  style={{
                    backgroundColor: BG_INPUT,
                    border: `1px solid ${BORDER}`,
                    color: WHITE,
                  }}
                >
                  <div className="w-5 h-5 rounded bg-[#00c9a7] flex items-center justify-center text-white text-xs font-bold mr-2">
                    M
                  </div>
                  Mews
                </Button>
              </div>
            </div>
          </div>

          <div
            className="flex items-center justify-center gap-6 mt-8 text-sm"
            style={{ color: GRAY }}
          >
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4" style={{ color: GREEN }} />
              <span>100% Free</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4" style={{ color: GREEN }} />
              <span>No Credit Card</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4" style={{ color: GREEN }} />
              <span>5 Min Setup</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="relative py-12 px-6"
        style={{ borderTop: `1px solid ${BORDER}` }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Logo */}
            <div className="flex items-center gap-1">
              <span style={{ color: BLUE, fontSize: "24px" }}>(</span>
              <span
                style={{
                  color: WHITE,
                  fontSize: "14px",
                  letterSpacing: "0.025em",
                  position: "relative",
                  top: "2px",
                }}
              >
                MARKET PULSE
              </span>
              <span style={{ color: BLUE, fontSize: "24px" }}>)</span>
            </div>

            <div
              className="flex items-center gap-8 text-sm"
              style={{ color: GRAY }}
            >
              <button
                onClick={() => onViewChange("privacy")}
                className="transition-colors"
                style={{ color: GRAY }}
                onMouseEnter={(e) => (e.currentTarget.style.color = BLUE)}
                onMouseLeave={(e) => (e.currentTarget.style.color = GRAY)}
              >
                Privacy Policy
              </button>
              <button
                onClick={() => onViewChange("terms")}
                className="transition-colors"
                style={{ color: GRAY }}
                onMouseEnter={(e) => (e.currentTarget.style.color = BLUE)}
                onMouseLeave={(e) => (e.currentTarget.style.color = GRAY)}
              >
                Terms of Service
              </button>
              <a
                href="mailto:support@marketpulse.com"
                className="transition-colors"
                style={{ color: GRAY }}
                onMouseEnter={(e) => (e.currentTarget.style.color = BLUE)}
                onMouseLeave={(e) => (e.currentTarget.style.color = GRAY)}
              >
                Contact
              </a>
            </div>

            <div className="text-sm" style={{ color: DIM }}>
              &copy; 2026 Market Pulse. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
