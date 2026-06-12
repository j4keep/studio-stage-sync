# W.Studio Edit Window Overhaul

A big refresh covering bug fixes, polish, and several new features. Grouping the work so it can ship in clear passes.

## 1. Bug fixes
- **Clip drag doesn't follow audio to new track** — when a clip is dragged to a different track, the audio still plays on the original track. Fix the drop handler to re-assign the clip's `trackId` and rebuild routing so playback follows the visual move.
- **Mixer cut off at the bottom** — `R / M / S` buttons under the fader are clipped. Make the mixer area's vertical scroll reach the full strip height (independent of the bottom nav and tracks panel).
- **Light-mode invisible text** — several toolbar/panel labels are hardcoded white. Replace with semantic tokens (`text-foreground`, `text-muted-foreground`) so they read in both themes.

## 2. Light mode "pro" look
- Move base background from pure white to a soft warm gray (`hsl(220 14% 96%)` ish), with subtle elevation on panels.
- Bold the section labels (SETTING, EQ, INPUT, etc.) and toolbar text.
- Add a faint inner shadow / hairline border on panels for depth.
- Audit `text-white`, `bg-white`, `bg-black` in DAW components and swap to tokens.

## 3. Collapsible Session / Library panel
- The right-side **Session** panel (with participants + Share screen) and the **Library** tab become a single dockable panel.
- Add a sidebar **icon toggle** in the top toolbar (open/close). When closed, the Edit canvas expands full width.
- The same panel will host the **video chat tiles** when in a live session.

## 4. Quick Start refresh (iTunes-inspired)
- Re-skin the Quick Start tiles with a vivid gradient background (orange → pink → purple → cyan, like the iTunes reference) and white iconography.
- Swap flat lucide glyphs for layered/3D-feel icon treatments (gradient fill + soft drop shadow + subtle bevel using CSS).
- Keep existing actions (Browse loops, Patterns Beatmaker, Play the synth, Add new track, Import file, Invite a friend).

## 5. Floating Keyboard upgrades
- **Musical-typing color highlights** — color-code the key chips like Logic's musical typing panel (image 2): octave keys (Z/X) blue, sustain (Tab) green, velocity (1–8) orange/red.
- **Hardware-style instrument keyboard** — redesign the floating keyboard shell to look like image 3 (StudioLogic SL73): dark brushed body, colored knobs strip across the top, and a small LCD-style screen that displays the **currently selected instrument name** (updates when the user changes the active instrument track).
- Keep all existing controls (octave, mode toggle, glissando, computer-key mapping).
- Restore the **full piano keyboard look** from image 4 (proper proportions, octave labels under C keys, wider black-to-white ratio).

## 6. Piano Roll feature parity (Logic Pro)
Add a full inspector column on the left of the piano roll:
- **Time Quantize** dropdown — full list: 1/1, 1/2, 1/4, 1/8, 1/16, 1/32, 1/64, plus triplets (1/2 → 1/128) and swing variants (1/16 A–F, 1/8 A–F) and tuplets (5/4, 5/8, 7, 9), plus combined (1/16 & 1/16T, etc.) — matching image 6.
- **Strength** slider (0–100) and **Swing** slider (0–100).
- **Scale Quantize** — root note picker (Off, C, C#, D, D#, Eb, E, F, F#, G, G#, Ab, A, A#, Bb, B) + scale type picker (Major, Natural Minor, Chromatic, Major/Minor, Major+b7, Harmonic Minor, Melodic Minor, Major Pentatonic, Minor Pentatonic, Major Blues, Minor Blues, Lydian, Mixolydian, Dorian, Phrygian, Locrian, Klezmer, Japanese, South-East Asian) — matching images 7 & 8.
- **Velocity** slider (1–127) for new notes.
- **Pencil tool** inside the piano roll for drawing notes (in addition to current select/erase tools).

## 7. Reference pass
Quick look at Logic Pro on the web layout to confirm icon ordering and inspector grouping before final styling.

---

## Technical notes
- Clip-move fix lives in `DawStore.moveClip` / drag handler in `TracksView` / `ClipBlock`.
- Mixer scroll fix is a follow-up to the recent `items-start` change in `MixerView.tsx` — likely needs `min-h-0` on parent + `overflow-y-auto` on the strips container.
- Light-mode tokens edited in `src/index.css` (`:root` block).
- New `SidePanelToggle` button in `TransportBar.tsx` driving a Zustand flag in `DawStore`.
- Piano-roll inspector becomes a new component `PianoRollInspector.tsx`; quantize/scale data lives in a new `pianoRollOptions.ts` constants file.
- Pencil tool wired into existing tool enum in `DawStore`.

## Scope check
This is ~8–10 hrs of work and touches a lot of files. Want me to do it all in one pass, or split into shippable chunks (e.g., bug fixes + light mode first, then piano roll, then keyboard redesign)?
