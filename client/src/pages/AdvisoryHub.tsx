/**
 * Advisory Hub (C24)
 * Consolidates: Products, Insurance Quotes/Applications, Estate Planning,
 * Premium Finance, Marketplace, Advisory Execution
 * Tabs: Products | Cases | Recommendations
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Link } from "wouter";
import {
  ArrowLeft, Package, Briefcase, Lightbulb, Search, Filter,
  Star, TrendingUp, Shield, FileText, Calculator, DollarSign,
  Building2, Scale, ChevronRight, Loader2, Eye, Plus,
  CheckCircle2, Clock, AlertTriangle, BarChart3,
} from "lucide-react";

export default function AdvisoryHub() {
  const [activeTab, setActiveTab] = useState("products");
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container py-4">
          <div className="flex items-center gap-3">
            <Link href="/chat">
              <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold">Advisory</h1>
              <p className="text-sm text-muted-foreground">Products, cases, and recommendations</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <QuickStat icon={Package} label="Products" value="—" color="text-blue-500" />
          <QuickStat icon={Briefcase} label="Active Cases" value="—" color="text-purple-500" />
          <QuickStat icon={Lightbulb} label="Recommendations" value="—" color="text-amber-500" />
          <QuickStat icon={CheckCircle2} label="Completed" value="—" color="text-green-500" />
        </div>

        {/* Search */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search products, cases, recommendations..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
          </div>
          <Button variant="outline" size="icon"><Filter className="h-4 w-4" /></Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="products" className="gap-1">
              <Package className="h-3 w-3" /> Products
            </TabsTrigger>
            <TabsTrigger value="cases" className="gap-1">
              <Briefcase className="h-3 w-3" /> Cases
            </TabsTrigger>
            <TabsTrigger value="recommendations" className="gap-1">
              <Lightbulb className="h-3 w-3" /> Recommendations
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="space-y-4 mt-4">
            <ProductsSection searchQuery={searchQuery} />
          </TabsContent>

          <TabsContent value="cases" className="space-y-4 mt-4">
            <CasesSection />
          </TabsContent>

          <TabsContent value="recommendations" className="space-y-4 mt-4">
            <RecommendationsSection />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function QuickStat({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-3">
        <Icon className={`h-5 w-5 ${color}`} />
        <div>
          <div className="text-lg font-bold">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProductsSection({ searchQuery }: { searchQuery: string }) {
  const products = trpc.products.list.useQuery({});

  const categories = [
    { name: "Life Insurance", icon: Shield, count: "—", color: "text-blue-500" },
    { name: "Annuities", icon: DollarSign, count: "—", color: "text-green-500" },
    { name: "Estate Planning", icon: Scale, count: "—", color: "text-purple-500" },
    { name: "Premium Finance", icon: Building2, count: "—", color: "text-amber-500" },
    { name: "Investment Products", icon: TrendingUp, count: "—", color: "text-cyan-500" },
    { name: "Marketplace", icon: Star, count: "—", color: "text-pink-500" },
  ];

  return (
    <div className="space-y-4">
      {/* Category Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {categories.map((cat) => (
          <Card key={cat.name} className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => toast.info("Ask the AI about " + cat.name)}>
            <CardContent className="p-4 flex items-center gap-3">
              <cat.icon className={`h-5 w-5 ${cat.color}`} />
              <div>
                <div className="text-sm font-medium">{cat.name}</div>
                <div className="text-xs text-muted-foreground">{cat.count} products</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Product List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Product Catalog</CardTitle>
          <CardDescription>All available products and services</CardDescription>
        </CardHeader>
        <CardContent>
          {products.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-2">
              {(products.data as any)?.slice?.(0, 8)?.map((product: any) => (
                <div key={product.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div>
                    <div className="text-sm font-medium">{product.name}</div>
                    <div className="text-xs text-muted-foreground">{product.carrier} · {product.type}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {product.suitabilityScore && (
                      <Badge variant="outline" className="text-xs">{product.suitabilityScore}% match</Badge>
                    )}
                    <Button size="sm" variant="ghost" className="h-7" onClick={() => toast.info("Ask the AI to analyze this product")}>
                      <Eye className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )) ?? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  Ask the AI to search for products matching your needs.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Suitability Matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Suitability Matrix</CardTitle>
          <CardDescription>Product-profile matching across 12 dimensions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground text-sm">
            <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
            Complete your suitability profile to see product matches.
            <br />
            <Link href="/chat">
              <Button size="sm" variant="link" className="mt-2">Start Suitability Assessment →</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CasesSection() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Active Cases</h3>
        <Button size="sm" onClick={() => toast.info("Ask the AI to create a new case")}>
          <Plus className="h-3 w-3 mr-1" /> New Case
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="text-center py-12 text-muted-foreground text-sm">
            <Briefcase className="h-8 w-8 mx-auto mb-2 opacity-50" />
            No active cases. Cases are created when you work with clients
            <br />
            on insurance applications, estate planning, or premium finance.
            <br />
            <span className="text-xs">Ask the AI to start a new advisory case.</span>
          </div>
        </CardContent>
      </Card>

      {/* Case Templates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Case Templates</CardTitle>
          <CardDescription>Quick-start templates for common advisory scenarios</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2">
          {[
            { name: "Insurance Application", icon: Shield },
            { name: "Estate Plan Review", icon: Scale },
            { name: "Premium Finance Setup", icon: Building2 },
            { name: "Retirement Analysis", icon: Calculator },
          ].map((template) => (
            <Button key={template.name} variant="outline" className="h-auto py-3 flex-col gap-1" onClick={() => toast.info("Ask the AI to start a " + template.name)}>
              <template.icon className="h-4 w-4" />
              <span className="text-xs">{template.name}</span>
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function RecommendationsSection() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI Recommendations</CardTitle>
          <CardDescription>Personalized recommendations based on your profile and goals</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground text-sm">
            <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
            Recommendations will appear as the AI learns about your needs.
            <br />
            <span className="text-xs">Complete your profile and suitability assessment for personalized recommendations.</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recommendation History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground text-sm">
            <Clock className="h-6 w-6 mx-auto mb-2 opacity-50" />
            Past recommendations and their outcomes will be tracked here.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
