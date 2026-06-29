/**
 * Optional custom colors for the mobile app.
 *
 * The user can pick a Background, Text, and Answer-box color. These are stored
 * as hex and converted to the "H S% L%" triplets the theme system uses (vars
 * are consumed as `hsl(var(--name))`). We also derive a couple of supporting
 * tones (muted surface, secondary text, border) so the result stays coherent
 * instead of clashing with leftover default grays.
 *
 * Nothing is applied unless the user sets a color, so the stock look -- and the
 * brown answer box -- is the default, scoped to the mobile app root only.
 */
export type MobileColors = {
    background?: string;
    foreground?: string;
    box?: string;
};

/** Every theme variable a custom color may drive, so callers can fully reset. */
export const MOBILE_COLOR_VAR_KEYS = [
    "background",
    "card",
    "popover",
    "muted",
    "highlight",
    "accent",
    "secondary",
    "foreground",
    "card-foreground",
    "popover-foreground",
    "highlight-foreground",
    "accent-foreground",
    "secondary-foreground",
    "muted-foreground",
    "primary",
    "primary-foreground",
    "border",
    "input",
    "ring",
    "special",
] as const;

type Rgb = { r: number; g: number; b: number };

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

export function hexToRgb(hex: string): Rgb | undefined {
    const normalized = hex.trim().replace(/^#/, "");
    if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return undefined;
    return {
        r: parseInt(normalized.slice(0, 2), 16),
        g: parseInt(normalized.slice(2, 4), 16),
        b: parseInt(normalized.slice(4, 6), 16),
    };
}

function rgbToHsl({ r, g, b }: Rgb): { h: number; s: number; l: number } {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const delta = max - min;
    let h = 0;
    if (delta !== 0) {
        if (max === rn) h = ((gn - bn) / delta) % 6;
        else if (max === gn) h = (bn - rn) / delta + 2;
        else h = (rn - gn) / delta + 4;
        h *= 60;
        if (h < 0) h += 360;
    }
    const l = (max + min) / 2;
    const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
    return { h, s, l };
}

function hslTriplet({ h, s, l }: { h: number; s: number; l: number }) {
    return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function hexToHslTriplet(hex: string): string | undefined {
    const rgb = hexToRgb(hex);
    if (!rgb) return undefined;
    return hslTriplet(rgbToHsl(rgb));
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
    return {
        r: a.r + (b.r - a.r) * t,
        g: a.g + (b.g - a.g) * t,
        b: a.b + (b.b - a.b) * t,
    };
}

function hslTripletFromRgb(rgb: Rgb) {
    return hslTriplet(rgbToHsl(rgb));
}

/** Convert an "H S% L%" triplet back to hex, for seeding the color inputs. */
export function hslTripletToHex(triplet: string): string | undefined {
    const match = triplet
        .trim()
        .match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/);
    if (!match) return undefined;
    const h = parseFloat(match[1]);
    const s = parseFloat(match[2]) / 100;
    const l = parseFloat(match[3]) / 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let rp = 0;
    let gp = 0;
    let bp = 0;
    if (h < 60) [rp, gp, bp] = [c, x, 0];
    else if (h < 120) [rp, gp, bp] = [x, c, 0];
    else if (h < 180) [rp, gp, bp] = [0, c, x];
    else if (h < 240) [rp, gp, bp] = [0, x, c];
    else if (h < 300) [rp, gp, bp] = [x, 0, c];
    else [rp, gp, bp] = [c, 0, x];
    const toHex = (v: number) =>
        clamp(Math.round((v + m) * 255), 0, 255)
            .toString(16)
            .padStart(2, "0");
    return `#${toHex(rp)}${toHex(gp)}${toHex(bp)}`;
}

/**
 * Build the theme-variable overrides for a set of custom colors. Background and
 * text are required for a coherent result; box is optional (falls back to the
 * default brown). Returns undefined when nothing is customized.
 */
export function mobileColorVars(
    colors: MobileColors | undefined,
): Record<string, string> | undefined {
    if (!colors || (!colors.background && !colors.foreground && !colors.box)) {
        return undefined;
    }

    const vars: Record<string, string> = {};

    const bgRgb = colors.background ? hexToRgb(colors.background) : undefined;
    const fgRgb = colors.foreground ? hexToRgb(colors.foreground) : undefined;

    if (colors.box) {
        const box = hexToHslTriplet(colors.box);
        if (box) vars.special = box;
    }

    // Background and text together drive every surface and on-surface token so
    // the whole app stays coherent (no leftover default grays or white bubbles).
    if (bgRgb && fgRgb) {
        const bg = hslTripletFromRgb(bgRgb);
        const fg = hslTripletFromRgb(fgRgb);
        // Surfaces resting directly on the background.
        vars.background = bg;
        vars.card = bg;
        vars.popover = bg;
        // Slightly raised surfaces: muted rows, selected bubbles, accents.
        const raised = hslTripletFromRgb(mix(bgRgb, fgRgb, 0.1));
        vars.muted = hslTripletFromRgb(mix(bgRgb, fgRgb, 0.07));
        vars.highlight = raised;
        vars.accent = raised;
        vars.secondary = raised;
        // Text on those surfaces.
        vars.foreground = fg;
        vars["card-foreground"] = fg;
        vars["popover-foreground"] = fg;
        vars["highlight-foreground"] = fg;
        vars["accent-foreground"] = fg;
        vars["secondary-foreground"] = fg;
        vars["muted-foreground"] = hslTripletFromRgb(mix(fgRgb, bgRgb, 0.4));
        // Solid accent (primary buttons): text color filled, background text.
        vars.primary = fg;
        vars["primary-foreground"] = bg;
        // Lines and focus rings.
        vars.border = hslTripletFromRgb(mix(bgRgb, fgRgb, 0.18));
        vars.input = hslTripletFromRgb(mix(bgRgb, fgRgb, 0.18));
        vars.ring = hslTripletFromRgb(mix(fgRgb, bgRgb, 0.3));
    }

    return Object.keys(vars).length > 0 ? vars : undefined;
}
