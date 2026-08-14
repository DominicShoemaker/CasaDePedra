import {
  applyCalendarOperations,
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
import { createPuterPricingAssistant } from "./assistant-runtime.js";

function messageElement(role, content) {
  const article = document.createElement("article");
  article.className = `assistant-message ${role}`;
  const label = document.createElement("strong");
  label.textContent = role === "user" ? "You" : "Pricing assistant";
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
  let assistantReady = false;
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
    sendButton.textContent = value ? "Thinking with Puter…" : "Send";
  }

  function hideProposal() {
    pendingCandidate = null;
    proposalPanel.hidden = true;
    proposalSamples.replaceChildren();
  }

  function renderProposal(summary, candidate, impact, currency) {
    pendingCandidate = candidate;
    proposalSummary.textContent = `${summary} Candidate rule-set version: ${candidate.ruleDocument.rule_set.version}.`;
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
    const candidateRuleDocument = proposal.ruleOperations.length ? applyRuleOperations(ruleDocument, proposal.ruleOperations) : structuredClone(ruleDocument);
    const candidateCalendarDocument = proposal.calendarOperations.length ? applyCalendarOperations(calendarDocument, proposal.calendarOperations) : structuredClone(calendarDocument);
    const candidateModel = createCalendarPricingModel(candidateRuleDocument, candidateCalendarDocument, horizon);
    return {
      candidate: Object.freeze({ ruleDocument: candidateRuleDocument, calendarDocument: candidateCalendarDocument }),
      impact: comparePricingModels(currentModel, candidateModel),
      currency: candidateModel.currency,
    };
  }

  async function activate() {
    if (assistantReady || activating) return;
    activating = true;
    activateButton.disabled = true;
    progress.hidden = false;
    progress.value = 0;
    try {
      setStatus("Activating Puter AI in this browser…", "loading");
      runtime = await createPuterPricingAssistant(report => {
        progress.value = Math.max(0, Math.min(1, report.progress));
        setStatus(report.text, "loading");
      });
      assistantReady = true;
      progress.value = 1;
      setStatus(`Ready · ${runtime.model} · direct browser-to-Puter connection`, "ready");
      activationPanel.hidden = true;
      chatPanel.hidden = false;
      appendMessage("assistant", "I am ready in an anonymous temporary Puter session. I can read the rules and calendar currently shown on this page, answer pricing questions, and prepare a validated local draft. I cannot save or publish production changes.");
      input.focus();
    } catch (error) {
      console.error("Puter pricing assistant activation failed.", error);
      runtime = null;
      assistantReady = false;
      progress.hidden = true;
      activateButton.disabled = false;
      setStatus(describeError(error, "Puter AI could not be activated. Check the network connection and retry."), "error");
    } finally {
      activating = false;
    }
  }

  async function respond(instruction) {
    if (!assistantReady || responding) return;
    const cleanInstruction = instruction.trim();
    if (!cleanInstruction) return;
    hideProposal();
    appendMessage("user", cleanInstruction);
    input.value = "";
    setResponding(true);
    setStatus("Checking the currently loaded pricing rules locally…", "loading");
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
        setStatus("Sending sanitized pricing context directly from this browser to Puter AI…", "loading");
        const systemPrompt = createAssistantSystemPrompt(ruleDocument, calendarDocument, cleanInstruction, proposalMode);
        const rawResponse = await runtime.respond(systemPrompt, history, cleanInstruction, proposalMode);
        response = proposalMode
          ? parseAssistantResponse(rawResponse)
          : { answer: String(rawResponse).trim() || "The AI model returned an empty response.", proposal: null };
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
        setStatus(`Ready · ${runtime.model} · no document changes proposed`, "ready");
      }
    } catch (error) {
      console.error("Puter pricing assistant request failed.", error);
      appendMessage("assistant", `I could not complete that request: ${describeError(error, "unknown Puter AI error")}`);
      setStatus("The request failed; the local editors were not changed.", "error");
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
    appendMessage("assistant", "Conversation cleared. Puter AI remains ready and the local pricing documents are unchanged.");
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
