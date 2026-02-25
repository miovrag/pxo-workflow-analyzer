import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const imageFile = formData.get("image") as File;
    const problemStatement = formData.get("problemStatement") as string;
    const userSegment = formData.get("userSegment") as string;
    const metricAtRisk = formData.get("metricAtRisk") as string;
    const hypothesisX = formData.get("hypothesisX") as string;
    const hypothesisSegment = formData.get("hypothesisSegment") as string;
    const hypothesisMetric = formData.get("hypothesisMetric") as string;
    const hypothesisBehavior = formData.get("hypothesisBehavior") as string;
    const riskLevel = formData.get("riskLevel") as string;

    if (!imageFile) {
      return NextResponse.json({ error: "Image is required" }, { status: 400 });
    }

    const imageBuffer = await imageFile.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString("base64");
    const mediaType = (imageFile.type || "image/png") as "image/png" | "image/jpeg" | "image/gif" | "image/webp";

    const hypothesis = `If we improve ${hypothesisX}, for ${hypothesisSegment}, then ${hypothesisMetric} will improve, because ${hypothesisBehavior}.`;

    const systemPrompt = `You are a senior product strategist and UX researcher specializing in the PXO (Product Experience Operating System) framework. You analyze product screenshots and inputs to generate structured, actionable PXO analyses.

Your output must be valid JSON. Be specific, insightful, and grounded in what you actually see in the screenshot and the provided context.`;

    const userPrompt = `Analyze this product screenshot and generate a complete PXO Workflow analysis.

## Provided Context:
- Problem Statement: ${problemStatement}
- User Segment: ${userSegment}
- Metric at Risk: ${metricAtRisk}
- Hypothesis: ${hypothesis}
- Risk Level: ${riskLevel}

## Instructions:
Analyze the screenshot carefully. Generate all 12 PXO sections plus a summary.

Return ONLY valid JSON in this exact format:
{
  "summary": "3-4 sentence executive summary covering the core problem, key insight from the screenshot, recommended focus, and expected impact",
  "sections": [
    {
      "id": 0,
      "title": "Problem Hypothesis",
      "subtitle": "Before Empathy",
      "content": "detailed analysis for this section"
    },
    {
      "id": 1,
      "title": "Empathy Engine",
      "subtitle": "User emotional landscape",
      "content": "detailed analysis"
    },
    {
      "id": 2,
      "title": "JTBD Extraction",
      "subtitle": "Jobs to be done",
      "content": "detailed analysis"
    },
    {
      "id": 3,
      "title": "Constraint Mapping",
      "subtitle": "Technical, data, legal, org",
      "content": "detailed analysis"
    },
    {
      "id": 4,
      "title": "Persona Roles",
      "subtitle": "Usage archetypes",
      "content": "detailed analysis"
    },
    {
      "id": 5,
      "title": "Behavioral Trigger Design",
      "subtitle": "Activation to control",
      "content": "detailed analysis"
    },
    {
      "id": 6,
      "title": "Information Architecture",
      "subtitle": "IA tree and task flows",
      "content": "detailed analysis"
    },
    {
      "id": 7,
      "title": "Failure Mode Design",
      "subtitle": "What can break",
      "content": "detailed analysis"
    },
    {
      "id": 8,
      "title": "Metric Definition",
      "subtitle": "Primary, secondary, signals",
      "content": "detailed analysis"
    },
    {
      "id": 9,
      "title": "Low-Fi Specification",
      "subtitle": "Layout, CTA, state logic",
      "content": "detailed analysis"
    },
    {
      "id": 10,
      "title": "Heuristic & Cognitive Audit",
      "subtitle": "Nielsen, cognitive load, accessibility",
      "content": "detailed analysis"
    },
    {
      "id": 11,
      "title": "Validation Loop",
      "subtitle": "Before and after development",
      "content": "detailed analysis"
    }
  ]
}

Each content field should be thorough, structured with clear sub-points, and directly tied to what you observe in the screenshot and the provided inputs. Use markdown formatting within the content strings (bullet points, bold, headers).`;

    const message = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 8000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64Image,
              },
            },
            {
              type: "text",
              text: userPrompt,
            },
          ],
        },
      ],
    });

    const rawContent = message.content[0];
    if (rawContent.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }

    // Strip markdown code fences if present
    let jsonText = rawContent.text.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const result = JSON.parse(jsonText);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      { error: "Analysis failed. Check your API key and try again." },
      { status: 500 }
    );
  }
}
