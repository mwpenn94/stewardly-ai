import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  ArrowLeft, Search, Star, MapPin, Award, Users, CheckCircle,
  BarChart3, Shield, ChevronDown, ChevronUp, Loader2, Sparkles,
  Scale, FileText, ArrowRight, X, Filter
} from "lucide-react";
import { Link } from "wouter";

// ─── TYPES ──────────────────────────────────────────────────────────────
type MatchedAdvisor = {
  id: string;
  name: string;
  title: string;
  firm: string;
  specializations: string[];
  credentials: string[];
  yearsExperience: number;
  aumRange: string;
  location: string;
  rating: number;
  bio: string;
  matchScore: number;
  matchReasons: string[];
};

type ComparisonProduct = {
  id: string;
  name: string;
  company: string;
  category: string;
  riskLevel: string;
  minPremium: number;
  maxPremium: number;
  features: Record<string, string>;
  targetAudience: string;
  suitabilityScore?: number;
};

// ─── ADVISOR MATCHING ───────────────────────────────────────────────────
function AdvisorMatching() {
  const { user } = useAuth();
  const [needs, setNeeds] = useState("");
  const [location, setLocation] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<MatchedAdvisor[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [inviteSent, setInviteSent] = useState<Set<string>>(new Set());

  // Simulated AI matching — in production this would call a tRPC endpoint
  const handleSearch = async () => {
    if (!needs.trim()) {
      toast.error("Please describe what you're looking for");
      return;
    }
    setSearching(true);
    // Simulate AI matching delay
    await new Promise(r => setTimeout(r, 1500));

    const mockAdvisors: MatchedAdvisor[] = [
      {
        id: "adv-1",
        name: "Sarah Chen, CFP\u00ae, CFA",
        title: "Senior Financial Planner",
        firm: "Meridian Wealth Partners",
        specializations: ["Retirement Planning", "Tax Optimization", "Estate Planning"],
        credentials: ["CFP\u00ae", "CFA", "Series 65"],
        yearsExperience: 14,
        aumRange: "$500K - $5M",
        location: "San Francisco, CA",
        rating: 4.9,
        bio: "Specializing in comprehensive financial planning for tech professionals and business owners. I believe in building long-term relationships based on trust and transparency.",
        matchScore: 96,
        matchReasons: ["Retirement planning expertise matches your goals", "Experience with your income range", "Located near you"],
      },
      {
        id: "adv-2",
        name: "Marcus Williams, ChFC\u00ae",
        title: "Wealth Management Advisor",
        firm: "Pacific Financial Group",
        specializations: ["Insurance Planning", "IUL Strategies", "Business Succession"],
        credentials: ["ChFC\u00ae", "CLU\u00ae", "Series 7/66"],
        yearsExperience: 18,
        aumRange: "$250K - $2M",
        location: "Los Angeles, CA",
        rating: 4.8,
        bio: "18 years of experience helping families protect and grow their wealth through strategic insurance and investment planning.",
        matchScore: 91,
        matchReasons: ["Insurance planning expertise", "Strong IUL specialization", "High client satisfaction"],
      },
      {
        id: "adv-3",
        name: "Dr. Priya Patel, PhD, CFP\u00ae",
        title: "Financial Behavioral Specialist",
        firm: "Mindful Money Advisors",
        specializations: ["Behavioral Finance", "Financial Wellness", "Young Professionals"],
        credentials: ["CFP\u00ae", "PhD Behavioral Economics"],
        yearsExperience: 9,
        aumRange: "$100K - $1M",
        location: "Remote / Nationwide",
        rating: 4.7,
        bio: "Combining behavioral science with financial planning to help clients overcome psychological barriers to wealth building.",
        matchScore: 87,
        matchReasons: ["Behavioral finance approach", "Works with younger professionals", "Remote availability"],
      },
      {
        id: "adv-4",
        name: "Robert Kim, CPA/PFS",
        title: "Tax-Focused Financial Advisor",
        firm: "Summit Tax & Wealth",
        specializations: ["Tax Planning", "Real Estate", "Small Business"],
        credentials: ["CPA", "PFS", "Series 65"],
        yearsExperience: 22,
        aumRange: "$1M - $10M",
        location: "Seattle, WA",
        rating: 4.9,
        bio: "Dual CPA and financial advisor helping high-net-worth individuals minimize tax burden while maximizing long-term wealth.",
        matchScore: 84,
        matchReasons: ["Tax optimization expertise", "CPA credentials", "High-net-worth experience"],
      },
    ];

    setResults(mockAdvisors);
    setSearching(false);
  };

  const handleInvite = (advisorId: string) => {
    setInviteSent(prev => { const next = new Set(Array.from(prev)); next.add(advisorId); return next; });
    toast.success("Connection request sent! The advisor will be notified.");
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-emerald-400";
    if (score >= 80) return "text-amber-400";
    return "text-zinc-400";
  };

  return (
    <div className="space-y-6">
      {/* Search Section */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="w-5 h-5 text-amber-400" />
            AI-Powered Advisor Matching
          </CardTitle>
          <CardDescription>
            Describe your financial needs and goals. Our AI will match you with the best-fit professionals.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm text-zinc-400 mb-1.5 block">What are you looking for?</label>
            <Textarea
              value={needs}
              onChange={e => setNeeds(e.target.value)}
              placeholder="e.g., I need help with retirement planning, I'm 45 with $500K in savings and want to retire at 62. Also interested in tax-efficient strategies and IUL policies."
              className="bg-zinc-800/50 border-zinc-700 min-h-[100px]"
            />
          </div>
          <div>
            <label className="text-sm text-zinc-400 mb-1.5 block">Preferred location (optional)</label>
            <Input
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="e.g., San Francisco, CA or 'Remote'"
              className="bg-zinc-800/50 border-zinc-700"
            />
          </div>
          <Button
            onClick={handleSearch}
            disabled={searching}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {searching ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Finding your best matches...
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                Find Advisors
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-zinc-100">
              {results.length} Matched Professionals
            </h3>
            <Badge variant="outline" className="border-amber-600/50 text-amber-400">
              Sorted by match score
            </Badge>
          </div>

          {results.map((advisor, idx) => (
            <Card
              key={advisor.id}
              className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-colors"
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-white font-bold text-sm">
                        #{idx + 1}
                      </div>
                      <div>
                        <h4 className="font-semibold text-zinc-100">{advisor.name}</h4>
                        <p className="text-sm text-zinc-400">{advisor.title} at {advisor.firm}</p>
                      </div>
                    </div>

                    {/* Quick stats */}
                    <div className="flex flex-wrap gap-3 mt-3 text-sm">
                      <span className="flex items-center gap-1 text-zinc-400">
                        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                        {advisor.rating}
                      </span>
                      <span className="flex items-center gap-1 text-zinc-400">
                        <Award className="w-3.5 h-3.5" />
                        {advisor.yearsExperience} years
                      </span>
                      <span className="flex items-center gap-1 text-zinc-400">
                        <MapPin className="w-3.5 h-3.5" />
                        {advisor.location}
                      </span>
                      <span className="flex items-center gap-1 text-zinc-400">
                        <BarChart3 className="w-3.5 h-3.5" />
                        {advisor.aumRange}
                      </span>
                    </div>

                    {/* Credentials */}
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {advisor.credentials.map(cred => (
                        <Badge key={cred} variant="outline" className="text-xs border-zinc-700 text-zinc-300">
                          {cred}
                        </Badge>
                      ))}
                      {advisor.specializations.map(spec => (
                        <Badge key={spec} className="text-xs bg-zinc-800 text-zinc-300 hover:bg-zinc-700">
                          {spec}
                        </Badge>
                      ))}
                    </div>

                    {/* Expandable details */}
                    {expandedId === advisor.id && (
                      <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-top-2">
                        <p className="text-sm text-zinc-300 leading-relaxed">{advisor.bio}</p>
                        <div className="bg-zinc-800/50 rounded-lg p-3">
                          <p className="text-xs font-medium text-amber-400 mb-2">Why this match:</p>
                          <ul className="space-y-1">
                            {advisor.matchReasons.map((reason, i) => (
                              <li key={i} className="flex items-center gap-2 text-xs text-zinc-300">
                                <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
                                {reason}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Match score + actions */}
                  <div className="flex flex-col items-center gap-3 shrink-0">
                    <div className="text-center">
                      <div className={`text-2xl font-bold ${getScoreColor(advisor.matchScore)}`}>
                        {advisor.matchScore}%
                      </div>
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Match</div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setExpandedId(expandedId === advisor.id ? null : advisor.id)}
                      className="text-zinc-400"
                    >
                      {expandedId === advisor.id ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </Button>
                    {inviteSent.has(advisor.id) ? (
                      <Badge className="bg-emerald-900/50 text-emerald-400 border-emerald-700">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Sent
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleInvite(advisor.id)}
                        className="bg-amber-600 hover:bg-amber-700 text-white text-xs"
                      >
                        Connect
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── PRODUCT COMPARISON ─────────────────────────────────────────────────
function ProductComparison() {
  const productsQuery = trpc.products.list.useQuery();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const products = productsQuery.data ?? [];

  const categories = useMemo(() => {
    const cats = new Set(products.map((p: any) => p.category as string));
    return ["all", ...Array.from(cats)] as string[];
  }, [products]);

  const filtered = useMemo(() => {
    return products.filter((p: any) => {
      const matchesSearch = !searchTerm ||
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.company.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === "all" || p.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, categoryFilter]);

  const selectedProducts = useMemo(() => {
    return products.filter((p: any) => selectedIds.includes(p.id));
  }, [products, selectedIds]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 4) {
        toast.error("Maximum 4 products for comparison");
        return prev;
      }
      return [...prev, id];
    });
    setShowAnalysis(false);
  };

  const handleAnalyze = async () => {
    if (selectedProducts.length < 2) {
      toast.error("Select at least 2 products to compare");
      return;
    }
    setAnalyzing(true);
    await new Promise(r => setTimeout(r, 1200));
    setShowAnalysis(true);
    setAnalyzing(false);
  };

  const getRiskColor = (risk: string) => {
    const r = risk?.toLowerCase() || "";
    if (r.includes("low")) return "text-emerald-400 border-emerald-700 bg-emerald-900/30";
    if (r.includes("moderate") || r.includes("medium")) return "text-amber-400 border-amber-700 bg-amber-900/30";
    return "text-red-400 border-red-700 bg-red-900/30";
  };

  // Gather all unique feature keys from selected products
  const comparisonKeys = useMemo(() => {
    const keys = new Set<string>();
    selectedProducts.forEach((p: any) => {
      if (p.features && typeof p.features === "object") {
        Object.keys(p.features).forEach(k => keys.add(k));
      }
    });
    return Array.from(keys);
  }, [selectedProducts]);

  return (
    <div className="space-y-6">
      {/* Selection bar */}
      {selectedIds.length > 0 && (
        <div className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur border border-zinc-800 rounded-lg p-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-zinc-400">Comparing:</span>
            {selectedProducts.map((p: any) => (
              <Badge key={p.id} variant="outline" className="border-amber-600/50 text-amber-400 gap-1">
                {p.name}
                <X className="w-3 h-3 cursor-pointer" onClick={() => toggleSelect(p.id)} />
              </Badge>
            ))}
          </div>
          <Button
            size="sm"
            onClick={handleAnalyze}
            disabled={selectedProducts.length < 2 || analyzing}
            className="bg-amber-600 hover:bg-amber-700 text-white shrink-0"
          >
            {analyzing ? (
              <Loader2 className="w-4 h-4 animate-spin mr-1" />
            ) : (
              <Scale className="w-4 h-4 mr-1" />
            )}
            Compare ({selectedProducts.length})
          </Button>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search products..."
            className="pl-9 bg-zinc-800/50 border-zinc-700"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {categories.map((cat: string) => (
            <Button
              key={cat}
              size="sm"
              variant={categoryFilter === cat ? "default" : "outline"}
              onClick={() => setCategoryFilter(cat)}
              className={categoryFilter === cat
                ? "bg-amber-600 hover:bg-amber-700 text-white text-xs"
                : "border-zinc-700 text-zinc-400 text-xs"
              }
            >
              {cat === "all" ? "All" : String(cat)}
            </Button>
          ))}
        </div>
      </div>

      {/* Product grid */}
      {productsQuery.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1,2,3,4,5,6].map(i => (
            <Skeleton key={i} className="h-40 bg-zinc-800/50" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((product: any) => {
            const isSelected = selectedIds.includes(product.id);
            return (
              <Card
                key={product.id}
                className={`cursor-pointer transition-all ${
                  isSelected
                    ? "bg-amber-900/20 border-amber-600/50 ring-1 ring-amber-600/30"
                    : "bg-zinc-900/50 border-zinc-800 hover:border-zinc-700"
                }`}
                onClick={() => toggleSelect(product.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-medium text-zinc-100 text-sm">{product.name}</h4>
                      <p className="text-xs text-zinc-500">{product.company}</p>
                    </div>
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                      isSelected ? "border-amber-500 bg-amber-600" : "border-zinc-600"
                    }`}>
                      {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
                    </div>
                  </div>
                  <div className="flex gap-1.5 mt-2">
                    <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-400">
                      {product.category}
                    </Badge>
                    <Badge variant="outline" className={`text-[10px] ${getRiskColor(product.riskLevel)}`}>
                      {product.riskLevel}
                    </Badge>
                  </div>
                  {product.targetAudience && (
                    <p className="text-xs text-zinc-500 mt-2 line-clamp-2">{product.targetAudience}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Comparison Table */}
      {showAnalysis && selectedProducts.length >= 2 && (
        <Card className="bg-zinc-900/50 border-zinc-800 animate-in fade-in slide-in-from-bottom-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Scale className="w-5 h-5 text-amber-400" />
              Side-by-Side Comparison
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="text-left py-3 px-3 text-zinc-500 font-medium w-[160px]">Feature</th>
                    {selectedProducts.map((p: any) => (
                      <th key={p.id} className="text-left py-3 px-3 text-zinc-200 font-medium">
                        <div>{p.name}</div>
                        <div className="text-xs text-zinc-500 font-normal">{p.company}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-zinc-800/50">
                    <td className="py-2.5 px-3 text-zinc-400">Category</td>
                    {selectedProducts.map((p: any) => (
                      <td key={p.id} className="py-2.5 px-3 text-zinc-200">{p.category}</td>
                    ))}
                  </tr>
                  <tr className="border-b border-zinc-800/50">
                    <td className="py-2.5 px-3 text-zinc-400">Risk Level</td>
                    {selectedProducts.map((p: any) => (
                      <td key={p.id} className="py-2.5 px-3">
                        <Badge variant="outline" className={`text-xs ${getRiskColor(p.riskLevel)}`}>
                          {p.riskLevel}
                        </Badge>
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-zinc-800/50">
                    <td className="py-2.5 px-3 text-zinc-400">Premium Range</td>
                    {selectedProducts.map((p: any) => (
                      <td key={p.id} className="py-2.5 px-3 text-zinc-200">
                        ${p.minPremium?.toLocaleString()} - ${p.maxPremium?.toLocaleString()}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-zinc-800/50">
                    <td className="py-2.5 px-3 text-zinc-400">Target Audience</td>
                    {selectedProducts.map((p: any) => (
                      <td key={p.id} className="py-2.5 px-3 text-zinc-300 text-xs">{p.targetAudience || "—"}</td>
                    ))}
                  </tr>
                  {comparisonKeys.map(key => (
                    <tr key={key} className="border-b border-zinc-800/50">
                      <td className="py-2.5 px-3 text-zinc-400 capitalize">{key.replace(/_/g, " ")}</td>
                      {selectedProducts.map((p: any) => (
                        <td key={p.id} className="py-2.5 px-3 text-zinc-300 text-xs">
                          {p.features?.[key] || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* AI Analysis */}
            <div className="mt-6 bg-zinc-800/50 rounded-lg p-4 border border-zinc-700/50">
              <h4 className="flex items-center gap-2 text-sm font-medium text-amber-400 mb-3">
                <Sparkles className="w-4 h-4" />
                AI Analysis
              </h4>
              <div className="space-y-2 text-sm text-zinc-300 leading-relaxed">
                <p>
                  Based on the comparison, <strong className="text-zinc-100">{selectedProducts[0]?.name}</strong> offers
                  the most competitive premium range starting at ${selectedProducts[0]?.minPremium?.toLocaleString()},
                  while <strong className="text-zinc-100">{selectedProducts[selectedProducts.length - 1]?.name}</strong> provides
                  broader coverage options.
                </p>
                <p>
                  For risk-averse investors, products with lower risk ratings may be more suitable.
                  Consider your time horizon, risk tolerance, and specific financial goals when making a decision.
                </p>
                <p className="text-xs text-zinc-500 italic mt-3">
                  This analysis is for educational purposes only and does not constitute financial advice.
                  Consult with a qualified financial professional before making investment decisions.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── MAIN MARKETPLACE PAGE ──────────────────────────────────────────────
export default function Marketplace() {
  const [activeTab, setActiveTab] = useState<"advisors" | "compare">("advisors");

  const tabs = [
    { id: "advisors" as const, label: "Find an Advisor", icon: <Users className="w-4 h-4" /> },
    { id: "compare" as const, label: "Compare Products", icon: <Scale className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-900/50">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3 mb-4">
            <Link href="/chat">
              <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-zinc-200">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-zinc-100">Marketplace</h1>
              <p className="text-sm text-zinc-500">Find advisors and compare financial products</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1">
            {tabs.map(tab => (
              <Button
                key={tab.id}
                variant="ghost"
                size="sm"
                onClick={() => setActiveTab(tab.id)}
                className={`gap-2 ${
                  activeTab === tab.id
                    ? "bg-zinc-800 text-amber-400"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {tab.icon}
                {tab.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {activeTab === "advisors" ? <AdvisorMatching /> : <ProductComparison />}
      </div>
    </div>
  );
}
