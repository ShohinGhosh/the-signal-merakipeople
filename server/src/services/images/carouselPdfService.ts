import PDFDocument from 'pdfkit';
import { uploadImageToAzure, isAzureConfigured } from './azureBlobClient';
import { generateImageWithGemini, isGeminiImageAvailable } from './geminiImageClient';
import { generateImage } from './falClient';
import { isImageGenerationAvailable } from './imageService';
import fs from 'fs';
import path from 'path';
import os from 'os';

export interface CarouselSlideInput {
  slideNumber: number;
  content: string;
  type: 'hook' | 'content' | 'cta';
}

export interface CarouselPdfResult {
  /** The PDF URL (Azure Blob or local temp path) */
  pdfUrl: string;
  /** Whether the PDF is stored permanently */
  isPermanent: boolean;
  /** Number of slides rendered */
  slideCount: number;
  /** Individual slide image URLs (for preview) */
  slideImageUrls: string[];
}

/* ─────────────────────────────────────────────
   Brand Design System — The Signal
   ───────────────────────────────────────────── */
const C = {
  // Primary palette
  navy:        '#0F0D2E',
  navyMid:     '#1E1B4B',
  navyLight:   '#2D2A5E',
  indigo:      '#4338CA',
  indigoLight: '#6366F1',

  // Accent
  coral:       '#FF6B6B',
  coralSoft:   '#FF8A8A',
  coralGlow:   '#FF5252',
  amber:       '#F59E0B',
  emerald:     '#10B981',

  // Neutral
  white:       '#FFFFFF',
  white90:     '#E8E8F0',
  white60:     '#9B9BB0',
  white40:     '#6B6B80',
  slate50:     '#F8FAFC',
  slate100:    '#F1F5F9',
  slate200:    '#E2E8F0',
  slate700:    '#334155',
  slate900:    '#0F172A',

  // Gradients (as pairs)
  gradDark:    ['#0F0D2E', '#1E1B4B'],
  gradCoral:   ['#FF6B6B', '#FF5252'],
  gradIndigo:  ['#4338CA', '#6366F1'],
};

const PAGE = 540; // 540pt = 1080px at 2x

/* ─────────────────────────────────────────────
   Helper: draw a rounded rectangle path
   ───────────────────────────────────────────── */
function roundedRect(
  doc: InstanceType<typeof PDFDocument>,
  x: number, y: number, w: number, h: number, r: number
) {
  doc.moveTo(x + r, y)
     .lineTo(x + w - r, y)
     .quadraticCurveTo(x + w, y, x + w, y + r)
     .lineTo(x + w, y + h - r)
     .quadraticCurveTo(x + w, y + h, x + w - r, y + h)
     .lineTo(x + r, y + h)
     .quadraticCurveTo(x, y + h, x, y + h - r)
     .lineTo(x, y + r)
     .quadraticCurveTo(x, y, x + r, y);
}

/* ─────────────────────────────────────────────
   Helper: draw decorative geometric elements
   ───────────────────────────────────────────── */
function drawDecoCircles(
  doc: InstanceType<typeof PDFDocument>,
  variant: number
) {
  doc.save();
  doc.opacity(0.06);

  if (variant % 3 === 0) {
    // Large circle top-right
    doc.circle(PAGE + 40, -40, 200).fill(C.coral);
    // Small circle bottom-left
    doc.circle(-20, PAGE + 20, 80).fill(C.indigoLight);
  } else if (variant % 3 === 1) {
    // Ring top-left
    doc.circle(-60, -60, 160).lineWidth(30).strokeColor(C.indigoLight).stroke();
    // Dot cluster bottom-right
    doc.circle(PAGE - 60, PAGE - 80, 40).fill(C.coral);
    doc.circle(PAGE - 20, PAGE - 40, 20).fill(C.coralSoft);
  } else {
    // Diagonal stripe
    doc.save();
    doc.moveTo(PAGE - 180, 0).lineTo(PAGE, 0).lineTo(PAGE, 180).closePath().fill(C.indigo);
    doc.restore();
    // Bottom-left arc
    doc.circle(0, PAGE, 120).fill(C.indigoLight);
  }

  doc.restore();
}

/* ─────────────────────────────────────────────
   Helper: draw the accent bar + slide badge
   ───────────────────────────────────────────── */
function drawSlideHeader(
  doc: InstanceType<typeof PDFDocument>,
  slideNum: number,
  totalSlides: number,
  slideType: string,
  deckTitle: string,
  useLightTheme: boolean
) {
  const textColor = useLightTheme ? C.slate900 : C.white;
  const mutedColor = useLightTheme ? C.white40 : C.white60;

  // Top accent gradient bar
  const grad = doc.linearGradient(0, 0, PAGE, 0);
  grad.stop(0, C.coral).stop(1, C.indigo);
  doc.rect(0, 0, PAGE, 5).fill(grad);

  // Slide number pill
  const pillX = 40;
  const pillY = 24;
  const pillW = 44;
  const pillH = 26;
  doc.save();
  roundedRect(doc, pillX, pillY, pillW, pillH, 13);
  doc.fill(C.coral);
  doc.restore();

  doc.font('Helvetica-Bold').fontSize(11).fill(C.white);
  doc.text(`${slideNum}`, pillX, pillY + 7, { width: pillW, align: 'center' });

  // Type label next to pill
  const typeLabel = slideType === 'hook' ? 'HOOK' : slideType === 'cta' ? 'CTA' : 'INSIGHT';
  doc.font('Helvetica-Bold').fontSize(8).fill(mutedColor);
  doc.text(typeLabel, pillX + pillW + 10, pillY + 9);

  // Deck title — right aligned
  doc.font('Helvetica').fontSize(8).fill(mutedColor);
  doc.text(deckTitle.toUpperCase(), PAGE - 250, pillY + 9, { width: 210, align: 'right' });
}

/* ─────────────────────────────────────────────
   Helper: draw footer
   ───────────────────────────────────────────── */
function drawFooter(
  doc: InstanceType<typeof PDFDocument>,
  slideNum: number,
  totalSlides: number,
  useLightTheme: boolean
) {
  const y = PAGE - 36;
  const mutedColor = useLightTheme ? C.white40 : C.white40;

  // Thin separator line
  doc.save();
  doc.opacity(0.15);
  doc.moveTo(40, y - 8).lineTo(PAGE - 40, y - 8)
    .lineWidth(0.5).strokeColor(useLightTheme ? C.slate200 : C.white).stroke();
  doc.restore();

  // Page indicator dots
  const dotY = y + 4;
  const dotSpacing = 14;
  const totalWidth = (totalSlides - 1) * dotSpacing;
  const startX = (PAGE - totalWidth) / 2;

  for (let i = 0; i < totalSlides; i++) {
    const isActive = i === slideNum - 1;
    doc.circle(startX + i * dotSpacing, dotY, isActive ? 4 : 2.5)
      .fill(isActive ? C.coral : mutedColor);
  }

  // Branding
  doc.font('Helvetica').fontSize(7).fill(mutedColor);
  doc.text('The Signal', 40, y, { width: 100 });
  doc.text('MerakiPeople', PAGE - 140, y, { width: 100, align: 'right' });
}

/* ─────────────────────────────────────────────
   Helper: smart text sizing
   ───────────────────────────────────────────── */
function getContentFontSize(text: string, isHero: boolean): number {
  const len = text.length;
  if (isHero) {
    if (len <= 40) return 42;
    if (len <= 80) return 36;
    if (len <= 120) return 30;
    if (len <= 180) return 26;
    return 22;
  }
  if (len <= 60) return 30;
  if (len <= 120) return 24;
  if (len <= 200) return 20;
  if (len <= 300) return 17;
  return 15;
}

/* ═════════════════════════════════════════════
   SLIDE RENDERERS — one per slide type
   ═════════════════════════════════════════════ */

/**
 * HOOK slide: Dark background, big bold text, coral accent
 * Inspired by premium deck cover slides
 */
function renderHookSlide(
  doc: InstanceType<typeof PDFDocument>,
  slide: CarouselSlideInput,
  totalSlides: number,
  title: string
) {
  // Deep dark gradient background
  const bgGrad = doc.linearGradient(0, 0, PAGE * 0.3, PAGE);
  bgGrad.stop(0, C.navy).stop(1, C.navyMid);
  doc.rect(0, 0, PAGE, PAGE).fill(bgGrad);

  // Decorative elements
  drawDecoCircles(doc, slide.slideNumber);

  // Large coral accent shape — bottom-left geometric
  doc.save();
  doc.opacity(0.12);
  doc.moveTo(0, PAGE * 0.65).lineTo(0, PAGE).lineTo(PAGE * 0.35, PAGE).closePath().fill(C.coral);
  doc.restore();

  // Vertical coral accent line on left
  doc.rect(40, 80, 4, PAGE - 160).fill(C.coral);

  // Header
  drawSlideHeader(doc, slide.slideNumber, totalSlides, 'hook', title, false);

  // Main hook text — large, bold, white
  const fontSize = getContentFontSize(slide.content, true);
  const textX = 60;
  const textW = PAGE - 120;
  const textY = PAGE * 0.22;

  doc.font('Helvetica-Bold').fontSize(fontSize).fill(C.white);
  doc.text(slide.content, textX, textY, {
    width: textW,
    lineGap: fontSize * 0.4,
    paragraphGap: fontSize * 0.3,
  });

  // Swipe prompt at bottom
  doc.save();
  doc.font('Helvetica').fontSize(10).fill(C.white60);
  doc.text('Swipe to learn more  \u2192', 0, PAGE - 60, { width: PAGE, align: 'center' });
  doc.restore();

  // Footer
  drawFooter(doc, slide.slideNumber, totalSlides, false);
}

/**
 * CONTENT slide: Clean light or dark alternating, structured layout
 */
function renderContentSlide(
  doc: InstanceType<typeof PDFDocument>,
  slide: CarouselSlideInput,
  totalSlides: number,
  title: string
) {
  const useDark = slide.slideNumber % 2 === 0;

  if (useDark) {
    // Dark variant
    const bgGrad = doc.linearGradient(0, 0, 0, PAGE);
    bgGrad.stop(0, C.navyMid).stop(1, C.navy);
    doc.rect(0, 0, PAGE, PAGE).fill(bgGrad);
  } else {
    // Light variant — soft off-white
    doc.rect(0, 0, PAGE, PAGE).fill(C.slate50);
    // Subtle navy side block
    doc.save();
    doc.opacity(0.04);
    doc.rect(0, 0, 8, PAGE).fill(C.navy);
    doc.restore();
  }

  const textColor = useDark ? C.white : C.slate900;
  const mutedColor = useDark ? C.white60 : C.white40;

  // Decorative elements
  drawDecoCircles(doc, slide.slideNumber);

  // Header
  drawSlideHeader(doc, slide.slideNumber, totalSlides, 'content', title, !useDark);

  // Content area with accent card
  const cardX = 40;
  const cardY = 70;
  const cardW = PAGE - 80;
  const cardH = PAGE - 130;

  // Subtle card background
  doc.save();
  doc.opacity(useDark ? 0.08 : 0.5);
  doc.roundedRect(cardX, cardY, cardW, cardH, 16)
    .fill(useDark ? C.white : C.white);
  doc.restore();

  // Left accent bar on card
  doc.roundedRect(cardX, cardY + 20, 4, cardH - 40, 2).fill(C.indigo);

  // Split content if it has line breaks or is long
  const contentLines = slide.content.split('\n').filter(l => l.trim());
  const hasMultipleParagraphs = contentLines.length > 1;

  if (hasMultipleParagraphs && contentLines[0].length < 80) {
    // First line as a headline
    const headSize = getContentFontSize(contentLines[0], true);
    doc.font('Helvetica-Bold').fontSize(Math.min(headSize, 28)).fill(textColor);
    doc.text(contentLines[0], cardX + 24, cardY + 36, {
      width: cardW - 48,
      lineGap: 8,
    });

    // Remaining lines as body
    const bodyText = contentLines.slice(1).join('\n');
    const bodySize = getContentFontSize(bodyText, false);
    doc.font('Helvetica').fontSize(Math.min(bodySize, 18)).fill(useDark ? C.white90 : C.slate700);
    doc.text(bodyText, cardX + 24, cardY + 36 + Math.min(headSize, 28) + 30, {
      width: cardW - 48,
      lineGap: 10,
      paragraphGap: 14,
    });
  } else {
    // Single block of text — centered vertically
    const fontSize = getContentFontSize(slide.content, false);
    const estimatedHeight = Math.ceil(slide.content.length / ((cardW - 48) / (fontSize * 0.5))) * (fontSize + 10);
    const textY = Math.max(cardY + 36, cardY + (cardH - estimatedHeight) / 2 - 10);

    doc.font('Helvetica-Bold').fontSize(fontSize).fill(textColor);
    doc.text(slide.content, cardX + 24, textY, {
      width: cardW - 48,
      lineGap: fontSize * 0.45,
      paragraphGap: fontSize * 0.3,
    });
  }

  // Footer
  drawFooter(doc, slide.slideNumber, totalSlides, !useDark);
}

/**
 * CTA slide: Bold, coral-accented, action-oriented
 */
function renderCtaSlide(
  doc: InstanceType<typeof PDFDocument>,
  slide: CarouselSlideInput,
  totalSlides: number,
  title: string
) {
  // Dark background with coral energy
  const bgGrad = doc.linearGradient(0, 0, PAGE, PAGE);
  bgGrad.stop(0, C.navy).stop(1, '#1a1145');
  doc.rect(0, 0, PAGE, PAGE).fill(bgGrad);

  // Large coral gradient circle — center-right
  doc.save();
  doc.opacity(0.1);
  doc.circle(PAGE * 0.7, PAGE * 0.5, 220).fill(C.coral);
  doc.restore();

  doc.save();
  doc.opacity(0.06);
  doc.circle(PAGE * 0.3, PAGE * 0.8, 140).fill(C.indigoLight);
  doc.restore();

  // Header
  drawSlideHeader(doc, slide.slideNumber, totalSlides, 'cta', title, false);

  // CTA content — centered, bold
  const fontSize = getContentFontSize(slide.content, true);
  const textW = PAGE - 100;
  const textX = 50;

  // Estimate text height for vertical centering
  const charsPerLine = Math.floor(textW / (fontSize * 0.5));
  const numLines = Math.ceil(slide.content.length / charsPerLine);
  const textHeight = numLines * (fontSize + fontSize * 0.4);
  const textY = Math.max(80, (PAGE - textHeight) / 2 - 30);

  doc.font('Helvetica-Bold').fontSize(fontSize).fill(C.white);
  doc.text(slide.content, textX, textY, {
    width: textW,
    align: 'center',
    lineGap: fontSize * 0.4,
  });

  // CTA button-style element
  const btnW = 220;
  const btnH = 48;
  const btnX = (PAGE - btnW) / 2;
  const btnY = textY + textHeight + 40;

  if (btnY < PAGE - 70) {
    // Coral gradient button
    const btnGrad = doc.linearGradient(btnX, btnY, btnX + btnW, btnY);
    btnGrad.stop(0, C.coral).stop(1, C.coralGlow);

    doc.save();
    doc.roundedRect(btnX, btnY, btnW, btnH, 24).fill(btnGrad);
    doc.restore();

    doc.font('Helvetica-Bold').fontSize(14).fill(C.white);
    doc.text('Follow for more \u2192', btnX, btnY + 16, { width: btnW, align: 'center' });
  }

  // Engagement icons row
  const iconsY = PAGE - 70;
  doc.save();
  doc.font('Helvetica').fontSize(20).fill(C.white60);
  doc.text('\u2764  \uD83D\uDCAC  \u2B06', 0, iconsY, { width: PAGE, align: 'center' });
  doc.restore();

  // Footer
  drawFooter(doc, slide.slideNumber, totalSlides, false);
}

/* ═════════════════════════════════════════════
   AI Image-based carousel (fal.ai Nano Banana Pro)
   ═════════════════════════════════════════════ */

function buildSlidePrompt(
  slide: CarouselSlideInput,
  totalSlides: number,
  title: string,
  author: string
): string {
  const slideType = slide.type;
  const slideNum = slide.slideNumber;

  let designInstruction = '';
  if (slideType === 'hook') {
    designInstruction = 'This is the opening hook slide. Bold, attention-grabbing typography. Use a strong visual hierarchy with the key phrase prominent. Dark or rich background with contrasting text. Make someone stop scrolling.';
  } else if (slideType === 'cta') {
    designInstruction = 'This is the final call-to-action slide. Clear, direct message. Include visual cues for engagement (arrow, hand, or comment icon). Use brand accent colour prominently. Professional but inviting.';
  } else {
    designInstruction = 'This is an informational content slide. Clean, readable layout. Use clear typography with good visual hierarchy. Include subtle design elements (lines, shapes, icons) to support the text. Professional and modern.';
  }

  return [
    `Create a 1:1 square social media carousel slide (slide ${slideNum} of ${totalSlides}).`,
    '',
    `SLIDE TEXT CONTENT:`,
    `"${slide.content}"`,
    '',
    `DESIGN REQUIREMENTS:`,
    designInstruction,
    '',
    `STYLE:`,
    `- Modern, minimal corporate design suitable for LinkedIn`,
    `- Clean sans-serif typography (no handwriting fonts)`,
    `- Text must be clearly readable and accurately rendered`,
    `- Use a consistent colour palette: deep navy (#1E1B4B), coral accent (#FF6B6B), white`,
    `- Include the slide number "${slideNum}/${totalSlides}" small in a corner`,
    `- No stock photos — use flat design, geometric shapes, or abstract patterns as background elements`,
    `- Brand: MerakiPeople — a growth consultancy. Use "MerakiPeople" as the brand name (NOT the author's personal name)`,
    `- Include a small "MerakiPeople" watermark or logo text in a corner`,
    `- Topic: ${title}`,
    '',
    `CRITICAL: The text content must be rendered accurately and legibly. This is the most important requirement.`,
  ].join('\n');
}

/**
 * Generates a carousel as AI-generated 1:1 images (via Nano Banana Pro on fal.ai),
 * then combines them into a multi-page PDF.
 */
export async function generateCarouselPdf(
  slides: CarouselSlideInput[],
  postId: string,
  title: string = 'Carousel',
  author: string = ''
): Promise<CarouselPdfResult> {
  if (!slides || slides.length === 0) {
    throw new Error('No carousel slides provided');
  }

  // Determine which image provider to use: Gemini (preferred) → fal.ai → text fallback
  const useGemini = isGeminiImageAvailable();
  const useFal = !useGemini && isImageGenerationAvailable();

  if (!useGemini && !useFal) {
    console.warn('[carouselPdf] No image API available (GEMINI_API_KEY / FAL_KEY not set), falling back to text PDF');
    return generateTextCarouselPdf(slides, postId, title, author);
  }

  const provider = useGemini ? 'Gemini' : 'fal.ai Nano Banana Pro';
  console.log(`[carouselPdf] Generating ${slides.length} slide images via ${provider}...`);

  const slideImageBuffers: Buffer[] = [];
  const slideImageUrls: string[] = [];

  // Generate slides sequentially for Gemini (rate limits), batch for fal.ai
  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    const prompt = buildSlidePrompt(slide, slides.length, title, author);

    try {
      let buffer: Buffer;
      let url = '';

      if (useGemini) {
        const result = await generateImageWithGemini(prompt);
        buffer = result.buffer;
        // Save locally for URL reference
        const tmpDir = path.join(os.tmpdir(), 'signal-carousels', postId);
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
        const slidePath = path.join(tmpDir, `slide-${slide.slideNumber}.png`);
        fs.writeFileSync(slidePath, buffer);
        url = slidePath;
      } else {
        const result = await generateImage(prompt, '1:1', '1K', 1);
        url = result.imageUrls[0];
        buffer = await fetchImageBuffer(url);
      }

      slideImageBuffers.push(buffer);
      slideImageUrls.push(url);
      console.log(`[carouselPdf] Slide ${slide.slideNumber}/${slides.length} generated (${(buffer.length / 1024).toFixed(1)} KB)`);
    } catch (err: any) {
      console.warn(`[carouselPdf] Failed to generate slide ${slide.slideNumber}: ${err.message}`);
    }
  }

  if (slideImageBuffers.length === 0) {
    console.warn('[carouselPdf] All slide image generations failed, falling back to text PDF');
    return generateTextCarouselPdf(slides, postId, title, author);
  }

  console.log(`[carouselPdf] ${slideImageBuffers.length}/${slides.length} slide images generated via ${provider}`);

  const pageSize = PAGE;
  const doc = new PDFDocument({
    size: [pageSize, pageSize],
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    info: {
      Title: title,
      Author: author || 'The Signal',
      Creator: 'The Signal \u2014 MerakiPeople Growth OS',
    },
  });

  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  const pdfReady = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  for (let i = 0; i < slideImageBuffers.length; i++) {
    if (i > 0) doc.addPage();
    doc.image(slideImageBuffers[i], 0, 0, { width: pageSize, height: pageSize });
  }

  doc.end();
  const pdfBuffer = await pdfReady;

  console.log(`[carouselPdf] PDF assembled: ${slideImageBuffers.length} pages (${(pdfBuffer.length / 1024).toFixed(1)} KB)`);

  if (isAzureConfigured()) {
    try {
      const blobName = `posts/${postId}/carousel.pdf`;
      const pdfUrl = await uploadImageToAzure(pdfBuffer, blobName, 'application/pdf');
      console.log(`[carouselPdf] Uploaded to Azure: ${blobName}`);
      return { pdfUrl, isPermanent: true, slideCount: slideImageBuffers.length, slideImageUrls };
    } catch (azureErr: any) {
      console.warn(`[carouselPdf] Azure upload failed, falling back to local: ${azureErr.message}`);
    }
  }

  const tmpDir = path.join(os.tmpdir(), 'signal-carousels');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const tmpPath = path.join(tmpDir, `${postId}.pdf`);
  fs.writeFileSync(tmpPath, pdfBuffer);
  console.log(`[carouselPdf] Saved locally: ${tmpPath}`);

  return {
    pdfUrl: `/api/posts/${postId}/carousel-pdf`,
    isPermanent: false,
    slideCount: slideImageBuffers.length,
    slideImageUrls,
  };
}

/* ═════════════════════════════════════════════
   Premium text-based carousel PDF
   (fallback when fal.ai is unavailable)
   ═════════════════════════════════════════════ */
async function generateTextCarouselPdf(
  slides: CarouselSlideInput[],
  postId: string,
  title: string,
  author: string
): Promise<CarouselPdfResult> {
  const doc = new PDFDocument({
    size: [PAGE, PAGE],
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    info: {
      Title: title,
      Author: author || 'The Signal',
      Creator: 'The Signal \u2014 MerakiPeople Growth OS',
    },
  });

  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  const pdfReady = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    if (i > 0) doc.addPage();

    // Dispatch to the appropriate renderer
    switch (slide.type) {
      case 'hook':
        renderHookSlide(doc, slide, slides.length, title);
        break;
      case 'cta':
        renderCtaSlide(doc, slide, slides.length, title);
        break;
      default:
        renderContentSlide(doc, slide, slides.length, title);
        break;
    }
  }

  doc.end();
  const pdfBuffer = await pdfReady;

  console.log(`[carouselPdf] Premium text PDF: ${slides.length} slides (${(pdfBuffer.length / 1024).toFixed(1)} KB)`);

  if (isAzureConfigured()) {
    try {
      const blobName = `posts/${postId}/carousel.pdf`;
      const pdfUrl = await uploadImageToAzure(pdfBuffer, blobName, 'application/pdf');
      return { pdfUrl, isPermanent: true, slideCount: slides.length, slideImageUrls: [] };
    } catch (azureErr: any) {
      console.warn(`[carouselPdf] Azure upload failed, falling back to local: ${azureErr.message}`);
    }
  }

  const tmpDir = path.join(os.tmpdir(), 'signal-carousels');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const tmpPath = path.join(tmpDir, `${postId}.pdf`);
  fs.writeFileSync(tmpPath, pdfBuffer);

  return {
    pdfUrl: `/api/posts/${postId}/carousel-pdf`,
    isPermanent: false,
    slideCount: slides.length,
    slideImageUrls: [],
  };
}

/**
 * Fetches an image from a URL and returns it as a Buffer.
 */
async function fetchImageBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
