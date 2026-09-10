import { ACCENT_PRESETS, ACCENT_MIGRATION } from "./SettingsModal";
import { DENSITY_PAD, FONT_FAMILIES } from "./logbookConstants";

// ─── Theme CSS variable injection (v6 — aliases --elb-* to --cb-* tokens) ─────

// Resolve accent preset → single color value
export function resolveAccent(settings) {
  const presetId = settings.accentPreset
    || ACCENT_MIGRATION[settings.accentColor]
    || "gradient";
  const preset = ACCENT_PRESETS.find(p => p.id === presetId) || ACCENT_PRESETS[0];
  const single = preset.single;
  const isGrad = preset.colors.length > 1;
  const grad = isGrad
    ? `linear-gradient(135deg, ${preset.colors.join(", ")})`
    : single;
  const dim = single + "4d"; // ~30% opacity
  return { accent: single, grad, dim };
}

export function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r},${g},${b}`;
}

export function makeThemeCss(settings = {}) {
  const isDark   = (settings.theme || "dark") === "dark";
  const fontSize = Math.min(18, Math.max(12, Number(settings.fontSize) || 14));
  const rowPad   = DENSITY_PAD[settings.tableDensity] || DENSITY_PAD.default;
  const fontFamily = FONT_FAMILIES[settings.fontType] || FONT_FAMILIES.courier;
  const { accent, grad, dim } = resolveAccent(settings);

  // CB surface / ink / line tokens — mirrors brand.css values
  const surf = isDark
    ? { s0:"#0a1020", s1:"#141a2e", s2:"#1b2340", s3:"#232c4d",
        ink:"#e8ecf5", ink2:"#b8c0d4", inkD:"#7c87a3",
        line:"rgba(255,255,255,0.07)", line2:"rgba(255,255,255,0.12)" }
    : { s0:"#f4f6fb", s1:"#ffffff", s2:"#ebeef7", s3:"#dfe3f0",
        ink:"#0a1020", ink2:"#3a4258", inkD:"#6b7488",
        line:"rgba(10,16,32,0.08)", line2:"rgba(10,16,32,0.16)" };

  return `
    :root {
      /* ── ClaudeBorne brand tokens ── */
      --cb-surface-0:${surf.s0};--cb-surface-1:${surf.s1};
      --cb-surface-2:${surf.s2};--cb-surface-3:${surf.s3};
      --cb-ink:${surf.ink};--cb-ink-2:${surf.ink2};--cb-ink-dim:${surf.inkD};
      --cb-line:${surf.line};--cb-line-2:${surf.line2};
      --cb-accent:${accent};
      --cb-accent-rgb:${hexToRgb(accent)};
      --cb-grad:${grad};
      --cb-font-body:${fontFamily};
      --cb-font-mono:${fontFamily};
      --fs:${(fontSize / 14).toFixed(4)};
      --cell-pad:${rowPad};

      /* ── Legacy --elb-* aliases → CB tokens ── */
      --elb-bg:var(--cb-surface-0);
      --elb-bg2:var(--cb-surface-1);
      --elb-bg3:var(--cb-surface-2);
      --elb-bghd:var(--cb-surface-1);
      --elb-bgalt:var(--cb-surface-2);
      --elb-thead:var(--cb-surface-2);
      --elb-bginput:var(--cb-surface-2);
      --elb-rowhover:var(--cb-surface-3);
      --elb-acc:var(--cb-accent);
      /* Update-modal contract (see brand-kit/component/UpdatePrompt.jsx) */
      --cb-update-accent:var(--cb-accent);
      --elb-acc2:#3B8DFF;
      --elb-accdim:${dim};
      --elb-accent:var(--cb-accent);
      --elb-border:var(--cb-line-2);
      --elb-bdr:var(--cb-line-2);
      --elb-border2:var(--cb-line);
      --elb-bdr2:var(--cb-line);
      --elb-border3:var(--cb-line);
      --elb-bdr3:var(--cb-line);
      --elb-border4:var(--cb-line);
      --elb-bdr4:var(--cb-line);
      --elb-txt:var(--cb-ink);
      --elb-txt-muted:var(--cb-ink-2);
      --elb-txt-dim:var(--cb-ink-dim);
      --elb-txt-bright:var(--cb-ink);
      --elb-muted:var(--cb-ink-2);
      --elb-dim:var(--cb-ink-dim);
      --elb-bright:var(--cb-ink);
      --elb-font:var(--cb-font-mono);
      --elb-td-sz:calc(${fontSize}px * var(--fs,1));
      --elb-th-sz:calc(${Math.max(10, fontSize - 1)}px * var(--fs,1));
      --elb-ths-sz:calc(${Math.max(9, fontSize - 2)}px * var(--fs,1));
      --elb-desc-sz:calc(${Math.max(11, fontSize)}px * var(--fs,1));
      --elb-hint-sz:calc(${Math.max(10, fontSize - 1)}px * var(--fs,1));
      --elb-row-pad:${rowPad};
    }
  `;
}
