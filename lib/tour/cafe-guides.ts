/**
 * The café's step-by-step guides. They run on the shop's REAL screens in live
 * mode (lib/tour/guide-live): the overlay shows where to tap and what happens,
 * drawers are opened for the person to see, and nothing can be saved — every
 * write is refused while a guide runs.
 *
 * Anchors are `data-tour` values on the real controls (or a CSS selector);
 * a step whose anchor is not on screen shows as a centred card instead.
 */
import type { Tour } from "@/lib/tour/tours"

export type CafeGuide = Tour & {
  /** Only offered when the person can open this page (a module key). */
  module?: string
  /** Owner-only screens (reports, stock items…). */
  ownerOnly?: boolean
}

export const CAFE_GUIDES: CafeGuide[] = [
  {
    id: "cafe-add-customer",
    mode: "live",
    module: "customers",
    title: "إضافة زبون جديد",
    subtitle: "الاسم فقط يكفي — الهاتف اختياري",
    icon: "UserPlus",
    steps: [
      {
        route: "/customers",
        closeFirst: true,
        anchor: "page-add",
        title: "زر «زبون»",
        body: "من صفحة الزبائن اضغط «زبون» لإضافة زبون جديد.",
      },
      {
        prepare: "page-add",
        anchor: "customer-name",
        title: "اكتب الاسم",
        body: "هذا كل المطلوب: اسم الزبون كما تناديه.",
      },
      {
        anchor: "customer-phone",
        title: "الهاتف (اختياري)",
        body: "إن أعطاك رقمه اكتبه — يجده الكاشير بسرعة بالبحث. يمكنك تركه فارغاً.",
      },
      {
        anchor: "[data-form-primary]",
        title: "اضغط «حفظ»",
        body: "ويظهر الزبون فوراً في القائمة وعلى شاشة البيع. (في التدريب لا يُحفظ شيء.)",
      },
      {
        route: "/pos",
        closeFirst: true,
        prepareIfShown: "pos-cart-open",
        anchor: "pos-add-customer",
        title: "أو من شاشة البيع",
        body: "وأنت تبيع: هذا الزر يضيف زبوناً جديداً ويربطه بالطلب مباشرة.",
      },
    ],
  },
  {
    id: "cafe-sale",
    mode: "live",
    module: "pos",
    title: "عملية بيع",
    subtitle: "من اختيار المشروب حتى إتمام البيع",
    icon: "ShoppingBag",
    steps: [
      {
        route: "/pos",
        closeFirst: true,
        anchor: "pos-categories",
        title: "اختر التصنيف",
        body: "اضغط تصنيفاً لتظهر مشروباته فقط، أو «الكل» لرؤية المنيو كاملاً.",
      },
      {
        anchor: ".pos-tile",
        title: "اضغط على المشروب",
        body: "يُضاف إلى السلة. إن كان له أحجام أو نكهات تختارها قبل الإضافة.",
      },
      {
        prepareIfShown: "pos-cart-open",
        anchor: "pos-cart",
        title: "السلة",
        body: "هنا كل ما طلبه الزبون. غيّر الكمية بـ + و −، واحذف سطراً بـ ✕. وزر «+» فوق يفتح سلة ثانية لزبون آخر.",
      },
      {
        prepareIfShown: "pos-cart-open",
        anchor: "pos-customer",
        title: "الزبون (اختياري)",
        body: "اربط الطلب بزبون ليجمع نقاطاً، أو اتركه فارغاً لزبون عابر.",
      },
      {
        prepareIfShown: "pos-cart-open",
        anchor: "pos-note",
        title: "ملاحظة على الطلب",
        body: "مثل «بدون سكر» أو «تيك أواي» — تُطبع على الفاتورة.",
      },
      {
        prepareIfShown: "pos-cart-open",
        anchor: "pos-total",
        title: "الإجمالي",
        body: "يُحسب وحده. اضغط عليه إن أردت خصماً أو تقريب المبلغ.",
      },
      {
        prepareIfShown: "pos-cart-open",
        anchor: "pos-pay",
        title: "طريقة الدفع",
        body: "نقداً أو بطاقة — اختر قبل الإتمام.",
      },
      {
        prepareIfShown: "pos-cart-open",
        anchor: "pos-checkout",
        title: "«إتمام البيع»",
        body: "تُسجّل الفاتورة وتُطبع إن كانت الطابعة موصولة، وتُفرَّغ السلة للزبون التالي.",
      },
    ],
  },
  {
    id: "cafe-cash-sale",
    mode: "live",
    module: "pos",
    title: "بيع نقدي",
    subtitle: "الدفع نقداً — يدخل الصندوق تلقائياً",
    icon: "Banknote",
    steps: [
      {
        route: "/pos",
        closeFirst: true,
        anchor: ".pos-tile",
        title: "أضف المشروبات",
        body: "اضغط على المشروبات كما في أي بيع.",
      },
      {
        prepareIfShown: "pos-cart-open",
        anchor: "pos-pay-cash",
        title: "اختر «نقداً»",
        body: "هذا هو الاختيار الافتراضي. المبلغ يُضاف إلى حساب الصندوق تلقائياً.",
      },
      {
        prepareIfShown: "pos-cart-open",
        anchor: "pos-checkout",
        title: "«إتمام البيع»",
        body: "استلم النقود وأعطِ الباقي، ثم أتمّ البيع.",
      },
      {
        closeFirst: true,
        anchor: "pos-drawer",
        title: "الصندوق",
        body: "في بداية الوردية افتح الصندوق بعدّ النقود، وفي نهايتها أغلقه بعدّها مرة أخرى — ويخبرك النظام إن كان مطابقاً للمبيعات.",
      },
    ],
  },
  {
    id: "cafe-card-sale",
    mode: "live",
    module: "pos",
    title: "بيع بالبطاقة",
    subtitle: "الدفع بالبطاقة — لا يدخل الصندوق",
    icon: "CreditCard",
    steps: [
      {
        route: "/pos",
        closeFirst: true,
        anchor: ".pos-tile",
        title: "أضف المشروبات",
        body: "اضغط على المشروبات كما في أي بيع.",
      },
      {
        prepareIfShown: "pos-cart-open",
        anchor: "pos-pay-card",
        title: "اختر «بطاقة»",
        body: "قبل الإتمام. هكذا تُسجّل الفاتورة كدفع بالبطاقة، ولا تُحسب في نقود الصندوق.",
      },
      {
        prepareIfShown: "pos-cart-open",
        anchor: "pos-checkout",
        title: "«إتمام البيع»",
        body: "بعد نجاح الدفع على جهاز البطاقة، أتمّ البيع. تظهر الفاتورة في «الفواتير» مكتوباً عليها «بطاقة».",
      },
    ],
  },
  {
    id: "cafe-return",
    mode: "live",
    module: "pos",
    title: "إرجاع مشروب",
    subtitle: "إرجاع المبلغ للزبون نقداً أو للبطاقة",
    icon: "Undo2",
    steps: [
      {
        route: "/pos",
        closeFirst: true,
        prepareIfShown: "pos-cart-open",
        anchor: "pos-return",
        title: "زر «إرجاع»",
        body: "يحوّل السلة إلى وضع الإرجاع — تصبح حمراء حتى لا تختلط مع البيع.",
      },
      {
        closeFirst: true,
        anchor: ".pos-tile",
        title: "اختر ما أُعيد",
        body: "اضغط على المشروب الذي أعاده الزبون، بالكمية نفسها.",
      },
      {
        prepareIfShown: "pos-cart-open",
        anchor: "pos-pay",
        title: "كيف يعود المبلغ",
        body: "نقداً من الصندوق، أو للبطاقة — كما دفع الزبون.",
      },
      {
        prepareIfShown: "pos-cart-open",
        anchor: "pos-checkout",
        title: "«إتمام الإرجاع»",
        body: "يُسجَّل المرتجع في التقارير، والإرجاع النقدي يُخصم من حساب الصندوق تلقائياً.",
      },
    ],
  },
  {
    id: "cafe-drawer",
    mode: "live",
    module: "pos",
    title: "فتح وإغلاق الصندوق",
    subtitle: "عدّ النقود في بداية الوردية ونهايتها",
    icon: "Coins",
    steps: [
      {
        route: "/pos",
        closeFirst: true,
        anchor: "pos-drawer",
        title: "زر الصندوق",
        body: "بجانب التصنيفات. النقطة الخضراء تعني أن الصندوق مفتوح.",
      },
      {
        prepare: "pos-drawer",
        anchor: "drawer-sheet",
        title: "افتح أو أغلق",
        body: "عند الفتح: عُدّ النقود الموجودة واكتبها. عند الإغلاق: «أغلق الصندوق وعُدّ النقود» واكتب ما عددته — فيظهر «مطابق» أو كم ينقص أو يزيد. ولإخراج نقود (شراء حليب مثلاً) استخدم «إخراج نقد» مع السبب.",
      },
    ],
  },
  {
    id: "cafe-reports",
    mode: "live",
    module: "reports",
    ownerOnly: true,
    title: "التقارير",
    subtitle: "كم بعت، كم ربحت، وما الأكثر طلباً",
    icon: "ChartPie",
    steps: [
      {
        route: "/reports",
        closeFirst: true,
        anchor: "reports-period",
        title: "اختر الفترة",
        body: "يوم، أسبوع، شهر أو سنة — والأسهم تنقلك للفترة السابقة أو التالية.",
      },
      {
        prepare: "tab-overview",
        anchor: "tab-overview",
        title: "نظرة عامة",
        body: "المبيعات والفواتير ومتوسط الفاتورة، ومقارنة بالفترة السابقة.",
      },
      {
        prepare: "tab-profit",
        anchor: "tab-profit",
        title: "الأرباح",
        body: "دخل الصندوق − ما صرفته = ربحك. وتحتها أين ذهب كل شيكل.",
      },
      {
        prepare: "tab-items",
        anchor: "tab-items",
        title: "الأصناف",
        body: "أكثر المشروبات مبيعاً وربحاً. اضغط على أي مشروب لترى تقريره ومن يطلبه أكثر.",
      },
      {
        prepare: "tab-customers",
        anchor: "tab-customers",
        title: "الزبائن",
        body: "أفضل الزبائن ومن عاد ومن انقطع.",
      },
    ],
  },
  {
    id: "cafe-stock-add",
    mode: "live",
    module: "stock",
    ownerOnly: true,
    title: "إضافة صنف للمخزون",
    subtitle: "مادة خام: حليب، بن، أكواب…",
    icon: "PackagePlus",
    steps: [
      {
        route: "/stock",
        closeFirst: true,
        anchor: "stock-add",
        title: "زر «صنف»",
        body: "من صفحة المخزون اضغط «صنف» لإضافة مادة خام جديدة.",
      },
      {
        prepare: "stock-add",
        anchor: "item-name",
        title: "الاسم",
        body: "مثل «حليب كامل الدسم».",
      },
      {
        anchor: "item-category",
        title: "التصنيف",
        body: "اختر من القائمة (ألبان، قهوة، تغليف…) أو أضف تصنيفاً جديداً.",
      },
      {
        anchor: "item-supplier",
        title: "المورّد (اختياري)",
        body: "اختر المورّد أو اكتب اسماً جديداً لإضافته.",
      },
      {
        anchor: "item-buy",
        title: "كيف تشتريه",
        body: "الوحدة (قطعة، كيلو، لتر…) وكم في العبوة وسعرها — ومنها تُحسب تكلفة كل كوب.",
      },
      {
        anchor: "item-stock",
        title: "الموجود الآن والتنبيه",
        body: "اكتب الكمية الموجودة الآن، ومتى تريد أن ينبّهك النظام أنه قارب على النفاد.",
      },
      {
        anchor: "[data-form-primary]",
        title: "«إضافة الصنف»",
        body: "ويظهر في المخزون. عند كل شراء لاحقاً استخدم زر «شراء» على الصنف. (في التدريب لا يُحفظ شيء.)",
      },
    ],
  },
]
