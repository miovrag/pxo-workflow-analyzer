"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

type RiskLevel = "Low" | "Medium" | "High";

interface PXOSection {
  id: number;
  title: string;
  subtitle: string;
  content: string;
}

const TOTAL_STEPS = 12;

const riskColors: Record<RiskLevel, string> = {
  Low: "bg-green-100 text-green-800 border-green-200",
  Medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  High: "bg-red-100 text-red-800 border-red-200",
};

function MarkdownContent({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1 text-sm text-gray-700 leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith("### ")) {
          return (
            <h3 key={i} className="font-semibold text-gray-900 mt-3 mb-1">
              {line.slice(4)}
            </h3>
          );
        }
        if (line.startsWith("## ")) {
          return (
            <h2 key={i} className="font-bold text-gray-900 mt-4 mb-1">
              {line.slice(3)}
            </h2>
          );
        }
        if (line.startsWith("- ")) {
          return (
            <div key={i} className="flex gap-2">
              <span className="text-gray-400 mt-0.5 shrink-0">—</span>
              <span
                dangerouslySetInnerHTML={{
                  __html: line
                    .slice(2)
                    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>"),
                }}
              />
            </div>
          );
        }
        if (line.trim() === "") {
          return <div key={i} className="h-1" />;
        }
        return (
          <p
            key={i}
            dangerouslySetInnerHTML={{
              __html: line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>"),
            }}
          />
        );
      })}
    </div>
  );
}

export default function Home() {
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [problemStatement, setProblemStatement] = useState("");
  const [userSegment, setUserSegment] = useState("");
  const [metricAtRisk, setMetricAtRisk] = useState("");
  const [hypothesisX, setHypothesisX] = useState("");
  const [hypothesisSegment, setHypothesisSegment] = useState("");
  const [hypothesisMetric, setHypothesisMetric] = useState("");
  const [hypothesisBehavior, setHypothesisBehavior] = useState("");
  const [riskLevel, setRiskLevel] = useState<RiskLevel>("Medium");

  const [loading, setLoading] = useState(false);
  const [currentStepLabel, setCurrentStepLabel] = useState<string | null>(null);
  const [completedSteps, setCompletedSteps] = useState(0);
  const [sections, setSections] = useState<PXOSection[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const hasResults = sections.length > 0 || summary !== null;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!image) return;
    setLoading(true);
    setError(null);
    setSections([]);
    setSummary(null);
    setCompletedSteps(0);
    setCurrentStepLabel(null);

    const formData = new FormData();
    formData.append("image", image);
    formData.append("problemStatement", problemStatement);
    formData.append("userSegment", userSegment);
    formData.append("metricAtRisk", metricAtRisk);
    formData.append("hypothesisX", hypothesisX);
    formData.append("hypothesisSegment", hypothesisSegment);
    formData.append("hypothesisMetric", hypothesisMetric);
    formData.append("hypothesisBehavior", hypothesisBehavior);
    formData.append("riskLevel", riskLevel);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let scrolledToResults = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          if (!part.startsWith("data: ")) continue;
          const data = JSON.parse(part.slice(6));

          if (data.type === "step_start") {
            setCurrentStepLabel(data.title);
            if (!scrolledToResults) {
              scrolledToResults = true;
              setTimeout(
                () =>
                  resultsRef.current?.scrollIntoView({ behavior: "smooth" }),
                100
              );
            }
          } else if (data.type === "step_complete") {
            setSections((prev) => [...prev, data.section]);
            setCompletedSteps((prev) => prev + 1);
          } else if (data.type === "summary_complete") {
            setSummary(data.summary);
          } else if (data.type === "done") {
            setLoading(false);
            setCurrentStepLabel(null);
          } else if (data.type === "error") {
            throw new Error(data.message);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
      setCurrentStepLabel(null);
    }
  };

  const isValid = !!image && !!problemStatement && !!userSegment && !!metricAtRisk;
  const progressPercent = (completedSteps / TOTAL_STEPS) * 100;

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-10">
          <p className="text-xs font-mono text-gray-400 uppercase tracking-widest mb-2">
            Product Experience OS
          </p>
          <h1 className="text-3xl font-bold text-gray-900">
            PXO Workflow Analyzer
          </h1>
          <p className="text-gray-500 mt-1">
            Upload a screenshot and define the problem. Get a full PXO analysis.
          </p>
        </div>

        {/* Form */}
        <div className="space-y-8">
          {/* Image Upload */}
          <div>
            <Label className="text-sm font-medium text-gray-900 mb-2 block">
              Screenshot
            </Label>
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:border-gray-400 transition-colors"
            >
              {imagePreview ? (
                <div className="relative group">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full rounded-lg object-contain max-h-64"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-lg flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 text-white text-sm font-medium bg-black/50 px-3 py-1 rounded-full transition-opacity">
                      Change image
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center">
                  <div className="text-4xl mb-3 text-gray-300">+</div>
                  <p className="text-gray-500 text-sm">
                    Drop screenshot here or click to upload
                  </p>
                  <p className="text-gray-400 text-xs mt-1">PNG, JPG, WebP</p>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
            />
          </div>

          {/* Problem Statement */}
          <div>
            <Label
              htmlFor="problem"
              className="text-sm font-medium text-gray-900 mb-2 block"
            >
              Problem Statement
            </Label>
            <Textarea
              id="problem"
              placeholder="Describe the problem you are solving..."
              value={problemStatement}
              onChange={(e) => setProblemStatement(e.target.value)}
              className="resize-none h-20"
            />
          </div>

          {/* User Segment + Metric */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label
                htmlFor="segment"
                className="text-sm font-medium text-gray-900 mb-2 block"
              >
                User Segment
              </Label>
              <Input
                id="segment"
                placeholder="e.g. New users, Power users"
                value={userSegment}
                onChange={(e) => setUserSegment(e.target.value)}
              />
            </div>
            <div>
              <Label
                htmlFor="metric"
                className="text-sm font-medium text-gray-900 mb-2 block"
              >
                Metric at Risk
              </Label>
              <Input
                id="metric"
                placeholder="e.g. Activation rate, Churn"
                value={metricAtRisk}
                onChange={(e) => setMetricAtRisk(e.target.value)}
              />
            </div>
          </div>

          {/* Hypothesis */}
          <div>
            <Label className="text-sm font-medium text-gray-900 mb-3 block">
              Hypothesis
            </Label>
            <div className="bg-gray-100 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-gray-600 shrink-0">
                  If we improve
                </span>
                <Input
                  placeholder="[X]"
                  value={hypothesisX}
                  onChange={(e) => setHypothesisX(e.target.value)}
                  className="flex-1 min-w-28 bg-white"
                />
                <span className="text-sm text-gray-600 shrink-0">for</span>
                <Input
                  placeholder="[segment]"
                  value={hypothesisSegment}
                  onChange={(e) => setHypothesisSegment(e.target.value)}
                  className="flex-1 min-w-28 bg-white"
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-gray-600 shrink-0">then</span>
                <Input
                  placeholder="[metric]"
                  value={hypothesisMetric}
                  onChange={(e) => setHypothesisMetric(e.target.value)}
                  className="flex-1 min-w-28 bg-white"
                />
                <span className="text-sm text-gray-600 shrink-0">
                  will improve, because
                </span>
              </div>
              <Textarea
                placeholder="[behavior shift assumption]"
                value={hypothesisBehavior}
                onChange={(e) => setHypothesisBehavior(e.target.value)}
                className="resize-none h-16 bg-white"
              />
            </div>
          </div>

          {/* Risk Level */}
          <div>
            <Label className="text-sm font-medium text-gray-900 mb-3 block">
              Risk Level
            </Label>
            <div className="flex gap-6">
              {(["Low", "Medium", "High"] as RiskLevel[]).map((level) => (
                <label
                  key={level}
                  className="flex items-center gap-2 cursor-pointer"
                  onClick={() => setRiskLevel(level)}
                >
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                      riskLevel === level
                        ? level === "Low"
                          ? "border-green-500 bg-green-500"
                          : level === "Medium"
                          ? "border-yellow-500 bg-yellow-500"
                          : "border-red-500 bg-red-500"
                        : "border-gray-300 bg-white"
                    }`}
                  >
                    {riskLevel === level && (
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </div>
                  <span
                    className={`text-sm font-medium ${
                      riskLevel === level
                        ? level === "Low"
                          ? "text-green-700"
                          : level === "Medium"
                          ? "text-yellow-700"
                          : "text-red-700"
                        : "text-gray-500"
                    }`}
                  >
                    {level}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={!isValid || loading}
            className="w-full h-12 text-base"
          >
            {loading ? "Analyzing..." : "Run PXO Analysis"}
          </Button>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Results */}
        {(loading || hasResults) && (
          <div ref={resultsRef} className="mt-16 space-y-6">
            {/* Progress */}
            {loading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">
                    {currentStepLabel ?? "Starting..."}
                  </span>
                  <span className="text-xs font-mono text-gray-400">
                    {completedSteps}/{TOTAL_STEPS}
                  </span>
                </div>
                <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gray-900 rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Summary */}
            {summary && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-xl font-bold text-gray-900">Analysis</h2>
                  <Badge variant="outline" className={riskColors[riskLevel]}>
                    {riskLevel} Risk
                  </Badge>
                </div>
                <Card className="border-gray-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-mono text-gray-400 uppercase tracking-widest font-normal">
                      Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700 leading-relaxed">{summary}</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Sections */}
            {sections.length > 0 && (
              <Accordion type="multiple" className="space-y-2">
                {sections.map((section) => (
                  <AccordionItem
                    key={section.id}
                    value={`section-${section.id}`}
                    className="border border-gray-200 rounded-lg px-4 bg-white"
                  >
                    <AccordionTrigger className="hover:no-underline py-4">
                      <div className="flex items-center gap-3 text-left">
                        <span className="text-xs font-mono text-gray-400 w-6 shrink-0">
                          {String(section.id).padStart(2, "0")}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {section.title}
                          </p>
                          <p className="text-xs text-gray-400">
                            {section.subtitle}
                          </p>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-4 pt-0">
                      <div className="border-t border-gray-100 pt-4">
                        <MarkdownContent text={section.content} />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
