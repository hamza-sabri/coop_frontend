/* كوب — menu + copy. Replace MENU with the shop's real list when it lands;
   `b` is the point price (≈ ₪ × 3.33) and is what the customer actually shops by. */
export type Item = { c:string; ar:string; en:string; he:string; dar:string; den:string; dhe:string;
                     p:number; b:number; g:[string,string]; t:string[]; image?:string;
                     /** Options this drink is actually sold in, from the API. */
                     v?:{ id:number; label:string; price:number }[] }
export type Cat  = { k:string; ar:string; en:string; he:string }

export const MENU: Item[] = [
 {c:'coffee',ar:'آيس لاتيه كراميل',en:'Caramel Iced Latte',he:'אייס לאטה קרמל',dar:'إسبريسو، حليب بارد، كراميل بيتي',den:'Espresso, cold milk, house caramel',dhe:'אספרסו, חלב קר, קרמל',p:18,b:60,g:['#8A5F33','#C9A063'],t:['cold'],image:'/koup/menu/caramel.webp'},
 {c:'coffee',ar:'آيس لاتيه بندق',en:'Hazelnut Iced Latte',he:'אייס לאטה אגוזי לוז',dar:'بندق محمّص ولاتيه بارد',den:'Roasted hazelnut over cold latte',dhe:'אגוזי לוז קלויים ולאטה קר',p:18,b:60,g:['#6E4A2E','#B07A46'],t:['cold'],image:'/koup/menu/hazelnut.webp'},
 {c:'coffee',ar:'سبانش لاتيه',en:'Spanish Latte',he:'לאטה ספרדי',dar:'حليب مكثّف محلّى',den:'Sweetened condensed milk',dhe:'חלב מרוכז ממותק',p:20,b:66,g:['#7A5432','#D0A874'],t:[],image:'/koup/menu/spanish.webp'},
 {c:'coffee',ar:'كراميل بدون سكر',en:'Sugar-Free Caramel',he:'קרמל ללא סוכר',dar:'نفس المتعة… بدون سكر',den:'Same pleasure, zero sugar',dhe:'אותה הנאה, בלי סוכר',p:19,b:64,g:['#4E5E8E','#8A9AC8'],t:['new'],image:'/koup/menu/sugarfree.webp'},
 {c:'smoothie',ar:'مشروب الجوافة',en:'Guava Cooler',he:'משקה גויאבה',dar:'من الشجرة للخلاط',den:'From the tree to the blender',dhe:'מהעץ לבלנדר',p:22,b:74,g:['#3F7A4E','#A8CF45'],t:['cold'],image:'/koup/menu/guava.webp'},
 {c:'smoothie',ar:'سموذي بيري',en:'Mixed Berry Smoothie',he:'סמות׳י פירות יער',dar:'توت مشكّل وحليب بارد',den:'Mixed berries, cold milk',dhe:'פירות יער וחלב קר',p:24,b:80,g:['#6A3468','#C05C9A'],t:['cold'],image:'/koup/menu/berry.webp'},
 {c:'protein',ar:'بروتين شيك شوكولاتة',en:'Chocolate Protein Shake',he:'שייק חלבון שוקולד',dar:'٢٥غ بروتين · طعم لذيذ وفائدة أكبر',den:'25g protein, tastes like dessert',dhe:'25 גרם חלבון',p:26,b:86,g:['#3C2A20','#8A5F33'],t:['new'],image:'/koup/menu/protein-choc.webp'},
 {c:'protein',ar:'بروتين شيك بيري',en:'Berry Protein Shake',he:'שייק חלבון פירות יער',dar:'٢٥غ بروتين · توت طبيعي',den:'25g protein, real berries',dhe:'25 גרם חלבון, פירות יער',p:26,b:86,g:['#5A2E5C','#B5568A'],t:[],image:'/koup/menu/protein-berry.webp'},
 {c:'breakfast',ar:'فرنش توست بالقرفة',en:'Cinnamon French Toast',he:'פרנץ׳ טוסט קינמון',dar:'مع آيس كريم فانيلا',den:'With vanilla ice cream',dhe:'עם גלידת וניל',p:28,b:92,g:['#7A5228','#D4A661'],t:[],image:'/koup/menu/frenchtoast.webp'},
 {c:'breakfast',ar:'بوكس كوب',en:'Koup Box',he:'קופסת קופ',dar:'أحلى رفيق للماتش · يكفي ٣–٤',den:'Best match-night companion, serves 3–4',dhe:'מושלם לערב משחק',p:75,b:250,g:['#253465','#4A5C9B'],t:['new'],image:'/koup/menu/koupbox.webp'},
 {c:'dessert',ar:'تشيز كيك',en:'Cheesecake',he:'עוגת גבינה',dar:'قطعة يومية طازة',den:'Baked fresh daily',dhe:'נאפה טרי כל יום',p:22,b:74,g:['#8A6F4A','#E0C79A'],t:[],image:'/koup/menu/cheesecake.webp'},
 {c:'dessert',ar:'كوكيز كوب',en:'Koup Cookie',he:'עוגיית קופ',dar:'شوكولاتة دارك',den:'Dark chocolate',dhe:'שוקולד מריר',p:12,b:40,g:['#4A3324','#9C6B3E'],t:[],image:'/koup/menu/cookie.webp'},
];
export const CATS: Cat[] = [
 {k:'all',ar:'الكل',en:'All',he:'הכל'},{k:'coffee',ar:'قهوة',en:'Coffee',he:'קפה'},
 {k:'smoothie',ar:'سموذي وعصائر',en:'Smoothies',he:'שייקים'},{k:'protein',ar:'بروتين',en:'Protein',he:'חלבון'},
 {k:'breakfast',ar:'فطور',en:'Breakfast',he:'ארוחת בוקר'},{k:'dessert',ar:'حلويات',en:'Desserts',he:'קינוחים'},
];
export const TAGS: Record<string, Record<string,string>> = {cold:{ar:'بارد',en:'Cold',he:'קר'},new:{ar:'جديد',en:'New',he:'חדש'}};

/* ══════════ i18n ══════════ */
export const T: Record<string, Record<string,string>> = {
 en:{
 'home.account':'My account','home.hiPrefix':'Good morning,','home.hiAnon':'Welcome to كوب ☕','home.subAnon':'Sign in and start collecting points','home.anonPitch':'Every cup earns points — and points buy a cup.','home.tonextTail':' points to go and the caramel iced latte is on us 🎉','menu.count':'items','cart.offline':'No connection — you can browse, but ordering needs the network.','nav.home':'Home','nav.menu':'Menu','nav.item':'Drink customiser','nav.cart':'Cart & points payment','nav.track':'Order tracking','nav.wallet':'Points wallet','nav.rewards':'Rewards & tiers','nav.menu2':'Menu','nav.cart2':'Cart','nav.wallet2':'Points','nav.rewards2':'Rewards',
 'home.hi':'Good morning, Hamza ☕','home.sub':'Your second place is ready','tier.double':'Double tier · 1.25×','unit.points':'points','unit.points2':'points from this order',
 'home.tonext':'<b class="num" id="gapN">12</b> points to go — the caramel iced latte is on us 🎉','home.scan':'Scan at the counter','home.wallet':'My points',
 'stat.streak':'weeks in a row','stat.cups':'cups this year','stat.free':'free drinks','home.live':'Your order','home.liveT':'Caramel Iced Latte + French Toast','home.liveS':'Being prepared · order #1042','home.eta':'3 min',
 'home.forYou':'Picked for you','common.all':'Full menu','home.challenges':'This week’s challenges',
 'ch1.t':'3 visits this week','ch1.s':'2 of 3 done','ch1.a':'2 / 3','ch1.b':'2 days left',
 'ch2.t':'Try something new','ch2.s':'Any drink you haven’t ordered','ch2.a':'0 / 1','ch2.b':'5 days left',
 'menu.h':'Menu','menu.sub':'Every item has two prices: shekels or points','menu.search':'Search a drink or dish…',
 'cart.h':'Your cart','cart.sub':'3 items · Koup — Street 22','cart.pickup':'Pickup','cart.dinein':'At the table','cart.delivery':'Delivery',
 'ci1.n':'Caramel Iced Latte','ci1.m':'Large · almond milk · extra shot','ci2.n':'Cinnamon French Toast','ci2.m':'With ice cream','ci3.n':'Guava Cooler','ci3.m':'No added sugar',
 'cart.pay':'Pay with your points','cart.avail':'You have','cart.saved':'Saved','cart.sub2':'Subtotal','cart.disc':'Points discount','cart.fee':'Fees','cart.total':'Total','cart.earn':'You’ll earn','cart.confirm':'Place order','cart.cash':'Cash on collection · points land instantly',
 'tr.h':'Order #1042','tr.sub':'Delivery · Street 22, Qalqilya','tr.eta':'Ready in about 3 minutes','tr.s1':'Order received','tr.s1t':'9:38','tr.s2':'Barista started your order','tr.s2t':'9:40','tr.s3':'On the way to you','tr.s3t':'Mahmoud left the shop','tr.s4':'Delivered','tr.s4t':'—',
 'tr.driver':'Your driver','dr.name':'Mahmoud Abu Zeid','dr.deliv':'deliveries','tr.rate':'After delivery you can rate Mahmoud ⭐ — it shows on his profile.','tr.pending':'18 points held — they drop into your cup on delivery',
 'w.h':'My points','w.sub':'One currency — no maths','w.worth':'Worth about <b>₪75</b> off the menu','w.redeem':'Spend points','w.qr':'My code','w.can':'You can get right now','w.hist':'Activity',
 'l1.t':'Order #1042 · delivery','l1.d':'Today 9:38','l2.t':'Hazelnut Iced Latte — free','l2.d':'Yesterday 16:20','l3.t':'Challenge: 3 visits','l3.d':'18 Aug','l4.t':'Counter scan · cash','l4.d':'17 Aug','l5.t':'40 points expire in 30 days','l5.d':'Heads up',
 'r.h':'Rewards','r.sub':'The more you visit, the faster points come','r.tiers':'Your tier','t1.n':'Single','t1.d':'Starting point · 1.0×','t2.n':'Double — you are here','t2.d':'10 visits in a month · holds 3 months','t3.n':'Triple','t3.d':'2,500 points a year · points never expire','r.next':'1,550 points to reach Triple',
 'r.streak':'Your streak','r.streakT':'6 weeks in a row','r.streakS':'Visit before Sunday to make it 7','r.saver':'You have one streak-saver this month','r.badges':'Your badges',
 'b1':'5 cold drinks','b2':'Koup breakfast ×3','b3':'Match night','b4':'Koup Box','b5':'Protein shake','b6':'100 cups','b7':'Ramadan quiz','b8':'Refer 3 friends',
 'r.ref':'Refer a friend','r.refS':'You both get 30 points after their first order',
 'it.n':'Caramel Iced Latte','it.d':'Italian espresso, cold milk, house caramel — also available sugar-free.','it.size':'Size','it.sm':'Medium','it.lg':'Large','it.milk':'Milk','it.full':'Whole','it.skim':'Low fat','it.almond':'Almond','it.oat':'Oat','it.extra':'Extras','it.shot':'Extra shot','it.nosugar':'No sugar','it.cream':'Cream','it.add':'Add to cart','it.or':'or for','common.nice':'Nice 👌',
 'home.initial':'H','t1.x':'1.0×','t2.x':'1.25×','t3.x':'1.5×','ch1.r':'+20','ch2.r':'+15','r.streakR':'+25','r.refR':'+30',
 'hint':'Tap the cup to replay the opening (with sound), or try “Scan at the counter” to see points fly in.'},

 he:{
 'home.account':'החשבון שלי','home.hiPrefix':'בוקר טוב,','home.hiAnon':'ברוך הבא ל־كوب ☕','home.subAnon':'התחבר והתחל לאסוף נקודות','home.anonPitch':'כל כוס מזכה בנקודות — והנקודות קונות כוס.','home.tonextTail':' נקודות ואייס לאטה קרמל עלינו 🎉','menu.count':'פריטים','cart.offline':'אין חיבור — אפשר לעיין, אבל הזמנה דורשת רשת.','nav.home':'בית','nav.menu':'תפריט','nav.item':'התאמת משקה','nav.cart':'סל ותשלום בנקודות','nav.track':'מעקב הזמנה','nav.wallet':'ארנק הנקודות','nav.rewards':'תגמולים ודרגות','nav.menu2':'תפריט','nav.cart2':'סל','nav.wallet2':'נקודות','nav.rewards2':'תגמולים',
 'home.hi':'בוקר טוב, חמזה ☕','home.sub':'המקום השני שלך מוכן','tier.double':'דרגת דאבל · 1.25×','unit.points':'נקודות','unit.points2':'נקודות מההזמנה',
 'home.tonext':'נשארו <b class="num" id="gapN">12</b> נקודות והאייס לאטה קרמל עלינו 🎉','home.scan':'סרוק בקופה','home.wallet':'הנקודות שלי',
 'stat.streak':'שבועות ברצף','stat.cups':'כוסות השנה','stat.free':'משקאות חינם','home.live':'ההזמנה שלך','home.liveT':'אייס לאטה קרמל + פרנץ׳ טוסט','home.liveS':'בהכנה · הזמנה 1042#','home.eta':'3 דק׳',
 'home.forYou':'נבחר עבורך','common.all':'תפריט מלא','home.challenges':'אתגרי השבוע',
 'ch1.t':'3 ביקורים השבוע','ch1.s':'2 מתוך 3','ch1.a':'2 / 3','ch1.b':'נשארו יומיים',
 'ch2.t':'נסה משהו חדש','ch2.s':'כל משקה שעוד לא הזמנת','ch2.a':'0 / 1','ch2.b':'נשארו 5 ימים',
 'menu.h':'תפריט','menu.sub':'לכל פריט שני מחירים: שקלים או נקודות','menu.search':'חפש משקה או מנה…',
 'cart.h':'הסל שלך','cart.sub':'3 פריטים · קופ — רחוב 22','cart.pickup':'איסוף','cart.dinein':'לשולחן','cart.delivery':'משלוח',
 'ci1.n':'אייס לאטה קרמל','ci1.m':'גדול · חלב שקדים · שוט נוסף','ci2.n':'פרנץ׳ טוסט קינמון','ci2.m':'עם גלידה','ci3.n':'משקה גויאבה','ci3.m':'ללא תוספת סוכר',
 'cart.pay':'שלם בנקודות שלך','cart.avail':'יש לך','cart.saved':'חסכת','cart.sub2':'סכום ביניים','cart.disc':'הנחת נקודות','cart.fee':'עמלות','cart.total':'סה"כ','cart.earn':'תרוויח','cart.confirm':'אשר הזמנה','cart.cash':'תשלום במזומן באיסוף · הנקודות נכנסים מיד',
 'tr.h':'הזמנה 1042#','tr.sub':'משלוח · רחוב 22, קלקיליה','tr.eta':'מוכן בעוד כ־3 דקות','tr.s1':'ההזמנה התקבלה','tr.s1t':'9:38','tr.s2':'הבריסטה התחיל להכין','tr.s2t':'9:40','tr.s3':'בדרך אליך','tr.s3t':'מחמוד יצא מהחנות','tr.s4':'נמסר','tr.s4t':'—',
 'tr.driver':'השליח שלך','dr.name':'מחמוד אבו זייד','dr.deliv':'משלוחים','tr.rate':'אחרי המסירה תוכל לדרג את מחמוד ⭐ — הדירוג מופיע בפרופיל שלו.','tr.pending':'18 נקודות שמורים — ייכנסו לכוס עם המסירה',
 'w.h':'הנקודות שלי','w.sub':'מטבע אחד — בלי חשבונות','w.worth':'שווים בערך <b>₪75</b> מהתפריט','w.redeem':'מימוש נקודות','w.qr':'הקוד שלי','w.can':'אפשר לקחת עכשיו','w.hist':'פעילות',
 'l1.t':'הזמנה 1042# · משלוח','l1.d':'היום 9:38','l2.t':'אייס לאטה אגוזי לוז — חינם','l2.d':'אתמול 16:20','l3.t':'אתגר: 3 ביקורים','l3.d':'18 באוג׳','l4.t':'סריקה בקופה · מזומן','l4.d':'17 באוג׳','l5.t':'40 נקודות יפוגו בעוד 30 יום','l5.d':'שים לב',
 'r.h':'תגמולים','r.sub':'ככל שתבקר יותר, הנקודות מגיעים מהר יותר','r.tiers':'הדרגה שלך','t1.n':'סינגל','t1.d':'נקודת פתיחה · 1.0×','t2.n':'דאבל — אתה כאן','t2.d':'10 ביקורים בחודש · נשמר 3 חודשים','t3.n':'טריפל','t3.d':'2,500 נקודות בשנה · הנקודות לא פגים','r.next':'נשארו 1,550 נקודות לטריפל',
 'r.streak':'הרצף שלך','r.streakT':'6 שבועות ברצף','r.streakS':'בקר לפני יום ראשון וזה יהיה 7','r.saver':'יש לך מציל־רצף אחד החודש','r.badges':'התגים שלך',
 'b1':'5 משקאות קרים','b2':'ארוחת בוקר ×3','b3':'ערב משחק','b4':'קופסת קופ','b5':'שייק חלבון','b6':'100 כוסות','b7':'חידון רמדאן','b8':'הזמן 3 חברים',
 'r.ref':'הזמן חבר','r.refS':'שניכם מקבלים 30 נקודות אחרי ההזמנה הראשונה שלו',
 'it.n':'אייס לאטה קרמל','it.d':'אספרסו איטלקי, חלב קר, קרמל של הבית — קיים גם ללא סוכר.','it.size':'גודל','it.sm':'בינוני','it.lg':'גדול','it.milk':'חלב','it.full':'מלא','it.skim':'דל שומן','it.almond':'שקדים','it.oat':'שיבולת שועל','it.extra':'תוספות','it.shot':'שוט נוסף','it.nosugar':'ללא סוכר','it.cream':'קצפת','it.add':'הוסף לסל','it.or':'או ב־','common.nice':'מעולה 👌',
 'home.initial':'ח','t1.x':'1.0×','t2.x':'1.25×','t3.x':'1.5×','ch1.r':'+20','ch2.r':'+15','r.streakR':'+25','r.refR':'+30',
 'hint':'הקש על הכוס כדי להריץ שוב את הפתיחה (עם קול), או נסה “סרוק בקופה”.'}
};
