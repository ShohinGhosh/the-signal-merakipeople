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
  /** The PDF URL (Azure Blob or local temp path) */
  pdfUrl: string;
  /** Whether the PDF is stored permanently */
  isPermanent: boolean;
  /** Number of slides rendered */
  slideCount: number;
}

/**
 * Brand colours from The Signal design system
 */
const BRAND = {
  coral: '#FF6B6B',
  coralLight: '#FFF0F0',
  indigo: '#1E1B4B',
  indigoDark: '#0F0D2E',
  slate50: '#F8FAFC',
  slate100: '#F1F5F9',
  slate300: '#CBD5E1',
  slate500: '#64748B',
  slate700: '#334155',
  slate900: '#0F172A',
  white: '#FFFFFF',
  purple: '#8B5CF6',
  purpleLight: '#F5F3FF',
};

/**
 * Slide type colour accents
 */
const SLIDE_ACCENTS: Record<string, { bg: string; accent: string; label: string }> = {
  hook: { bg: BRAND.coralLight, accent: BRAND.coral, label: 'HOOK' },
  content: { bg: BRAND.slate50, accent: BRAND.indigo, label: 'CONTENT' },
  cta: { bg: BRAND.purpleLight, accent: BRAND.purple, label: 'CTA' },
};

/**
 * Generates a carousel PDF from slide outline data.
 *
 * Each slide becomes a full page:
 * - Slide number + type badge in the header
 * - Large readable content text
 * - Branded footer
 *
 * PDF is 1080×1080px (LinkedIn carousel standard), landscape-style.
 *
 * @param slides - The carousel slide outline
 * @param postId - Post ID (for file naming)
 * @param title - Content pillar or post topic (shown as deck title)
 * @param author - Post author name
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

  // Create PDF at 1080x1080 (LinkedIn carousel format)
  const pageSize = 540; // Points (1 point = 1/72 inch, 540pt ≈ 7.5 inches ≈ 1080px at 144dpi)
  const doc = new PDFDocument({
    size: [pageSize, pageSize],
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
    info: {
      Title: title,
      Author: author || 'The Signal',
      Creator: 'The Signal — MerakiPeople Growth OS',
    },
  });

  // Collect PDF buffer
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  const pdfReady = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const contentWidth = pageSize - 100; // 50px margin each side

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    const accent = SLIDE_ACCENTS[slide.type] || SLIDE_ACCENTS.content;

    if (i > 0) doc.addPage();

    // ── Background ──
    doc.rect(0, 0, pageSize, pageSize).fill(BRAND.white);

    // ── Accent bar at top ──
    doc.rect(0, 0, pageSize, 6).fill(accent.accent);

    // ── Slide number badge ──
    const badgeY = 30;
    doc.roundedRect(50, badgeY, 36, 24, 4).fill(accent.accent);
    doc.fontSize(11).fill(BRAND.white).text(
      String(slide.slideNumber || i + 1),
      50,
      badgeY + 6,
      { width: 36, align: 'center' }
    );

    // ── Type label ──
    doc.fontSize(9).fill(accent.accent).text(
      accent.label,
      96,
      badgeY + 7
    );

    // ── Deck title (small, top-right) ──
    doc.fontSize(8).fill(BRAND.slate300).text(
      title.toUpperCase(),
      pageSize - 250,
      badgeY + 8,
      { width: 200, align: 'right' }
    );

    // ── Main content area ──
    const contentY = 90;
    const maxContentHeight = pageSize - 160; // Leave room for footer

    // Choose font size based on content length
    let fontSize = 28;
    if (slide.content.length > 200) fontSize = 20;
    else if (slide.content.length > 120) fontSize = 24;
    else if (slide.content.length <= 50) fontSize = 36;

    doc.fontSize(fontSize).fill(BRAND.slate900);

    // For hook slides, use bold/italic styling feel
    if (slide.type === 'hook') {
      doc.font('Helvetica-Bold');
    } else if (slide.type === 'cta') {
      doc.font('Helvetica-Bold');
    } else {
      doc.font('Helvetica');
    }

    doc.text(slide.content, 50, contentY, {
      width: contentWidth,
      height: maxContentHeight,
      lineGap: 8,
      paragraphGap: 12,
    });

    // ── Footer ──
    const footerY = pageSize - 40;

    // Divider line
    doc.moveTo(50, footerY - 10).lineTo(pageSize - 50, footerY - 10).strokeColor(BRAND.slate100).lineWidth(1).stroke();

    // Page number
    doc.font('Helvetica').fontSize(9).fill(BRAND.slate300).text(
      `${i + 1} / ${slides.length}`,
      50,
      footerY,
      { width: contentWidth, align: 'center' }
    );

    // Brand mark
    doc.fontSize(7).fill(BRAND.slate300).text(
      'The Signal · MerakiPeople',
      50,
      footerY,
      { width: contentWidth, align: 'right' }
    );
  }

  doc.end();
  const pdfBuffer = await pdfReady;

  console.log(`[carouselPdf] Generated ${slides.length}-slide PDF (${(pdfBuffer.length / 1024).toFixed(1)} KB)`);

  // Upload to Azure if configured
  if (isAzureConfigured()) {
    const blobName = `posts/${postId}/carousel.pdf`;
    const pdfUrl = await uploadImageToAzure(pdfBuffer, blobName, 'application/pdf');
    console.log(`[carouselPdf] Uploaded to Azure: ${blobName}`);
    return { pdfUrl, isPermanent: true, slideCount: slides.length };
  }

  // Fallback: save to temp directory and serve from there
  const tmpDir = path.join(os.tmpdir(), 'signal-carousels');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const tmpPath = path.join(tmpDir, `${postId}.pdf`);
  fs.writeFileSync(tmpPath, pdfBuffer);
  console.log(`[carouselPdf] Saved locally: ${tmpPath}`);

  return { pdfUrl: `/api/posts/${postId}/carousel-pdf`, isPermanent: false, slideCount: slides.length };
}
