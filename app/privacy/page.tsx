/* Privacy policy + data-deletion instructions for the customer page.
   Facebook Login needs both URLs before the app can go Live. */
export const metadata = { title: "الخصوصية — كوب" }

export default function Privacy() {
  return (
    <main dir="rtl" style={{ maxWidth: 680, margin: "0 auto", padding: "40px 20px", lineHeight: 1.9, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 26, fontWeight: 800 }}>سياسة الخصوصية — كوب</h1>
      <p>عند تسجيل الدخول عبر Google أو فيسبوك نحفظ: اسمك، صورتك، بريدك الإلكتروني (إن وُجد)، ورقم جوالك وجنسك وتاريخ ميلادك إذا أدخلتها بنفسك.</p>
      <p>نستخدم هذه البيانات فقط لربط زياراتك ونقاطك في المقهى بحسابك، ولإرسال عروض تخصّك. لا نبيع بياناتك ولا نشاركها مع أي جهة.</p>
      <h2 id="delete" style={{ fontSize: 20, fontWeight: 800, marginTop: 28 }}>حذف بياناتك</h2>
      <p>لحذف حسابك وكل بياناتك: اطلب ذلك من الكاشير في المقهى، أو راسلنا عبر صفحتنا على فيسبوك/إنستغرام. نحذف البيانات خلال ٧ أيام.</p>
      <p>يمكنك أيضاً إزالة صلاحية «كوب» من حسابك على فيسبوك: الإعدادات ← التطبيقات ومواقع الويب ← كوب ← إزالة.</p>
    </main>
  )
}
