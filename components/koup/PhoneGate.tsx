'use client'
/* The door while sign-up is by mobile number at the counter.

   No Google, no Facebook: the staff register each customer at the till with
   their name and mobile number, points start counting there, and the كوب app
   (coming soon) will sign them in with that same number by SMS code. */
import { useEffect } from 'react'
import { gsap } from 'gsap'

export default function PhoneGate() {
  useEffect(() => {
    gsap.fromTo('.gate-card', { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: .7, ease: 'expo.out', delay: .2 })
    gsap.fromTo('.gate-card > *', { y: 12, opacity: 0 },
      { y: 0, opacity: 1, duration: .45, stagger: .06, ease: 'power3.out', delay: .34 })
  }, [])

  return (
    <div className="gate">
      <div className="gate-card">
        <div className="gate-lockup">
          <div className="gate-word">كوب</div>
          <div className="gate-rule" />
        </div>
        <h2 className="gate-h">نقاطك برقم جوالك</h2>
        <p className="gate-p">
          عند الكاشير، قول اسمك ورقم جوالك — وكل كوب بيقرّبك من كوب مجاني.
        </p>
        <div className="phone-steps">
          <div><b>١</b><span>سجّل عند الكاشير برقم جوالك</span></div>
          <div><b>٢</b><span>نقاطك بتنحسب مع كل طلب</span></div>
          <div><b>٣</b><span>تطبيق كوب قريباً — بتدخله بنفس الرقم وبتلاقي نقاطك</span></div>
        </div>
      </div>
    </div>
  )
}
