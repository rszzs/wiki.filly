import {
  Article,
  ArticleType,
  PORTAL_SUBCATEGORY_SUGGESTIONS,
  WikiPortal
} from '../types/encyclopedia';

export interface SuggestedCategoryItem {
  label: string;
  score: number;
  matchedKeywords: string[];
  source: 'keyword' | 'existing';
}

export interface SuggestedSubcategoryItem {
  label: string;
  score: number;
  matchedKeywords: string[];
}

export interface CategorySuggestionResult {
  categories: SuggestedCategoryItem[];
  subcategories: SuggestedSubcategoryItem[];
  extractedKeywords: string[];
  suggestedPortal: WikiPortal | null;
}

interface KeywordRule {
  category: string;
  subcategories?: string[];
  portal?: WikiPortal;
  /** كلمات وعبارات مفتاحية دالة (تُطبَّع تلقائياً) */
  keywords: string[];
  /** وزن إضافي لنوع مقال محدد */
  preferredTypes?: ArticleType[];
  weight?: number;
}

const ARABIC_STOP_WORDS = new Set([
  'في',
  'من',
  'الي',
  'علي',
  'عن',
  'مع',
  'بين',
  'حتي',
  'منذ',
  'خلال',
  'ضمن',
  'حول',
  'نحو',
  'بعد',
  'قبل',
  'عند',
  'لدي',
  'فوق',
  'تحت',
  'امام',
  'خلف',
  'هو',
  'هي',
  'هم',
  'هن',
  'هذا',
  'هذه',
  'ذلك',
  'تلك',
  'التي',
  'الذي',
  'الذين',
  'اللواتي',
  'كان',
  'كانت',
  'يكون',
  'تكون',
  'اصبح',
  'يعد',
  'تعد',
  'يعتبر',
  'تعتبر',
  'احد',
  'احدي',
  'ابرز',
  'اهم',
  'اكثر',
  'عبر',
  'عام',
  'سنه',
  'العام',
  'كما',
  'حيث',
  'وقد',
  'فقد',
  'وهو',
  'وهي',
  'والتي',
  'والذي',
  'بشكل',
  'كبير',
  'عديد',
  'عده',
  'بعض',
  'جميع',
  'مختلف',
  'تاريخ',
  'العراق',
  'عراقي',
  'عراقيه'
]);

const CATEGORY_KEYWORD_RULES: KeywordRule[] = [
  {
    category: 'الأدب والشعر',
    subcategories: ['شعراء وأدباء', 'الشعر والأدب الفيلي'],
    portal: 'فنون وثقافة',
    keywords: [
      'شاعر',
      'شاعره',
      'شعر',
      'قصيده',
      'قصائد',
      'ديوان',
      'دواوين',
      'اديب',
      'اديبه',
      'ادب',
      'روائي',
      'روائيه',
      'روايه',
      'قاص',
      'قصه',
      'قصص',
      'مقالات ادبيه',
      'نقد ادبي',
      'كاتب',
      'كاتبه',
      'مؤلف',
      'مؤلفات',
      'كتاب'
    ],
    weight: 3
  },
  {
    category: 'أكاديميون وباحثون',
    subcategories: ['أكاديميون وباحثون'],
    portal: 'شخصيات وأعلام',
    preferredTypes: ['person'],
    keywords: [
      'اكاديمي',
      'اكاديميه',
      'دكتوراه',
      'ماجستير',
      'استاذ جامعي',
      'بروفيسور',
      'جامعه',
      'كليه',
      'عميد',
      'باحث',
      'باحثه',
      'اطروحه',
      'ابحاث',
      'دراسات عليا',
      'محاضر',
      'تدريسي',
      'انثروبولوجيا',
      'علم النفس',
      'علم الاجتماع',
      'لجنه علميه'
    ],
    weight: 3
  },
  {
    category: 'العلوم والتربية',
    subcategories: ['أكاديميون وباحثون'],
    portal: 'شخصيات وأعلام',
    keywords: [
      'تربوي',
      'تربويه',
      'تربيه',
      'تعليم',
      'معلم',
      'معلمه',
      'مدرس',
      'مدرسه',
      'مناهج',
      'علوم',
      'علم النفس',
      'طب',
      'طبيب',
      'هندسه',
      'مهندس',
      'فيزياء',
      'كيمياء',
      'رياضيات',
      'صيدله'
    ],
    weight: 2.5
  },
  {
    category: 'الفكر والصحافة',
    subcategories: ['الصحافة والنشر الفيلي'],
    portal: 'إعلام وسياسة',
    keywords: [
      'صحفي',
      'صحفيه',
      'صحافه',
      'جريده',
      'صحيفه',
      'مجله',
      'ناشر',
      'دار نشر',
      'رئيس تحرير',
      'مفكر',
      'مثقف',
      'مقالات',
      'المدي',
      'شفق'
    ],
    weight: 3
  },
  {
    category: 'صحفيون وإعلاميون',
    subcategories: ['الصحافة والنشر الفيلي'],
    portal: 'إعلام وسياسة',
    preferredTypes: ['person'],
    keywords: [
      'اعلامي',
      'اعلاميه',
      'اعلام',
      'اذاعه',
      'تلفزيون',
      'فضائيه',
      'قناه',
      'مراسل',
      'مذيع',
      'مقدم برامج',
      'صحفي',
      'صحفيه',
      'اخبار',
      'تحرير صحفي'
    ],
    weight: 3
  },
  {
    category: 'التاريخ والمجتمع',
    subcategories: ['مفكرون ومؤرخون', 'الوثائق والأرشيف التاريخي'],
    portal: 'أحداث تاريخية',
    keywords: [
      'مؤرخ',
      'مؤرخه',
      'تاريخي',
      'تاريخيه',
      'وثائق',
      'وثيقه',
      'ارشيف',
      'ذاكره',
      'مجتمع',
      'اجتماعي',
      'اجتماعيه',
      'سوسيولوجيا',
      'التاريخ الحديث',
      'التاريخ المعاصر',
      'القرن التاسع عشر',
      'القرن العشرين'
    ],
    weight: 2.5
  },
  {
    category: 'مترجمون عراقيون',
    subcategories: ['مفكرون ومؤرخون'],
    portal: 'شخصيات وأعلام',
    preferredTypes: ['person'],
    keywords: ['مترجم', 'مترجمه', 'ترجمه', 'ترجم', 'نقل الي العربيه', 'ترجمات'],
    weight: 3
  },
  {
    category: 'شؤون المرأة',
    subcategories: ['شخصيات وطنية ومجتمعية'],
    portal: 'شخصيات وأعلام',
    preferredTypes: ['person'],
    keywords: [
      'مراه',
      'المراه',
      'نسائيه',
      'نسويه',
      'حقوق المراه',
      'تمكين المراه',
      'ناشطه',
      'اعلاميه',
      'تربويه',
      'شاعره',
      'باحثه',
      'الطفل والاسره'
    ],
    weight: 2.5
  },
  {
    category: 'ناشطون حقوقيون',
    subcategories: ['شخصيات وطنية ومجتمعية', 'العمل المدني والبرلماني'],
    portal: 'إعلام وسياسة',
    preferredTypes: ['person'],
    keywords: [
      'حقوقي',
      'حقوقيه',
      'حقوق الانسان',
      'ناشط',
      'ناشطه',
      'مجتمع مدني',
      'منظمات مدنيه',
      'مناصره',
      'حريات',
      'عداله',
      'محامي',
      'قانوني',
      'قانونيه'
    ],
    weight: 3
  },
  {
    category: 'إعلام وسياسة',
    subcategories: ['العمل المدني والبرلماني', 'مراكز الدراسات الاستراتيجية'],
    portal: 'إعلام وسياسة',
    keywords: [
      'سياسي',
      'سياسيه',
      'سياسه',
      'برلمان',
      'برلماني',
      'نائب',
      'وزير',
      'دبلوماسي',
      'سفير',
      'حكومه',
      'محلل سياسي',
      'دراسات استراتيجيه',
      'حزب',
      'قيادي',
      'مستشار',
      'انتخابات'
    ],
    weight: 2.8
  },
  {
    category: 'التقنية والسياسات الرقمية',
    subcategories: ['تقنية وسياسات رقمية', 'السياسات الرقمية والأمن السيبراني'],
    portal: 'إعلام وسياسة',
    keywords: [
      'سيبراني',
      'امن سيبراني',
      'رقميه',
      'رقمي',
      'تحول رقمي',
      'تقنيه',
      'تكنولوجيا',
      'برمجه',
      'مطور',
      'حاسوب',
      'انترنت',
      'ذكاء اصطناعي',
      'تصميم جرافيكي',
      'منصه الكترونيه'
    ],
    weight: 3
  },
  {
    category: 'عشائر العراق',
    subcategories: ['الأنساب ونظام التوشمال'],
    portal: 'عشائر وأنساب',
    preferredTypes: ['general'],
    keywords: [
      'عشيره',
      'عشائر',
      'قبيله',
      'قبائل',
      'فخذ',
      'افخاذ',
      'حموله',
      'توشمال',
      'انساب',
      'نسب',
      'شيخ العشيره',
      'زعامه قبليه',
      'تنظيم قبلي'
    ],
    weight: 3.2
  },
  {
    category: 'عشائر وأنساب',
    subcategories: ['عشائر اللور والكردلية'],
    portal: 'عشائر وأنساب',
    keywords: [
      'كلهور',
      'كلهوري',
      'اركوازي',
      'اركواز',
      'ملك شاهي',
      'ملكشاهي',
      'زنكنه',
      'باجلان',
      'سورميري',
      'شوهان',
      'كردليه',
      'لور',
      'لوري',
      'باويه',
      'قره لوس',
      'دلفان',
      'بيره نوند',
      'خزل',
      'بنجستون'
    ],
    weight: 3.4
  },
  {
    category: 'فنون وثقافة',
    subcategories: ['الهوره والموسيقى الفيلية', 'التراث الشعبي والأزياء'],
    portal: 'فنون وثقافة',
    keywords: [
      'هوره',
      'مور',
      'موسيقي',
      'موسيقار',
      'مقام',
      'غناء',
      'مطرب',
      'فنان',
      'فنانه',
      'فنون',
      'مسرح',
      'سينما',
      'تشكيلي',
      'رسم',
      'نحت',
      'فلكلور',
      'تراث شعبي',
      'ازياء شعبيه',
      'عود',
      'تنبور'
    ],
    weight: 3
  },
  {
    category: 'التراث الفيلي',
    subcategories: ['اللهجة الفيلية واللغويات', 'التراث الشعبي والأزياء'],
    portal: 'فنون وثقافة',
    keywords: [
      'تراث',
      'لهجه',
      'لغه كرديه',
      'لغه كورديه',
      'لغويات',
      'معجم',
      'قاموس',
      'موروث',
      'فلكلور',
      'عادات وتقاليد',
      'امثال شعبيه',
      'هويه ثقافيه'
    ],
    weight: 2.8
  },
  {
    category: 'أحداث تاريخية',
    subcategories: ['التهجير القسري والذاكرة', 'الاعتراف القانوني والعدالة'],
    portal: 'أحداث تاريخية',
    keywords: [
      'تهجير',
      'تسفير',
      'اسقاط الجنسيه',
      'اباده',
      'اباده جماعيه',
      'جينوسايد',
      'مقابر جماعيه',
      'انتفاضه',
      'ثوره',
      'معركه',
      'معاهده',
      'محكمه جنائيه',
      'قرار برلماني',
      'السبعينيات',
      'الثمانينيات',
      'حمله التهجير'
    ],
    weight: 3.4
  },
  {
    category: 'أماكن ومدن',
    subcategories: ['مدن محافظة ديالى'],
    portal: 'أماكن ومدن',
    preferredTypes: ['place'],
    keywords: [
      'مدينه',
      'قضاء',
      'ناحيه',
      'قريه',
      'محله',
      'منطقه',
      'جغرافيا',
      'نهر',
      'جبل',
      'حدوديه',
      'سكان',
      'بساتين',
      'احداثيات',
      'سفوح زاغروس'
    ],
    weight: 3
  },
  {
    category: 'أعلام خانقين',
    subcategories: ['مدن محافظة ديالى'],
    portal: 'أماكن ومدن',
    keywords: ['خانقين', 'الوند', 'جلولاء', 'السعديه', 'قزانيه', 'ديالي', 'كفري'],
    weight: 3.2
  },
  {
    category: 'أعلام مندلي',
    subcategories: ['مدن محافظة ديالى'],
    portal: 'أماكن ومدن',
    keywords: ['مندلي', 'بلدروز', 'قزانيه'],
    weight: 3.2
  },
  {
    category: 'أعلام بغداد',
    subcategories: ['محلات بغداد التاريخية'],
    portal: 'أماكن ومدن',
    keywords: [
      'بغداد',
      'عقد الاكراد',
      'باب الشيخ',
      'الصدريه',
      'الشورجه',
      'شارع الكفاح',
      'الرصافه',
      'الكرخ',
      'جميله',
      'مدينه الصدر'
    ],
    weight: 3
  },
  {
    category: 'مدن ومناطق واسط وميسان',
    subcategories: ['مدن محافظة واسط', 'محافظة ميسان والجنوب'],
    portal: 'أماكن ومدن',
    keywords: [
      'بدره',
      'جصان',
      'زرباطيه',
      'الكوت',
      'واسط',
      'النعمانيه',
      'ميسان',
      'العماره',
      'علي الغربي',
      'شيخ سعد'
    ],
    weight: 3
  },
  {
    category: 'شعراء وأعلام إيلام وزاغروس',
    subcategories: ['إيلام ولورستان وكرمنشاه'],
    portal: 'أماكن ومدن',
    keywords: ['ايلام', 'بشتكوه', 'لورستان', 'كرمنشاه', 'مهران', 'دهلران', 'زاغروس', 'ملکشاهي'],
    weight: 3
  },
  {
    category: 'ناشطون في كركوك',
    subcategories: ['شخصيات وطنية ومجتمعية'],
    portal: 'شخصيات وأعلام',
    keywords: ['كركوك', 'طوزخورماتو', 'داقوق'],
    weight: 3
  },
  {
    category: 'كرد فيليون',
    subcategories: [],
    keywords: ['فيلي', 'فيليه', 'فيليين', 'فيليون', 'كرد فيلي', 'كورد فيلي', 'الكرد الفيليين', 'الكورد الفيليين'],
    weight: 1.8
  }
];

const SPECIFIC_SUBCATEGORY_RULES: Array<{
  subcategory: string;
  keywords: string[];
}> = [
  { subcategory: 'عشائر الكلهور', keywords: ['كلهور', 'كلهوري', 'كلهوريه'] },
  { subcategory: 'عشائر الأركوازي', keywords: ['اركوازي', 'اركواز'] },
  { subcategory: 'عشائر ملك شاهي', keywords: ['ملك شاهي', 'ملكشاهي'] },
  { subcategory: 'عشائر اللور والكردلية', keywords: ['لور', 'لوري', 'لورستان', 'كردليه', 'كردلي'] },
  { subcategory: 'عشائر الزنكنة والباوية', keywords: ['زنكنه', 'باويه', 'باوي'] },
  { subcategory: 'الأنساب ونظام التوشمال', keywords: ['توشمال', 'انساب', 'نسب', 'فخذ', 'افخاذ'] },
  { subcategory: 'شعراء وأدباء', keywords: ['شاعر', 'شاعره', 'شعر', 'ديوان', 'اديب', 'روايه', 'كاتب'] },
  { subcategory: 'أكاديميون وباحثون', keywords: ['اكاديمي', 'دكتوراه', 'جامعه', 'باحث', 'ماجستير', 'استاذ'] },
  { subcategory: 'مفكرون ومؤرخون', keywords: ['مفكر', 'مؤرخ', 'مترجم', 'فلسفه', 'تاريخ'] },
  { subcategory: 'فنانون وموسيقيون', keywords: ['فنان', 'موسيقي', 'مطرب', 'مسرح', 'سينما', 'تشكيلي'] },
  { subcategory: 'شخصيات وطنية ومجتمعية', keywords: ['وطني', 'وطنيه', 'مجتمعي', 'ناشط', 'ناشطه', 'حقوق المراه', 'قيادي'] },
  { subcategory: 'تقنية وسياسات رقمية', keywords: ['سيبراني', 'رقمي', 'رقميه', 'تقنيه', 'تكنولوجيا', 'برمجه'] },
  { subcategory: 'الهوره والموسيقى الفيلية', keywords: ['هوره', 'مور', 'مقام', 'غناء', 'موسيقي'] },
  { subcategory: 'الشعر والأدب الفيلي', keywords: ['شعر', 'ديوان', 'قصيده', 'ادب'] },
  { subcategory: 'اللهجة الفيلية واللغويات', keywords: ['لهجه', 'لغويات', 'لغه كرديه', 'لغه كورديه', 'معجم', 'قاموس'] },
  { subcategory: 'التراث الشعبي والأزياء', keywords: ['تراث شعبي', 'ازياء', 'فلكلور', 'عادات'] },
  { subcategory: 'المسرح والسينما', keywords: ['مسرح', 'سينما', 'مخرج', 'ممثل', 'فيلم'] },
  { subcategory: 'مدن محافظة ديالى', keywords: ['خانقين', 'مندلي', 'ديالي', 'جلولاء', 'قزانيه', 'بلدروز'] },
  { subcategory: 'مدن محافظة واسط', keywords: ['بدره', 'جصان', 'زرباطيه', 'الكوت', 'واسط'] },
  { subcategory: 'محلات بغداد التاريخية', keywords: ['بغداد', 'عقد الاكراد', 'باب الشيخ', 'الصدريه', 'الشورجه', 'الكفاح'] },
  { subcategory: 'محافظة ميسان والجنوب', keywords: ['ميسان', 'العماره', 'علي الغربي', 'البصره'] },
  { subcategory: 'إيلام ولورستان وكرمنشاه', keywords: ['ايلام', 'بشتكوه', 'لورستان', 'كرمنشاه', 'مهران'] },
  { subcategory: 'التهجير القسري والذاكرة', keywords: ['تهجير', 'تسفير', 'اسقاط الجنسيه', 'اباده', 'جينوسايد'] },
  { subcategory: 'التاريخ الحديث للعراق', keywords: ['انتفاضه', 'ثوره', 'القرن العشرين', 'التاريخ الحديث'] },
  { subcategory: 'الاعتراف القانوني والعدالة', keywords: ['محكمه', 'قرار', 'قانون', 'اعتراف', 'عداله', 'تعويض'] },
  { subcategory: 'الوثائق والأرشيف التاريخي', keywords: ['وثائق', 'وثيقه', 'ارشيف', 'مخطوطات'] },
  { subcategory: 'الصحافة والنشر الفيلي', keywords: ['صحافه', 'صحفي', 'اعلامي', 'اعلاميه', 'جريده', 'ناشر', 'مجله', 'اذاعه'] },
  { subcategory: 'مراكز الدراسات الاستراتيجية', keywords: ['دراسات استراتيجيه', 'محلل سياسي', 'مركز ابحاث', 'مركز دراسات'] },
  { subcategory: 'السياسات الرقمية والأمن السيبراني', keywords: ['امن سيبراني', 'سياسات رقميه', 'تحول رقمي'] },
  { subcategory: 'العمل المدني والبرلماني', keywords: ['برلمان', 'نائب', 'مجتمع مدني', 'حقوقي', 'منظمات'] }
];

export function normalizeArabicText(raw: string): string {
  return raw
    .replace(/\[\d+\]/g, ' ')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ک/g, 'ك')
    .replace(/ی/g, 'ي')
    .replace(/[^\u0600-\u06FFa-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function stripLightPrefix(word: string): string {
  if (word.length > 4 && (word.startsWith('وال') || word.startsWith('بال') || word.startsWith('كال') || word.startsWith('فال'))) {
    return word.slice(3);
  }
  if (word.length > 3 && (word.startsWith('ال') || word.startsWith('لل'))) {
    return word.slice(2);
  }
  if (word.length > 4 && (word.startsWith('و') || word.startsWith('ب') || word.startsWith('ل'))) {
    return word.slice(1);
  }
  return word;
}

function tokenizeNormalized(normalizedText: string): string[] {
  if (!normalizedText) return [];
  return normalizedText.split(' ').filter((w) => w.length >= 2);
}

function matchesKeyword(
  normalizedText: string,
  tokens: string[],
  strippedTokens: string[],
  rawKeyword: string
): boolean {
  const normKw = normalizeArabicText(rawKeyword);
  if (!normKw) return false;

  // عبارة مركبة من أكثر من كلمة
  if (normKw.includes(' ')) {
    return normalizedText.includes(normKw);
  }

  const strippedKw = stripLightPrefix(normKw);
  for (let i = 0; i < tokens.length; i += 1) {
    const tok = tokens[i];
    const stripped = strippedTokens[i];
    if (tok === normKw || stripped === strippedKw) {
      return true;
    }
    if (strippedKw.length >= 4 && stripped.startsWith(strippedKw)) {
      return true;
    }
    if (strippedKw.length >= 5 && stripped.includes(strippedKw)) {
      return true;
    }
  }
  return false;
}

export function suggestCategoriesFromSummary(params: {
  summary: string;
  title?: string;
  subtitle?: string;
  field?: string;
  articleType?: ArticleType | null;
  portal?: WikiPortal;
  existingArticles?: Article[];
}): CategorySuggestionResult {
  const {
    summary,
    title = '',
    subtitle = '',
    field = '',
    articleType = null,
    portal,
    existingArticles = []
  } = params;

  const summaryNormalized = normalizeArabicText(summary);
  if (summaryNormalized.length < 4) {
    return {
      categories: [],
      subcategories: [],
      extractedKeywords: [],
      suggestedPortal: null
    };
  }

  const summaryTokens = tokenizeNormalized(summaryNormalized);
  const summaryStripped = summaryTokens.map(stripLightPrefix);

  // سياق مساعد من العنوان والصفة (بوزن أقل من الملخص)
  const contextNormalized = normalizeArabicText(`${title} ${subtitle} ${field}`);
  const contextTokens = tokenizeNormalized(contextNormalized);
  const contextStripped = contextTokens.map(stripLightPrefix);

  const categoryMap = new Map<string, SuggestedCategoryItem>();
  const subcategoryMap = new Map<string, SuggestedSubcategoryItem>();
  const portalScores = new Map<WikiPortal, number>();
  const matchedKeywordSet = new Set<string>();

  const addCategoryScore = (
    label: string,
    score: number,
    keyword: string,
    source: 'keyword' | 'existing'
  ) => {
    const existing = categoryMap.get(label);
    if (existing) {
      existing.score += score;
      if (keyword && !existing.matchedKeywords.includes(keyword)) {
        existing.matchedKeywords.push(keyword);
      }
    } else {
      categoryMap.set(label, {
        label,
        score,
        matchedKeywords: keyword ? [keyword] : [],
        source
      });
    }
  };

  const addSubcategoryScore = (label: string, score: number, keyword: string) => {
    const existing = subcategoryMap.get(label);
    if (existing) {
      existing.score += score;
      if (keyword && !existing.matchedKeywords.includes(keyword)) {
        existing.matchedKeywords.push(keyword);
      }
    } else {
      subcategoryMap.set(label, {
        label,
        score,
        matchedKeywords: keyword ? [keyword] : []
      });
    }
  };

  // 1. مطابقة القواعد الموضوعية المخصصة لويكي فيلي مع ملخص المقال
  for (const rule of CATEGORY_KEYWORD_RULES) {
    const baseWeight = rule.weight ?? 2;
    let ruleHits = 0;

    for (const kw of rule.keywords) {
      const inSummary = matchesKeyword(summaryNormalized, summaryTokens, summaryStripped, kw);
      const inContext =
        !inSummary &&
        contextNormalized.length >= 2 &&
        matchesKeyword(contextNormalized, contextTokens, contextStripped, kw);

      if (inSummary || inContext) {
        const typeBonus =
          articleType && rule.preferredTypes?.includes(articleType) ? 0.6 : 0;
        const hitScore = (inSummary ? baseWeight : baseWeight * 0.45) + typeBonus;
        addCategoryScore(rule.category, hitScore, kw, 'keyword');
        if (inSummary) {
          matchedKeywordSet.add(kw);
        }
        ruleHits += 1;

        if (rule.portal) {
          portalScores.set(
            rule.portal,
            (portalScores.get(rule.portal) ?? 0) + (inSummary ? 2 : 0.7)
          );
        }

        if (rule.subcategories) {
          for (const sub of rule.subcategories) {
            addSubcategoryScore(sub, inSummary ? 1.5 : 0.6, kw);
          }
        }
      }
    }

    // مكافأة إضافية إذا تطابقت أكثر من كلمة مفتاحية لنفس التصنيف
    if (ruleHits >= 2) {
      const current = categoryMap.get(rule.category);
      if (current) {
        current.score += 1.2;
      }
    }
  }

  // 2. مطابقة التصنيفات الفرعية الدقيقة
  for (const subRule of SPECIFIC_SUBCATEGORY_RULES) {
    for (const kw of subRule.keywords) {
      if (matchesKeyword(summaryNormalized, summaryTokens, summaryStripped, kw)) {
        addSubcategoryScore(subRule.subcategory, 3, kw);
        matchedKeywordSet.add(kw);
      }
    }
  }

  // 3. استثمار التصنيفات الموجودة فعلياً في مقالات الموسوعة لضمان الاتساق
  if (existingArticles.length > 0) {
    const existingCategoryFreq = new Map<string, number>();
    for (const art of existingArticles) {
      for (const cat of art.categories) {
        const clean = cat.trim();
        if (!clean) continue;
        existingCategoryFreq.set(clean, (existingCategoryFreq.get(clean) ?? 0) + 1);
      }
    }

    existingCategoryFreq.forEach((freq, catLabel) => {
      const normCat = normalizeArabicText(catLabel);
      const catWords = tokenizeNormalized(normCat)
        .map(stripLightPrefix)
        .filter((w) => w.length >= 3 && !ARABIC_STOP_WORDS.has(w));

      if (catWords.length === 0) return;

      let matchedWords = 0;
      const hitLabels: string[] = [];
      for (const cw of catWords) {
        if (matchesKeyword(summaryNormalized, summaryTokens, summaryStripped, cw)) {
          matchedWords += 1;
          hitLabels.push(cw);
        }
      }

      if (matchedWords > 0) {
        const coverage = matchedWords / catWords.length;
        if (coverage >= 0.5 || matchedWords >= 2) {
          const boost = 2.4 * coverage + Math.min(freq, 5) * 0.25;
          for (const h of hitLabels) {
            addCategoryScore(catLabel, boost / hitLabels.length, h, 'existing');
            matchedKeywordSet.add(h);
          }
        }
      }
    });
  }

  // 4. منح أولوية طفيفة للتصنيفات الفرعية التابعة للبوابة المختارة حالياً
  if (portal && PORTAL_SUBCATEGORY_SUGGESTIONS[portal]) {
    for (const portalSub of PORTAL_SUBCATEGORY_SUGGESTIONS[portal]) {
      const existingSub = subcategoryMap.get(portalSub);
      if (existingSub) {
        existingSub.score += 0.8;
      }
    }
  }

  // ترتيب التصنيفات المقترحة
  const sortedCategories = Array.from(categoryMap.values())
    .filter((item) => item.score >= 1.5)
    .sort((a, b) => b.score - a.score || b.matchedKeywords.length - a.matchedKeywords.length)
    .slice(0, 8);

  const sortedSubcategories = Array.from(subcategoryMap.values())
    .filter((item) => item.score >= 1.8)
    .sort((a, b) => b.score - a.score || b.matchedKeywords.length - a.matchedKeywords.length)
    .slice(0, 5);

  // استخراج أبرز الكلمات المفتاحية المرصودة من الملخص
  const extractedKeywords = Array.from(matchedKeywordSet).slice(0, 10);

  // اقتراح البوابة الأنسب إذا كانت الإشارات قوية ومختلفة عن البوابة الحالية
  let suggestedPortal: WikiPortal | null = null;
  let bestPortalScore = 0;
  portalScores.forEach((sc, p) => {
    if (sc > bestPortalScore) {
      bestPortalScore = sc;
      suggestedPortal = p;
    }
  });
  if (bestPortalScore < 3 || suggestedPortal === portal) {
    suggestedPortal = null;
  }

  return {
    categories: sortedCategories,
    subcategories: sortedSubcategories,
    extractedKeywords,
    suggestedPortal
  };
}
