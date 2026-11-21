// Single source of truth for what "AI-free" means in this repo.
// Package names: exact match, or prefix match when the entry ends with "/" (npm scope).
export const BANNED_PACKAGES = [
  "openai", "@anthropic-ai/", "@google/generative-ai", "@google/genai", "@google-cloud/aiplatform",
  "@google-cloud/vertexai", "cohere-ai", "@mistralai/", "mistralai", "replicate", "@huggingface/",
  "@xenova/", "transformers", "@tensorflow/", "tensorflow", "onnxruntime", "onnxruntime-node",
  "onnxruntime-web", "onnxruntime-common", "brain.js", "ml5", "natural", "langchain", "@langchain/",
  "ai", "@ai-sdk/", "llamaindex", "ollama", "groq-sdk", "together-ai", "@mlc-ai/", "synaptic",
  "@vercel/ai", "gpt-3-encoder", "tiktoken", "@dqbd/tiktoken", "js-tiktoken", "face-api.js",
  "@mediapipe/", "tesseract.js"
];

// Hostnames of hosted model APIs. Matched anywhere in source text.
export const BANNED_HOSTS = [
  "api.openai.com", "api.anthropic.com", "generativelanguage.googleapis.com", "aiplatform.googleapis.com",
  "api.cohere.ai", "api.cohere.com", "api.mistral.ai", "api-inference.huggingface.co", "router.huggingface.co",
  "api.replicate.com", "api.together.xyz", "api.groq.com", "openrouter.ai", "api.deepseek.com",
  "api.perplexity.ai", "api.x.ai", "inference.ai.azure.com", "openai.azure.com"
];

export function isBannedPackage(name) {
  return BANNED_PACKAGES.some((b) => (b.endsWith("/") ? name.startsWith(b) : name === b));
}
