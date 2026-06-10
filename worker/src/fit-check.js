// fit-check.js
// Pete's AI fit-check assistant. Buyers answer ~5-8 questions about
// their computer + goals; we score whether they have enough memory
// and CPU to run a local LLaMA-based chatbot, and if so, route them
// to checkout with a fit_check_id that round-trips through the
// Stripe webhook for fulfillment attribution.
//
// Cost: gpt-4o-mini at current pricing is ~$0.0001-0.0003 per turn.
// At 20 turns/conversation that's ~$0.005 per buyer, ~$5/1000 buyers.

const MAX_TURNS = 20;

// What we need the conversation to surface. The system prompt asks
// for these as JSON, so we can parse a structured summary at the end.
const REQUIRED_FIELDS = [
  "device_kind",      // mac | windows | other
  "os_version",       // free text, e.g. "macOS 14.5" or "Windows 11"
  "ram_gb",           // number, approximate
  "apple_silicon",    // boolean, only for mac
  "primary_goal",     // free text
  "comfort_level",    // beginner | some | confident
];

// Score a conversation outcome. Returns {score: 0-100, reason, ...}
function scoreDevice(answers) {
  if (!answers) return { score: 0, reason: "no answers", eligible: false };

  // Macs with Apple Silicon
  if (answers.device_kind === "mac" && answers.apple_silicon) {
    if (answers.ram_gb >= 16) return { score: 95, eligible: true, tier: "starter_setup", reason: "Apple Silicon Mac with 16+ GB RAM - great fit for any of our packages" };
    if (answers.ram_gb >= 8)  return { score: 80, eligible: true, tier: "starter_setup", reason: "Apple Silicon Mac with 8 GB RAM - runs a 7B model comfortably" };
    return { score: 50, eligible: false, reason: "Apple Silicon Mac with <8 GB RAM - will run, but you'll want more headroom" };
  }

  // Macs without Apple Silicon (Intel)
  if (answers.device_kind === "mac" && !answers.apple_silicon) {
    if (answers.ram_gb >= 16) return { score: 55, eligible: true, tier: "starter_setup", reason: "Intel Mac with 16+ GB RAM - works, but slower than Apple Silicon" };
    return { score: 25, eligible: false, reason: "Intel Mac - local LLM will be slow; recommend a managed cloud service instead" };
  }

  // Windows
  if (answers.device_kind === "windows") {
    if (answers.ram_gb >= 16) return { score: 85, eligible: true, tier: "starter_setup", reason: "Windows PC with 16+ GB RAM - excellent fit" };
    if (answers.ram_gb >= 8)  return { score: 70, eligible: true, tier: "starter_setup", reason: "Windows PC with 8 GB RAM - runs a 7B model fine, tighter on headroom" };
    return { score: 35, eligible: false, reason: "Windows PC with <8 GB RAM - too tight for a comfortable local LLM" };
  }

  return { score: 20, eligible: false, reason: "We currently only support Mac and Windows PCs" };
}

const SYSTEM_PROMPT = `You are "Pete" - the fit-check assistant for Offline Helper, a small US business that installs private, local-first AI assistants on Mac and Windows computers for older adults, families, and caregivers.

Your job is to have a short, warm conversation to find out whether the buyer's computer is powerful enough to run a local AI chatbot comfortably, and what package fits them. You are not a salesperson; you are a helpful screener. If the buyer isn't a fit, say so kindly and suggest a managed cloud alternative.

CRITICAL RULES:
1. Ask exactly ONE question at a time. Never ask two things in one turn.
2. Plain language. No jargon. No "RAM" without "memory". No "OS" without "operating system".
3. Never recommend a package yourself - just gather the info. The system decides fit and shows them the right option.
4. When you have all the info you need, end your turn with the literal token [READY_TO_SCORE] on its own line. The system will then produce a structured summary.
5. If the buyer goes off-topic or asks something you can't answer, redirect: "That's a great question - the best way to get it answered is to book the free fit check at offlinehelpers.com/fit-check/ where Pete will personally respond."
6. If the buyer wants to talk to a real human at any point, say: "I'll let Pete know you wanted a personal response - he reads every fit-check transcript."
7. If the buyer seems upset, confused, or in a hurry, wrap up quickly and offer the free fit check at offlinehelpers.com/fit-check/.
8. Never invent technical specs. If you're unsure, ask. Example: don't guess someone's RAM - ask.

INFORMATION YOU NEED TO COLLECT (in this approximate order):
- What kind of computer they have (Mac or Windows). One question.
- Whether it's a recent Mac with an "M1", "M2", "M3", or "M4" chip (Apple Silicon). Skip if Windows.
- How much memory (RAM) it has. Suggest: "If you're not sure, click the Apple menu > About This Mac on a Mac, or Settings > System > About on Windows."
- What they want to use the AI for (writing, research, family help, etc.)
- How comfortable they are with technology (beginner, some, or confident)

When you have all of these, end with [READY_TO_SCORE].

TONE: Like a friendly librarian who happens to know about computers. Short turns. No lists. No headers. No exclamation marks.`;

async function callOpenAI(messages, apiKey) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 300,
      temperature: 0.7,
    }),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) {
    throw new Error(`OpenAI HTTP ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

function isReadyToScore(text) {
  return /\[READY_TO_SCORE\]/.test(text || "");
}

function stripReadyToScore(text) {
  return (text || "").replace(/\[READY_TO_SCORE\]/g, "").trim();
}

// Initial greeting - sent before any user message.
function initialAssistantMessage() {
  return "Hi, I'm Pete's fit-check assistant. I'll ask you a few quick questions to see whether your computer can run a private local AI comfortably, and which package fits. About 5 questions, takes 2 minutes. Sound good?";
}

export {
  SYSTEM_PROMPT,
  MAX_TURNS,
  REQUIRED_FIELDS,
  scoreDevice,
  callOpenAI,
  isReadyToScore,
  stripReadyToScore,
  initialAssistantMessage,
};
