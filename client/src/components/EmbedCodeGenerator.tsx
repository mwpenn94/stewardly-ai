/**
 * EmbedCodeGenerator — Generates embeddable HTML/JS snippets for calculators and widgets.
 * Provides copy-to-clipboard with preview of the embed dimensions.
 */
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Check, Code, Eye } from "lucide-react";
import { toast } from "sonner";

interface EmbedCodeGeneratorProps {
  widgetType: string;
  widgetId: string;
  baseUrl?: string;
  className?: string;
}

export function EmbedCodeGenerator({
  widgetType,
  widgetId,
  baseUrl = typeof window !== "undefined" ? window.location.origin : "",
  className,
}: EmbedCodeGeneratorProps) {
  const [width, setWidth] = useState("100%");
  const [height, setHeight] = useState("600");
  const [theme, setTheme] = useState("dark");
  const [copied, setCopied] = useState(false);

  const embedUrl = useMemo(
    () => `${baseUrl}/embed/${widgetType}/${widgetId}?theme=${theme}`,
    [baseUrl, widgetType, widgetId, theme],
  );

  const iframeCode = useMemo(
    () =>
      `<iframe src="${embedUrl}" width="${width}" height="${height}" frameborder="0" style="border:none;border-radius:8px;" loading="lazy" allow="clipboard-write"></iframe>`,
    [embedUrl, width, height],
  );

  const scriptCode = useMemo(
    () =>
      `<div id="stewardly-${widgetType}-${widgetId}"></div>\n<script src="${baseUrl}/embed/loader.js" data-widget="${widgetType}" data-id="${widgetId}" data-theme="${theme}"></script>`,
    [baseUrl, widgetType, widgetId, theme],
  );

  const handleCopy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("Embed code copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Code className="h-4 w-4" /> Embed Code
        </CardTitle>
        <CardDescription>Add this widget to your website</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Width</Label>
            <Input value={width} onChange={e => setWidth(e.target.value)} placeholder="100%" className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Height (px)</Label>
            <Input value={height} onChange={e => setHeight(e.target.value)} placeholder="600" className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Theme</Label>
            <Select value={theme} onValueChange={setTheme}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="auto">Auto</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs defaultValue="iframe" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="iframe" className="flex-1 text-xs">iFrame</TabsTrigger>
            <TabsTrigger value="script" className="flex-1 text-xs">Script Tag</TabsTrigger>
          </TabsList>
          <TabsContent value="iframe">
            <div className="relative">
              <pre className="bg-muted/50 rounded-md p-3 text-xs overflow-x-auto font-mono whitespace-pre-wrap break-all">
                {iframeCode}
              </pre>
              <Button
                variant="ghost" size="sm"
                className="absolute top-1 right-1 h-7 w-7 p-0"
                onClick={() => handleCopy(iframeCode)}
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </TabsContent>
          <TabsContent value="script">
            <div className="relative">
              <pre className="bg-muted/50 rounded-md p-3 text-xs overflow-x-auto font-mono whitespace-pre-wrap break-all">
                {scriptCode}
              </pre>
              <Button
                variant="ghost" size="sm"
                className="absolute top-1 right-1 h-7 w-7 p-0"
                onClick={() => handleCopy(scriptCode)}
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
