# Design System: Typography

Typography forms the structural backbone of our interface, bringing order, hierarchy, and a premium feel. Inspired by Claude, our type system relies on extreme legibility and subtle beauty.

## Font Families

We utilize clear, highly legible neo-grotesque or geometric sans-serifs for the user interface to maintain neutrality. A soft serif may be introduced contextually for long-form reading or primary branding elements, but the app generally relies on highly legible system sans.

- **Primary UI Font**: `Inter` (sans-serif) for data, labels, and general UI text.
- **Headings Font**: `Instrument Serif` (or similar editorial serif) to provide a premium, editorial feel for primary headings.
- **Secondary / Monospace**: `ui-monospace`, `SFMono-Regular`, `Menlo`, `Monaco`, `Consolas`, `"Liberation Mono"`, `"Courier New"`, `monospace`.

## Font Scale

We follow a modular scale providing clear distinction without being overly dramatic:

- `text-xs` (12px): Metadata, secondary hints, small labels, and timestamps.
- `text-sm` (14px): Standard UI elements, buttons, secondary body text, table secondary rows.
- `text-base` (16px): Primary body text, readable content, primary table rows.
- `text-lg` (18px): Subheadings, emphasized text, small card titles.
- `text-xl` (20px): Section headings, modal titles.
- `text-2xl` (24px): Page titles, major context shifts.
- `text-3xl` (30px): Prominent display headings (e.g., dashboard summary metrics).

## Font Weights

- **Regular (400)**: Standard body copy and secondary text.
- **Medium (500)**: Button text, table headers, and emphasized UI text.
- **Semibold (600)**: Primary headings and distinct actionable items or critical labels.

## Line Height (Leading)

Generous line spacing is crucial for a premium feel.

- **Tight (`leading-tight`)**: For large headings (1.2 to 1.25), tying multi-line titles together neatly.
- **Normal (`leading-normal`)**: For UI components and short strings (1.5). Standard UI standard.
- **Relaxed (`leading-relaxed`)**: For multi-line paragraphs or explanatory descriptions (1.625+).
