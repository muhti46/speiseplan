import jsPDF from 'jspdf';
import { WeeklyPlan } from '../types/menu';
import { formatHauptspeiseWithBeilage } from './format';
import { getWeekRange } from './generator';

const DAYS_DE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

function formatDate(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${date.getFullYear()}`;
}

/**
 * Erstellt den Speiseplan-Aushang (A4 quer) im Format des Hauses: Kopf mit Einrichtung und
 * Zeitraum (Montag bis Sonntag), Tabelle Vorspeise / Hauptgericht / Nachspeise. Samstag und
 * Sonntag bleiben leer ("Nach Wahl der Kinder- und Jugendlichen"). Der aushängende Plan ist
 * bewusst immer deutsch, unabhängig von der App-Sprache.
 */
export function exportWeeklyPlanPdf(plan: WeeklyPlan): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  const left = 15;
  const { start, end } = getWeekRange(plan.calendarWeek, plan.year);

  // Kopf: Einrichtung links, Titel und Zeitraum mittig/rechts
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(['Schottener Soziale Dienste', 'WG - Weilburg'], left, 22);
  doc.text(['Limburger Straße 20', '35781 Weilburg'], left, 34);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.text('Speiseplan', 148.5, 26, { align: 'center' });
  doc.setFontSize(16);
  doc.text(`Von :  ${formatDate(start)}`, 105, 46, { align: 'center' });
  doc.text(`Bis: ${formatDate(end)}`, 235, 46, { align: 'center' });

  // Tabelle
  const colW = [46, 58, 98, 65];
  const colX = colW.map((_, i) => left + colW.slice(0, i).reduce((a, b) => a + b, 0));
  const tableW = colW.reduce((a, b) => a + b, 0);
  const headH = 12;
  const rowH = 16;
  const top = 58;

  doc.setLineWidth(0.4);
  doc.setDrawColor(40);
  doc.rect(left, top, tableW, headH + rowH * 7);
  doc.line(left, top + headH, left + tableW, top + headH);
  for (let i = 1; i < colW.length; i++) doc.line(colX[i], top, colX[i], top + headH + rowH * 7);
  for (let r = 1; r < 7; r++) {
    const ry = top + headH + rowH * r;
    // Zwischen Samstag und Sonntag die "Nach Wahl"-Zelle (Tageszelle rechts) nicht durchkreuzen
    if (r === 6) {
      doc.line(left, ry, left + 26, ry);
      doc.line(colX[1], ry, left + tableW, ry);
    } else {
      doc.line(left, ry, left + tableW, ry);
    }
  }

  doc.setFontSize(13);
  ['Vorspeise', 'Hauptgericht', 'Nachspeise'].forEach((label, i) => {
    doc.text(label, colX[i + 1] + 2, top + headH / 2 + 1.5);
  });

  const cell = (text: string, col: number, row: number) => {
    const lines: string[] = doc.splitTextToSize(text, colW[col] - 4);
    const lineH = 5;
    const y0 = top + headH + rowH * row + (rowH - lines.length * lineH) / 2 + 3.6;
    doc.text(lines, colX[col] + 2, y0);
  };

  DAYS_DE.forEach((dayName, row) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    cell(dayName, 0, row);
    const day = plan.days[row];
    if (row < 5 && day) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      cell(day.vorspeise.name, 1, row);
      cell(formatHauptspeiseWithBeilage(day, 'de'), 2, row);
      cell(day.nachspeise.name, 3, row);
    }
  });

  // Hinweis für das Wochenende (über beide Zeilen, rechts in der Tageszelle)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  const noteX = colX[0] + 26;
  const noteTop = top + headH + rowH * 5;
  doc.line(noteX, noteTop, noteX, noteTop + rowH * 2);
  doc.text(['Nach Wahl', 'der Kinder-', 'und', 'Jugendlichen'], noteX + 1.5, noteTop + rowH - 6);

  // Unterschriftszeile
  doc.setFontSize(10);
  doc.line(110, 199, 190, 199);
  doc.text('Einrichtungsleitung', 110, 204);

  doc.save(`Speiseplan_KW${plan.calendarWeek}_${plan.year}.pdf`);
}
