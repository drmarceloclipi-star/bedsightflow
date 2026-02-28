# Design System: Components

Our components are highly restrained. They avoid heavy visual weight, stark black drop shadows, or thick vivid borders unless serving an explicit, urgent interaction purpose.

## Buttons

Buttons should feel tactile but unobtrusive.

- **Primary Action**: Uses the muted brand color (e.g., soft terracotta) or off-black, with soft white/off-white text. A smooth hover transition that slightly darkens or lightens the button. Absolutely no drop shadow.
- **Secondary/Ghost**: Transparent or very soft light-gray background (`bg-zinc-100`). Text uses the primary dark text color. Interaction causes the gray background to darken slightly (`hover:bg-zinc-200`).
- **Icon Buttons**: Circular or square bounding boxes with soft rounded corners. Generally no background until hovered or active.

## Inputs & Forms

Inputs should not command attention until a user decides to interact with them.

- **Standard Field**: Solid very light gray background (`bg-zinc-50`) and a subtle 1px border (`border-zinc-200`). Empty space within the input provides clarity.
- **Focus State**: To signify active interaction, apply a gentle colored outer glow (using the brand accent or a soft blue/green shade) or change the thin border to the primary brand color. Avoid shifting layout upon focus.
- **Labels**: Always clear, small (`text-sm` or `text-xs`), and often placed directly above inputs in a secondary muted text color (`text-zinc-500`).

## Cards & Surfaces

Cards define distinct groups or workspaces without feeling "boxed" in.

- **Elevation (Light mode)**: Shadows should be barely perceptible, simulating highly diffuse ambient light (`shadow-sm` colored very faintly, e.g., `rgba(0,0,0,0.03)`). Often, simply a 1px soft border (`border-zinc-200`) and a pure white background (`bg-white`) against the slightly off-white application background (`bg-[#fdfbf7]`) provides enough elevation.
- **Padding**: Cards require generous inner padding (`p-6` or `p-8`) to decouple the content from the boundary edges.

## Modals & Dialogs

- **Overlays**: Soft backdrop blur (`backdrop-blur-sm`) mixed with a semi-transparent, highly diffused dark tint (e.g., `bg-black/40` or `bg-zinc-900/50`).
- **Dialog Box**: Rounded, continuous corners (`rounded-xl` or `rounded-2xl`) to avoid harsh edges. Modals should appear completely centered and present clear, unambiguous primary and secondary actions separated by space at the bottom right.

## TV Context Exceptions

TV components (e.g., `KanbanScreen`, `KamishibaiScreen`, badges on `/tv`) operate in a fundamentally different viewing context: screens viewed from 2–4m distance in a clinical environment. The following exceptions to standard rules are **officially sanctioned** for TV-only components:

- **`font-weight: 700`** (Bold): Standard UI limits labels to `600` (Semibold). TV badges and status indicators **may use `700`** to remain legible at distance. Do NOT use `700` on desktop/mobile admin UI.
- **`border-width: 2px`**: Standard UI uses `1px` soft borders. TV status badges (e.g., `.tv-badge--overdue`) **may use `2px`** so the border is perceptible at 3–4m. Do NOT use `2px` borders on standard components.
- **`font-size: 0.75rem`** as minimum: For TV badges this is still adequate (12px on a large display). On desktop/mobile, prefer `text-xs` only for truly secondary metadata.
- **No `zoom` property**: Use `font-size` scaling or CSS custom properties instead of the non-semantic `zoom` CSS property, which behaves inconsistently across non-Chromium browsers.
