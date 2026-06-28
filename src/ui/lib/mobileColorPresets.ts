/**
 * Optional color presets for the mobile app.
 *
 * Each preset overrides a small set of theme CSS variables (background, text,
 * the framed-answer border, and a few supporting tones) scoped to the mobile
 * app root. The "default" preset overrides nothing, so the carefully designed
 * stock look (including the brown answer box) is preserved exactly.
 *
 * Values are HSL triplets in the same "H S% L%" format the theme system uses,
 * since they are consumed as `hsl(var(--name))`.
 */
export type MobileColorPreset = {
    id: string;
    label: string;
    /** Swatch colors (ready-to-use CSS color strings) for the picker UI. */
    swatch: { background: string; text: string; box: string };
    /** CSS variable overrides, or undefined for the stock theme. */
    vars?: Record<string, string>;
};

export const DEFAULT_MOBILE_COLOR_PRESET = "default";

/** Every theme variable a preset may override, so callers can cleanly reset. */
export const MOBILE_COLOR_VAR_KEYS = [
    "background",
    "card",
    "popover",
    "muted",
    "foreground",
    "card-foreground",
    "muted-foreground",
    "border",
    "special",
] as const;

export const mobileColorPresets: MobileColorPreset[] = [
    {
        id: "default",
        label: "Default",
        swatch: {
            background: "hsl(0 0% 100%)",
            text: "hsl(12 7% 15%)",
            box: "hsl(19 51% 70%)",
        },
        vars: undefined,
    },
    {
        id: "sepia",
        label: "Sepia",
        swatch: {
            background: "hsl(39 46% 93%)",
            text: "hsl(28 35% 22%)",
            box: "hsl(26 50% 42%)",
        },
        vars: {
            background: "39 46% 93%",
            card: "39 46% 93%",
            popover: "39 46% 93%",
            muted: "39 30% 88%",
            foreground: "28 35% 22%",
            "card-foreground": "28 35% 22%",
            "muted-foreground": "30 18% 45%",
            border: "33 25% 80%",
            special: "26 50% 42%",
        },
    },
    {
        id: "rose",
        label: "Rose",
        swatch: {
            background: "hsl(350 52% 96%)",
            text: "hsl(345 45% 24%)",
            box: "hsl(344 65% 55%)",
        },
        vars: {
            background: "350 52% 96%",
            card: "350 52% 96%",
            popover: "350 52% 96%",
            muted: "350 40% 92%",
            foreground: "345 45% 24%",
            "card-foreground": "345 45% 24%",
            "muted-foreground": "345 25% 48%",
            border: "348 35% 86%",
            special: "344 65% 55%",
        },
    },
    {
        id: "mint",
        label: "Mint",
        swatch: {
            background: "hsl(152 33% 95%)",
            text: "hsl(175 30% 18%)",
            box: "hsl(168 55% 38%)",
        },
        vars: {
            background: "152 33% 95%",
            card: "152 33% 95%",
            popover: "152 33% 95%",
            muted: "152 25% 90%",
            foreground: "175 30% 18%",
            "card-foreground": "175 30% 18%",
            "muted-foreground": "175 15% 40%",
            border: "160 25% 82%",
            special: "168 55% 38%",
        },
    },
    {
        id: "indigo",
        label: "Indigo",
        swatch: {
            background: "hsl(222 30% 95%)",
            text: "hsl(224 35% 18%)",
            box: "hsl(232 60% 58%)",
        },
        vars: {
            background: "222 30% 95%",
            card: "222 30% 95%",
            popover: "222 30% 95%",
            muted: "222 22% 90%",
            foreground: "224 35% 18%",
            "card-foreground": "224 35% 18%",
            "muted-foreground": "224 18% 45%",
            border: "224 25% 84%",
            special: "232 60% 58%",
        },
    },
    {
        id: "midnight",
        label: "Midnight",
        swatch: {
            background: "hsl(222 38% 11%)",
            text: "hsl(210 30% 92%)",
            box: "hsl(190 75% 55%)",
        },
        vars: {
            background: "222 38% 11%",
            card: "222 38% 13%",
            popover: "222 38% 13%",
            muted: "222 25% 18%",
            foreground: "210 30% 92%",
            "card-foreground": "210 30% 92%",
            "muted-foreground": "215 18% 65%",
            border: "222 25% 24%",
            special: "190 75% 55%",
        },
    },
    {
        id: "forest",
        label: "Forest",
        swatch: {
            background: "hsl(155 28% 10%)",
            text: "hsl(120 14% 90%)",
            box: "hsl(140 55% 50%)",
        },
        vars: {
            background: "155 28% 10%",
            card: "155 28% 13%",
            popover: "155 28% 13%",
            muted: "155 20% 17%",
            foreground: "120 14% 90%",
            "card-foreground": "120 14% 90%",
            "muted-foreground": "130 12% 62%",
            border: "150 18% 24%",
            special: "140 55% 50%",
        },
    },
];

export function mobileColorPresetVars(
    presetId: string | undefined,
): Record<string, string> | undefined {
    const preset = mobileColorPresets.find((p) => p.id === presetId);
    return preset?.vars;
}
