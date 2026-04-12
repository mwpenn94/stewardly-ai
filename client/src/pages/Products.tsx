import { useAuth } from "@/_core/hooks/useAuth";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  ArrowLeft, Sparkles, Package, TrendingUp, Shield, Building2,
  Loader2, MessageSquare, ChevronRight, Star, Search, Plus,
  Edit2, Trash2, Filter, X, AlertTriangle, Heart,
} from "lucide-react";
import { useState, useMemo } from "react";

const CATEGORY_META: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  iul: { icon: <TrendingUp className="w-3.5 h-3.5" />, label: "Indexed Universal Life", color: "text-emerald-400" },
  whole_life: { icon: <Shield className="w-3.5 h-3.5" />, label: "Whole Life", color: "text-blue-400" },
  term_life: { icon: <Building2 className="w-3.5 h-3.5" />, label: "Term Life", color: "text-accent" },
  variable_life: { icon: <TrendingUp className="w-3.5 h-3.5" />, label: "Variable Life", color: "text-violet-400" },
  annuity: { icon: <Star className="w-3.5 h-3.5" />, label: "Annuities", color: "text-amber-400" },
  disability: { icon: <Heart className="w-3.5 h-3.5" />, label: "Disability", color: "text-rose-400" },
  ltc: { icon: <Shield className="w-3.5 h-3.5" />, label: "Long-Term Care", color: "text-orange-400" },
  premium_finance: { icon: <TrendingUp className="w-3.5 h-3.5" />, label: "Premium Finance", color: "text-teal-400" },
};

const RISK_COLORS: Record<string, string> = {
  low: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  moderate: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  moderate_high: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  high: "bg-red-500/10 text-red-400 border-red-500/20",
};

const CATEGORIES = ["iul", "term_life", "whole_life", "variable_life", "disability", "ltc", "premium_finance"] as const;

export default function Products() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const products = trpc.products.list.useQuery();
  const utils = trpc.useUtils();

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const createMutation = trpc.products.create.useMutation({
    onSuccess: () => { utils.products.list.invalidate(); setShowCreateDialog(false); toast.success("Product created"); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.products.update.useMutation({
    onSuccess: () => { utils.products.list.invalidate(); setEditingProduct(null); toast.success("Product updated"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.products.delete.useMutation({
    onSuccess: () => { utils.products.list.invalidate(); toast.success("Product removed"); },
    onError: (e) => toast.error(e.message),
  });

  const allProducts = products.data || [];
  const isAdmin = user?.role === "admin";

  // Filter products
  const filtered = useMemo(() => {
    let result = allProducts;
    if (activeCategory) result = result.filter(p => p.category === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.company.toLowerCase().includes(q) ||
        (p.description || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [allProducts, activeCategory, search]);

  // Group by company
  const grouped = useMemo(() => {
    const map: Record<string, typeof filtered> = {};
    for (const p of filtered) {
      if (!map[p.company]) map[p.company] = [];
      map[p.company].push(p);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const categories = useMemo(() => Array.from(new Set(allProducts.map(p => p.category))), [allProducts]);

  if (products.isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>;
  }

  return (
    <AppShell title="Products">
      <SEOHead title="Products" description="Product catalog and comparison tools" />
    <div className="min-h-screen animate-curtain-lift">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/30 backdrop-blur-sm sticky top-0 z-50 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 20% 50%, oklch(0.76 0.14 80 / 0.15) 0%, transparent 70%)' }} />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" className="shrink-0" onClick={() => navigate("/chat")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-accent" />
            <span className="font-semibold text-sm">Product Catalog</span>
          </div>
          <div className="flex-1" />
          {isAdmin && (
            <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 text-xs gap-1.5 h-8" onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-3.5 h-3.5" /> Add Product
            </Button>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Search + filters */}
        <div className="mb-6 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search products by name, company, or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-card border-border h-10"
            />
            {search && (
              <button className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setSearch("")}>
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* Category chips */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <button
              onClick={() => setActiveCategory(null)}
              className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-all border ${
                !activeCategory
                  ? "bg-accent/15 text-accent border-accent/30"
                  : "bg-card/50 text-muted-foreground border-border/50 hover:text-foreground"
              }`}
            >
              All ({allProducts.length})
            </button>
            {categories.map(cat => {
              const meta = CATEGORY_META[cat] || { icon: <Package className="w-3 h-3" />, label: cat, color: "text-muted-foreground" };
              const count = allProducts.filter(p => p.category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-all border ${
                    activeCategory === cat
                      ? "bg-accent/15 text-accent border-accent/30"
                      : "bg-card/50 text-muted-foreground border-border/50 hover:text-foreground"
                  }`}
                >
                  <span className={meta.color}>{meta.icon}</span>
                  {meta.label} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Results summary */}
        <p className="text-xs text-muted-foreground mb-4">
          {filtered.length} product{filtered.length !== 1 ? "s" : ""} from {grouped.length} provider{grouped.length !== 1 ? "s" : ""}
          {search && <span className="text-accent"> matching "{search}"</span>}
        </p>

        {/* Products grouped by company */}
        {grouped.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No products match your filters</p>
            <Button variant="ghost" size="sm" className="mt-2 text-xs text-accent" onClick={() => { setSearch(""); setActiveCategory(null); }}>
              Clear filters
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(([company, companyProducts]) => (
              <div key={company}>
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center">
                    <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                  <h2 className="text-sm font-semibold">{company}</h2>
                  <span className="text-[10px] text-muted-foreground">{companyProducts.length} product{companyProducts.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {companyProducts.map(product => {
                    const meta = CATEGORY_META[product.category] || { icon: <Package className="w-3.5 h-3.5" />, label: product.category, color: "text-muted-foreground" };
                    const riskColor = RISK_COLORS[product.riskLevel || ""] || "";
                    const isExpanded = expandedId === product.id;
                    const features = Array.isArray(product.features) ? product.features : [];

                    return (
                      <Card
                        key={product.id}
                        className={`bg-card/60 border-border/50 hover:border-accent/20 transition-all cursor-pointer ${isExpanded ? "ring-1 ring-accent/20" : ""}`}
                        onClick={() => setExpandedId(isExpanded ? null : product.id)}
                      >
                        <CardContent className="p-4 space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium leading-tight">{product.name}</p>
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className={`inline-flex items-center gap-1 text-[10px] ${meta.color}`}>
                                  {meta.icon} {meta.label}
                                </span>
                              </div>
                            </div>
                            {product.isPlatform && (
                              <Badge variant="outline" className="text-[8px] shrink-0 border-accent/20 text-accent">Platform</Badge>
                            )}
                          </div>

                          {product.riskLevel && (
                            <Badge variant="outline" className={`text-[9px] ${riskColor}`}>
                              {product.riskLevel.replace("_", " ")} risk
                            </Badge>
                          )}

                          {product.description && (
                            <p className={`text-xs text-muted-foreground leading-relaxed ${isExpanded ? "" : "line-clamp-2"}`}>
                              {product.description}
                            </p>
                          )}

                          {/* Expanded details */}
                          {isExpanded && (
                            <div className="space-y-2 pt-1 border-t border-border/30">
                              {features.length > 0 && (
                                <div>
                                  <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wider mb-1">Key Features</p>
                                  <div className="flex flex-wrap gap-1">
                                    {features.map((f: string, i: number) => (
                                      <Badge key={i} variant="secondary" className="text-[9px]">{f}</Badge>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {product.targetAudience && (
                                <div>
                                  <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wider mb-1">Target Audience</p>
                                  <p className="text-xs text-muted-foreground">{product.targetAudience}</p>
                                </div>
                              )}

                              {(product.minPremium || product.maxPremium) && (
                                <div>
                                  <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wider mb-1">Premium Range</p>
                                  <p className="text-xs font-mono text-muted-foreground">
                                    {product.minPremium ? `$${product.minPremium.toLocaleString()}` : "—"}
                                    {" — "}
                                    {product.maxPremium ? `$${product.maxPremium.toLocaleString()}` : "—"}
                                  </p>
                                </div>
                              )}

                              <div className="flex items-center gap-2 pt-1">
                                <Button
                                  variant="ghost" size="sm"
                                  className="text-xs text-accent hover:text-accent/80 p-0 h-auto gap-1"
                                  onClick={(e) => { e.stopPropagation(); navigate("/chat"); }}
                                >
                                  <MessageSquare className="w-3 h-3" /> Ask AI <ChevronRight className="w-3 h-3" />
                                </Button>
                                {isAdmin && !product.isPlatform && (
                                  <>
                                    <Button
                                      variant="ghost" size="sm"
                                      className="text-xs text-muted-foreground hover:text-foreground p-0 h-auto gap-1 ml-auto"
                                      onClick={(e) => { e.stopPropagation(); setEditingProduct(product); }}
                                    >
                                      <Edit2 className="w-3 h-3" /> Edit
                                    </Button>
                                    <Button
                                      variant="ghost" size="sm"
                                      className="text-xs text-muted-foreground hover:text-destructive p-0 h-auto gap-1"
                                      onClick={(e) => { e.stopPropagation(); deleteMutation.mutate({ id: product.id }); }}
                                    >
                                      <Trash2 className="w-3 h-3" /> Delete
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-[10px] text-muted-foreground text-center mt-8">
          Product information is for educational purposes. Consult a licensed professional for personalized recommendations.
        </p>
      </div>

      {/* Create / Edit Dialog */}
      <ProductFormDialog
        open={showCreateDialog || !!editingProduct}
        onClose={() => { setShowCreateDialog(false); setEditingProduct(null); }}
        product={editingProduct}
        onSubmit={(data) => {
          if (editingProduct) {
            updateMutation.mutate({ id: editingProduct.id, ...data });
          } else {
            createMutation.mutate(data);
          }
        }}
        saving={createMutation.isPending || updateMutation.isPending}
      />
    </div>
    </AppShell>
  );
}

// ─── PRODUCT FORM DIALOG ────────────────────────────────────────────
function ProductFormDialog({
  open, onClose, product, onSubmit, saving,
}: {
  open: boolean;
  onClose: () => void;
  product: any;
  onSubmit: (data: any) => void;
  saving: boolean;
}) {
  const [company, setCompany] = useState(product?.company || "");
  const [name, setName] = useState(product?.name || "");
  const [category, setCategory] = useState(product?.category || "iul");
  const [description, setDescription] = useState(product?.description || "");
  const [riskLevel, setRiskLevel] = useState(product?.riskLevel || "moderate");
  const [targetAudience, setTargetAudience] = useState(product?.targetAudience || "");
  const [featuresStr, setFeaturesStr] = useState(
    Array.isArray(product?.features) ? product.features.join(", ") : ""
  );

  // Reset when product changes
  useState(() => {
    if (product) {
      setCompany(product.company || "");
      setName(product.name || "");
      setCategory(product.category || "iul");
      setDescription(product.description || "");
      setRiskLevel(product.riskLevel || "moderate");
      setTargetAudience(product.targetAudience || "");
      setFeaturesStr(Array.isArray(product.features) ? (product.features as string[]).join(", ") : "");
    }
  });

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm">{product ? "Edit Product" : "Add New Product"}</DialogTitle>
          <DialogDescription className="text-xs">
            {product ? "Update the product details below." : "Create a new product for your organization."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1 block">Company</Label>
              <Input value={company} onChange={(e) => setCompany(e.target.value)} className="h-8 text-xs bg-secondary" placeholder="Company name" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Product Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-xs bg-secondary" placeholder="Product name" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1 block">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-8 text-xs bg-secondary"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_META[c]?.label || c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Risk Level</Label>
              <Select value={riskLevel} onValueChange={setRiskLevel}>
                <SelectTrigger className="h-8 text-xs bg-secondary"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="moderate_high">Moderate-High</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs mb-1 block">Description</Label>
            <Textarea
              value={description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
              className="min-h-[80px] text-xs bg-secondary"
              placeholder="Product description..."
            />
          </div>

          <div>
            <Label className="text-xs mb-1 block">Key Features (comma-separated)</Label>
            <Input
              value={featuresStr}
              onChange={(e) => setFeaturesStr(e.target.value)}
              className="h-8 text-xs bg-secondary"
              placeholder="Tax-free growth, Living benefits, Market protection..."
            />
          </div>

          <div>
            <Label className="text-xs mb-1 block">Target Audience</Label>
            <Input
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              className="h-8 text-xs bg-secondary"
              placeholder="High-net-worth individuals, Business owners..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" className="text-xs" onClick={onClose}>Cancel</Button>
            <Button
              size="sm"
              className="bg-accent text-accent-foreground hover:bg-accent/90 text-xs gap-1.5"
              disabled={saving || !company.trim() || !name.trim()}
              onClick={() => onSubmit({
                company: company.trim(),
                name: name.trim(),
                category,
                description: description.trim() || undefined,
                riskLevel,
                targetAudience: targetAudience.trim() || undefined,
                features: featuresStr.split(",").map((f: string) => f.trim()).filter(Boolean),
              })}
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              {product ? "Update" : "Create"} Product
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
