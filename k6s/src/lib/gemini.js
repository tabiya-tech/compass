import http from "k6/http";
import { check } from "k6";
import { env } from "./env-vars.js";
import { GEMINI_TIMEOUT_DEFAULT } from "../config.js";

export function buildGeminiPrompt(
  basePrompt,
  conversationResponse,
  turn,
  sessionId,
  userId,
) {
  return [
    basePrompt,
    "",
    "Generate the next user message for this conversation.",
    "Return plain text only. No JSON, no markdown, no explanation.",
    `Turn: ${turn}`,
    `Session ID: ${sessionId}`,
    `User ID: ${userId}`,
    "",
    "Conversation response JSON:",
    JSON.stringify(conversationResponse),
  ].join("\n");
}

function extractGeminiText(json) {
  const parts = json?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) {
    return null;
  }

  const textPart = parts.find(
    (part) => typeof part?.text === "string" && part.text.trim().length > 0,
  );

  return textPart?.text?.trim() || null;
}

export function generateNextMessageWithGemini(
  geminiApiKey,
  geminiModel,
  prompt,
  conversationResponse,
  turn,
  sessionId,
  userId,
  { geminiCalls, geminiDurationMs, addStatusCounter, geminiFailures },
) {
  geminiCalls.add(1);
  const start = Date.now();
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${encodeURIComponent(geminiApiKey)}`;
  const finalPrompt = buildGeminiPrompt(
    prompt,
    conversationResponse,
    turn,
    sessionId,
    userId,
  );

  const res = http.post(
    geminiUrl,
    JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: finalPrompt }],
        },
      ],
      generationConfig: {
        temperature: 0.7,
      },
    }),
    {
      headers: {
        "Content-Type": "application/json",
      },
      timeout:
        env("GEMINI_TIMEOUT") ||
        env("USER_AI_TIMEOUT") ||
        GEMINI_TIMEOUT_DEFAULT,
    },
  );
  geminiDurationMs.add(Date.now() - start);
  addStatusCounter(res.status);

  const ok = check(res, {
    "gemini status is 200": (r) => r.status === 200,
  });

  if (!ok) {
    geminiFailures.add(1);
    throw new Error(
      `Gemini call failed: status=${res.status} body=${res.body}`,
    );
  }

  const body = res.json();
  const message = extractGeminiText(body);
  if (!message) {
    geminiFailures.add(1);
    throw new Error(`Gemini response missing message text: body=${res.body}`);
  }

  return {
    message,
    durationMs: Date.now() - start,
  };
}
