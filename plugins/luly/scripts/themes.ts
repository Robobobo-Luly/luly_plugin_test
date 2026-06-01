/**
 * Theme contract for the Luly authoring pipeline.
 *
 * Colors are NOT hardcoded — the agent generates a fresh 18-token palette per
 * request, informed by the brief (tone, audience, topic, product preset).
 * The contract below pins down what tokens must be present and which font
 * strings are valid; the agent fills in the actual values.
 */

export const REQUIRED_COLOR_TOKENS: readonly string[] = [
  'background', 'surface', 'primary', 'primaryLight', 'secondary', 'onSurface',
  'textColor', 'mutedTextColor', 'disabledTextColor', 'textOnPrimary',
  'headerBackground', 'headerText', 'footerBackground', 'footerText',
  'border', 'disabled',
  'success', 'successLight', 'failure', 'failureLight', 'warning', 'warningLight',
] as const;

export const OPTIONAL_COLOR_TOKENS: readonly string[] = [
  'edit', 'shadow',
  // Inline definition tooltips (clickable terms in body text that open a
  // popup). luly-app defaults these to primary / primaryLight, so omitting
  // them is fine when the primary pair reads well in body text. Emit
  // explicit values when primary is close to the background, very low
  // contrast against text, or exotic enough that a tinted variant works
  // better for inline highlighting.
  'tooltipTextColor', 'tooltipBackgroundColor',
] as const;

export const REQUIRED_STYLE_TOKENS: readonly string[] = [
  'fontHeading', 'fontBody',
] as const;

export const OPTIONAL_STYLE_TOKENS: readonly string[] = [
  'buttonBorderRadius', 'buttonBorderRadiusMobile',
  'containerBorderRadius', 'containerBorderRadiusMobile',
  'buttonHeight', 'buttonHeightMobile',
  'progressBarHeight',
] as const;

export const OPTIONAL_LAYOUT_TOKENS: readonly string[] = [
  'maxWidth', 'maxWidthMobile', 'padding', 'paddingMobile',
] as const;

/**
 * Font contract — NOT an allow-list.
 *
 * The CMS has no closed font list. `src/services/fonts/fontService.ts` resolves
 * ANY family by name: anything not bundled is fetched from Google Fonts at
 * render time (`ensureFlowFontsLoaded` → `loadGoogleFamily`). So `fontHeading` /
 * `fontBody` may be ANY Google Fonts family, written as the CSS string
 * `"<Family>", sans-serif` (use `serif` for serif faces) — the renderer extracts
 * the quoted family and loads it. Pick by brand/tone; do NOT maintain a curated
 * catalog here — it only goes stale against Google's.
 *
 * The one finite fact worth pinning: these families are BUNDLED in the app and
 * render with no network round-trip. Everything else is an open Google choice.
 * SF Pro Display and Matter still resolve for legacy flows but are retired
 * (`hidden: true`) — don't anchor new products to them.
 */
export const BUNDLED_FONTS: readonly string[] = [
  'Inter', 'Inter Tight', 'Roboto', 'Satoshi',
  'Nunito', 'Poppins', 'Open Sans', 'Montserrat', 'Lato',
] as const;

export interface ThemeArtifact {
  colors: Record<string, string>;
  style: { fontHeading: string; fontBody: string } & Record<string, string>;
  layout?: Record<string, string>;
}

/** Backward-compat alias — the resolved theme is the artifact itself now. */
export type ResolvedTheme = ThemeArtifact;
