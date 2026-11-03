# Sources and attribution

The example geometry is reused from [OpenIndustries](https://github.com/Mapped-Assembly/OpenIndustries), checked out from `Mapped-Assembly/Open-Industries` at commit `5e306c2033bfdb15510f98f575f937e1578f6a3f` (clean working tree when tested).

The portable scene files embed only the existing `cleanroom-robot` and `cleanroom-desk` geometry. They retain source identities and digests. No cleanroom architecture geometry is included in the model-generated scenes.

- Robot: `swab_bot.step`, source project `forma-cleanroom-swab-bot`.
- Workbench: `cleanroom_desk.step`, source project `forma-cleanroom-desk`.
- The upstream notes declare CERN-OHL-S-2.0 for these CAD assets, while noting that their original source archives and license texts are not bundled upstream.

The upstream provenance manifest and notes are preserved verbatim in `provenance/`. References in those copied notes are relative to the upstream repository. This repository does not relicense upstream geometry or the OpenIndustries source code; the viewer imports code from a separate checkout.

The current DeepSeek-V4-Pro / GPT-6 Astra outputs are recorded in `*.raw.txt`, with the exact prompt in `prompt.txt` and Comfy job identifiers in `results.json`. Earlier Qwen3 4B / GPT-4.1 results are in `legacy-results.json`. Screenshots and GIFs are rendered from those outputs using the example geometry. Model weights are not included.

## Generated crew

`assets/astronaut.glb`, `assets/engineer.glb`, and `assets/botanist.glb` were generated through Comfy Cloud using Tripo P2 with user-approved credit spend. Their prompts and seeds are preserved in `assets/crew-batch.json`; job IDs are in `assets/provenance.json`. They are separate generated assets, not upstream CAD assets, and are not assigned the CAD assets' CERN license by this repository. Provider terms apply to these generated outputs.

The live viewer adds the same three static people at documented fixed positions to either benchmark result. It normalizes their height to 1.75 m without changing the stored GLB files. This presentation layer is not included in the LLM-authored scene JSON, benchmark scores, or benchmark GIFs. Crew screenshots are identified by `.crew.png` or `sci-fi-crew.png`.
