# Sources and attribution

The example geometry is reused from [OpenIndustries](https://github.com/Mapped-Assembly/OpenIndustries), checked out from `Mapped-Assembly/Open-Industries` at commit `5e306c2033bfdb15510f98f575f937e1578f6a3f` (clean working tree when tested).

The portable scene files embed only the existing `cleanroom-robot` and `cleanroom-desk` geometry. They retain source identities and digests. No cleanroom architecture geometry is included in the model-generated scenes.

- Robot: `swab_bot.step`, source project `forma-cleanroom-swab-bot`.
- Workbench: `cleanroom_desk.step`, source project `forma-cleanroom-desk`.
- The upstream notes declare CERN-OHL-S-2.0 for these CAD assets, while noting that their original source archives and license texts are not bundled upstream.

The upstream provenance manifest and notes are preserved verbatim in `provenance/`. References in those copied notes are relative to the upstream repository. This repository does not relicense upstream geometry or the OpenIndustries source code; the viewer imports code from a separate checkout.

The current DeepSeek-V4-Pro / GPT-6 Astra outputs are recorded in `assets/*.raw.txt`, with the exact prompt in `prompt.txt` and Comfy job identifiers in `assets/results.json`. Earlier Qwen3 4B / GPT-4.1 results are in `assets/legacy-results.json`. Screenshots and GIFs are rendered from those outputs using the example geometry. Model weights are not included.

## Generated crew

`assets/astronaut.glb`, `assets/engineer.glb`, and `assets/botanist.glb` were generated through Comfy Cloud using Tripo P2 with user-approved credit spend. Their prompts and seeds are preserved in `assets/crew-batch.json`; job IDs are in `assets/provenance.json`. They are separate generated assets, not upstream CAD assets, and are not assigned the CAD assets' CERN license by this repository. Provider terms apply to these generated outputs.

The live viewer adds the same three static people at documented fixed positions to either benchmark result. It normalizes their height to 1.75 m without changing the stored GLB files. This presentation layer is not included in the LLM-authored scene JSON, benchmark scores, or benchmark GIFs. Crew screenshots are in `assets/`, identified by `.crew.png` or `sci-fi-crew.png`.

## Brineglass station

`assets/station/` contains a separate generation: Nano Banana Pro concept art, GPT-6 Astra's untouched image-conditioned blueprint, and three new Tripo P2 characters with biped rigs and in-place walk/idle clips. Each of the five completed jobs is identified in `assets/station/provenance.json`. Provider terms apply to generated assets; they are not assigned the upstream CAD license.

`generation-batch.json` reconstructs the original concept and character submission, including prompts and seeds 731–733. `blueprint.workflow-api.json` preserves the stored executed GPT-6 graph retrieved through Comfy Cloud, including its image input and high reasoning effort. The reopenable template UI omitted that reasoning override, so the executed API graph is authoritative. No credentials or expiring signed storage links are committed.

The Three.js station architecture, prop builders, navigation, interface, and simulation runtime are authored source code in `station/`. GPT-6 authored the blueprint's room identities, equipment choices/slots, colors, narrative, crew roles and repeating tasks within the renderer's fixed six-department layout. The concept image is a visual reference, not a directly converted mesh. The runtime plays generated skeletal animation and does not make live model calls.

Space Station 13 is an inspiration for departmental atmosphere, not the source of any copied sprites, meshes, characters, or branding. Station screenshots and video are captured from this repository's browser renderer.

## Character atelier / Nova

The default character images in `assets/characters/*-base.png` are portraits rendered from the existing station GLBs. FLUX Kontext Pro (Black Forest Labs) edited the engineer portrait into `orbital-look.png`, retaining recognizable identity while changing the outfit. Tripo P2 consumed that exact generated image to make a new mesh, followed by biped rigging and real walk/idle animation exports. It did not generate this mesh from text alone.

Both user-approved paid jobs were confirmed completed and downloaded: `ee120d37-1309-4091-bd74-d63c1b8e615e` (image edit) and `470cac6d-3372-4198-8e5f-049e4f8cc579` (image-to-model/rig/animations). `assets/characters/provenance.json`, the two `orbital-*.workflow-api.json` graphs, and `catalog.json` preserve the sources, settings and relationships. The image graph was checked against the stored executed graph. Provider terms apply to these generated assets.

The character UI, workflow builders and local server integration are authored application code. Optional GPT-6 visual-description reading is separate from the sample, which did not run that stage. The included sample was generated through Comfy MCP; the application's SDK transport is covered with injected-provider tests. Browser evidence verifies the actual generated GLBs, moving bones, persistence, reference upload, and station deployment. User-created library entries remain local in Git-ignored `assets/characters/local/`.
