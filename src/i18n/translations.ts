import { Course, ProteinCategory, StoreCategory, SubCategory } from '../types/recipe';
import { DayOfWeek } from '../types/menu';

export type Lang = 'de' | 'tr';

export const LANGUAGES: Record<Lang, string> = {
  de: 'Deutsch',
  tr: 'Türkçe',
};

interface Translation {
  langName: string;
  appTitle: string;
  appSubtitle: string;
  tabs: { plan: string; einkauf: string; archiv: string; chat: string };
  generate: string;
  regenerate: string;
  nextWeek: (week: number) => string;
  weekLabel: (week: number, year: number) => string;
  noPlanYet: string;
  finalize: string;
  finalized: string;
  pdf: string;
  shoppingMon: string;
  shoppingFri: string;
  needPlanForShopping: string;
  archivedPlans: string;
  noArchivedPlans: string;
  noShoppingListFor: (title: string) => string;
  rerollDay: string;
  close: string;
  portions: (min: number, max: number) => string;
  prep: string;
  cook: string;
  total: string;
  ingredients: string;
  steps: string;
  startServe: (start: string, serve: string) => string;
  beilage: (name: string) => string;
  withConnector: string;
  dayLabels: Record<DayOfWeek, string>;
  proteinLabels: Record<ProteinCategory, string>;
  courseLabels: Record<Course, string>;
  subCategoryLabels: Record<SubCategory, string>;
  aisleLabels: Record<StoreCategory, string>;
  pdf_headerTitle: (week: number, year: number) => string;
  pdf_subtitle: string;
  pdf_prepServe: (start: string, serve: string) => string;
  pdf_vorspeise: string;
  pdf_hauptspeise: string;
  pdf_nachspeise: string;
  chatTitle: string;
  chatPlaceholder: string;
  chatSend: string;
  chatEmptyState: string;
  chatApiKeyLabel: string;
  chatApiKeyHint: string;
  chatApiKeyPlaceholder: string;
  chatApiKeySave: string;
  chatApiKeyClear: string;
  chatApiKeyClearConfirm: string;
  chatOffline: string;
  chatError: string;
  chatErrorAuth: string;
  chatErrorQuota: string;
  chatThinking: string;
  aiRecipeBadge: string;
  chatApiKeyInvalid: string;
  chatApiKeyValidating: string;
}

export const translations: Record<Lang, Translation> = {
  de: {
    langName: 'Deutsch',
    appTitle: 'Kinderheim Speiseplan',
    appSubtitle: 'Weilburg · 10–12 Personen',
    tabs: { plan: 'Speiseplan', einkauf: 'Einkauf', archiv: 'Archiv', chat: 'Chat' },
    generate: 'Wochenplan erzeugen',
    regenerate: 'Neu generieren',
    nextWeek: (week) => `Nächste Woche: KW ${week}`,
    weekLabel: (week, year) => `KW ${week} / ${year}`,
    noPlanYet: 'Noch kein Wochenplan. Mit einem Klick automatisch nach der 5-Tage-Protein-Regel erzeugen.',
    finalize: 'Plan freigeben & speichern',
    finalized: 'Freigegeben & gespeichert',
    pdf: 'PDF',
    shoppingMon: 'Einkauf Montag (Mo–Mi)',
    shoppingFri: 'Einkauf Freitag (Do–Fr)',
    needPlanForShopping: 'Erzeuge zuerst einen Wochenplan im Tab „Speiseplan“.',
    archivedPlans: 'Archivierte Wochenpläne',
    noArchivedPlans: 'Noch keine freigegebenen Pläne gespeichert.',
    noShoppingListFor: (title) => `Noch keine Einkaufsliste für ${title}. Erzeuge zuerst einen Wochenplan.`,
    rerollDay: 'Tag neu würfeln',
    close: 'Schließen',
    portions: (min, max) => `Portionen: ${min}–${max} Personen`,
    prep: 'Zubereitung',
    cook: 'Kochen',
    total: 'Gesamtzeit',
    ingredients: 'Zutaten',
    steps: 'Zubereitungsschritte',
    startServe: (start, serve) => `Start ${start} Uhr · Servieren ${serve} Uhr`,
    beilage: (name) => `Beilage: ${name}`,
    withConnector: 'mit',
    dayLabels: {
      Montag: 'Montag',
      Dienstag: 'Dienstag',
      Mittwoch: 'Mittwoch',
      Donnerstag: 'Donnerstag',
      Freitag: 'Freitag',
    },
    proteinLabels: {
      gefluegel: 'Geflügel',
      rind: 'Rindfleisch',
      fisch: 'Fisch',
      suess: 'Süße Hauptspeise',
      vegetarisch: 'Vegetarisch',
    },
    courseLabels: {
      vorspeise: 'Vorspeise',
      hauptspeise: 'Hauptspeise',
      nachspeise: 'Nachspeise',
    },
    subCategoryLabels: {
      suppe: 'Suppe',
      salat: 'Salat',
      beilage: 'Beilage',
      dessert: 'Dessert',
    },
    aisleLabels: {
      gemuese: 'Obst & Gemüse',
      kuehlung: 'Fleisch & Fisch (Kühlung)',
      mopro: 'Molkereiprodukte',
      trocken: 'Trockensortiment / Vorrat',
      tk: 'Tiefkühlware',
    },
    pdf_headerTitle: (week, year) => `Speiseplan KW ${week} / ${year}`,
    pdf_subtitle: 'Kinderheim Weilburg · täglich 18:00 Uhr servierfertig',
    pdf_prepServe: (start, serve) => `Vorbereitung ab ${start} Uhr · Servieren ${serve} Uhr`,
    pdf_vorspeise: 'Vorspeise',
    pdf_hauptspeise: 'Hauptspeise',
    pdf_nachspeise: 'Nachspeise',
    chatTitle: 'KI-Assistent',
    chatPlaceholder: 'Was soll ich tun?',
    chatSend: 'Senden',
    chatEmptyState: 'Frag mich z.B. „Füge ein neues Hauptgericht Linsen-Curry hinzu" oder „Tausche Dienstag Hähnchen gegen Fisch".',
    chatApiKeyLabel: 'Gemini API-Key',
    chatApiKeyHint: 'Der Key wird nur auf diesem Gerät gespeichert und direkt an Google Gemini gesendet (kein Server dazwischen).',
    chatApiKeyPlaceholder: 'API-Key einfügen',
    chatApiKeySave: 'Speichern',
    chatApiKeyClear: 'API-Key entfernen',
    chatApiKeyClearConfirm: 'Gespeicherten Gemini API-Key wirklich entfernen? Du musst ihn dann erneut eingeben.',
    chatOffline: 'Der Chat benötigt eine Internetverbindung.',
    chatError: 'Da ist etwas schiefgelaufen. Bitte versuche es erneut.',
    chatErrorAuth: 'Der Gemini API-Key scheint ungültig zu sein. Bitte im Chat-Header prüfen/erneuern.',
    chatErrorQuota: 'Gemini-Kontingent erschöpft. Bitte später erneut versuchen.',
    chatThinking: 'Denkt nach…',
    aiRecipeBadge: 'KI-generiert',
    chatApiKeyInvalid: 'Dieser API-Key wurde von Gemini abgelehnt. Bitte prüfen und erneut versuchen.',
    chatApiKeyValidating: 'Wird geprüft…',
  },
  tr: {
    langName: 'Türkçe',
    appTitle: 'Çocuk Yuvası Yemek Planı',
    appSubtitle: 'Weilburg · 10-12 Kişi',
    tabs: { plan: 'Yemek Planı', einkauf: 'Alışveriş', archiv: 'Arşiv', chat: 'Sohbet' },
    generate: 'Haftalık Plan Oluştur',
    regenerate: 'Yeniden Oluştur',
    nextWeek: (week) => `Gelecek hafta: ${week}. Hafta`,
    weekLabel: (week, year) => `${week}. Hafta / ${year}`,
    noPlanYet: 'Henüz haftalık plan yok. Tek tıkla 5 günlük protein kuralına göre otomatik oluştur.',
    finalize: 'Planı Onayla ve Kaydet',
    finalized: 'Onaylandı ve Kaydedildi',
    pdf: 'PDF',
    shoppingMon: 'Pazartesi Alışverişi (Pzt–Çrş)',
    shoppingFri: 'Cuma Alışverişi (Per–Cum)',
    needPlanForShopping: 'Önce "Yemek Planı" sekmesinde bir haftalık plan oluştur.',
    archivedPlans: 'Arşivlenmiş Haftalık Planlar',
    noArchivedPlans: 'Henüz onaylanmış bir plan kaydedilmedi.',
    noShoppingListFor: (title) => `${title} için henüz alışveriş listesi yok. Önce bir haftalık plan oluştur.`,
    rerollDay: 'Günü Yeniden Ata',
    close: 'Kapat',
    portions: (min, max) => `Porsiyon: ${min}–${max} kişi`,
    prep: 'Hazırlık',
    cook: 'Pişirme',
    total: 'Toplam Süre',
    ingredients: 'Malzemeler',
    steps: 'Hazırlanış',
    startServe: (start, serve) => `Başlangıç ${start} · Servis ${serve}`,
    beilage: (name) => `Garnitür: ${name}`,
    withConnector: 'ile',
    dayLabels: {
      Montag: 'Pazartesi',
      Dienstag: 'Salı',
      Mittwoch: 'Çarşamba',
      Donnerstag: 'Perşembe',
      Freitag: 'Cuma',
    },
    proteinLabels: {
      gefluegel: 'Tavuk/Hindi',
      rind: 'Dana Eti',
      fisch: 'Balık',
      suess: 'Tatlı Ana Yemek',
      vegetarisch: 'Vejetaryen',
    },
    courseLabels: {
      vorspeise: 'Başlangıç',
      hauptspeise: 'Ana Yemek',
      nachspeise: 'Tatlı',
    },
    subCategoryLabels: {
      suppe: 'Çorba',
      salat: 'Salata',
      beilage: 'Garnitür',
      dessert: 'Tatlı',
    },
    aisleLabels: {
      gemuese: 'Meyve & Sebze',
      kuehlung: 'Et & Balık (Soğuk Reyon)',
      mopro: 'Süt Ürünleri',
      trocken: 'Kuru Gıda / Stok',
      tk: 'Dondurulmuş Ürünler',
    },
    pdf_headerTitle: (week, year) => `Yemek Planı ${week}. Hafta / ${year}`,
    pdf_subtitle: 'Çocuk Yuvası Weilburg · her gün saat 18:00\'de servise hazır',
    pdf_prepServe: (start, serve) => `Hazırlık başlangıcı ${start} · Servis ${serve}`,
    pdf_vorspeise: 'Başlangıç',
    pdf_hauptspeise: 'Ana Yemek',
    pdf_nachspeise: 'Tatlı',
    chatTitle: 'Yapay Zeka Asistanı',
    chatPlaceholder: 'Ne yapmamı istersin?',
    chatSend: 'Gönder',
    chatEmptyState: 'Örneğin şunu sor: "Mercimek Köftesi diye yeni bir ana yemek ekle" veya "Salı günü tavuk yerine balık koy".',
    chatApiKeyLabel: 'Gemini API Anahtarı',
    chatApiKeyHint: 'Anahtar sadece bu cihazda saklanır ve doğrudan Google Gemini\'ye gönderilir (aradaki sunucu yok).',
    chatApiKeyPlaceholder: 'API anahtarını yapıştır',
    chatApiKeySave: 'Kaydet',
    chatApiKeyClear: 'API Anahtarını Kaldır',
    chatApiKeyClearConfirm: 'Kayıtlı Gemini API anahtarını kaldırmak istediğine emin misin? Tekrar girmen gerekecek.',
    chatOffline: 'Sohbet için internet bağlantısı gerekli.',
    chatError: 'Bir şeyler ters gitti. Lütfen tekrar dene.',
    chatErrorAuth: 'Gemini API anahtarı geçersiz görünüyor. Lütfen sohbet başlığından kontrol et/yenile.',
    chatErrorQuota: 'Gemini kotası doldu. Lütfen daha sonra tekrar dene.',
    chatThinking: 'Düşünüyor…',
    aiRecipeBadge: 'Yapay Zeka ile Oluşturuldu',
    chatApiKeyInvalid: 'Bu API anahtarı Gemini tarafından reddedildi. Lütfen kontrol edip tekrar dene.',
    chatApiKeyValidating: 'Kontrol ediliyor…',
  },
};
