# Asset license and provenance

The following assets were created for Muzluk and are released under the same
MIT license as this repository:

- `packages/mood-wheel/src/assets/wheel.webp`
- `packages/mood-wheel/src/assets/pointer.webp`
- `packages/mood-wheel/src/assets/tick.wav`
- `packages/agent-questions/src/assets/question-reveal.wav`
- `packages/agent-questions/src/assets/question-answered.wav`
- `packages/agent-questions/src/assets/slider-tick-1.wav`
- `packages/agent-questions/src/assets/slider-tick-2.wav`
- `packages/agent-questions/src/assets/slider-tick-3.wav`
- `packages/agent-questions/src/assets/slider-tick-4.wav`

The wheel and pointer files are byte-for-byte copies of the webapp assets; the
trigger geometry is not redrawn or resized. Their SHA-256 fingerprints are:

| Asset | SHA-256 |
| --- | --- |
| `wheel.webp` | `527fc64e52d2dc3f649d804c4f3f6f6c9494a7d3fa054f75ddcafd49df63776b` |
| `pointer.webp` | `35b391dcceea63067f97606393343461368e2509b1212cb19fcadac013405730` |
| `tick.wav` | `0ddaeccec8478ec41fce3623f61992c7eec264914d83845d7bec8d0394646d8a` |
| `question-reveal.wav` | `4d422beb0a53f0cb7596f601a9e2f5b1882f1f86f821a4689a4a8ec7377e0c0d` |
| `question-answered.wav` | `4a6b1a40c8f3e0163abb97046521669329e46ff81376ed60c265574697d36daa` |
| `slider-tick-1.wav` | `eb32e0c17dfc71d5a57298bcd7e4a8b7aadf8777849ba2dd9beebaf9393d59d6` |
| `slider-tick-2.wav` | `11e26de614253122ce8c0ee81be65434b0f43b69e16c4e1b19c3e912297c99fe` |
| `slider-tick-3.wav` | `c975f2caff1ba426028b39148b7a7e9ce21e0679d59a322008310ba5d8e2031f` |
| `slider-tick-4.wav` | `9c1055d46e50af08ea153b74ec30825a1858b99acaafedd316f2e233acd6805c` |

No Lucide, Hugeicons, or other third-party icon files are distributed. Default
interface glyphs are small SVG paths authored in this repository. Consumers can
replace them through the documented render slots.
