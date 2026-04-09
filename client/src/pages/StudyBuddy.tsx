import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, BookOpen, FileText, HelpCircle, List, Loader2,
  MessageSquare, Sparkles, Upload, X, BookMarked, Clock, Lightbulb,
} from "lucide-react";
import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

type StudyResult = {
  type: "summary" | "outline" | "qa" | "glossary" | "explain";
  title: string;
  content: string;
  createdAt: Date;
};

export default function StudyBuddy() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("tools");
  const [documentText, setDocumentText] = useState("");
  const [documentName, setDocumentName] = useState("");
  const [results, setResults] = useState<StudyResult[]>([]);
  const [processing, setProcessing] = useState(false);
  const [selectedResult, setSelectedResult] = useState<StudyResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const studyMutation = trpc.chat.send.useMutation();

  const processWithAI = async (type: StudyResult["type"], prompt: string) => {
    if (!documentText.trim()) {
      toast.error("Please paste or upload document text first");
      return;
    }
    setProcessing(true);
    try {
      // Send to chat with study focus
      const result = await studyMutation.mutateAsync({
        content: prompt,
        focus: "study",
        conversationId: 0,
      });
      const content = result.content || "No result generated";
      const newResult: StudyResult = {
        type,
        title: `${type.charAt(0).toUpperCase() + type.slice(1)} — ${documentName || "Document"}`,
        content,
        createdAt: new Date(),
      };
      setResults(prev => [newResult, ...prev]);
      setSelectedResult(newResult);
      setActiveTab("results");
      toast.success(`${type} generated successfully`);
    } catch (e: any) {
      toast.error(e.message || "Failed to process");
    } finally {
      setProcessing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDocumentName(file.name);
    if (file.type === "text/plain" || file.name.endsWith(".txt") || file.name.endsWith(".md")) {
      const text = await file.text();
      setDocumentText(text);
      toast.success(`Loaded: ${file.name}`);
    } else if (file.type === "text/csv" || file.name.endsWith(".csv")) {
      const text = await file.text();
      setDocumentText(text);
      toast.success(`Loaded CSV: ${file.name}`);
    } else {
      toast.info("For best results, paste the text content directly. PDF/image OCR coming soon.");
    }
  };

  const tools = [
    {
      id: "summary",
      icon: <FileText className="w-5 h-5" />,
      title: "Summarize",
      desc: "Create a concise summary of the document",
      color: "text-blue-400",
      action: () => processWithAI("summary", `Please provide a comprehensive summary of the following document. Include the main points, key arguments, and conclusions:\n\n${documentText.slice(0, 8000)}`),
    },
    {
      id: "outline",
      icon: <List className="w-5 h-5" />,
      title: "Outline",
      desc: "Generate a structured outline with key points",
      color: "text-green-400",
      action: () => processWithAI("outline", `Create a detailed, hierarchical outline of the following document. Use Roman numerals for main sections, letters for subsections, and numbers for details:\n\n${documentText.slice(0, 8000)}`),
    },
    {
      id: "qa",
      icon: <HelpCircle className="w-5 h-5" />,
      title: "Generate Q&A",
      desc: "Create practice questions from the material",
      color: "text-purple-400",
      action: () => processWithAI("qa", `Generate 10 practice questions with detailed answers based on the following document. Include a mix of multiple choice, short answer, and conceptual questions:\n\n${documentText.slice(0, 8000)}`),
    },
    {
      id: "glossary",
      icon: <BookMarked className="w-5 h-5" />,
      title: "Build Glossary",
      desc: "Extract and define key terms",
      color: "text-amber-400",
      action: () => processWithAI("glossary", `Extract all key terms, acronyms, and important concepts from the following document. For each term, provide a clear definition and context of how it's used in the document:\n\n${documentText.slice(0, 8000)}`),
    },
    {
      id: "explain",
      icon: <Lightbulb className="w-5 h-5" />,
      title: "Explain Simply",
      desc: "Break down complex concepts in plain language",
      color: "text-cyan-400",
      action: () => processWithAI("explain", `Explain the following document in simple, plain language that anyone could understand. Use analogies and examples where helpful. Avoid jargon:\n\n${documentText.slice(0, 8000)}`),
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/30 backdrop-blur-sm sticky top-0 z-30 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 opacity-[0.10]" style={{ background: 'radial-gradient(ellipse at 20% 50%, oklch(0.76 0.14 80) 0%, transparent 70%)' }} />
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => navigate("/chat")}>
            <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">Chat</span>
          </Button>
          <Separator orientation="vertical" className="h-5" />
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-accent" />
            <h1 className="text-sm font-semibold">Study Buddy</h1>
          </div>
          {documentName && (
            <Badge variant="secondary" className="text-[10px] ml-auto">{documentName}</Badge>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="tools">Study Tools</TabsTrigger>
            <TabsTrigger value="results">
              Results {results.length > 0 && <Badge variant="secondary" className="ml-1.5 text-[9px]">{results.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tools" className="space-y-6">
            {/* Document Input */}
            <Card className="bg-card/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Upload className="w-4 h-4 text-accent" />
                  Document Input
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Document name (optional)"
                    value={documentName}
                    onChange={e => setDocumentName(e.target.value)}
                    className="flex-1 h-8 text-sm"
                  />
                  <input ref={fileInputRef} type="file" className="hidden" accept=".txt,.md,.csv,.tsv" onChange={handleFileUpload} />
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1.5">
                    <Upload className="w-3.5 h-3.5" /> Upload
                  </Button>
                  {documentText && (
                    <Button variant="ghost" size="sm" onClick={() => { setDocumentText(""); setDocumentName(""); }}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
                <Textarea
                  placeholder="Paste your document text here, or upload a text file above..."
                  value={documentText}
                  onChange={e => setDocumentText(e.target.value)}
                  className="min-h-[200px] text-sm font-mono"
                />
                {documentText && (
                  <p className="text-xs text-muted-foreground">
                    {documentText.split(/\s+/).length} words · {documentText.length} characters
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Study Tools Grid */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Study Tools</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {tools.map(tool => (
                  <Card
                    key={tool.id}
                    className="bg-card/50 hover:border-accent/30 transition-colors cursor-pointer group"
                    onClick={tool.action}
                  >
                    <CardContent className="pt-5">
                      <div className={`${tool.color} mb-2 group-hover:scale-110 transition-transform`}>
                        {tool.icon}
                      </div>
                      <h4 className="text-sm font-semibold mb-0.5">{tool.title}</h4>
                      <p className="text-xs text-muted-foreground">{tool.desc}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {processing && (
              <div className="flex items-center justify-center gap-3 py-8">
                <Loader2 className="w-5 h-5 animate-spin text-accent" />
                <span className="text-sm text-muted-foreground">Processing document...</span>
              </div>
            )}
          </TabsContent>

          <TabsContent value="results" className="space-y-4">
            {results.length === 0 ? (
              <div className="text-center py-16">
                <Sparkles className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No results yet. Use the study tools to analyze a document.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Results List */}
                <div className="space-y-2">
                  {results.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedResult(r)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        selectedResult === r
                          ? "border-accent/40 bg-accent/5"
                          : "border-border/30 bg-card/30 hover:border-accent/20"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[9px] capitalize">{r.type}</Badge>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {r.createdAt.toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-xs font-medium truncate">{r.title}</p>
                    </button>
                  ))}
                </div>

                {/* Result Detail */}
                <div className="lg:col-span-2">
                  {selectedResult ? (
                    <Card className="bg-card/50">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm">{selectedResult.title}</CardTitle>
                          <Badge variant="outline" className="capitalize text-[10px]">{selectedResult.type}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="prose-chat text-sm max-h-[60vh] overflow-y-auto">
                          <Streamdown>{selectedResult.content}</Streamdown>
                        </div>
                        <Separator className="my-4" />
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(selectedResult.content); toast.success("Copied"); }}>
                            Copy
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => { navigate("/chat"); toast.info("Continue discussing in chat"); }}>
                            <MessageSquare className="w-3.5 h-3.5 mr-1.5" /> Discuss in Chat
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
                      Select a result to view details
                    </div>
                  )}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
