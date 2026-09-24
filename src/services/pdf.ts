import jsPDF from 'jspdf';
import { WeeklyPlan } from '../types/menu';
import { formatHauptspeiseWithBeilage } from './format';

/** Erstellt einen A4-Aushang des Wochenplans zum Ausdrucken für den Speisesaal. */
export function exportWeeklyPlanPdf(plan: WeeklyPlan): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const marginX = 18;
  let y = 20;

  doc.setFontSize(18);
  doc.text(`Speiseplan KW ${plan.calendarWeek} / ${plan.year}`, marginX, y);
  y += 10;

  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text('Kinderheim Weilburg · täglich 18:00 Uhr servierfertig', marginX, y);
  doc.setTextColor(0);
  y += 10;

  for (const day of plan.days) {
    if (y > 260) {
      doc.addPage();
      y = 20;
    }
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(day.dayOfWeek, marginX, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Vorbereitung ab ${day.prepStartTime} Uhr · Servieren ${day.targetServeTime} Uhr`, marginX + 60, y);
    y += 6;

    doc.setFontSize(11);
    doc.text(`Vorspeise: ${day.vorspeise.name}`, marginX + 4, y);
    y += 5.5;
    doc.text(`Hauptspeise: ${formatHauptspeiseWithBeilage(day)}`, marginX + 4, y);
    y += 5.5;
    doc.text(`Nachspeise: ${day.nachspeise.name}`, marginX + 4, y);
    y += 8;
  }

  doc.save(`Speiseplan_KW${plan.calendarWeek}_${plan.year}.pdf`);
}
