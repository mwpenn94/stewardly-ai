/**
 * EmbedWidget — Embeddable calculator widget for advisor websites.
 * Renders a minimal calculator UI that can be iframed into external sites.
 */
import { useState } from "react";
import { useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calculator, PiggyBank } from "lucide-react";

export default function EmbedWidget() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const type = params.get("type") || "retirement";
  const accentColor = params.get("accent") || "#6366f1";

  const [age, setAge] = useState(35);
  const [retireAge, setRetireAge] = useState(65);
  const [savings, setSavings] = useState(250000);
  const [monthly, setMonthly] = useState(1500);
  const [result, setResult] = useState<number | null>(null);

  const calculate = () => {
    const years = retireAge - age;
    const rate = 0.07 / 12;
    const months = years * 12;
    const fv = savings * Math.pow(1 + rate, months) + monthly * ((Math.pow(1 + rate, months) - 1) / rate);
    setResult(Math.round(fv));
  };

  return (
    <div className="min-h-screen bg-transparent p-4">
      <Card className="max-w-md mx-auto border-0 shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <PiggyBank className="h-4 w-4" style={{ color: accentColor }} />
            Retirement Calculator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Current Age</Label><Input type="number" value={age} onChange={e => setAge(+e.target.value)} className="h-8 text-sm" /></div>
            <div><Label className="text-xs">Retirement Age</Label><Input type="number" value={retireAge} onChange={e => setRetireAge(+e.target.value)} className="h-8 text-sm" /></div>
            <div><Label className="text-xs">Current Savings ($)</Label><Input type="number" value={savings} onChange={e => setSavings(+e.target.value)} className="h-8 text-sm" /></div>
            <div><Label className="text-xs">Monthly ($)</Label><Input type="number" value={monthly} onChange={e => setMonthly(+e.target.value)} className="h-8 text-sm" /></div>
          </div>
          <Button onClick={calculate} className="w-full h-8 text-sm" style={{ backgroundColor: accentColor }}>
            <Calculator className="h-3.5 w-3.5 mr-1" /> Calculate
          </Button>
          {result !== null && (
            <div className="p-3 bg-muted/30 rounded-lg text-center">
              <p className="text-xs text-muted-foreground">Projected Savings at Retirement</p>
              <p className="text-xl font-bold" style={{ color: accentColor }}>${result.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Assuming 7% avg annual return</p>
            </div>
          )}
          <p className="text-[10px] text-center text-muted-foreground/50">
            Powered by Stewardly AI
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
