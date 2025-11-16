
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
//const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
console.log("Gemini API Key:", GEMINI_API_KEY); // just to verify


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
    const endpoint = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;


    const requestPayload = {
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
          maxOutputTokens: maxTokens,
          temperature: 0.15
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
    // Extract text output depending on Gemini's actual response structure
    // The SDK/endpoint might return something like { output: [{ content: "..." }] } — adapt if needed
    const textOutput = extractTextFromGeminiResponse(json);

    // Try to parse the model output as JSON. We asked the model to return JSON.
    let suggestions = parseSuggestionsFromModel(textOutput);

    // If parsing failed, fall back to simple splitting heuristics
    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      suggestions = fallbackParseTextToSuggestions(textOutput, numSuggestions);
    }

    // Trim to requested numSuggestions
    suggestions = suggestions.slice(0, numSuggestions).map(s => sanitizeSuggestion(s));

    return res.json({ suggestions });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "internal_server_error", details: String(err) });
  }
});
 


/* ---------------- helper functions ---------------- */

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
You are a helpful code-completion assistant. The user's file is ${language}.
You will be given the code context consisting of text before the cursor (PREFIX) and text after the cursor (SUFFIX).
Provide up to ${numSuggestions} completion suggestions in strict JSON format: an array of objects with keys:
- label: short description (e.g., "for loop", "fetchData")
- insertText: the exact snippet to insert at the cursor (use \\n for newlines).
- detail: a one-sentence explanation of the suggestion.
- score: optional numeric score 0.0-1.0 (higher is better).

Do NOT output any commentary or extra text outside the JSON array.

PREFIX:
\`\`\`
${prefix}
\`\`\`

SUFFIX:
\`\`\`
${suffix}
\`\`\`

Cursor is located at the end of the PREFIX. Provide suggestions that are syntactically appropriate. Prioritize concise, correct completions. Example JSON output:

[
  {"label":"console.log snippet","insertText":"console.log(variable);","detail":"log variable to console","score":0.9},
  {"label":"for loop","insertText":"for (let i = 0; i < arr.length; i++) {\\n  const item = arr[i];\\n}","detail":"basic for loop over array","score":0.7}
]

Now produce the JSON array for the given PREFIX/SUFFIX.
`;
  return prompt;
}

function extractTextFromGeminiResponse(geminiJson: any): string {
  // Adapt to actual Gemini response shape. Try common fields.
  try {
    // If SDK: geminiJson?.outputText or geminiJson?.candidates[0]?.content
    if (typeof geminiJson === "string") return geminiJson;
    if (geminiJson?.output?.[0]?.content) {
      // Some endpoints nest text content in output[0].content
      const content = geminiJson.output[0].content;
      if (typeof content === "string") return content;
      // if content is an array of objects, join text parts
      if (Array.isArray(content)) {
        return content.map((c: any) => (typeof c === "string" ? c : c.text ?? "")).join("");
      }
    }
    if (geminiJson?.candidates?.[0]?.output) {
      return geminiJson.candidates[0].output;
    }
    if (geminiJson?.candidates?.[0]?.content?.[0]?.text) {
      return geminiJson.candidates[0].content[0].text;
    }
    // fallback to JSON stringify
    return JSON.stringify(geminiJson);
  } catch (e) {
    return String(geminiJson);
  }
}

function parseSuggestionsFromModel(text: string) {
  // Try to locate the first JSON array in the text and parse it.
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start >= 0 && end > start) {
    const jsonText = text.substring(start, end + 1);
    try {
      const arr = JSON.parse(jsonText);
      if (Array.isArray(arr)) return arr;
    } catch (e) {
      // ignore parse error
      console.warn("JSON parse failed for model output:", e);
    }
  }
  return null;
}

function fallbackParseTextToSuggestions(text: string, maxSuggestions: number) {
  // Naive fallback: split lines, return top N lines as insertText
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const uniq = Array.from(new Set(lines)).slice(0, maxSuggestions);
  return uniq.map((line, i) => ({
    label: line.length > 40 ? line.slice(0, 37) + "..." : line,
    insertText: line,
    detail: "Fallback suggestion",
    score: 0.5 - i * 0.05
  }));
}

function sanitizeSuggestion(s: any) {
  return {
    label: String(s.label ?? s.title ?? s.summary ?? "").substring(0, 200),
    insertText: String(s.insertText ?? s.text ?? s.snippet ?? ""),
    detail: String(s.detail ?? s.description ?? "").substring(0, 500),
    score: typeof s.score === "number" ? s.score : undefined
  };
}

const server = app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

// ✅ Attach Yjs WebSocket server
createWSServer(server);

