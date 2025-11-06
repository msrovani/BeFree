export const summarize = async (text: string) => {
  // TODO: connect to local LLM (Ollama/Llama.cpp) or remote if allowed
  return `Resumo: ${text.slice(0, 64)}...`;
};
