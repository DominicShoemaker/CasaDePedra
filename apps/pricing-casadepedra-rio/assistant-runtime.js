import {
  CreateWebWorkerMLCEngine,
  prebuiltAppConfig,
} from "@mlc-ai/web-llm";

export const PRICING_ASSISTANT_MODEL = "SmolLM2-360M-Instruct-q4f16_1-MLC";

export async function createLocalPricingAssistant(onProgress) {
  const modelRecord = prebuiltAppConfig.model_list.find(record => record.model_id === PRICING_ASSISTANT_MODEL);
  if (!modelRecord) throw new Error(`WebLLM does not include ${PRICING_ASSISTANT_MODEL}.`);
  const worker = new Worker(new URL("./assistant-worker.js", import.meta.url), { type: "module" });
  let engine;
  try {
    engine = await CreateWebWorkerMLCEngine(worker, PRICING_ASSISTANT_MODEL, {
      appConfig: {
        model_list: [modelRecord],
        cacheBackend: "opfs",
        opfsAccessMode: "async",
      },
      initProgressCallback: report => onProgress?.({
        progress: Number.isFinite(report.progress) ? report.progress : 0,
        text: report.text || "Loading the local model…",
      }),
      logLevel: "WARN",
    });
  } catch (error) {
    worker.terminate();
    throw error;
  }

  return Object.freeze({
    model: PRICING_ASSISTANT_MODEL,
    async respond(systemPrompt, history, instruction, structured = false) {
      const messages = [
        { role: "system", content: systemPrompt },
        ...history.slice(-4).map(message => ({
          role: message.role,
          content: String(message.content).slice(0, 400),
        })),
        { role: "user", content: instruction },
      ];
      const request = {
        messages,
        temperature: 0.1,
        top_p: 0.9,
        max_tokens: structured ? 240 : 120,
        seed: 7,
      };
      if (structured) request.response_format = { type: "json_object" };
      const response = await engine.chat.completions.create(request);
      return response.choices[0]?.message?.content ?? "";
    },
    async unload() {
      try {
        await engine.unload();
      } finally {
        worker.terminate();
      }
    },
  });
}
