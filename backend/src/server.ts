
console.log("SERVER STARTING...");

import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import cors from "cors";
import helmet from "helmet";
import bodyParser from "body-parser";
//import fetch from "node-fetch";
import dotenv from 'dotenv';
dotenv.config();
import { createWSServer } from './websocket';

const app = express();
app.use(helmet());
app.use(express.json());
app.use(cors()); // restrict origin in production
app.use(bodyParser.json({ limit: "200kb" }));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const PORT = process.env.PORT ?? 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
//console.log("Gemini API Key:", GEMINI_API_KEY); // just to verify


if (!GEMINI_API_KEY) {
  console.warn("Warning: GEMINI_API_KEY not set. /api/complete will fail until it's configured.");
}

/**
 * /api/complete
 * Expects { language, prefix, suffix, cursorOffset, maxTokens?, numSuggestions? }
 * Returns: { suggestions: Array<{ label, insertText, detail, score? }> }
 */

app.post("/api/complete", async (req, res) => {
  try {
    const body = req.body;
    const language = (body.language ?? "javascript") as string;
    const prefix = (body.prefix ?? "") as string;   // text before cursor
    const suffix = (body.suffix ?? "") as string;   // text after cursor, optional
    const cursorOffset = body.cursorOffset ?? prefix.length;
    const maxTokens = body.maxTokens ?? 192;
    const numSuggestions = body.numSuggestions ?? 5;
    

    // Build a prompt for Gemini. We'll ask for JSON output to make parsing easier.
    const prompt = buildGeminiPrompt({ language, prefix, suffix, cursorOffset, numSuggestions });

  
    // This example uses an API key method in Authorization: Bearer key.
    const endpoint = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;


    const requestPayload = {
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
          maxOutputTokens: 2048,
          temperature: 0.2
      }
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        
      },
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok) {
      const rtext = await response.text();
      console.error("Gemini error:", response.status, rtext);
      return res.status(502).json({ error: "Upstream Gemini API error", details: rtext });
    }

    const json = await response.json();
    //console.log("RAW GEMINI OUTPUT:", JSON.stringify(json, null, 2));

    // Extract text output depending on Gemini's actual response structure
    const textOutput = extractTextFromGeminiResponse(json);

    // Try to parse the model output as JSON. We asked the model to return JSON.
    let suggestions = parseSuggestionsFromModel(textOutput);

    // If parsing failed, fall back to simple splitting heuristics
    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      suggestions = fallbackParseTextToSuggestions(textOutput, numSuggestions);
    }
    
    // Trim to requested numSuggestions
    suggestions = suggestions.slice(0, numSuggestions).map(s => sanitizeSuggestion(s));
    //console.log("FINAL SUGGESTIONS:", suggestions);
    return res.json({ suggestions });
  

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "internal_server_error", details: String(err) });
  }
});
 


/* Functions*/

function buildGeminiPrompt(opts: {
  language: string;
  prefix: string;
  suffix: string;
  cursorOffset: number;
  numSuggestions: number;
}) {
  // Prompt engineering: instruct the model to return a JSON array of suggestions.
  // Each suggestion should contain: label, insertText, detail, and optionally score.
  // insertText is the text to insert at the cursor (may include closing brackets).
  const { language, prefix, suffix, cursorOffset, numSuggestions } = opts;

  // Keep the prompt precise and bounded. Provide examples.
  const prompt = `
  You are a code completion assistant. Return ONLY a JSON array of suggestions.

  Each item must contain:
  - label: short name
  - insertText: code snippet
  - detail: brief explanation

  PREFIX:
  ${prefix}

  SUFFIX:
  ${suffix}

  Example:
  [
    {
      "label": "console.log",
      "insertText": "console.log('Hello');",
      "detail": "Logs a message to the console"
    }
  ]
` ;

  return prompt;
} 

function extractTextFromGeminiResponse(json: any): string {
  try {
    if (json?.candidates?.[0]?.content?.parts) {
      const parts = json.candidates[0].content.parts;
      return parts.map((p: any) => p.text ?? "").join("");
    }

    if (json?.candidates?.[0]?.content?.[0]?.text) {
      return json.candidates[0].content[0].text;
    }

    return "";
  } catch (e) {
    console.error("Failed extract:", e);
    return "";
  }
}

function parseSuggestionsFromModel(raw: string) {
  try {
    // 1. Remove ```json fences
    let text = raw.replace(/```json/gi, "")
                  .replace(/```/g, "");

    // 2. Find first "[" and last "]"
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");

    if (start < 0 || end < 0) {
      throw new Error("JSON array not found");
    }

    let jsonText = text.substring(start, end + 1);

    // 3. Try parsing
    const parsed = JSON.parse(jsonText);

    if (Array.isArray(parsed)) return parsed;

    return null;
  } catch (e) {
    console.error("JSON parse failed:", e);
    return null;
  }
}


function fallbackParseTextToSuggestions(text: string, maxSuggestions: number) {
  // Naive fallback: split lines, return top N lines as insertText
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const uniq = Array.from(new Set(lines)).slice(0, maxSuggestions);
  return uniq.map((line, i) => ({
    label: line.length > 40 ? line.slice(0, 37) + "..." : line,
    insertText: line,
    detail: "Fallback suggestion",
    
  }));
}

function sanitizeSuggestion(s: any) {
  let label = s.label ?? s.title ?? s.summary ?? s.insertText ?? s.text;

  if (typeof label !== "string") {
    label = JSON.stringify(label ?? "") ?? "";
  }

  label = label.trim();
  if (label.length === 0) label = "completion";

  let insertText = s.insertText ?? s.text ?? "";
  if (typeof insertText !== "string") insertText = String(insertText ?? "");

  let detail = s.detail ?? s.description ?? "";
  if (typeof detail !== "string") detail = String(detail ?? "");

  return {
    label,
    insertText,
    detail,
  };
}


const server = app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

// ✅ Attach Yjs WebSocket server
createWSServer(server);

