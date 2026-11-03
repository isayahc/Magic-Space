import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { out } from './paths.mjs';
const prompt = (await readFile(new URL('prompt.txt', import.meta.url), 'utf8')).trim();
const qwen = {
  '1': { class_type: 'CLIPLoader', inputs: { clip_name: 'qwen_3_4b.safetensors', type: 'ltxv', device: 'default' }, _meta: { title: 'Load open-weight Qwen3 4B' } },
  '2': { class_type: 'TextGenerate', inputs: { clip: ['1', 0], prompt, max_length: 4096, sampling_mode: 'off', thinking: false, use_default_template: true }, _meta: { title: 'Generate robotic farm scene' } },
  '3': { class_type: 'SaveText', inputs: { text: ['2', 0], filename_prefix: 'oi_benchmark_qwen3_4b', format: 'txt' }, _meta: { title: 'Save untouched model answer' } },
};
const gpt = {
  '1': { class_type: 'OpenAIChatConfig', inputs: { truncation: 'disabled', max_output_tokens: 4096 }, _meta: { title: 'Match output budget' } },
  '2': { class_type: 'OpenAIChatNode', inputs: { prompt, model: 'gpt-4.1', persist_context: false, advanced_options: ['1', 0] }, _meta: { title: 'Generate scene with GPT-4.1' } },
  '3': { class_type: 'SaveText', inputs: { text: ['2', 0], filename_prefix: 'oi_benchmark_gpt41', format: 'txt' }, _meta: { title: 'Save untouched model answer' } },
};
const astra = {
  '1': { class_type: 'OpenAIChatConfig', inputs: { truncation: 'disabled', max_output_tokens: 16384, reasoning_effort: 'high' }, _meta: { title: 'GPT-6 Astra reasoning settings' } },
  '2': { class_type: 'OpenAIChatNode', inputs: { prompt, model: 'gpt-6-astra', persist_context: false, advanced_options: ['1', 0] }, _meta: { title: 'Generate farm scene with GPT-6 Astra' } },
  '3': { class_type: 'SaveText', inputs: { text: ['2', 0], filename_prefix: 'magic_space/gpt6_astra', format: 'txt' }, _meta: { title: 'Save untouched model answer' } },
};
const deepseek = {
  '2': { class_type: 'OpenRouterLLMNode', inputs: { prompt, model: 'deepseek/deepseek-v4-pro', 'model.reasoning_effort': 'high', seed: 0 }, _meta: { title: 'Generate farm scene with DeepSeek-V4-Pro' } },
  '3': { class_type: 'SaveText', inputs: { text: ['2', 0], filename_prefix: 'magic_space/deepseek_v4_pro', format: 'txt' }, _meta: { title: 'Save untouched model answer' } },
};
await mkdir(out, { recursive: true });
for (const [name, workflow] of [['qwen3-4b', qwen], ['gpt-4.1', gpt], ['gpt-6-astra', astra], ['deepseek-v4-pro', deepseek]]) {
  await writeFile(join(out, `${name}.workflow-api.json`), JSON.stringify(workflow, null, 2) + '\n');
}
console.log('Wrote current and legacy API-format workflows. No jobs submitted.');
