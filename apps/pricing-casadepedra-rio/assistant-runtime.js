export const PRICING_ASSISTANT_MODEL = "openai/gpt-5.6-terra";

const proposalTool = Object.freeze({
  type: "function",
  function: {
    name: "propose_pricing_changes",
    description: "Prepare a local, uncommitted proposal that changes the loaded Casa de Pedra pricing rules and/or calendar description.",
    parameters: {
      type: "object",
      properties: {
        answer: { type: "string", description: "Concise explanation to the user." },
        summary: { type: "string", description: "Exact human-readable summary of every proposed edit." },
        rule_operations: {
          type: "array",
          description: "Zero or more allowed rule operations from the system instructions.",
          items: { type: "object" },
        },
        calendar_operations: {
          type: "array",
          description: "Zero or more allowed calendar operations from the system instructions.",
          items: { type: "object" },
        },
      },
      required: ["answer", "summary", "rule_operations", "calendar_operations"],
    },
  },
});

function responseText(response) {
  const content = response?.message?.content ?? response?.content ?? response;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map(part => part?.text ?? "").join("");
  return String(content ?? "");
}

function proposalFromToolCall(response) {
  const call = response?.message?.tool_calls?.find(item => item?.function?.name === proposalTool.function.name);
  if (!call) return null;
  const args = typeof call.function.arguments === "string" ? JSON.parse(call.function.arguments) : call.function.arguments;
  return JSON.stringify({
    answer: args.answer,
    proposal: {
      summary: args.summary,
      rule_operations: args.rule_operations,
      calendar_operations: args.calendar_operations,
    },
  });
}

async function collectStream(response) {
  let content = "";
  for await (const chunk of response) {
    if (chunk?.type === "error") throw new Error(chunk.message || "Puter AI returned a streaming error.");
    content += chunk?.text ?? "";
  }
  return content;
}

export async function createPuterPricingAssistant(onProgress) {
  onProgress?.({ progress: 0.5, text: "Connecting the browser directly to Puter AI…" });
  if (!globalThis.puter?.ai?.chat) {
    throw new Error("Puter.js did not load. Check the network connection and content-blocking extensions, then retry.");
  }
  onProgress?.({ progress: 1, text: "Puter AI is ready." });

  return Object.freeze({
    model: PRICING_ASSISTANT_MODEL,
    async respond(systemPrompt, history, instruction, structured = false) {
      const messages = [
        { role: "system", content: systemPrompt },
        ...(structured ? [] : history.slice(-6).map(message => ({ role: message.role, content: String(message.content).slice(0, 1000) }))),
        { role: "user", content: instruction },
      ];
      const options = {
        model: PRICING_ASSISTANT_MODEL,
        temperature: 0.1,
        max_tokens: structured ? 1600 : 500,
        stream: !structured,
      };
      if (structured) {
        options.tools = [proposalTool];
        options.tool_choice = { type: "function", function: { name: proposalTool.function.name } };
      }
      const response = await globalThis.puter.ai.chat(messages, options);
      if (!structured && response?.[Symbol.asyncIterator]) return collectStream(response);
      return proposalFromToolCall(response) ?? responseText(response);
    },
  });
}
