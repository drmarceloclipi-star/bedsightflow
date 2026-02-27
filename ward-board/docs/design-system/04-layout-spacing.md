# Design System: Layout & Spacing

Our layouts prioritize center-aligned content columns with constrained max-widths, allowing the content to breathe inside generous margins. This mimics a high-end editorial reading experience even in data-heavy environments.

## Spacing Scale

We use a standard 4px baseline grid (frequently via Tailwind CSS units):

- **4px (`gap-1`, `p-1`) / 8px (`gap-2`, `p-2`)**: Internal component-level spacing (e.g., the gap between an icon and its text, or slight offsets).
- **12px (`p-3`) / 16px (`p-4`)**: Standard internal padding for most components (buttons, small cards, table cells).
- **24px (`p-6`) / 32px (`p-8`, `gap-8`)**: Spacing between related broader distinct items (like cards in a grid) or sections of a document.
- **48px (`py-12`) / 64px (`py-16`)**: Major section breaks, page margins, or whitespace framing the main app interface.

## Layout Principles

1. **Constrained Widths**: Content should rarely stretch the full width of widescreen monitors uncomfortably. For reading and forms, we constrain maximum width (e.g., `max-w-3xl`, `max-w-5xl`, or `max-w-7xl` depending on density).
2. **Negative Space**: Whenever possible, use whitespace instead of literal lines or heavy card backgrounds to separate sections.
3. **Centered Focus**: The main interactive content rests centrally, anchoring the user's attention, while sidebars or secondary content sit comfortably on the periphery.

## Breakpoints

- **Mobile (`sm`: 640px)**: Stacks all columns, comfortable edge padding (`px-4` or `px-6`).
- **Tablet (`md`: 768px)**: Adapts components for touch without significantly altering desktop paradigms. Starts showing grid layouts where appropriate.
- **Desktop (`lg`: 1024px, `xl`: 1280px)**: Unlocks multi-column layouts, persistent sidebars, and full Kanban boards for large displays and TVs.
