import puppeteer from 'puppeteer';
import PDFDocument from 'pdfkit';
import { uploadImageToAzure, isAzureConfigured } from './azureBlobClient';
import fs from 'fs';
import path from 'path';
import os from 'os';

export interface CarouselSlideInput {
  slideNumber: number;
  content: string;
  type: 'hook' | 'content' | 'cta';
}

export interface CarouselPdfResult {
  pdfUrl: string;
  isPermanent: boolean;
  slideCount: number;
  slideImageUrls: string[];
}

const BASE = 1080; // base dimension in px

/** Supported aspect ratios → [width, height] */
const ASPECT_RATIOS: Record<string, [number, number]> = {
  '1:1':  [1080, 1080],
  '4:5':  [1080, 1350],
  '9:16': [1080, 1920],
};

/* ─────────────────────────────────────────────
   Brand tokens — matching MerakiPeople / NotebookLM style
   ───────────────────────────────────────────── */
const B = {
  pageBg:     '#F5F5F5',   // clean light gray-white (matching NotebookLM spec)
  white:      '#FFFFFF',
  cardBg:     '#FFFFFF',
  headBlack:  '#152B68',   // deep navy for headlines (brand primary)
  bodyGrey:   '#4A4A5A',   // body text
  mutedGrey:  '#8B8B9E',   // captions
  lightGrey:  '#E0E0E0',   // borders, subtle elements
  coral:      '#FF6F61',   // accent — callouts, highlights, icons
  coralLight: '#FFF0EE',   // coral tint bg
  coralDark:  '#E85A4F',
  navy:       '#152B68',   // illustrations, icons
  navyLight:  '#2A4494',
  navyTint:   '#F0F2F8',   // light navy tint
  teal:       '#0EA5A0',   // secondary accent
  tealLight:  '#E6F7F6',
};

/* ═══════════════════════════════════════════════════
   SHARED STYLES
   ═══════════════════════════════════════════════════ */

/** Font links — empty by default; fonts are pre-loaded once on the page before rendering slides */
function fontLinks(): string {
  return '';
}

function baseStyles(W: number, H: number): string {
  return `

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      width: ${W}px;
      height: ${H}px;
      overflow: hidden;
      font-family: 'Inter', -apple-system, sans-serif;
      -webkit-font-smoothing: antialiased;
      background: ${B.pageBg};
    }

    .slide {
      width: ${W}px;
      height: ${H}px;
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      background: ${B.pageBg};
      padding: 48px;
    }

    /* ── Bold heading (clean B2B) ── */
    .serif { font-family: 'Inter', -apple-system, sans-serif; font-weight: 800; }

    /* ── Top bar ── */
    .top-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 40px;
      flex-shrink: 0;
    }
    .slide-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 44px;
      height: 32px;
      padding: 0 14px;
      border-radius: 16px;
      background: ${B.navy};
      color: #FFF;
      font-weight: 600;
      font-size: 13px;
      letter-spacing: 0.5px;
    }
    .brand-tag {
      font-size: 12px;
      font-weight: 500;
      color: ${B.mutedGrey};
      letter-spacing: 0.5px;
    }

    /* ── Cards ── */
    .card {
      background: ${B.cardBg};
      border-radius: 20px;
      padding: 52px 56px;
      box-shadow: 0 2px 20px rgba(0,0,0,0.04);
    }

    /* ── Bottom branding ── */
    .bottom-brand {
      position: absolute;
      bottom: 28px;
      right: 52px;
      font-size: 13px;
      font-weight: 600;
      color: ${B.navy};
      letter-spacing: 0.3px;
      opacity: 0.5;
    }

    /* ── Dots ── */
    .dot-row {
      position: absolute;
      bottom: 32px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: ${B.lightGrey};
    }
    .dot.active {
      width: 24px;
      border-radius: 4px;
      background: ${B.coral};
    }

    /* ── Accent bubble (coral callout) ── */
    .bubble {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 12px 22px;
      background: ${B.coralLight};
      border-radius: 12px;
      color: ${B.coral};
      font-weight: 600;
      font-size: 17px;
    }
    .bubble-arrow {
      position: relative;
    }
    .bubble-arrow::after {
      content: '';
      position: absolute;
      bottom: -8px;
      left: 24px;
      width: 0; height: 0;
      border-left: 8px solid transparent;
      border-right: 8px solid transparent;
      border-top: 8px solid ${B.coralLight};
    }

    /* ── Feature card row ── */
    .feature-row {
      display: flex;
      gap: 24px;
      margin-top: 32px;
    }
    .feature-card {
      flex: 1;
      background: ${B.white};
      border: 1.5px solid ${B.lightGrey};
      border-radius: 16px;
      padding: 32px 24px;
      text-align: center;
    }
    .feature-icon {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
      font-size: 28px;
    }
    .feature-title {
      font-family: 'DM Serif Display', Georgia, serif;
      font-size: 19px;
      color: ${B.headBlack};
      margin-bottom: 8px;
    }
    .feature-desc {
      font-size: 14px;
      color: ${B.mutedGrey};
      line-height: 1.5;
    }

    /* ── Illustration helpers ── */
    .illust-container {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
  `;
}

/* ═══════════════════════════════════════════════════
   SVG ILLUSTRATIONS — simple, clean, topic-adaptive
   ═══════════════════════════════════════════════════ */

/**
 * Pick an illustration SVG using narrative arc position first, then keywords.
 * Narrative carousels follow: Hook → Moment → Problem → Consequence → Insight → CTA
 * The slide's position in the story determines the visual mood.
 */
function pickIllustration(content: string, type: string, slideNum: number, totalSlides?: number): string {
  const text = content.toLowerCase();
  const total = totalSlides || 7;

  // ── Narrative arc position mapping ──
  // Slide 1: Hook/Scene entry — tension, split screen
  if (type === 'hook' || slideNum === 1) return svgSceneEntry();

  // Last slide: CTA — minimal, question-focused
  if (type === 'cta' || slideNum === total) return svgCtaQuestion();

  // Slide 2: The Moment — conversation, scene
  if (slideNum === 2) {
    if (text.includes('call') || text.includes('prospect') || text.includes('conversation') || text.includes('said'))
      return svgConversation();
    return svgConversation();
  }

  // Slide 3: The Mistake / Real Problem — broken input
  if (slideNum === 3) {
    if (text.includes('prompt') || text.includes('chatgpt') || text.includes('ai') || text.includes('typed'))
      return svgBrokenInput();
    return svgBrokenInput();
  }

  // Slide 4: The Output / Consequence — irrelevant result, red X
  if (slideNum === 4) {
    if (text.includes('irrelevant') || text.includes('email') || text.includes('output') || text.includes('feature'))
      return svgIrrelevantOutput();
    if (text.includes('died') || text.includes('lost') || text.includes('vendor') || text.includes('walked'))
      return svgDealDeath();
    return svgIrrelevantOutput();
  }

  // Slide 5: Consequence or Insight
  if (slideNum === 5) {
    if (text.includes('died') || text.includes('lost') || text.includes('vendor') || text.includes('walked'))
      return svgDealDeath();
    if (text.includes('amplif') || text.includes('context') || text.includes('chaos') || text.includes('feed'))
      return svgTwoFunnels();
    return svgDealDeath();
  }

  // Slide 6: The Principle / Insight — two paths, comparison
  if (slideNum === 6) {
    if (text.includes('amplif') || text.includes('context') || text.includes('chaos') || text.includes('feed') || text.includes('missing'))
      return svgTwoFunnels();
    return svgTwoFunnels();
  }

  // ── Keyword fallback for any other positions ──
  if (text.includes('team') || text.includes('people') || text.includes('hire') || text.includes('rep'))
    return svgTeam();
  if (text.includes('data') || text.includes('chart') || text.includes('metric') || text.includes('analytics'))
    return svgChart();
  if (text.includes('growth') || text.includes('scale') || text.includes('revenue') || text.includes('result'))
    return svgGrowth();
  if (text.includes('process') || text.includes('system') || text.includes('framework') || text.includes('step'))
    return svgProcess();
  if (text.includes('brain') || text.includes('think') || text.includes('mindset') || text.includes('strategy'))
    return svgBrain();
  if (text.includes('target') || text.includes('goal') || text.includes('focus') || text.includes('icp'))
    return svgTarget();
  if (text.includes('money') || text.includes('cost') || text.includes('price') || text.includes('roi'))
    return svgMoney();

  const fallbacks = [svgLightbulb, svgRocket, svgPuzzle, svgMegaphone, svgShield];
  return fallbacks[slideNum % fallbacks.length]();
}

/* ── Narrative-arc-specific illustrations ── */

/** Hook: Split screen — old vs new, with ghost/tension element */
function svgSceneEntry(): string {
  return `<svg width="220" height="180" viewBox="0 0 220 180" fill="none" xmlns="http://www.w3.org/2000/svg">
    <!-- Left panel (old/template) -->
    <rect x="10" y="20" width="90" height="140" rx="8" fill="${B.navy}" opacity="0.08" stroke="${B.navy}" stroke-width="1.5" opacity="0.2"/>
    <rect x="22" y="40" width="66" height="6" rx="3" fill="${B.navy}" opacity="0.15"/>
    <rect x="22" y="54" width="50" height="4" rx="2" fill="${B.navy}" opacity="0.1"/>
    <rect x="22" y="64" width="58" height="4" rx="2" fill="${B.navy}" opacity="0.1"/>
    <rect x="22" y="74" width="42" height="4" rx="2" fill="${B.navy}" opacity="0.1"/>
    <text x="55" y="120" text-anchor="middle" fill="${B.navy}" font-size="9" opacity="0.3" font-family="Inter">TEMPLATE</text>
    <!-- Divider -->
    <line x1="110" y1="10" x2="110" y2="170" stroke="${B.coral}" stroke-width="2" stroke-dasharray="6 4" opacity="0.4"/>
    <!-- Right panel (AI/polished) -->
    <rect x="120" y="20" width="90" height="140" rx="8" fill="${B.coral}" opacity="0.06" stroke="${B.coral}" stroke-width="1.5" opacity="0.3"/>
    <rect x="132" y="40" width="66" height="6" rx="3" fill="${B.coral}" opacity="0.3"/>
    <rect x="132" y="54" width="50" height="4" rx="2" fill="${B.coral}" opacity="0.2"/>
    <rect x="132" y="64" width="58" height="4" rx="2" fill="${B.coral}" opacity="0.2"/>
    <rect x="132" y="74" width="42" height="4" rx="2" fill="${B.coral}" opacity="0.2"/>
    <text x="165" y="120" text-anchor="middle" fill="${B.coral}" font-size="9" opacity="0.5" font-family="Inter">AI OUTPUT</text>
    <!-- Ghost crossing both -->
    <circle cx="110" cy="90" r="18" fill="${B.navy}" opacity="0.06"/>
    <text x="110" y="95" text-anchor="middle" fill="${B.coral}" font-size="16" opacity="0.5">⚡</text>
    <!-- Arrow suggesting same result -->
    <path d="M55 145 Q110 165 165 145" stroke="${B.navy}" stroke-width="1.5" stroke-dasharray="4 3" fill="none" opacity="0.2"/>
    <text x="110" y="172" text-anchor="middle" fill="${B.coral}" font-size="8" font-weight="600" opacity="0.5" font-family="Inter">SAME RESULT</text>
  </svg>`;
}

/** The Moment: Conversation scene — person on call with speech bubble */
function svgConversation(): string {
  return `<svg width="200" height="180" viewBox="0 0 200 180" fill="none" xmlns="http://www.w3.org/2000/svg">
    <!-- Person (rep) -->
    <circle cx="50" cy="55" r="18" fill="${B.navy}" opacity="0.15"/>
    <circle cx="50" cy="55" r="13" fill="${B.navy}"/>
    <rect x="36" y="76" width="28" height="35" rx="6" fill="${B.navy}" opacity="0.8"/>
    <!-- Notepad (empty) -->
    <rect x="30" y="118" width="40" height="50" rx="4" fill="${B.white}" stroke="${B.navy}" stroke-width="1.5" opacity="0.3"/>
    <line x1="36" y1="130" x2="64" y2="130" stroke="${B.navy}" stroke-width="0.8" opacity="0.15"/>
    <line x1="36" y1="138" x2="64" y2="138" stroke="${B.navy}" stroke-width="0.8" opacity="0.15"/>
    <line x1="36" y1="146" x2="64" y2="146" stroke="${B.navy}" stroke-width="0.8" opacity="0.15"/>
    <!-- Speech bubble from prospect -->
    <rect x="90" y="20" width="100" height="70" rx="12" fill="${B.coral}" opacity="0.1" stroke="${B.coral}" stroke-width="1.5" opacity="0.3"/>
    <polygon points="95,90 105,80 115,90" fill="${B.coral}" opacity="0.1" stroke="${B.coral}" stroke-width="1.5" opacity="0.3"/>
    <rect x="102" y="34" width="76" height="5" rx="2.5" fill="${B.coral}" opacity="0.25"/>
    <rect x="102" y="45" width="60" height="4" rx="2" fill="${B.coral}" opacity="0.18"/>
    <rect x="102" y="55" width="68" height="4" rx="2" fill="${B.coral}" opacity="0.18"/>
    <rect x="102" y="65" width="45" height="4" rx="2" fill="${B.coral}" opacity="0.18"/>
    <!-- Prospect silhouette -->
    <circle cx="160" cy="120" r="14" fill="${B.coral}" opacity="0.2"/>
    <circle cx="160" cy="120" r="10" fill="${B.coral}" opacity="0.6"/>
    <rect x="148" y="137" width="24" height="30" rx="5" fill="${B.coral}" opacity="0.4"/>
  </svg>`;
}

/** The Mistake: Broken input — laptop with bare prompt, fading context */
function svgBrokenInput(): string {
  return `<svg width="200" height="170" viewBox="0 0 200 170" fill="none" xmlns="http://www.w3.org/2000/svg">
    <!-- Laptop body -->
    <rect x="30" y="25" width="140" height="95" rx="8" fill="${B.white}" stroke="${B.navy}" stroke-width="2" opacity="0.6"/>
    <!-- Screen content - bare prompt -->
    <rect x="42" y="38" width="116" height="12" rx="3" fill="${B.navy}" opacity="0.06"/>
    <text x="48" y="48" fill="${B.navy}" font-size="8" opacity="0.35" font-family="Inter">&gt; Write a follow-up email for...</text>
    <!-- Cursor blinking -->
    <rect x="42" y="58" width="2" height="12" fill="${B.coral}" opacity="0.6"/>
    <!-- Empty lines below (no context) -->
    <rect x="42" y="78" width="80" height="3" rx="1.5" fill="${B.navy}" opacity="0.05"/>
    <rect x="42" y="86" width="60" height="3" rx="1.5" fill="${B.navy}" opacity="0.05"/>
    <rect x="42" y="94" width="70" height="3" rx="1.5" fill="${B.navy}" opacity="0.05"/>
    <!-- Laptop base -->
    <rect x="20" y="120" width="160" height="8" rx="4" fill="${B.navy}" opacity="0.15"/>
    <!-- Fading context trail behind -->
    <circle cx="25" cy="60" r="8" fill="${B.coral}" opacity="0.15"/>
    <circle cx="12" cy="45" r="5" fill="${B.coral}" opacity="0.1"/>
    <circle cx="18" cy="80" r="6" fill="${B.coral}" opacity="0.08"/>
    <text x="100" y="148" text-anchor="middle" fill="${B.coral}" font-size="9" font-weight="600" opacity="0.4" font-family="Inter">CONTEXT LOST</text>
    <!-- X marks for missing inputs -->
    <g transform="translate(150, 40)" opacity="0.4">
      <line x1="0" y1="0" x2="10" y2="10" stroke="${B.coral}" stroke-width="2" stroke-linecap="round"/>
      <line x1="10" y1="0" x2="0" y2="10" stroke="${B.coral}" stroke-width="2" stroke-linecap="round"/>
    </g>
    <g transform="translate(150, 60)" opacity="0.3">
      <line x1="0" y1="0" x2="10" y2="10" stroke="${B.coral}" stroke-width="2" stroke-linecap="round"/>
      <line x1="10" y1="0" x2="0" y2="10" stroke="${B.coral}" stroke-width="2" stroke-linecap="round"/>
    </g>
    <g transform="translate(150, 80)" opacity="0.2">
      <line x1="0" y1="0" x2="10" y2="10" stroke="${B.coral}" stroke-width="2" stroke-linecap="round"/>
      <line x1="10" y1="0" x2="0" y2="10" stroke="${B.coral}" stroke-width="2" stroke-linecap="round"/>
    </g>
  </svg>`;
}

/** The Output: Polished email with red X markers over missing context */
function svgIrrelevantOutput(): string {
  return `<svg width="200" height="170" viewBox="0 0 200 170" fill="none" xmlns="http://www.w3.org/2000/svg">
    <!-- Email envelope -->
    <rect x="25" y="20" width="150" height="110" rx="10" fill="${B.white}" stroke="${B.navy}" stroke-width="1.5" opacity="0.4"/>
    <!-- Email header -->
    <rect x="40" y="32" width="80" height="6" rx="3" fill="${B.navy}" opacity="0.2"/>
    <rect x="40" y="44" width="50" height="4" rx="2" fill="${B.navy}" opacity="0.1"/>
    <!-- Email body lines (polished) -->
    <rect x="40" y="60" width="120" height="5" rx="2.5" fill="${B.navy}" opacity="0.12"/>
    <rect x="40" y="72" width="110" height="4" rx="2" fill="${B.navy}" opacity="0.08"/>
    <rect x="40" y="82" width="100" height="4" rx="2" fill="${B.navy}" opacity="0.08"/>
    <rect x="40" y="92" width="115" height="4" rx="2" fill="${B.navy}" opacity="0.08"/>
    <rect x="40" y="102" width="80" height="4" rx="2" fill="${B.navy}" opacity="0.08"/>
    <!-- Red X markers over missing context points -->
    <g transform="translate(152, 56)">
      <circle r="12" fill="${B.coral}" opacity="0.15"/>
      <line x1="-5" y1="-5" x2="5" y2="5" stroke="${B.coral}" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="5" y1="-5" x2="-5" y2="5" stroke="${B.coral}" stroke-width="2.5" stroke-linecap="round"/>
    </g>
    <g transform="translate(152, 82)">
      <circle r="12" fill="${B.coral}" opacity="0.15"/>
      <line x1="-5" y1="-5" x2="5" y2="5" stroke="${B.coral}" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="5" y1="-5" x2="-5" y2="5" stroke="${B.coral}" stroke-width="2.5" stroke-linecap="round"/>
    </g>
    <g transform="translate(152, 105)">
      <circle r="12" fill="${B.coral}" opacity="0.15"/>
      <line x1="-5" y1="-5" x2="5" y2="5" stroke="${B.coral}" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="5" y1="-5" x2="-5" y2="5" stroke="${B.coral}" stroke-width="2.5" stroke-linecap="round"/>
    </g>
    <!-- Labels for missing items -->
    <text x="100" y="148" text-anchor="middle" fill="${B.coral}" font-size="8" font-weight="600" opacity="0.5" font-family="Inter">MISSING: PAIN POINTS · SIGNALS · CONTEXT</text>
  </svg>`;
}

/** The Consequence: Deal dying — prospect walking away, pipeline breaking */
function svgDealDeath(): string {
  return `<svg width="200" height="170" viewBox="0 0 200 170" fill="none" xmlns="http://www.w3.org/2000/svg">
    <!-- Pipeline bar breaking -->
    <rect x="20" y="70" width="70" height="16" rx="8" fill="${B.navy}" opacity="0.6"/>
    <rect x="100" y="70" width="8" height="16" rx="4" fill="${B.coral}" opacity="0.4"/>
    <rect x="118" y="70" width="70" height="16" rx="8" fill="${B.navy}" opacity="0.2"/>
    <!-- Break crack -->
    <path d="M92 65 L96 78 L88 82 L94 92" stroke="${B.coral}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <!-- Prospect walking away (right) -->
    <circle cx="160" cy="35" r="12" fill="${B.coral}" opacity="0.3"/>
    <circle cx="160" cy="35" r="8" fill="${B.coral}" opacity="0.6"/>
    <rect x="153" y="50" width="14" height="22" rx="4" fill="${B.coral}" opacity="0.4"/>
    <!-- Arrow showing departure -->
    <path d="M165 45 L180 38" stroke="${B.coral}" stroke-width="1.5" stroke-linecap="round" opacity="0.4"/>
    <polygon points="182,36 176,34 178,40" fill="${B.coral}" opacity="0.4"/>
    <!-- Rep left behind (left) -->
    <circle cx="40" cy="35" r="12" fill="${B.navy}" opacity="0.15"/>
    <circle cx="40" cy="35" r="8" fill="${B.navy}" opacity="0.5"/>
    <rect x="33" y="50" width="14" height="22" rx="4" fill="${B.navy}" opacity="0.3"/>
    <!-- Dollar signs falling -->
    <text x="70" y="120" fill="${B.coral}" font-size="14" opacity="0.2" font-family="Inter">$</text>
    <text x="100" y="135" fill="${B.coral}" font-size="12" opacity="0.15" font-family="Inter">$</text>
    <text x="130" y="125" fill="${B.coral}" font-size="16" opacity="0.25" font-family="Inter">$</text>
    <!-- Down arrow -->
    <path d="M100 105 L100 150" stroke="${B.coral}" stroke-width="1.5" opacity="0.3" stroke-dasharray="4 3"/>
    <polygon points="95,148 100,158 105,148" fill="${B.coral}" opacity="0.3"/>
  </svg>`;
}

/** The Insight: Two funnels — context vs chaos comparison */
function svgTwoFunnels(): string {
  return `<svg width="220" height="170" viewBox="0 0 220 170" fill="none" xmlns="http://www.w3.org/2000/svg">
    <!-- Left funnel (context → good output) -->
    <text x="55" y="14" text-anchor="middle" fill="${B.navy}" font-size="9" font-weight="600" opacity="0.5" font-family="Inter">CONTEXT</text>
    <polygon points="20,22 90,22 72,80 38,80" fill="${B.navy}" opacity="0.12" stroke="${B.navy}" stroke-width="1.5" opacity="0.3"/>
    <!-- Input items going in (left) -->
    <circle cx="35" cy="32" r="4" fill="${B.navy}" opacity="0.4"/>
    <circle cx="50" cy="28" r="3" fill="${B.navy}" opacity="0.5"/>
    <circle cx="65" cy="33" r="3.5" fill="${B.navy}" opacity="0.45"/>
    <circle cx="55" cy="50" r="3" fill="${B.navy}" opacity="0.35"/>
    <!-- Good output below -->
    <rect x="35" y="90" width="40" height="50" rx="6" fill="${B.navy}" opacity="0.08" stroke="${B.navy}" stroke-width="1.5" opacity="0.25"/>
    <rect x="41" y="100" width="28" height="3" rx="1.5" fill="${B.navy}" opacity="0.3"/>
    <rect x="41" y="108" width="22" height="3" rx="1.5" fill="${B.navy}" opacity="0.2"/>
    <rect x="41" y="116" width="26" height="3" rx="1.5" fill="${B.navy}" opacity="0.2"/>
    <!-- Check mark -->
    <circle cx="55" cy="148" r="8" fill="${B.navy}" opacity="0.1"/>
    <path d="M50 148 L53 151 L60 144" stroke="${B.navy}" stroke-width="2" fill="none" stroke-linecap="round"/>
    <!-- Right funnel (nothing → chaos) -->
    <text x="165" y="14" text-anchor="middle" fill="${B.coral}" font-size="9" font-weight="600" opacity="0.5" font-family="Inter">CHAOS</text>
    <polygon points="130,22 200,22 182,80 148,80" fill="${B.coral}" opacity="0.08" stroke="${B.coral}" stroke-width="1.5" opacity="0.3"/>
    <!-- Empty funnel (nothing going in) -->
    <text x="165" y="50" text-anchor="middle" fill="${B.coral}" font-size="18" opacity="0.2" font-family="Inter">∅</text>
    <!-- Bad output below -->
    <rect x="145" y="90" width="40" height="50" rx="6" fill="${B.coral}" opacity="0.06" stroke="${B.coral}" stroke-width="1.5" opacity="0.2"/>
    <rect x="151" y="100" width="28" height="3" rx="1.5" fill="${B.coral}" opacity="0.15"/>
    <rect x="151" y="108" width="22" height="3" rx="1.5" fill="${B.coral}" opacity="0.1"/>
    <rect x="151" y="116" width="26" height="3" rx="1.5" fill="${B.coral}" opacity="0.1"/>
    <!-- X mark -->
    <circle cx="165" cy="148" r="8" fill="${B.coral}" opacity="0.1"/>
    <line x1="161" y1="144" x2="169" y2="152" stroke="${B.coral}" stroke-width="2" stroke-linecap="round"/>
    <line x1="169" y1="144" x2="161" y2="152" stroke="${B.coral}" stroke-width="2" stroke-linecap="round"/>
    <!-- VS divider -->
    <text x="110" y="60" text-anchor="middle" fill="${B.mutedGrey}" font-size="11" font-weight="700" font-family="Inter">VS</text>
    <line x1="110" y1="20" x2="110" y2="45" stroke="${B.lightGrey}" stroke-width="1" opacity="0.5"/>
    <line x1="110" y1="70" x2="110" y2="160" stroke="${B.lightGrey}" stroke-width="1" opacity="0.5"/>
  </svg>`;
}

/** CTA: Minimal question mark — clean close */
function svgCtaQuestion(): string {
  return `<svg width="160" height="160" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="80" cy="70" r="50" fill="${B.coral}" opacity="0.06"/>
    <circle cx="80" cy="70" r="35" fill="${B.coral}" opacity="0.04" stroke="${B.coral}" stroke-width="1.5" opacity="0.15"/>
    <text x="80" y="82" text-anchor="middle" fill="${B.coral}" font-size="48" font-weight="300" font-family="Inter" opacity="0.7">?</text>
    <!-- Small speech bubble dots -->
    <circle cx="80" cy="120" r="3" fill="${B.navy}" opacity="0.15"/>
    <circle cx="90" cy="128" r="2" fill="${B.navy}" opacity="0.1"/>
    <circle cx="98" cy="134" r="1.5" fill="${B.navy}" opacity="0.08"/>
  </svg>`;
}

function svgTeam(): string {
  return `<svg width="200" height="160" viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="100" cy="40" r="22" fill="${B.navy}" opacity="0.15"/>
    <circle cx="100" cy="40" r="16" fill="${B.navy}"/>
    <rect x="80" y="65" width="40" height="45" rx="8" fill="${B.navy}"/>
    <circle cx="50" cy="55" r="14" fill="${B.coral}" opacity="0.2"/>
    <circle cx="50" cy="55" r="10" fill="${B.coral}"/>
    <rect x="35" y="72" width="30" height="35" rx="6" fill="${B.coral}" opacity="0.8"/>
    <circle cx="150" cy="55" r="14" fill="${B.coral}" opacity="0.2"/>
    <circle cx="150" cy="55" r="10" fill="${B.coral}"/>
    <rect x="135" y="72" width="30" height="35" rx="6" fill="${B.coral}" opacity="0.8"/>
    <path d="M65 90 Q100 130 135 90" stroke="${B.navy}" stroke-width="2" stroke-dasharray="4 4" fill="none" opacity="0.3"/>
  </svg>`;
}

function svgChart(): string {
  return `<svg width="200" height="160" viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="20" y="100" width="30" height="50" rx="4" fill="${B.navy}" opacity="0.2"/>
    <rect x="60" y="70" width="30" height="80" rx="4" fill="${B.navy}" opacity="0.4"/>
    <rect x="100" y="40" width="30" height="110" rx="4" fill="${B.coral}" opacity="0.8"/>
    <rect x="140" y="20" width="30" height="130" rx="4" fill="${B.navy}"/>
    <path d="M35 95 L75 65 L115 35 L155 15" stroke="${B.coral}" stroke-width="3" fill="none" stroke-linecap="round"/>
    <circle cx="155" cy="15" r="5" fill="${B.coral}"/>
  </svg>`;
}

function svgGrowth(): string {
  return `<svg width="200" height="160" viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 140 Q60 120 80 100 Q100 80 120 50 Q140 20 180 10" stroke="${B.coral}" stroke-width="4" fill="none" stroke-linecap="round"/>
    <polygon points="175,2 188,12 172,16" fill="${B.coral}"/>
    <circle cx="80" cy="100" r="6" fill="${B.navy}" opacity="0.3"/>
    <circle cx="120" cy="50" r="6" fill="${B.navy}" opacity="0.5"/>
    <circle cx="180" cy="10" r="8" fill="${B.coral}"/>
    <rect x="20" y="145" width="168" height="2" rx="1" fill="${B.navy}" opacity="0.15"/>
  </svg>`;
}

function svgProcess(): string {
  return `<svg width="220" height="100" viewBox="0 0 220 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="25" width="55" height="50" rx="12" fill="${B.navy}"/>
    <text x="27" y="55" text-anchor="middle" fill="white" font-size="11" font-weight="600" font-family="Inter">Step 1</text>
    <path d="M60 50 L80 50" stroke="${B.coral}" stroke-width="2.5" marker-end="url(#arrow)"/>
    <rect x="82" y="25" width="55" height="50" rx="12" fill="${B.coral}" opacity="0.85"/>
    <text x="109" y="55" text-anchor="middle" fill="white" font-size="11" font-weight="600" font-family="Inter">Step 2</text>
    <path d="M142 50 L162 50" stroke="${B.coral}" stroke-width="2.5" marker-end="url(#arrow)"/>
    <rect x="164" y="25" width="55" height="50" rx="12" fill="${B.navy}" opacity="0.7"/>
    <text x="191" y="55" text-anchor="middle" fill="white" font-size="11" font-weight="600" font-family="Inter">Step 3</text>
    <defs><marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${B.coral}"/></marker></defs>
  </svg>`;
}

function svgBrain(): string {
  return `<svg width="180" height="160" viewBox="0 0 180 160" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="90" cy="70" rx="55" ry="50" fill="${B.navy}" opacity="0.1"/>
    <path d="M60 50 Q65 30 90 25 Q115 30 120 50" stroke="${B.navy}" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M55 65 Q50 50 60 40" stroke="${B.navy}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <path d="M125 65 Q130 50 120 40" stroke="${B.navy}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <path d="M65 80 Q60 95 70 105" stroke="${B.navy}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <path d="M115 80 Q120 95 110 105" stroke="${B.navy}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <line x1="90" y1="25" x2="90" y2="110" stroke="${B.navy}" stroke-width="1.5" opacity="0.3"/>
    <circle cx="90" cy="55" r="4" fill="${B.coral}"/>
    <circle cx="75" cy="70" r="3" fill="${B.coral}" opacity="0.6"/>
    <circle cx="105" cy="75" r="3" fill="${B.coral}" opacity="0.6"/>
    <circle cx="90" cy="90" r="3.5" fill="${B.coral}" opacity="0.8"/>
  </svg>`;
}

function svgClock(): string {
  return `<svg width="160" height="160" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="80" cy="80" r="60" fill="${B.navy}" opacity="0.08"/>
    <circle cx="80" cy="80" r="50" stroke="${B.navy}" stroke-width="3" fill="white"/>
    <line x1="80" y1="80" x2="80" y2="45" stroke="${B.navy}" stroke-width="3.5" stroke-linecap="round"/>
    <line x1="80" y1="80" x2="105" y2="80" stroke="${B.coral}" stroke-width="3" stroke-linecap="round"/>
    <circle cx="80" cy="80" r="5" fill="${B.navy}"/>
    ${[0,30,60,90,120,150,180,210,240,270,300,330].map(deg => {
      const rad = deg * Math.PI / 180;
      const x = 80 + 43 * Math.sin(rad);
      const y = 80 - 43 * Math.cos(rad);
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${deg % 90 === 0 ? 3 : 1.5}" fill="${B.navy}" opacity="0.4"/>`;
    }).join('')}
  </svg>`;
}

function svgNetwork(): string {
  return `<svg width="200" height="160" viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg">
    <line x1="100" y1="50" x2="45" y2="100" stroke="${B.navy}" stroke-width="1.5" opacity="0.25"/>
    <line x1="100" y1="50" x2="155" y2="100" stroke="${B.navy}" stroke-width="1.5" opacity="0.25"/>
    <line x1="100" y1="50" x2="100" y2="130" stroke="${B.navy}" stroke-width="1.5" opacity="0.25"/>
    <line x1="45" y1="100" x2="100" y2="130" stroke="${B.navy}" stroke-width="1.5" opacity="0.15"/>
    <line x1="155" y1="100" x2="100" y2="130" stroke="${B.navy}" stroke-width="1.5" opacity="0.15"/>
    <circle cx="100" cy="50" r="20" fill="${B.navy}"/>
    <circle cx="45" cy="100" r="16" fill="${B.coral}" opacity="0.85"/>
    <circle cx="155" cy="100" r="16" fill="${B.coral}" opacity="0.85"/>
    <circle cx="100" cy="130" r="14" fill="${B.navy}" opacity="0.6"/>
  </svg>`;
}

function svgTarget(): string {
  return `<svg width="160" height="160" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="80" cy="80" r="55" fill="${B.coral}" opacity="0.08"/>
    <circle cx="80" cy="80" r="55" stroke="${B.coral}" stroke-width="2.5" fill="none" opacity="0.3"/>
    <circle cx="80" cy="80" r="38" stroke="${B.coral}" stroke-width="2.5" fill="none" opacity="0.5"/>
    <circle cx="80" cy="80" r="20" fill="${B.coral}" opacity="0.15"/>
    <circle cx="80" cy="80" r="8" fill="${B.coral}"/>
    <line x1="105" y1="55" x2="82" y2="78" stroke="${B.navy}" stroke-width="2.5" stroke-linecap="round"/>
    <polygon points="108,48 112,62 98,58" fill="${B.navy}"/>
  </svg>`;
}

function svgMoney(): string {
  return `<svg width="180" height="140" viewBox="0 0 180 140" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="20" y="30" width="140" height="80" rx="12" fill="${B.navy}" opacity="0.08"/>
    <rect x="25" y="35" width="130" height="70" rx="10" stroke="${B.navy}" stroke-width="2" fill="white"/>
    <circle cx="90" cy="70" r="22" stroke="${B.coral}" stroke-width="2.5" fill="${B.coralLight}"/>
    <text x="90" y="78" text-anchor="middle" fill="${B.coral}" font-size="22" font-weight="700" font-family="Inter">₹</text>
    <line x1="35" y1="50" x2="55" y2="50" stroke="${B.navy}" stroke-width="1.5" opacity="0.3"/>
    <line x1="125" y1="90" x2="145" y2="90" stroke="${B.navy}" stroke-width="1.5" opacity="0.3"/>
  </svg>`;
}

function svgProblem(): string {
  return `<svg width="160" height="160" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="80" cy="70" r="45" fill="${B.coral}" opacity="0.08"/>
    <text x="80" y="82" text-anchor="middle" fill="${B.coral}" font-size="52" font-weight="700" font-family="Inter">?</text>
    <circle cx="40" cy="120" r="3" fill="${B.navy}" opacity="0.2"/>
    <circle cx="55" cy="130" r="2" fill="${B.navy}" opacity="0.15"/>
    <circle cx="120" cy="115" r="3" fill="${B.coral}" opacity="0.2"/>
    <circle cx="135" cy="128" r="2" fill="${B.coral}" opacity="0.15"/>
  </svg>`;
}

function svgLightbulb(): string {
  return `<svg width="140" height="170" viewBox="0 0 140 170" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="70" cy="65" r="40" fill="${B.coral}" opacity="0.1"/>
    <path d="M50 65 Q50 30 70 25 Q90 30 90 65 Q90 85 80 95 L60 95 Q50 85 50 65Z" fill="${B.coral}" opacity="0.2" stroke="${B.coral}" stroke-width="2.5"/>
    <rect x="58" y="100" width="24" height="10" rx="3" fill="${B.navy}" opacity="0.6"/>
    <rect x="62" y="114" width="16" height="6" rx="3" fill="${B.navy}" opacity="0.4"/>
    <line x1="70" y1="5" x2="70" y2="15" stroke="${B.coral}" stroke-width="2" stroke-linecap="round"/>
    <line x1="30" y1="35" x2="38" y2="42" stroke="${B.coral}" stroke-width="2" stroke-linecap="round"/>
    <line x1="110" y1="35" x2="102" y2="42" stroke="${B.coral}" stroke-width="2" stroke-linecap="round"/>
    <line x1="20" y1="65" x2="30" y2="65" stroke="${B.coral}" stroke-width="2" stroke-linecap="round"/>
    <line x1="120" y1="65" x2="110" y2="65" stroke="${B.coral}" stroke-width="2" stroke-linecap="round"/>
  </svg>`;
}

function svgRocket(): string {
  return `<svg width="160" height="170" viewBox="0 0 160 170" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M80 20 Q95 50 95 90 L80 110 L65 90 Q65 50 80 20Z" fill="${B.navy}"/>
    <circle cx="80" cy="60" r="8" fill="${B.white}"/>
    <circle cx="80" cy="60" r="4" fill="${B.coral}"/>
    <path d="M65 80 L50 95 L65 90Z" fill="${B.coral}" opacity="0.8"/>
    <path d="M95 80 L110 95 L95 90Z" fill="${B.coral}" opacity="0.8"/>
    <path d="M72 110 L80 140 L88 110Z" fill="${B.coral}" opacity="0.6"/>
    <circle cx="80" cy="150" r="4" fill="${B.coral}" opacity="0.3"/>
    <circle cx="72" cy="155" r="2" fill="${B.coral}" opacity="0.2"/>
    <circle cx="88" cy="155" r="2" fill="${B.coral}" opacity="0.2"/>
  </svg>`;
}

function svgPuzzle(): string {
  return `<svg width="180" height="160" viewBox="0 0 180 160" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="20" y="20" width="60" height="60" rx="8" fill="${B.navy}" opacity="0.8"/>
    <rect x="100" y="20" width="60" height="60" rx="8" fill="${B.coral}" opacity="0.8"/>
    <rect x="20" y="80" width="60" height="60" rx="8" fill="${B.coral}" opacity="0.5"/>
    <rect x="100" y="80" width="60" height="60" rx="8" fill="${B.navy}" opacity="0.5"/>
    <circle cx="90" cy="50" r="10" fill="${B.pageBg}"/>
    <circle cx="90" cy="50" r="10" fill="${B.navy}" opacity="0.4"/>
    <circle cx="50" cy="80" r="10" fill="${B.pageBg}"/>
    <circle cx="50" cy="80" r="10" fill="${B.coral}" opacity="0.4"/>
  </svg>`;
}

function svgMegaphone(): string {
  return `<svg width="180" height="150" viewBox="0 0 180 150" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M40 55 L120 25 L120 105 L40 75Z" fill="${B.navy}" opacity="0.85"/>
    <rect x="20" y="50" width="25" height="30" rx="5" fill="${B.coral}"/>
    <rect x="38" y="80" width="12" height="30" rx="3" fill="${B.navy}" opacity="0.4"/>
    <circle cx="135" cy="40" r="4" fill="${B.coral}" opacity="0.6"/>
    <circle cx="148" cy="55" r="3" fill="${B.coral}" opacity="0.4"/>
    <circle cx="140" cy="70" r="3.5" fill="${B.coral}" opacity="0.5"/>
    <line x1="128" y1="30" x2="145" y2="22" stroke="${B.coral}" stroke-width="2" stroke-linecap="round" opacity="0.4"/>
    <line x1="128" y1="65" x2="150" y2="65" stroke="${B.coral}" stroke-width="2" stroke-linecap="round" opacity="0.4"/>
    <line x1="128" y1="95" x2="142" y2="102" stroke="${B.coral}" stroke-width="2" stroke-linecap="round" opacity="0.4"/>
  </svg>`;
}

function svgShield(): string {
  return `<svg width="150" height="170" viewBox="0 0 150 170" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M75 15 L130 40 L130 85 Q130 130 75 155 Q20 130 20 85 L20 40Z" fill="${B.navy}" opacity="0.1" stroke="${B.navy}" stroke-width="2.5"/>
    <path d="M55 80 L70 95 L100 60" stroke="${B.coral}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

/* ─────────────────────────────────────────────
   Dot row HTML
   ───────────────────────────────────────────── */
function dotsHtml(slideNum: number, total: number): string {
  return `<div class="dot-row">${
    Array.from({ length: total }, (_, i) =>
      `<div class="dot ${i === slideNum - 1 ? 'active' : ''}"></div>`
    ).join('')
  }</div>`;
}

/* ═══════════════════════════════════════════════════
   SLIDE TEMPLATES
   ═══════════════════════════════════════════════════ */

function hookSlideHtml(slide: CarouselSlideInput, total: number, title: string, W = 1080, H = 1080): string {
  const lines = escapeHtml(slide.content).split('\n').filter(l => l.trim());
  const headline = lines[0] || escapeHtml(slide.content);
  const subtitle = lines.length > 1 ? lines.slice(1).join('<br>') : '';
  const hSize = headline.length <= 50 ? 50 : headline.length <= 80 ? 42 : headline.length <= 120 ? 36 : 30;
  const illustration = pickIllustration(slide.content, 'hook', slide.slideNumber, total);

  return `<!DOCTYPE html><html><head>${fontLinks()}<style>${baseStyles(W, H)}
    .hook-main {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 36px;
    }
    .hook-headline {
      font-size: ${hSize}px;
      line-height: 1.15;
      color: ${B.headBlack};
      letter-spacing: -0.5px;
      max-width: 820px;
    }
    .hook-subtitle {
      font-size: 20px;
      color: ${B.mutedGrey};
      line-height: 1.6;
      max-width: 700px;
    }
    .hook-content {
      display: flex;
      align-items: center;
      gap: 48px;
    }
    .hook-text {
      flex: 1;
    }
    .hook-illust {
      flex-shrink: 0;
    }
    .hook-accent {
      width: 60px;
      height: 5px;
      background: ${B.coral};
      border-radius: 3px;
      margin-top: 8px;
    }
  </style></head><body>
    <div class="slide">
      <div class="top-bar">
        <div class="slide-pill">${slide.slideNumber} / ${total}</div>
        <span class="brand-tag">${escapeHtml(title.toUpperCase())}</span>
      </div>
      <div class="hook-main">
        <div class="hook-content">
          <div class="hook-text">
            <h1 class="hook-headline serif">${headline}</h1>
            ${subtitle ? `<p class="hook-subtitle">${subtitle}</p>` : ''}
            <div class="hook-accent"></div>
          </div>
          <div class="hook-illust">${illustration}</div>
        </div>
      </div>
      <div class="bottom-brand">MerakiPeople</div>
      ${dotsHtml(slide.slideNumber, total)}
    </div>
  </body></html>`;
}

function contentSlideHtml(slide: CarouselSlideInput, total: number, title: string, W = 1080, H = 1080): string {
  const content = escapeHtml(slide.content);
  const lines = content.split('\n').filter(l => l.trim());
  const hasHeadline = lines.length > 1 && lines[0].length < 100;
  const headline = hasHeadline ? lines[0] : '';
  const body = hasHeadline ? lines.slice(1).join('<br><br>') : content;
  const headSize = headline.length <= 40 ? 36 : headline.length <= 70 ? 30 : 24;
  const bodyLen = body.replace(/<br>/g, '').length;
  const bodySize = bodyLen <= 100 ? 22 : bodyLen <= 200 ? 19 : bodyLen <= 350 ? 17 : 15;
  const illustration = pickIllustration(slide.content, slide.type || 'content', slide.slideNumber, total);

  // Detect if content has bullet-like items (for feature-card layout)
  const bulletItems = content.split('\n').filter(l => /^[-•\d]/.test(l.trim()));
  const useFeatureLayout = bulletItems.length >= 3 && bulletItems.length <= 4;

  if (useFeatureLayout) {
    return featureSlideHtml(slide, total, title, headline, bulletItems, W, H);
  }

  return `<!DOCTYPE html><html><head>${fontLinks()}<style>${baseStyles(W, H)}
    .content-body-area {
      flex: 1;
      display: flex;
      gap: 40px;
      align-items: center;
    }
    .content-card-main {
      flex: 1;
      background: ${B.cardBg};
      border-radius: 20px;
      padding: 48px 52px;
      box-shadow: 0 2px 24px rgba(0,0,0,0.04);
      position: relative;
    }
    .content-card-main::before {
      content: '';
      position: absolute;
      left: 0;
      top: 28px;
      bottom: 28px;
      width: 5px;
      background: ${B.coral};
      border-radius: 0 3px 3px 0;
    }
    .content-head {
      font-size: ${headSize}px;
      color: ${B.headBlack};
      line-height: 1.25;
      margin-bottom: 20px;
    }
    .content-text {
      font-size: ${bodySize}px;
      color: ${B.bodyGrey};
      line-height: 1.75;
    }
    .content-text strong, .content-text b {
      font-weight: 600;
      color: ${B.headBlack};
    }
    .content-illust {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .slide-num-watermark {
      position: absolute;
      top: 20px;
      right: 32px;
      font-size: 80px;
      font-weight: 800;
      color: ${B.navy};
      opacity: 0.04;
      line-height: 1;
    }
  </style></head><body>
    <div class="slide">
      <div class="top-bar">
        <div class="slide-pill">${slide.slideNumber} / ${total}</div>
        <span class="brand-tag">${escapeHtml(title.toUpperCase())}</span>
      </div>
      <div class="content-body-area">
        <div class="content-card-main">
          <div class="slide-num-watermark">${String(slide.slideNumber).padStart(2, '0')}</div>
          ${headline ? `<h2 class="content-head serif">${headline}</h2>` : ''}
          <div class="content-text">${formatBody(body)}</div>
        </div>
        <div class="content-illust">${illustration}</div>
      </div>
      <div class="bottom-brand">MerakiPeople</div>
      ${dotsHtml(slide.slideNumber, total)}
    </div>
  </body></html>`;
}

/** Feature-card layout for slides with 3-4 bullet points */
function featureSlideHtml(slide: CarouselSlideInput, total: number, title: string, headline: string, items: string[], W = 1080, H = 1080): string {
  const icons = ['💡', '⚡', '🎯', '🔑'];
  const bgColors = [B.coralLight, B.navyTint, B.tealLight, B.coralLight];

  const cards = items.map((item, i) => {
    const clean = item.replace(/^[-•\d.)\s]+/, '').trim();
    return `<div class="feature-card">
      <div class="feature-icon" style="background:${bgColors[i % bgColors.length]}">${icons[i % icons.length]}</div>
      <div class="feature-desc" style="font-size:16px;color:${B.bodyGrey};font-weight:500">${escapeHtml(clean)}</div>
    </div>`;
  }).join('');

  const headSize = headline.length <= 50 ? 36 : 28;

  return `<!DOCTYPE html><html><head>${fontLinks()}<style>${baseStyles(W, H)}
    .feat-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 32px;
    }
    .feat-headline {
      font-size: ${headSize}px;
      color: ${B.headBlack};
      line-height: 1.2;
      text-align: center;
    }
    .feat-sub {
      font-size: 18px;
      color: ${B.mutedGrey};
      text-align: center;
      max-width: 700px;
      margin: 0 auto;
      line-height: 1.5;
    }
  </style></head><body>
    <div class="slide">
      <div class="top-bar">
        <div class="slide-pill">${slide.slideNumber} / ${total}</div>
        <span class="brand-tag">${escapeHtml(title.toUpperCase())}</span>
      </div>
      <div class="feat-body">
        ${headline ? `<h2 class="feat-headline serif">${headline}</h2>` : ''}
        <div class="feature-row">${cards}</div>
      </div>
      <div class="bottom-brand">MerakiPeople</div>
      ${dotsHtml(slide.slideNumber, total)}
    </div>
  </body></html>`;
}

function ctaSlideHtml(slide: CarouselSlideInput, total: number, title: string, W = 1080, H = 1080): string {
  const content = escapeHtml(slide.content);
  const lines = content.split('\n').filter(l => l.trim());
  const headline = lines[0] || content;
  const subtitle = lines.length > 1 ? lines.slice(1).join('<br>') : '';
  const hSize = headline.length <= 60 ? 44 : headline.length <= 100 ? 36 : 28;

  return `<!DOCTYPE html><html><head>${fontLinks()}<style>${baseStyles(W, H)}
    .cta-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      gap: 28px;
    }
    .cta-headline {
      font-size: ${hSize}px;
      color: ${B.headBlack};
      line-height: 1.2;
      max-width: 800px;
    }
    .cta-sub {
      font-size: 19px;
      color: ${B.mutedGrey};
      line-height: 1.6;
      max-width: 650px;
    }
    .cta-divider {
      width: 50px;
      height: 4px;
      background: ${B.coral};
      border-radius: 2px;
    }
    .cta-button {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 18px 44px;
      background: ${B.coral};
      border-radius: 50px;
      color: white;
      font-size: 18px;
      font-weight: 700;
      letter-spacing: 0.3px;
      box-shadow: 0 6px 24px rgba(255,111,97,0.3);
    }
    .cta-url {
      margin-top: 12px;
      font-size: 16px;
      font-weight: 600;
      color: ${B.navy};
      opacity: 0.6;
    }
  </style></head><body>
    <div class="slide">
      <div class="top-bar">
        <div class="slide-pill">${slide.slideNumber} / ${total}</div>
        <span class="brand-tag">${escapeHtml(title.toUpperCase())}</span>
      </div>
      <div class="cta-body">
        <h1 class="cta-headline serif">${headline}</h1>
        ${subtitle ? `<p class="cta-sub">${subtitle}</p>` : ''}
        <div class="cta-divider"></div>
        <div class="cta-button">Follow for more →</div>
        <div class="cta-url">merakipeople.ai</div>
      </div>
      <div class="bottom-brand">MerakiPeople</div>
      ${dotsHtml(slide.slideNumber, total)}
    </div>
  </body></html>`;
}

/* ─────────────────────────────────────────────
   Text Helpers
   ───────────────────────────────────────────── */

function escapeHtml(s: string): string {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatBody(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^[-\u2022]\s*/gm, `<span style="color:${B.coral};margin-right:8px;">●</span> `)
    .replace(/^\d+\.\s*/gm, (m) => `<span style="color:${B.coral};font-weight:700;margin-right:8px;">${m.trim()}</span> `);
}

/* ═══════════════════════════════════════════════════
   MAIN: Generate carousel PDF via Puppeteer
   ═══════════════════════════════════════════════════ */

export async function generateCarouselPdf(
  slides: CarouselSlideInput[],
  postId: string,
  title: string = 'Carousel',
  author: string = '',
  aspectRatio: string = '1:1'
): Promise<CarouselPdfResult> {
  if (!slides || slides.length === 0) {
    throw new Error('No carousel slides provided');
  }

  const [W, H] = ASPECT_RATIOS[aspectRatio] || ASPECT_RATIOS['1:1'];
  console.log(`[carouselPdf] Generating ${slides.length}-slide carousel (${W}x${H}, ${aspectRatio}) via Puppeteer...`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const slideImageUrls: string[] = [];
  const slideBuffers: Buffer[] = [];

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: W, height: H, deviceScaleFactor: 2 });

    // Pre-load Google Fonts once on a blank page
    await page.setContent(`<!DOCTYPE html><html><head>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    </head><body><p style="font-family:'DM Serif Display'">.</p><p style="font-family:'Inter'">.</p></body></html>`, {
      waitUntil: 'networkidle2',
      timeout: 10000,
    }).catch(() => console.warn('[carouselPdf] Font preload timed out, using fallbacks'));

    // Wait for fonts to be ready (with timeout)
    await Promise.race([
      page.evaluate(() => document.fonts.ready),
      new Promise(r => setTimeout(r, 5000)),
    ]);
    console.log('[carouselPdf] Fonts loaded, rendering slides...');

    for (const slide of slides) {
      let html: string;
      switch (slide.type) {
        case 'hook':  html = hookSlideHtml(slide, slides.length, title, W, H); break;
        case 'cta':   html = ctaSlideHtml(slide, slides.length, title, W, H); break;
        default:      html = contentSlideHtml(slide, slides.length, title, W, H); break;
      }

      // Use domcontentloaded — fonts are already cached from preload
      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 5000 });
      // Small delay to let layout settle
      await new Promise(r => setTimeout(r, 200));

      const screenshot = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: W, height: H } });
      const buf = Buffer.isBuffer(screenshot) ? screenshot : Buffer.from(screenshot);
      slideBuffers.push(buf);
      console.log(`[carouselPdf] Slide ${slide.slideNumber}/${slides.length} rendered (${(buf.length / 1024).toFixed(0)} KB)`);
    }
  } finally {
    await browser.close();
  }

  // Assemble into PDF
  const doc = new PDFDocument({
    size: [W, H],
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    info: { Title: title, Author: author || 'MerakiPeople', Creator: 'The Signal — MerakiPeople Growth OS' },
  });

  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const pdfReady = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  for (let i = 0; i < slideBuffers.length; i++) {
    if (i > 0) doc.addPage();
    doc.image(slideBuffers[i], 0, 0, { width: W, height: H });
  }

  doc.end();
  const pdfBuffer = await pdfReady;
  console.log(`[carouselPdf] PDF assembled: ${slides.length} pages (${(pdfBuffer.length / 1024).toFixed(0)} KB)`);

  // Save individual slides
  const tmpDir = path.join(os.tmpdir(), 'signal-carousels', postId);
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  for (let i = 0; i < slideBuffers.length; i++) {
    fs.writeFileSync(path.join(tmpDir, `slide-${i + 1}.png`), slideBuffers[i]);
    slideImageUrls.push(`/api/posts/${postId}/carousel-slide/${i + 1}`);
  }

  // Store PDF
  if (isAzureConfigured()) {
    try {
      const blobName = `posts/${postId}/carousel.pdf`;
      const pdfUrl = await uploadImageToAzure(pdfBuffer, blobName, 'application/pdf');
      return { pdfUrl, isPermanent: true, slideCount: slides.length, slideImageUrls };
    } catch (azureErr: any) {
      console.warn(`[carouselPdf] Azure upload failed: ${azureErr.message}`);
    }
  }

  const pdfDir = path.join(os.tmpdir(), 'signal-carousels');
  if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
  fs.writeFileSync(path.join(pdfDir, `${postId}.pdf`), pdfBuffer);

  return {
    pdfUrl: `/api/posts/${postId}/carousel-pdf`,
    isPermanent: false,
    slideCount: slides.length,
    slideImageUrls,
  };
}
