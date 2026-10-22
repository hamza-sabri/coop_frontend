/* Privacy policy + how to delete your data — for the customer app on the web
   and in the App Store / Google Play (both stores link to this page). */
export const metadata = { title: "الخصوصية — كوب" }

const h2 = { fontSize: 20, fontWeight: 800, marginTop: 28 } as const

export default function Privacy() {
  return (
    <main dir="rtl" style={{ maxWidth: 680, margin: "0 auto", padding: "40px 20px", lineHeight: 1.9, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 26, fontWeight: 800 }}>سياسة الخصوصية — كوب</h1>
      <p>هذه السياسة تخص تطبيق «كوب» (على الويب وعلى iPhone وAndroid) وبرنامج النقاط في المقهى.</p>

      <h2 style={h2}>ماذا نحفظ</h2>
      <ul>
        <li>رقم جوالك — هو حسابك، وبه نرسل لك رمز الدخول برسالة SMS.</li>
        <li>اسمك، وإن أدخلتها بنفسك: جنسك وتاريخ ميلادك.</li>
        <li>طلباتك وفواتيرك ونقاطك في المقهى.</li>
        <li>رمز الإشعارات لجهازك، إن سمحت بالإشعارات — لنخبرك بحالة طلبك.</li>
      </ul>

      <h2 style={h2}>لماذا</h2>
      <p>لتسجيل دخولك، ولربط زياراتك ونقاطك وطلباتك بحسابك، ولإخبارك بحالة طلبك. لا نبيع بياناتك ولا نشاركها مع أي جهة للإعلان. نستعين فقط بمزوّد الرسائل لإرسال رمز الدخول، وبخدمات الإشعارات (Apple وGoogle) لإيصال تنبيهات الطلب.</p>

      <h2 id="delete" style={h2}>حذف حسابك</h2>
      <p>من التطبيق: حسابي ← «حذف حسابي». يُحذف اسمك ورقمك وبياناتك ونقاطك فوراً، وتنتهي كل جلسات الدخول. فواتيرك القديمة تبقى في سجلات المقهى المحاسبية بدون اسمك أو رقمك.</p>
      <p>أو اطلب الحذف من الكاشير في المقهى، ونحذفه خلال ٧ أيام.</p>
    </main>
  )
}
