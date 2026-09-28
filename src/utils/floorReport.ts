import type { jsPDF } from 'jspdf';
import type { Bundle } from '../types';
import { isCoated } from '../yardRules';

/** Grade as the floor sees it: epoxy-ordered bar is still black until the coat line coats it. */
export const reportGrade = (b: Bundle): string => (b.grade === 'Epoxy' && !isCoated(b) ? 'Epoxy (raw)' : b.grade);

/** `text` cut to fit `maxWidth` mm at the current font, ending in an ellipsis when cut. */
function fitText(doc: jsPDF, text: string, maxWidth: number): string {
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && doc.getTextWidth(`${cut}…`) > maxWidth) cut = cut.slice(0, -1);
  return `${cut}…`;
}

/**
 * Draws the plant-floor inventory report onto `doc` (A4 portrait, mm), one row per bundle,
 * breaking onto new pages as needed. Takes the document so jsPDF itself stays lazily loaded.
 */
export function buildFloorReport(doc: jsPDF, bundles: Bundle[], operatorName: string, now: Date = new Date()): jsPDF {
  // Colors setup (RGB)
  const primaryColor = [15, 23, 42]; // Slate 900
  const accentColor = [245, 158, 11]; // Amber 500
  const textColor = [51, 65, 85]; // Slate 700
  const headerTextColor = [255, 255, 255];
  const lightGray = [241, 245, 249]; // Slate 100
  const borderGray = [226, 232, 240]; // Slate 200

  // Add accent indicator bar at top
  doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.rect(0, 0, 210, 4, 'F');

  let yPos = 15;

  // Header Block
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('INDUSTRIAL REBAR MANUFACTURING PROCESS REPORT', 14, yPos);
  yPos += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); // Slate 500
  doc.text('Dynamic Real-Time Plant Floor Inventory Summary Log', 14, yPos);
  yPos += 10;

  // Add metadata information
  const timestamp = now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('REPORT GENERATED:', 14, yPos);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text(timestamp, 51, yPos);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('STATION OPERATOR:', 110, yPos);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text(operatorName, 146, yPos);
  yPos += 8;

  // Horizontal separator line
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.line(14, yPos, 196, yPos);
  yPos += 8;

  // Statistics Section (Summary KPIs)
  const totalWeight = bundles.reduce((sum, b) => sum + (b.weight || 0), 0);
  const totalTons = (totalWeight / 2000).toFixed(2);

  const countsByStatus = bundles.reduce<Record<string, { count: number; weight: number }>>((acc, b) => {
    if (!acc[b.status]) acc[b.status] = { count: 0, weight: 0 };
    acc[b.status].count += 1;
    acc[b.status].weight += b.weight || 0;
    return acc;
  }, {});

  // Draw statistics frames side by side (3 boxes)
  const boxW = 56;
  const boxH = 22;
  const startX = 14;

  // Box 1: Total Bundles on Floor
  doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.roundedRect(startX, yPos, boxW, boxH, 2, 2, 'FD');
  // Content Box 1
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL BUNDLES ON FLOOR', startX + 4, yPos + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(bundles.length.toString(), startX + 4, yPos + 15);

  // Box 2: Total Floor Load (Weight)
  const secX = startX + boxW + 6;
  doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
  doc.roundedRect(secX, yPos, boxW + 6, boxH, 2, 2, 'FD');
  // Content Box 2
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL ACTIVE PAYLOAD', secX + 4, yPos + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]); // Amber
  doc.text(`${totalWeight.toLocaleString()} lbs`, secX + 4, yPos + 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text(`(~ ${totalTons} short tons)`, secX + 4, yPos + 19);

  // Box 3: Epoxy vs Black Bar status
  const thirdX = secX + boxW + 12;
  const epoxyBundlesCount = bundles.filter(b => b.grade === 'Epoxy').length;
  const blackBundlesCount = bundles.filter(b => b.grade === 'Black').length;

  doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
  doc.roundedRect(thirdX, yPos, boxW - 2, boxH, 2, 2, 'FD');
  // Content Box 3
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('GRADE SPLIT (EPOXY / BLACK)', thirdX + 4, yPos + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(`${epoxyBundlesCount} Ep  /  ${blackBundlesCount} Bl`, thirdX + 4, yPos + 15);
  const rawEpoxyCount = bundles.filter(b => b.grade === 'Epoxy' && !isCoated(b)).length;
  if (rawEpoxyCount > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.text(`(${rawEpoxyCount} epoxy not yet coated)`, thirdX + 4, yPos + 19);
  }

  yPos += boxH + 10;

  // Status breakdown text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('PRODUCTION FLOW DISTRIBUTION SEGMENTATION:', 14, yPos);
  yPos += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);

  const statusDistributionText = Object.entries(countsByStatus)
    .map(([status, val]) => {
      const stats = val as { count: number; weight: number };
      return `${status}: ${stats.count} (${stats.weight.toLocaleString()} lbs)`;
    })
    .join('  |  ');

  // Wrap rather than run off the page when the yard holds many statuses
  const statusLines: string[] = doc.splitTextToSize(statusDistributionText, 182);
  doc.text(statusLines, 14, yPos);
  yPos += 8 + (statusLines.length - 1) * 3.5;

  // Horizontal delimiter
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.line(14, yPos, 196, yPos);
  yPos += 7;

  // Section Title: Detailed Inventory Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('DETAILED MANUFACTURE FLOOR CARDS & BUNDLES LISTING', 14, yPos);
  yPos += 5;

  // Table Header Row
  const tableHeaders = ['TAG ID', 'GRADE', 'BAR SIZE', 'LENGTH (FT)', 'WEIGHT (LBS)', 'STATUS', 'LOCATION'];
  const colX = [14, 42, 64, 86, 110, 138, 168]; // X Positions of columns

  // Draw Header Background
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(14, yPos, 182, 7, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(headerTextColor[0], headerTextColor[1], headerTextColor[2]);

  for (let i = 0; i < tableHeaders.length; i++) {
    doc.text(tableHeaders[i], colX[i] + 2, yPos + 5);
  }
  yPos += 7;

  // Sort bundles by status then tagId so it looks nicely organized
  const sortedBundles = [...bundles].sort((a, b) => {
    if (a.status !== b.status) return a.status.localeCompare(b.status);
    return a.tagId.localeCompare(b.tagId);
  });

  // Draw Rows
  let isAltRow = false;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  for (const b of sortedBundles) {
    // If row goes near page bottom boundary, insert a new page and redraw a simplified table header!
    if (yPos > 275) {
      doc.addPage();

      // top accent bar on next page too
      doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
      doc.rect(0, 0, 210, 4, 'F');

      yPos = 15;
      // Continued header title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text('DETAILED MANUFACTURE FLOOR LISTING (CONTINUED)', 14, yPos);
      yPos += 6;

      // Redraw table header on new page
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(14, yPos, 182, 7, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(headerTextColor[0], headerTextColor[1], headerTextColor[2]);
      for (let i = 0; i < tableHeaders.length; i++) {
        doc.text(tableHeaders[i], colX[i] + 2, yPos + 5);
      }
      yPos += 7;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
    }

    // Draw Row background if alternating
    if (isAltRow) {
      doc.setFillColor(248, 250, 252); // extremely light slate 50
      doc.rect(14, yPos, 182, 6.5, 'F');
    }

    doc.setTextColor(textColor[0], textColor[1], textColor[2]);

    doc.text(b.tagId, colX[0] + 2, yPos + 4.5);
    doc.text(reportGrade(b), colX[1] + 2, yPos + 4.5);
    doc.text(b.barSize, colX[2] + 2, yPos + 4.5);
    doc.text(b.length.toString(), colX[3] + 2, yPos + 4.5);
    doc.text(`${(b.weight || 0).toLocaleString()}`, colX[4] + 2, yPos + 4.5);

    // Status highlighting
    if (b.status === 'BENDING' || b.status === 'STAGED') {
      doc.setFont('helvetica', 'bold');
      if (b.status === 'BENDING') {
        doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]); // Amber
      } else {
        doc.setTextColor(99, 102, 241); // Indigo
      }
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    }
    doc.text(b.status, colX[5] + 2, yPos + 4.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);

    const locationStr = b.location ? b.location.replace('Bender-', '').replace('Shear-', '') : 'RAW STORAGE';
    doc.text(fitText(doc, locationStr, 196 - colX[6] - 3), colX[6] + 2, yPos + 4.5);

    yPos += 6.5;
    isAltRow = !isAltRow;
  }

  // Add Footer details
  if (yPos > 270) {
    doc.addPage();
    doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.rect(0, 0, 210, 4, 'F');
    yPos = 15;
  }

  yPos += 5;
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.line(14, yPos, 196, yPos);
  yPos += 5;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184); // Slate 400
  doc.text('Confidential Process Log Sheet - Steel Manufacturing Operations & Logistics Group. Generated via Operator Dashboard.', 14, yPos);

  // Stamp paginated dynamic page footprint markings
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text(`Page ${i} of ${totalPages}`, 180, 287);

    // Add footer branding separator
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.line(14, 282, 196, 282);
    doc.text('INDUSTRIAL LOGISTICS OPERATIONAL REPORT', 14, 285);
  }

  return doc;
}

/** The report's download name, e.g. plant_floor_inventory_report_2026-09-28.pdf */
export const floorReportFileName = (now: Date = new Date()) =>
  `plant_floor_inventory_report_${now.toISOString().substring(0, 10)}.pdf`;
