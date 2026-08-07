# Asset license and provenance

The following assets were created for Muzluk and are released under the same
MIT license as this repository:

- `packages/mood-wheel/src/assets/wheel.webp`
- `packages/mood-wheel/src/assets/pointer.webp`
- `packages/mood-wheel/src/assets/tick.wav`
- `packages/agent-questions/src/assets/question-reveal.wav`

The wheel and pointer files are byte-for-byte copies of the webapp assets; the
trigger geometry is not redrawn or resized. Their SHA-256 fingerprints are:

| Asset | SHA-256 |
| --- | --- |
| `wheel.webp` | `527fc64e52d2dc3f649d804c4f3f6f6c9494a7d3fa054f75ddcafd49df63776b` |
| `pointer.webp` | `35b391dcceea63067f97606393343461368e2509b1212cb19fcadac013405730` |
| `tick.wav` | `0ddaeccec8478ec41fce3623f61992c7eec264914d83845d7bec8d0394646d8a` |
| `question-reveal.wav` | `4d422beb0a53f0cb7596f601a9e2f5b1882f1f86f821a4689a4a8ec7377e0c0d` |

No Lucide, Hugeicons, or other third-party icon files are distributed. Default
interface glyphs are small SVG paths authored in this repository. Consumers can
replace them through the documented render slots.
