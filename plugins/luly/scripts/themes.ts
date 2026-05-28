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
 * Closed list of CSS font-family strings the CMS actually supports.
 * Source: `src/services/fonts/fontService.ts` (BUNDLED_FONTS + GOOGLE_FONTS).
 * `fontHeading` and `fontBody` MUST be one of these strings verbatim.
 */
export const SUPPORTED_FONTS: readonly string[] = [
  '"Inter", sans-serif',
  '"Inter Tight", sans-serif',
  '"SF Pro Display", -apple-system, sans-serif',
  '"Roboto", sans-serif',
  '"Matter", sans-serif',
  '"Nunito", sans-serif',
  '"Poppins", sans-serif',
  '"Open Sans", sans-serif',
  '"Montserrat", sans-serif',
  '"Lato", sans-serif',
] as const;

export interface ThemeArtifact {
  colors: Record<string, string>;
  style: { fontHeading: string; fontBody: string } & Record<string, string>;
  layout?: Record<string, string>;
}

/** Backward-compat alias — the resolved theme is the artifact itself now. */
export type ResolvedTheme = ThemeArtifact;
