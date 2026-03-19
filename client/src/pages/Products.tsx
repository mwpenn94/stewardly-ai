import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  ArrowLeft, Sparkles, Package, TrendingUp, Shield, Building2,
  Loader2, MessageSquare, ChevronRight, Star,
} from "lucide-react";

const CATEGORY_META: Record<string, { icon: React.ReactNode; label: string }> = {
  iul: { icon: <TrendingUp className="w-4 h-4" />, label: "Indexed Universal Life" },
  whole_life: { icon: <Shield className="w-4 h-4" />, label: "Whole Life" },
  term: { icon: <Building2 className="w-4 h-4" />, label: "Term Life" },
  term_life: { icon: <Building2 className="w-4 h-4" />, label: "Term Life" },
  annuity: { icon: <Star className="w-4 h-4" />, label: "Annuities" },
  disability: { icon: <Shield className="w-4 h-4" />, label: "Disability" },
  ltc: { icon: <Shield className="w-4 h-4" />, label: "Long-Term Care" },
  premium_finance: { icon: <TrendingUp className="w-4 h-4" />, label: "Premium Finance" },
};

export default function Products() {
  useAuth({ redirectOnUnauthenticated: true });
  const [, navigate] = useLocation();
  const products = trpc.products.list.useQuery();

  if (products.isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>;
  }

  const allProducts = products.data || [];
  const categories = Array.from(new Set(allProducts.map(p => p.category)));

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card/30 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Sparkles className="w-4 h-4 text-accent" />
          <span className="font-semibold text-sm">Product Catalog</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-3">
            <Package className="w-6 h-6 text-accent" />
          </div>
          <h1 className="text-xl font-semibold mb-1">Financial Products</h1>
          <p className="text-muted-foreground text-sm">Explore our comprehensive product lineup. Ask the AI for personalized recommendations.</p>
        </div>

        <Tabs defaultValue="all" className="space-y-6">
          <TabsList className="bg-secondary flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="all" className="text-xs">All Products</TabsTrigger>
            {categories.map(cat => {
              const meta = CATEGORY_META[cat] || { icon: <Package className="w-3.5 h-3.5" />, label: cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) };
              return <TabsTrigger key={cat} value={cat} className="gap-1 text-xs">{meta.icon} {meta.label}</TabsTrigger>;
            })}
          </TabsList>

          <TabsContent value="all">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {allProducts.map(product => (
                <ProductCard key={product.id} product={product} onAsk={() => navigate(`/chat`)} />
              ))}
            </div>
          </TabsContent>

          {categories.map(cat => (
            <TabsContent key={cat} value={cat}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {allProducts.filter(p => p.category === cat).map(product => (
                  <ProductCard key={product.id} product={product} onAsk={() => navigate(`/chat`)} />
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>

        <p className="text-[10px] text-muted-foreground text-center mt-8">
          Product information is for educational purposes. Consult a licensed professional for personalized recommendations.
        </p>
      </div>
    </div>
  );
}

function ProductCard({ product, onAsk }: { product: any; onAsk: () => void }) {
  const meta = CATEGORY_META[product.category] || { icon: <Package className="w-4 h-4" />, label: product.category.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) };
  const features = product.features ? (typeof product.features === "string" ? JSON.parse(product.features) : product.features) : {};

  return (
    <Card className="bg-card border-border hover:border-accent/30 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm">{product.name}</CardTitle>
            <CardDescription className="text-xs mt-0.5">{product.company}</CardDescription>
          </div>
          <Badge variant="secondary" className="text-[10px] gap-1 shrink-0">
            {meta.icon} {meta.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {product.description && (
          <p className="text-xs text-muted-foreground leading-relaxed">{product.description}</p>
        )}
        {Object.keys(features).length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(features).slice(0, 4).map(([key, val]) => (
              <Badge key={key} variant="outline" className="text-[10px] font-normal">
                {key}: {String(val)}
              </Badge>
            ))}
          </div>
        )}
        <Button variant="ghost" size="sm" className="text-xs text-accent hover:text-accent/80 p-0 h-auto" onClick={onAsk}>
          <MessageSquare className="w-3 h-3 mr-1" /> Ask AI about this product <ChevronRight className="w-3 h-3 ml-0.5" />
        </Button>
      </CardContent>
    </Card>
  );
}
