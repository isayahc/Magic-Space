# Magic-Space

**Can a small open-weight LLM generate an importable, animated 3D scene as reliably as a closed-source model?** This hackathon prototype runs Qwen3 4B and GPT-4.1 through Comfy Cloud, validates their unedited JSON, and renders both in OpenIndustries.

| Qwen3 4B | GPT-4.1 |
| --- | --- |
| ![Qwen animated scene](qwen3-4b.gif) | ![GPT animated scene](gpt-4.1.gif) |

## Why care?

**Generating an asset is only the beginning. Magic-Space explores how to bring it to life in a world.**

Stable Diffusion can generate visual concepts, and dedicated 3D-generation models can produce meshes. OpenIndustries adds a shared space: named objects, real-world placement, editable scene data, and authored motion. In this demo, the LLMs arrange existing geometry and animate a robot rather than generate new meshes.

For game designers, the next step is **persistent world context**: retain object identities, layout, roles, and previous decisions so a new generation can extend a world without losing continuity. The current prototype preserves a serialized scene and its animation; cross-generation continuity and autonomous behavior are future work.

## Hackathon checklist

- [x] Create and publish the GitHub repository.
- [x] Document how to run the codebase locally.
- [x] Run an open-weight vs. closed-weight model comparison.
- [x] Include GIFs and screenshots of sample outputs.
- [ ] Record a walkthrough video of the generation-to-world workflow.
- [ ] Add video clips of sample outputs alongside the GIFs.
- [ ] Carry world context across generations to help game designers maintain continuity.

## Tools used

| Tool | Role |
| --- | --- |
| **Comfy MCP** (`comfy-cloud`) | Run LLM workflows on Comfy Cloud and retrieve their outputs. The local `comfy-mcp` connection is optional and was not used for these generations. |
| **Qwen3 4B — open-weight** | Generate the first scene layout and animation as JSON. |
| **GPT-4.1 — closed-weight** | Generate the comparison scene from the same prompt. This is the tested baseline; additional models can be added later. |
| **OpenIndustries / its MCP scene contract** | Validate scene structure, resolve existing assets, import portable projects, and render animation. This run uses its schema and libraries directly; an autonomous OpenIndustries MCP tool loop is future work. |
| **OpenCode** | Coordinate model calls, write the adapter/evaluator, and package the demo. |
| **Playwright + Chrome** | Verify real browser imports and capture screenshots; GIFs use OpenIndustries’ renderer. |

## Run locally

### 1. Install prerequisites

- **Git** and **Node.js 22.14+** (including npm).
- A browser for the viewer. **Google Chrome** is required only for `npm run evaluate`.
- No local GPU, Python, ComfyUI installation, or API credentials are needed to view and evaluate the saved outputs.

### 2. Clone and install

Run these commands in a terminal. They work in PowerShell, macOS, and Linux shells. Keep both repositories in the same parent directory; the pinned OpenIndustries commit matches the recorded demo.

```sh
git clone https://github.com/Mapped-Assembly/OpenIndustries.git Open-Industries
cd Open-Industries
git checkout 5e306c2033bfdb15510f98f575f937e1578f6a3f
npm ci
cd ..
git clone https://github.com/isayahc/Magic-Space.git
cd Magic-Space
npm ci
npm start
```

### 3. Open the 3D space

Open **http://127.0.0.1:4194/comparison** and leave the terminal running.

- Switch between **Qwen3 4B** and **GPT-4.1** using the dropdown.
- Drag to orbit, scroll to zoom, and right-drag to pan.
- Pause or scrub the full 20-second robot animation.
- Click **Download editable scene** to import the project into OpenIndustries.
- Press **Ctrl+C** in the terminal to stop the viewer.

On subsequent runs, open a terminal in `Magic-Space` and run `npm start`.

### Existing OpenIndustries checkout or occupied port

The default checkout path is `../Open-Industries`. Set `OI_ROOT` to use another location and optionally set `PORT` if 4194 is occupied.

**PowerShell:**

```powershell
$env:OI_ROOT = "C:\path\to\Open-Industries"
$env:PORT = "4196"
npm start
```

**macOS / Linux:**

```sh
OI_ROOT=/path/to/Open-Industries PORT=4196 npm start
```

With these examples, open `http://127.0.0.1:4196/comparison`. If dependencies are missing, run `npm ci` in both repositories. New model generations require a separate authenticated Comfy Cloud MCP connection; see [Repeat model generation](#repeat-model-generation-through-comfy-mcp).

## Results and methodology

Both models ran on Comfy Cloud with the same prompt (`prompt.txt`) and 4096-token output caps. No model answer was repaired. One task and one sample per model: this demonstrates the pipeline, not a general model ranking or autonomous tool calling.

| Result | Qwen3 4B (open weight) | GPT-4.1 (closed source) |
| --- | --- | --- |
| Strict JSON and OpenIndustries schema | Pass | Pass |
| Structural/task checks including portable roundtrip | 13/13 | 13/13 |
| Browser import | 5 objects, no missing geometry | 5 objects, no missing geometry |
| Compact JSON instruction | Pretty-printed instead | Followed |
| Bed labels | Grow Bed A–D | Lettuce, Herb, Tomato, Microgreens |
| Robot Z path at 0/5/10/15/20 seconds | -4, -2, 2, 4, -4 | -4, -2, 4, -2, -4 |

Qwen uses `qwen_3_4b.safetensors` through CLIPLoader (`ltxv`) and TextGenerate, sampling off, thinking false, default template enabled. GPT-4.1 uses OpenAIChatNode with OpenAIChatConfig, truncation disabled, provider sampling defaults. These wrappers/settings are not identical inference implementations. `/no_think` was included in both prompts. GPT-4.1 has no reasoning mode; Qwen was deliberately tested without thinking.

Both satisfy the required endpoints, aisle, and loop. Constant speed was not requested; Qwen's final segment is 1.6 m/s vs GPT-4.1's maximum 1.2 m/s. Neither result is a physical-control or collision certification. Names/creativity are qualitative observations, not part of the 13 checks.

## Artifacts

- `*.raw.txt`: original unedited answers.
- `*.scene.json`: portable scene with existing example geometry bundled by a deterministic adapter. Open in OpenIndustries using Import project. The adapter maps field names and adds track/key IDs without changing model choices.
- `*.png`: screenshots after real browser import at 1440×1000.
- `*.gif`: native OpenIndustries authored-animation render, 480×480, 40 frames at 10 fps. These show **seconds 8–12** of the original 20-second timeline, because the native GIF renderer limits each clip to four seconds. They are not full-loop exports.
- `*.gif-metadata.json`: exact per-frame world poses and provenance.
- `results.json`: individual checks, job IDs, speeds, and browser evidence.
- `evaluate.mjs`: reruns validation, portable conversion, browser import, and GIF capture without making paid model calls.

The pinned OpenIndustries checkout retains legacy `astra.scene` serialization and Mergence UI branding. Its supported parser and scene contract were used directly. The farm is a planning layout: existing cleanroom desks stand in for grow beds, and the bundled robot is reused. Models generated the scene arrangement/animation, not new geometry. See [source attribution and geometry notices](PROVENANCE.md).

## Reproduce validation and rendering

Google Chrome must be installed for the browser checks. From this repository:

```sh
npm run evaluate
```

This validates the saved answers, regenerates the portable scenes, imports each in a fresh browser, and exports screenshots/GIFs. It starts a temporary local Vite server on port 4195 and shuts it down when finished. It does not call a model or spend credits.

## Repeat model generation through Comfy MCP

`npm run workflows` regenerates the two `*.workflow-api.json` files from the shared prompt. These are **API-format** graphs for `submit_workflow` or two `submit_batch` items with `tool: "submit_workflow"`, not editor drag-and-drop files. They correspond to the node graphs used in this run. Both use `SaveText` to preserve the raw answer. Submit through an authenticated Comfy Cloud MCP connection, wait for the jobs, and download their outputs. New generations consume Comfy credits.

To evaluate a new run, replace the corresponding `*.raw.txt` files and update the job identifiers in `evaluate.mjs`, then rerun the evaluator. Keep separate copies for multiple trials. The recorded run is a single-sample smoke test, not a statistical benchmark.

The two paid generation jobs have already completed; their IDs are in `results.json`. No provider keys or signed download URLs are stored here.
