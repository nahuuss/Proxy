# Design System Document: Proxy Platform Engine v1.2

## 1. Overview & Creative North Star
**The Creative North Star: "The Observational Engine"**

This design system moves away from the generic "SaaS dashboard" aesthetic in favor of a high-end, editorial approach to infrastructure management. The "Observational Engine" philosophy treats data as a live, breathing pulse. Instead of rigid boxes and heavy borders, the interface utilizes a sophisticated hierarchy of dark tones and atmospheric depth to create a sense of professional authority. 

By leveraging intentional asymmetry and high-contrast typography, we transform a technical utility into a premium digital workspace. The goal is to provide a "Mission Control" feel—highly functional, yet visually serene, where the primary vibrant blue (#2970FF) acts as a surgical strike of intent against a deep, layered void.

---

## 2. Colors
The palette is built upon a foundation of deep, ink-like tones, punctuated by high-chroma status indicators.

### Surface Hierarchy & Nesting
To achieve a bespoke feel, we utilize **Tonal Layering** rather than structural lines.
- **Base Layer:** Use `surface` (#0b1326) for the application canvas.
- **Sectioning:** Use `surface_container_low` (#131b2e) for large layout blocks like the "Conectores Activos" section.
- **Interactive Elements:** Use `surface_container_highest` (#2d3449) for cards and nested components.

### The "No-Line" Rule
**Explicit Instruction:** Do not use 1px solid borders to define section boundaries. Separation must be achieved via background color shifts (e.g., a `surface_container_low` card sitting on a `surface` background). This creates a seamless, modern interface that feels carved out of a single piece of glass rather than "constructed."

### The "Glass & Gradient" Rule
Floating elements (such as the global console or tooltips) should utilize **Glassmorphism**. Apply `surface_variant` with a 60-80% opacity and a `backdrop-blur` of 12px. For main Action Buttons (CTAs), use a subtle linear gradient from `primary` (#b3c5ff) to `primary_container` (#5e8bff) at a 135-degree angle to add a "signature" tactile quality.

---

## 3. Typography
We employ a dual-type system to balance technical precision with editorial elegance.

*   **Display & Headlines (Space Grotesk):** This typeface provides a tech-forward, slightly brutalist personality. Use `headline-lg` for section headers like "Proxy Platform Engine" to establish immediate authority.
*   **Body & Labels (Inter):** Chosen for its unparalleled legibility in high-density data environments. 

**Hierarchy as Identity:**
- **Title-LG:** Reserved for primary connector names (e.g., "Core Serena").
- **Label-SM:** Used for technical metadata (e.g., "Requests," "Latency"). These should use `on_surface_variant` (#c2c6d8) to remain secondary to the live data.
- **Mono-styling:** Any port numbers or URL strings should utilize a monospace weight of Inter to emphasize the platform's engine-centric nature.

---

## 4. Elevation & Depth
In this system, elevation is a product of light and tone, not just shadows.

*   **The Layering Principle:** Stacking `surface_container` tiers creates natural depth. An input field should use `surface_container_lowest` (#060e20) to appear "inset" into a card that uses `surface_container_high` (#222a3d).
*   **Ambient Shadows:** For floating components, use an extra-diffused shadow: `box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4)`. The shadow should feel like a soft glow of darkness, never a harsh outline.
*   **The "Ghost Border" Fallback:** If a container requires further definition (e.g., in high-density lists), use a **Ghost Border**: `outline_variant` (#424655) at 15% opacity. High-contrast, 100% opaque borders are strictly forbidden.

---

## 5. Components

### Buttons
- **Primary:** Gradient fill (Primary to Primary Container), `lg` (0.5rem) roundedness. Font: `title-sm` (Inter, Bold).
- **Secondary (Ghost):** No fill, Ghost Border (15% `outline_variant`), `primary` text color.
- **Action Icons:** 40x40px containers with `surface_container_highest` background and 20% opacity transitions on hover.

### Status Badges
- **Online/Live:** Pill shape (`full` roundedness). Background: `secondary_container` (#00a572) at 20% opacity. Text: `secondary` (#4edea3). 
- **Latency Chips:** Compact `md` roundedness, using `tertiary` (#89ceff) for text to distinguish network performance from system status.

### Simple Input Fields (Add Connector)
- **Styling:** Inset appearance using `surface_container_lowest`. No border.
- **States:** On focus, the container should transition to a subtle `primary` outer glow (4px blur, 10% opacity) and the label should shift to `primary` color.

### Compact List Items & Cards
- **Rule:** Forbid divider lines. Use `spacing.4` (0.9rem) of vertical white space to separate items.
- **Visual Texture:** Use `surface_container_high` for the card background. For technical metrics (Requests, Traffic), use `display-sm` for the values to ensure they are the focal point of the card.

---

## 6. Do's and Don'ts

### Do
- **Use Intentional Asymmetry:** Align the "Global Console" to the right with a different width than the connector cards to break the "template" feel.
- **Embrace Breathing Room:** Use the `spacing.10` and `spacing.16` tokens for section margins to allow the "Deep Black" background to provide visual relief.
- **Layer for Importance:** Place high-priority alerts on `surface_bright` to make them vibrate against the darker canvas.

### Don't
- **Don't use pure white text:** Always use `on_surface` (#dae2fd) or `on_surface_variant` (#c2c6d8). Pure white (#FFFFFF) is too harsh for long-term monitoring.
- **Don't use 1px solid borders:** Rely on the `surface` color shifts defined in Section 2.
- **Don't use standard shadows:** Avoid the default "CSS Drop Shadow" look. If it's not diffused and atmospheric, don't use it.
- **Don't clutter the UI:** In the "Add New Connector" bar, use `label-sm` for placeholders and keep inputs minimal to maintain the "Engine" aesthetic.