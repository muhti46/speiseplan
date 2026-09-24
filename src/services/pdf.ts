import jsPDF from 'jspdf';
import { WeeklyPlan } from '../types/menu';
import { formatHauptspeiseWithBeilage } from './format';
import { Lang, translations } from '../i18n/translations';

/** Erstellt einen A4-Aushang des Wochenplans zum Ausdrucken für den Speisesaal. */
export function exportWeeklyPlanPdf(plan: WeeklyPlan, lang: Lang): void {
  const t = translations[lang];
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const marginX = 18;
  let y = 20;

  doc.setFontSize(18);
  doc.text(t.pdf_headerTitle(plan.calendarWeek, plan.year), marginX, y);
  y += 10;

  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(t.pdf_subtitle, marginX, y);
  doc.setTextColor(0);
  y += 10;

  for (const day of plan.days) {
    if (y > 260) {
      doc.addPage();
      y = 20;
    }
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(t.dayLabels[day.dayOfWeek], marginX, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(t.pdf_prepServe(day.prepStartTime, day.targetServeTime), marginX + 60, y);
    y += 6;

    doc.setFontSize(11);
    doc.text(`${t.pdf_vorspeise}: ${day.vorspeise.name}`, marginX + 4, y);
    y += 5.5;
    doc.text(`${t.pdf_hauptspeise}: ${formatHauptspeiseWithBeilage(day, lang)}`, marginX + 4, y);
    y += 5.5;
    doc.text(`${t.pdf_nachspeise}: ${day.nachspeise.name}`, marginX + 4, y);
    y += 8;
  }

  doc.save(`Speiseplan_KW${plan.calendarWeek}_${plan.year}.pdf`);
}
