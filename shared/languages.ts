/**
 * Languages a learner can read a video transcript in.
 * `code` is a BCP-47 tag; `name` is the English name; `native` is how speakers write it,
 * so a learner can search in either script ("Hindi" or "हिन्दी").
 * `group` keeps the list scannable: the 22 scheduled languages of India come first.
 */
export interface TranscriptLanguage {
  code: string;
  name: string;
  native: string;
  group: 'India' | 'World';
  /** Right-to-left script. */
  rtl?: boolean;
}

export const SOURCE_LANGUAGE = 'en';

export const LANGUAGES: TranscriptLanguage[] = [
  // ---- The 22 scheduled languages of India, plus widely spoken regional languages ----
  { code: 'as', name: 'Assamese', native: 'অসমীয়া', group: 'India' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা', group: 'India' },
  { code: 'brx', name: 'Bodo', native: 'बड़ो', group: 'India' },
  { code: 'doi', name: 'Dogri', native: 'डोगरी', group: 'India' },
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી', group: 'India' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी', group: 'India' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ', group: 'India' },
  { code: 'ks', name: 'Kashmiri', native: 'کٲشُر', group: 'India', rtl: true },
  { code: 'gom', name: 'Konkani', native: 'कोंकणी', group: 'India' },
  { code: 'mai', name: 'Maithili', native: 'मैथिली', group: 'India' },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം', group: 'India' },
  { code: 'mni', name: 'Manipuri (Meitei)', native: 'ꯃꯩꯇꯩꯂꯣꯟ', group: 'India' },
  { code: 'mr', name: 'Marathi', native: 'मराठी', group: 'India' },
  { code: 'ne', name: 'Nepali', native: 'नेपाली', group: 'India' },
  { code: 'or', name: 'Odia', native: 'ଓଡ଼ିଆ', group: 'India' },
  { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ', group: 'India' },
  { code: 'sa', name: 'Sanskrit', native: 'संस्कृतम्', group: 'India' },
  { code: 'sat', name: 'Santali', native: 'ᱥᱟᱱᱛᱟᱲᱤ', group: 'India' },
  { code: 'sd', name: 'Sindhi', native: 'سنڌي', group: 'India', rtl: true },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்', group: 'India' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు', group: 'India' },
  { code: 'ur', name: 'Urdu', native: 'اردو', group: 'India', rtl: true },
  { code: 'bho', name: 'Bhojpuri', native: 'भोजपुरी', group: 'India' },
  { code: 'raj', name: 'Rajasthani', native: 'राजस्थानी', group: 'India' },
  { code: 'tcy', name: 'Tulu', native: 'ತುಳು', group: 'India' },
  { code: 'hne', name: 'Chhattisgarhi', native: 'छत्तीसगढ़ी', group: 'India' },
  { code: 'mag', name: 'Magahi', native: 'मगही', group: 'India' },
  { code: 'awa', name: 'Awadhi', native: 'अवधी', group: 'India' },
  { code: 'lus', name: 'Mizo', native: 'Mizo ṭawng', group: 'India' },
  { code: 'kha', name: 'Khasi', native: 'Ka Ktien Khasi', group: 'India' },

  // ---- World languages ----
  { code: 'en', name: 'English', native: 'English', group: 'World' },
  { code: 'af', name: 'Afrikaans', native: 'Afrikaans', group: 'World' },
  { code: 'sq', name: 'Albanian', native: 'Shqip', group: 'World' },
  { code: 'am', name: 'Amharic', native: 'አማርኛ', group: 'World' },
  { code: 'ar', name: 'Arabic', native: 'العربية', group: 'World', rtl: true },
  { code: 'hy', name: 'Armenian', native: 'Հայերեն', group: 'World' },
  { code: 'az', name: 'Azerbaijani', native: 'Azərbaycanca', group: 'World' },
  { code: 'eu', name: 'Basque', native: 'Euskara', group: 'World' },
  { code: 'be', name: 'Belarusian', native: 'Беларуская', group: 'World' },
  { code: 'bs', name: 'Bosnian', native: 'Bosanski', group: 'World' },
  { code: 'bg', name: 'Bulgarian', native: 'Български', group: 'World' },
  { code: 'my', name: 'Burmese', native: 'မြန်မာ', group: 'World' },
  { code: 'yue', name: 'Cantonese', native: '粵語', group: 'World' },
  { code: 'ca', name: 'Catalan', native: 'Català', group: 'World' },
  { code: 'ceb', name: 'Cebuano', native: 'Cebuano', group: 'World' },
  { code: 'zh-CN', name: 'Chinese (Simplified)', native: '简体中文', group: 'World' },
  { code: 'zh-TW', name: 'Chinese (Traditional)', native: '繁體中文', group: 'World' },
  { code: 'co', name: 'Corsican', native: 'Corsu', group: 'World' },
  { code: 'hr', name: 'Croatian', native: 'Hrvatski', group: 'World' },
  { code: 'cs', name: 'Czech', native: 'Čeština', group: 'World' },
  { code: 'da', name: 'Danish', native: 'Dansk', group: 'World' },
  { code: 'dv', name: 'Dhivehi', native: 'ދިވެހި', group: 'World', rtl: true },
  { code: 'nl', name: 'Dutch', native: 'Nederlands', group: 'World' },
  { code: 'eo', name: 'Esperanto', native: 'Esperanto', group: 'World' },
  { code: 'et', name: 'Estonian', native: 'Eesti', group: 'World' },
  { code: 'fil', name: 'Filipino', native: 'Filipino', group: 'World' },
  { code: 'fi', name: 'Finnish', native: 'Suomi', group: 'World' },
  { code: 'fr', name: 'French', native: 'Français', group: 'World' },
  { code: 'fr-CA', name: 'French (Canada)', native: 'Français (Canada)', group: 'World' },
  { code: 'gl', name: 'Galician', native: 'Galego', group: 'World' },
  { code: 'ka', name: 'Georgian', native: 'ქართული', group: 'World' },
  { code: 'de', name: 'German', native: 'Deutsch', group: 'World' },
  { code: 'el', name: 'Greek', native: 'Ελληνικά', group: 'World' },
  { code: 'gn', name: 'Guarani', native: "Avañe'ẽ", group: 'World' },
  { code: 'ht', name: 'Haitian Creole', native: 'Kreyòl ayisyen', group: 'World' },
  { code: 'ha', name: 'Hausa', native: 'Hausa', group: 'World' },
  { code: 'haw', name: 'Hawaiian', native: 'ʻŌlelo Hawaiʻi', group: 'World' },
  { code: 'he', name: 'Hebrew', native: 'עברית', group: 'World', rtl: true },
  { code: 'hmn', name: 'Hmong', native: 'Hmoob', group: 'World' },
  { code: 'hu', name: 'Hungarian', native: 'Magyar', group: 'World' },
  { code: 'is', name: 'Icelandic', native: 'Íslenska', group: 'World' },
  { code: 'ig', name: 'Igbo', native: 'Igbo', group: 'World' },
  { code: 'id', name: 'Indonesian', native: 'Bahasa Indonesia', group: 'World' },
  { code: 'ga', name: 'Irish', native: 'Gaeilge', group: 'World' },
  { code: 'it', name: 'Italian', native: 'Italiano', group: 'World' },
  { code: 'ja', name: 'Japanese', native: '日本語', group: 'World' },
  { code: 'jv', name: 'Javanese', native: 'Basa Jawa', group: 'World' },
  { code: 'kk', name: 'Kazakh', native: 'Қазақ тілі', group: 'World' },
  { code: 'km', name: 'Khmer', native: 'ខ្មែរ', group: 'World' },
  { code: 'rw', name: 'Kinyarwanda', native: 'Ikinyarwanda', group: 'World' },
  { code: 'ko', name: 'Korean', native: '한국어', group: 'World' },
  { code: 'ku', name: 'Kurdish (Kurmanji)', native: 'Kurdî', group: 'World' },
  { code: 'ckb', name: 'Kurdish (Sorani)', native: 'کوردی', group: 'World', rtl: true },
  { code: 'ky', name: 'Kyrgyz', native: 'Кыргызча', group: 'World' },
  { code: 'lo', name: 'Lao', native: 'ລາວ', group: 'World' },
  { code: 'la', name: 'Latin', native: 'Latina', group: 'World' },
  { code: 'lv', name: 'Latvian', native: 'Latviešu', group: 'World' },
  { code: 'lt', name: 'Lithuanian', native: 'Lietuvių', group: 'World' },
  { code: 'lb', name: 'Luxembourgish', native: 'Lëtzebuergesch', group: 'World' },
  { code: 'mk', name: 'Macedonian', native: 'Македонски', group: 'World' },
  { code: 'mg', name: 'Malagasy', native: 'Malagasy', group: 'World' },
  { code: 'ms', name: 'Malay', native: 'Bahasa Melayu', group: 'World' },
  { code: 'mt', name: 'Maltese', native: 'Malti', group: 'World' },
  { code: 'mi', name: 'Maori', native: 'Te Reo Māori', group: 'World' },
  { code: 'mn', name: 'Mongolian', native: 'Монгол', group: 'World' },
  { code: 'no', name: 'Norwegian', native: 'Norsk', group: 'World' },
  { code: 'ny', name: 'Nyanja (Chichewa)', native: 'Chichewa', group: 'World' },
  { code: 'ps', name: 'Pashto', native: 'پښتو', group: 'World', rtl: true },
  { code: 'fa', name: 'Persian', native: 'فارسی', group: 'World', rtl: true },
  { code: 'pl', name: 'Polish', native: 'Polski', group: 'World' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)', native: 'Português (Brasil)', group: 'World' },
  { code: 'pt-PT', name: 'Portuguese (Portugal)', native: 'Português (Portugal)', group: 'World' },
  { code: 'qu', name: 'Quechua', native: 'Runa Simi', group: 'World' },
  { code: 'ro', name: 'Romanian', native: 'Română', group: 'World' },
  { code: 'ru', name: 'Russian', native: 'Русский', group: 'World' },
  { code: 'sm', name: 'Samoan', native: 'Gagana Samoa', group: 'World' },
  { code: 'gd', name: 'Scottish Gaelic', native: 'Gàidhlig', group: 'World' },
  { code: 'sr', name: 'Serbian', native: 'Српски', group: 'World' },
  { code: 'st', name: 'Sesotho', native: 'Sesotho', group: 'World' },
  { code: 'sn', name: 'Shona', native: 'chiShona', group: 'World' },
  { code: 'si', name: 'Sinhala', native: 'සිංහල', group: 'World' },
  { code: 'sk', name: 'Slovak', native: 'Slovenčina', group: 'World' },
  { code: 'sl', name: 'Slovenian', native: 'Slovenščina', group: 'World' },
  { code: 'so', name: 'Somali', native: 'Soomaali', group: 'World' },
  { code: 'es', name: 'Spanish', native: 'Español', group: 'World' },
  { code: 'es-419', name: 'Spanish (Latin America)', native: 'Español (Latinoamérica)', group: 'World' },
  { code: 'su', name: 'Sundanese', native: 'Basa Sunda', group: 'World' },
  { code: 'sw', name: 'Swahili', native: 'Kiswahili', group: 'World' },
  { code: 'sv', name: 'Swedish', native: 'Svenska', group: 'World' },
  { code: 'tg', name: 'Tajik', native: 'Тоҷикӣ', group: 'World' },
  { code: 'tt', name: 'Tatar', native: 'Татарча', group: 'World' },
  { code: 'th', name: 'Thai', native: 'ไทย', group: 'World' },
  { code: 'ti', name: 'Tigrinya', native: 'ትግርኛ', group: 'World' },
  { code: 'tr', name: 'Turkish', native: 'Türkçe', group: 'World' },
  { code: 'tk', name: 'Turkmen', native: 'Türkmençe', group: 'World' },
  { code: 'uk', name: 'Ukrainian', native: 'Українська', group: 'World' },
  { code: 'ug', name: 'Uyghur', native: 'ئۇيغۇرچە', group: 'World', rtl: true },
  { code: 'uz', name: 'Uzbek', native: "O'zbek", group: 'World' },
  { code: 'vi', name: 'Vietnamese', native: 'Tiếng Việt', group: 'World' },
  { code: 'cy', name: 'Welsh', native: 'Cymraeg', group: 'World' },
  { code: 'fy', name: 'Western Frisian', native: 'Frysk', group: 'World' },
  { code: 'xh', name: 'Xhosa', native: 'isiXhosa', group: 'World' },
  { code: 'yi', name: 'Yiddish', native: 'ייִדיש', group: 'World', rtl: true },
  { code: 'yo', name: 'Yoruba', native: 'Yorùbá', group: 'World' },
  { code: 'zu', name: 'Zulu', native: 'isiZulu', group: 'World' },
];

const BY_CODE = new Map(LANGUAGES.map((l) => [l.code.toLowerCase(), l]));

export const languageByCode = (code: string | undefined | null): TranscriptLanguage | undefined => (code ? BY_CODE.get(code.toLowerCase()) : undefined);

/** Case- and accent-insensitive search over the English name, the native name, and the code. */
export function searchLanguages(query: string, list: TranscriptLanguage[] = LANGUAGES): TranscriptLanguage[] {
  const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const q = fold(query.trim());
  if (!q) return list;
  const starts: TranscriptLanguage[] = [];
  const contains: TranscriptLanguage[] = [];
  for (const l of list) {
    const hay = [fold(l.name), fold(l.native), l.code.toLowerCase()];
    if (hay.some((h) => h.startsWith(q))) starts.push(l);
    else if (hay.some((h) => h.includes(q))) contains.push(l);
  }
  return [...starts, ...contains];
}

/**
 * The best match for the browser's preferred languages (for example "hi-IN" → Hindi),
 * so a learner's own language is suggested first.
 */
export function suggestedLanguages(preferred: readonly string[]): TranscriptLanguage[] {
  const out: TranscriptLanguage[] = [];
  for (const p of preferred) {
    const exact = languageByCode(p);
    const base = languageByCode(p.split('-')[0]);
    const pick = exact ?? base;
    if (pick && pick.code !== SOURCE_LANGUAGE && !out.includes(pick)) out.push(pick);
  }
  return out;
}
