# Motion and forensic artwork

`FingerprintPlate.jsx` draws an annotated SVG specimen on the entry page. The ink image and the leader lines share a coordinate system, so they stay aligned on resize. Pointer movement shifts the specimen and its annotations together. Hovering over the ridges opens a 1.7× optical loupe, which magnifies the same SVG specimen through a circular clip. The scan button also works with Enter and Space. Scanning this illustration does not capture biometric data or change authentication state.

`fingerprint.css` controls the moving scanner, the target brackets, calibration marks and the phosphor palette. The dark theme switches the actual print asset. Theme selection is read from `data-theme` on the HTML element.

`KineticBackground.jsx` tracks pointer position and velocity in memory, manages visibility and motion preferences, and owns the frame loop. It sends no interaction data to the server. Coordinate easing, impulse decay and a frame-rate cap keep the movement smooth. When the tab is hidden the loop stops. The reduced-motion preference displays stationary photographic pigment.

`createInkField.js` manages a WebGL 1 context, a single triangle, one RGBA texture and the resize budget. A program or context failure leaves the photographic fallback in place. Context restoration rebuilds the GPU resources.

`inkShaders.js` samples the dye texture with ambient drift, a pointer-centred rotating displacement and an impulse based on cursor velocity. Three separately placed samples keep the ink concentrated at the viewport margins. Their final alpha allows the page surface to show through.

`kinetic.css` contains the photograph-based fallback and static reduced-motion presentation. Each graphic layer is decorative, cannot intercept clicks, and uses no external service.

## Color and surface design

| Element | Light mode | Dark mode |
| --- | --- | --- |
| Page substrate | Periwinkle `#c7bfff` with cool cyan and violet along the edges | Midnight indigo `#111329` with a teal cast |
| Form and workspace panels | Lilac `#e1dcff`, navy type `#151834` | Blue-black `#222540`, pale lilac type `#f0edff` |
| Primary action | Ultramarine `#4323bc` with white type | Lavender `#bda5ff` with deep indigo type |
| Reference specimen | The SVG color matrix develops the extracted ridges in blue over a mint plate | The phosphor image glows over a dark teal plate |
| Dye | Deep crimson | Coral-red |

`../styles.css` defines the shared theme tokens and the sign-in and registration controls. `../workspace/workspace.css` uses those tokens for diagrams, forms and dashboards. The printed dossier has its own ink-saving palette. The gradients and fine grain in `kinetic.css` sit behind the photographed strands. Ink fades near the narrow top and bottom bands to protect the header and footer.

## Bundled artwork

| File under `public/art/` | Use |
| --- | --- |
| `latent-print.png` | A rectified, isolated and recoloured impression derived from the supplied fingerprint-and-scale reference. |
| `latent-print-phosphor.png` | The same aligned ridge mask in a phosphor palette for dark mode. |
| `crimson-suspension.webp` | Pigment strands extracted from the supplied red-fluid photograph. Transparency at the edges allows dye to blend with the page. |

To adjust the amount of kinetic movement, edit `currents()` in the fragment shader. To change its position, edit the three plume centers in `main()`. To change how strongly cursor movement affects the actual print, edit `trackPointer()` in the plate component. The illustration and shader use no third-party animation libraries.
