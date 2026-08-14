import {
  applyRuleOperations,
  comparePricingModels,
  createDeterministicAnswer,
  createDeterministicProposal,
  createAssistantSystemPrompt,
  isRuleChangeRequest,
  parseAssistantResponse,
} from "./assistant-tools.js";
import {
  createCalendarPricingModel,
  createCalendarYearHorizon,
  formatCalendarMoney,
} from "./pricing-model.js";

function messageElement(role, content) {
  const article = document.createElement("article");
  article.className = `assistant-message ${role}`;
  const label = document.createElement("strong");
  label.textContent = role === "user" ? "You" : "Local assistant";
  const body = document.createElement("p");
  body.textContent = content;
  article.append(label, body);
  return article;
}

function impactLine(change, currency) {
  if (!change) return "None";
  const direction = change.delta > 0 ? "+" : "";
  return `${change.date}, ${change.nights}-night rate: ${formatCalendarMoney(change.before, currency)} → ${formatCalendarMoney(change.after, currency)} (${direction}${formatCalendarMoney(change.delta, currency)})`;
}

function describeError(error, fallback) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  if (error && typeof error === "object") {
    if (typeof error.message === "string" && error.message.trim()) return error.message;
    if (typeof error.text === "string" && error.text.trim()) return error.text;
    try {
      const serialized = JSON.stringify(error);
      if (serialized && serialized !== "{}") return serialized;
    } catch {
      // Fall through to the stable user-facing message.
    }
  }
  return fallback;
}

export function initializePricingAssistant({ getDocuments, applyDraft }) {
  const activateButton = document.querySelector("#activate-assistant");
  const activationPanel = document.querySelector("#assistant-activation");
  const chatPanel = document.querySelector("#assistant-chat");
  const progress = document.querySelector("#assistant-progress");
  const status = document.querySelector("#assistant-status");
  const log = document.querySelector("#assistant-log");
  const form = document.querySelector("#assistant-form");
  const input = document.querySelector("#assistant-input");
  const sendButton = document.querySelector("#assistant-send");
  const clearButton = document.querySelector("#assistant-clear");
  const proposalPanel = document.querySelector("#assistant-proposal");
  const proposalSummary = document.querySelector("#assistant-proposal-summary");
  const proposalImpact = document.querySelector("#assistant-proposal-impact");
  const proposalSamples = document.querySelector("#assistant-proposal-samples");
  const applyProposalButton = document.querySelector("#assistant-apply-proposal");
  const quickPrompts = [...document.querySelectorAll("[data-assistant-prompt]")];

  let runtime = null;
  let activating = false;
  let responding = false;
  let history = [];
  let pendingCandidate = null;

  function setStatus(message, type = "idle") {
    status.textContent = message;
    status.dataset.state = type;
  }

  function appendMessage(role, content) {
    log.append(messageElement(role, content));
    log.scrollTop = log.scrollHeight;
  }

  function setResponding(value) {
    responding = value;
    input.disabled = value;
    sendButton.disabled = value;
    sendButton.textContent = value ? "Thinking locally…" : "Send";
  }

  function hideProposal() {
    pendingCandidate = null;
    proposalPanel.hidden = true;
    proposalSamples.replaceChildren();
  }

  function renderProposal(summary, candidate, impact, currency) {
    pendingCandidate = candidate;
    proposalSummary.textContent = `${summary} Candidate rule-set version: ${candidate.rule_set.version}.`;
    const increase = impactLine(impact.largestIncrease, currency);
    const decrease = impactLine(impact.largestDecrease, currency);
    proposalImpact.textContent = `${impact.changedDates} dates and ${impact.changedValues} displayed stay-length prices change. Largest increase: ${increase}. Largest decrease: ${decrease}.`;
    proposalSamples.replaceChildren();
    for (const sample of impact.samples) {
      const item = document.createElement("li");
      item.textContent = impactLine(sample, currency);
      proposalSamples.append(item);
    }
    proposalPanel.hidden = false;
  }

  function validateProposal(proposal) {
    const { ruleDocument, calendarDocument } = getDocuments();
    const horizon = createCalendarYearHorizon(ruleDocument.listing_context.timezone, 2);
    const currentModel = createCalendarPricingModel(ruleDocument, calendarDocument, horizon);
    const candidate = applyRuleOperations(ruleDocument, proposal.operations);
    const candidateModel = createCalendarPricingModel(candidate, calendarDocument, horizon);
    return {
      candidate,
      impact: comparePricingModels(currentModel, candidateModel),
      currency: candidateModel.currency,
    };
  }

  async function activate() {
    if (runtime || activating) return;
    activating = true;
    activateButton.disabled = true;
    progress.hidden = false;
    progress.value = 0;
    try {
      if (!globalThis.navigator?.gpu) {
        throw new Error("This browser does not provide WebGPU. Use a current desktop version of Chrome or Edge with hardware acceleration enabled.");
      }
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) throw new Error("WebGPU is present, but no compatible graphics adapter is available. Check browser hardware-acceleration settings.");
      setStatus("Loading the WebLLM runtime only now, after activation…", "loading");
      const { createLocalPricingAssistant } = await import("./assistant-runtime.js");
      runtime = await createLocalPricingAssistant(report => {
        progress.value = Math.max(0, Math.min(1, report.progress));
        setStatus(report.text, "loading");
      });
      progress.value = 1;
      setStatus(`Ready · ${runtime.model} · processing stays on this device`, "ready");
      activationPanel.hidden = true;
      chatPanel.hidden = false;
      appendMessage("assistant", "I am ready. I can explain the currently loaded rules or prepare a validated local draft. I cannot publish production changes.");
      input.focus();
    } catch (error) {
      console.error("Local pricing assistant activation failed.", error);
      runtime = null;
      progress.hidden = true;
      activateButton.disabled = false;
      setStatus(describeError(error, "The local assistant could not start. Retry once; if it fails again, verify WebGPU and network access to the model host."), "error");
    } finally {
      activating = false;
    }
  }

  async function respond(instruction) {
    if (!runtime || responding) return;
    const cleanInstruction = instruction.trim();
    if (!cleanInstruction) return;
    hideProposal();
    appendMessage("user", cleanInstruction);
    input.value = "";
    setResponding(true);
    setStatus("The model is reasoning locally. No prompt is sent to a server.", "loading");
    try {
      const { ruleDocument, calendarDocument } = getDocuments();
      const proposalMode = isRuleChangeRequest(cleanInstruction);
      const deterministicResponse = proposalMode
        ? createDeterministicProposal(ruleDocument, cleanInstruction)
        : createDeterministicAnswer(ruleDocument, cleanInstruction);
      let response;
      if (deterministicResponse) {
        response = typeof deterministicResponse === "string"
          ? { answer: deterministicResponse, proposal: null }
          : deterministicResponse;
      } else {
        const systemPrompt = createAssistantSystemPrompt(ruleDocument, calendarDocument, cleanInstruction, proposalMode);
        const rawResponse = await runtime.respond(systemPrompt, history, cleanInstruction, proposalMode);
        response = proposalMode
          ? parseAssistantResponse(rawResponse)
          : { answer: String(rawResponse).trim() || "The local model returned an empty response.", proposal: null };
      }
      appendMessage("assistant", response.answer);
      history = [...history, { role: "user", content: cleanInstruction }, { role: "assistant", content: response.answer }].slice(-8);
      if (response.proposal) {
        try {
          const validated = validateProposal(response.proposal);
          renderProposal(response.proposal.summary, validated.candidate, validated.impact, validated.currency);
          setStatus("The proposed draft passed deterministic two-year engine validation. Review it before applying locally.", "ready");
        } catch (error) {
          appendMessage("assistant", `I rejected my proposed edit because deterministic validation failed: ${describeError(error, "unknown validation error")}`);
          setStatus("The proposal was rejected; the editor was not changed.", "error");
        }
      } else {
        setStatus("Ready · local model · no rule changes proposed", "ready");
      }
    } catch (error) {
      console.error("Local pricing assistant request failed.", error);
      appendMessage("assistant", `I could not complete that request: ${describeError(error, "unknown local model error")}`);
      setStatus("The request failed locally; the editor was not changed.", "error");
    } finally {
      setResponding(false);
      input.focus();
    }
  }

  activateButton.addEventListener("click", activate);
  form.addEventListener("submit", event => {
    event.preventDefault();
    respond(input.value);
  });
  clearButton.addEventListener("click", () => {
    history = [];
    hideProposal();
    log.replaceChildren();
    appendMessage("assistant", "Conversation cleared. The local model remains loaded and the pricing documents are unchanged.");
    input.focus();
  });
  applyProposalButton.addEventListener("click", () => {
    if (!pendingCandidate) return;
    applyDraft(pendingCandidate);
    hideProposal();
    appendMessage("assistant", "The validated candidate is now applied to the browser editor and local preview. It has not been saved or published to production.");
    setStatus("Local draft applied. Review the editor, chart, quotes, and marketplace instructions before any separate production workflow.", "ready");
  });
  for (const button of quickPrompts) {
    button.addEventListener("click", () => {
      input.value = button.dataset.assistantPrompt;
      input.focus();
    });
  }
}
