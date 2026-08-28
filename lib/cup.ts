/* ==========================================================================
   كوب — the cup, in WebGL.

   The fill level IS the bean balance, so it has to be a real continuous
   quantity that can be poured, not a sprite. The liquid is a lathe column cut
   by an animated clipping plane, topped by a shader surface that sloshes.

   Ring, pour stream, steam and bloom are all shader planes on purpose: an
   earlier version rebuilt the ring's TorusGeometry every frame during a pour
   (~190 allocations a second) and that was half of why the opening stuttered.
   The other half was tweening the fill AND lerping toward it — two easings
   stacked, so it never arrived. fillTo() drives the value directly.
   ========================================================================== */
import * as THREE from 'three'
import { gsap } from 'gsap'

const T: any = THREE
const G = gsap

/* Is this a phone that will struggle? No API answers that, so this is the
   usual triangulation: core count, reported memory, and the user's own
   reduced-motion preference, which is also a "keep it calm" signal. Wrong
   guesses are cheap in one direction (a slightly softer cup) and expensive in
   the other (a café app that stutters), so it errs toward cheap. */
function lowPower(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { deviceMemory?: number };
  if (typeof matchMedia === "function"
      && matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
  if ((nav.hardwareConcurrency ?? 8) <= 4) return true;
  if ((nav.deviceMemory ?? 8) <= 4) return true;
  return false;
}

export const Cup = (() => {
  let running = false;
/* ══════════════════════════════════════════════════════════════════════════
 THE CUP — WebGL clay render of the كوب cup.
 Liquid = a column cut by a clipping plane + a sloshing shader surface.
 Ring, pour stream and steam are all shader planes — no geometry churn,
 which is what made the first pour stutter.
 ══════════════════════════════════════════════════════════════════════════ */
let renderer: any, scene: any, camera: any, stage: any, entry: any,
    cupGroup: any, liquidCol: any, surface: any, rim: any, clip: any, t0 = 0;
let beans: any[] = [], ring: any, stream: any, steam: any, glow: any, drop: any;
let fill = 0, targetFill = 0, lerping = true, wobble = 0, spin = 0, ok = false;
const H = 2.66, Y0 = 0.09, TILT = 0.30;
const rAt = (y: number) => 0.70 + (1.08 - 0.70) * (y / H);
const st = { f: 0, ring: 0, stream: 0, steam: 0 };

function envTex(){
  const c = document.createElement('canvas'); c.width = 64; c.height = 32;
  const x = c.getContext('2d')!;
  const g = x.createLinearGradient(0, 0, 0, 32);
  g.addColorStop(0, '#dfe6ff'); g.addColorStop(.42, '#8f9dcd');
  g.addColorStop(.62, '#3a4674'); g.addColorStop(1, '#171d33');
  x.fillStyle = g; x.fillRect(0, 0, 64, 32);
  x.fillStyle = 'rgba(255,240,215,.95)'; x.beginPath(); x.ellipse(18, 7, 9, 4.5, 0, 0, 7); x.fill();
  x.fillStyle = 'rgba(255,215,160,.55)'; x.beginPath(); x.ellipse(48, 12, 7, 4, 0, 0, 7); x.fill();
  const t = new T.CanvasTexture(c); t.mapping = T.EquirectangularReflectionMapping; return t;
}

function logoTex(){
  const W = 1024, Hh = 512;
  const c = document.createElement('canvas'); c.width = W; c.height = Hh;
  const x = c.getContext('2d')!;
  x.fillStyle = '#24336a'; x.fillRect(0, 0, W, Hh);
  const g = x.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, 'rgba(0,0,0,.34)'); g.addColorStop(.25, 'rgba(255,255,255,.06)');
  g.addColorStop(.5, 'rgba(0,0,0,.22)'); g.addColorStop(.75, 'rgba(255,255,255,.04)');
  g.addColorStop(1, 'rgba(0,0,0,.34)');
  x.fillStyle = g; x.fillRect(0, 0, W, Hh);
  [0.17, 0.5, 0.83].forEach((u: number) => {
    const cx = W * u;
    x.save();
    x.translate(cx, Hh * .35); x.scale(3.0, 3.0); x.translate(-27.5, -21);
    x.strokeStyle = '#F7F1E8'; x.lineWidth = 4.4; x.lineCap = 'round'; x.lineJoin = 'round';
    x.stroke(new Path2D('M6 30c8-14 18-18 26-12 6 4.5 4 12-2 12-4 0-6-3-4.5-6'));
    x.stroke(new Path2D('M34 30c6 0 10-3 13-8'));
    x.fillStyle = '#DDBC8A'; x.beginPath(); x.arc(49, 19, 2.8, 0, 7); x.fill();
    x.restore();
    x.save();
    x.translate(cx, Hh * .53);
    x.fillStyle = 'rgba(247,241,232,.86)';
    x.font = '600 19px "Bricolage Grotesque", "Helvetica Neue", sans-serif';
    x.textAlign = 'center'; x.letterSpacing = '6px';
    x.fillText('COFFEE HOUSE', 5, 0);
    x.restore();
  });
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

const NOISE = `
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
  float fbm(vec2 p){ float v = 0., a = .5;
    for(int i = 0; i < 4; i++){ v += a * vnoise(p); p *= 2.03; a *= .5; } return v; }`;

function init(){
  try{ renderer = new T.WebGLRenderer({ antialias:true, alpha:true, powerPreference:'high-performance' }); }
  catch { return false; }
  if(!renderer) return false;
  /* Shader cost scales with the square of this number, and it is the single
     biggest lever on a phone. A 3x Android screen rendering at 1.75 is doing
     three times the fragment work of one at 1.0 for a cup that is 40mm tall.
     Weak devices get 1.15; everything else keeps the crisp 1.75. */
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, lowPower() ? 1.15 : 1.75));
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .96;
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.localClippingEnabled = true;

  scene = new T.Scene();
  camera = new T.PerspectiveCamera(30, 1, .1, 60);
  camera.position.set(0, 5.0, 10.9); camera.lookAt(0, .70, 0);

  const pmrem = new T.PMREMGenerator(renderer);
  scene.environment = pmrem.fromEquirectangular(envTex()).texture;

  stage = new T.Group(); scene.add(stage);
  entry = new T.Group(); stage.add(entry);
  cupGroup = new T.Group(); entry.add(cupGroup);

  /* bloom behind the cup */
  glow = new T.Mesh(new T.PlaneGeometry(7.2, 7.2), new T.ShaderMaterial({
    transparent:true, depthWrite:false, blending:T.AdditiveBlending,
    uniforms:{ uC:{ value:new T.Color(0xC9A063) }, uO:{ value:1 } },
    vertexShader:'varying vec2 v; void main(){ v=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'uniform vec3 uC; uniform float uO; varying vec2 v; void main(){ float d=length(v-.5)*2.; float a=pow(max(0.,1.-d),3.2)*.42*uO; gl_FragColor=vec4(uC,a);}'
  }));
  glow.position.set(0, 1.5, -2.4); stage.add(glow);

  /* outer shell */
  const pts = [ new T.Vector2(0, 0), new T.Vector2(.64, 0), new T.Vector2(.70, .04) ];
  for(let i = 1; i <= 16; i++){ const y = H * i / 16; pts.push(new T.Vector2(rAt(y), y)); }
  cupGroup.add(new T.Mesh(
    new T.LatheGeometry(pts, 72),
    new T.MeshPhysicalMaterial({ color:0xCDD3E8, map:logoTex(), roughness:.55, metalness:0,
      clearcoat:.42, clearcoatRoughness:.5, sheen:.32, sheenColor:new T.Color(0x93a3dd),
      side:T.FrontSide, envMapIntensity:.55 })
  ));
  /* cream inner shell, so the coffee reads */
  const ip = [ new T.Vector2(0, .03), new T.Vector2(.60, .03) ];
  for(let i = 1; i <= 16; i++){ const y = .03 + (H - .03) * i / 16; ip.push(new T.Vector2(rAt(y) - .035, y)); }
  cupGroup.add(new T.Mesh(
    new T.LatheGeometry(ip, 64),
    new T.MeshPhysicalMaterial({ color:0xE4DACA, roughness:.78, metalness:0, side:T.BackSide,
      envMapIntensity:.35 })
  ));

  rim = new T.Mesh(new T.TorusGeometry(1.062, .06, 12, 72),
    new T.MeshPhysicalMaterial({ color:0xE9E0D0, roughness:.62, metalness:0, clearcoat:.3,
      sheen:.4, envMapIntensity:.45 }));
  rim.rotation.x = Math.PI / 2; rim.position.y = H; cupGroup.add(rim);

  /* liquid */
  clip = new T.Plane(new T.Vector3(0, -1, 0), Y0);
  const lp = [ new T.Vector2(0, Y0), new T.Vector2(.58, Y0) ];
  for(let i = 1; i <= 16; i++){ const y = Y0 + (H - Y0) * i / 16; lp.push(new T.Vector2(rAt(y) - .045, y)); }
  liquidCol = new T.Mesh(new T.LatheGeometry(lp, 56),
    new T.MeshPhysicalMaterial({ color:0x8A5C30, roughness:.32, metalness:0, clearcoat:.75,
      clearcoatRoughness:.2, clippingPlanes:[clip], side:T.DoubleSide, envMapIntensity:.7 }));
  cupGroup.add(liquidCol);

  /* One bead of coffee that leaps off the surface when the pour stops and
     falls back in. Real liquid does this; it is the detail that says the
     surface has mass. Same material as the column so it reads as the same
     coffee, not as a bead of glass. */
  drop = new T.Mesh(new T.SphereGeometry(.125, 22, 16),
    new T.MeshPhysicalMaterial({ color:0x8A5C30, roughness:.24, metalness:0,
      clearcoat:.9, clearcoatRoughness:.14, envMapIntensity:.8 }));
  drop.visible = false; cupGroup.add(drop);

  surface = new T.Mesh(new T.CircleGeometry(1, 48, 0, Math.PI * 2), new T.ShaderMaterial({
    uniforms:{ uT:{value:0}, uW:{value:0} },
    vertexShader:`uniform float uT,uW; varying vec2 vU; varying float vH;
      void main(){ vec3 p=position; float r=length(p.xy);
        float w=sin(p.x*4.1+uT*2.3)*.5+sin(p.y*3.4-uT*1.9)*.5;
        float e=smoothstep(.1,1.0,r);
        vH=w*uW*e; p.z+=vH*.10; vU=p.xy;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader:`varying vec2 vU; varying float vH;
      void main(){ float r=length(vU);
        vec3 mid=vec3(.42,.27,.15), edge=vec3(.79,.62,.38);
        vec3 col=mix(mid,edge,smoothstep(.42,1.,r));
        col+=vH*.16; col+=pow(smoothstep(.86,1.,r),2.)*.34;
        col+=max(0.,.16-abs(vU.y-.28))*.9*vec3(1.,.93,.8);
        gl_FragColor=vec4(col,1.);}`
  }));
  surface.rotation.x = -Math.PI / 2; cupGroup.add(surface);

  /* ── progress ring: one shader plane, so a fill tween never rebuilds geometry ── */
  ring = new T.Mesh(new T.PlaneGeometry(4.3, 4.3), new T.ShaderMaterial({
    transparent:true, depthWrite:false, blending:T.AdditiveBlending,
    uniforms:{ uP:{value:0}, uT:{value:0}, uO:{value:1} },
    vertexShader:'varying vec2 v; void main(){ v=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`uniform float uP,uT,uO; varying vec2 v;
      #define PI 3.14159265
      void main(){
        vec2 p = v*2.-1.; float r = length(p);
        float band = smoothstep(.80,.855,r) * (1.-smoothstep(.925,.975,r));
        if(band <= 0.001){ discard; }
        float a01 = (atan(p.y,p.x)+PI)/(2.*PI);
        float t = fract(.25 + a01);
        float on = smoothstep(uP+.004, uP-.004, t);
        float head = smoothstep(uP-.055, uP, t) * on;
        float shimmer = .5+.5*sin(t*38. - uT*2.2);
        vec3 base = vec3(.10,.13,.28);
        vec3 gold = vec3(.86,.72,.48) * (.82 + shimmer*.28);
        vec3 col = mix(base, gold, on) + head*1.5*vec3(1.,.92,.78);
        gl_FragColor = vec4(col, band*(.30 + on*.62 + head*.5)*uO);
      }`
  }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = -.30; stage.add(ring);

  /* ── pour stream ──────────────────────────────────────────────────────────
     It read as a laser for three reasons, all fixed here:
       1. depthTest was off, so it painted straight down the FRONT of the cup
          instead of disappearing into it. Now the cup occludes it, which is
          the single thing that makes it look poured rather than projected.
       2. The core was near-white gold with additive-ish lift. Coffee is dark;
          only a thin refraction line on one edge should be bright.
       3. No texture. A smooth sine-wobbled bar is a beam. Real liquid has
          grain scrolling down it and necks as it accelerates. */
  stream = new T.Mesh(new T.PlaneGeometry(1.5, 3.1), new T.ShaderMaterial({
    transparent:true, depthWrite:false, depthTest:true,
    uniforms:{ uT:{value:0}, uO:{value:0} },
    vertexShader:'varying vec2 v; void main(){ v=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`uniform float uT,uO; varying vec2 v; ${NOISE}
      void main(){
        float y = v.y;              // 1 at the spout, 0 at the surface
        float fall = 1. - y;

        // leaves the spout as a lip and necks down as gravity takes it
        float w = mix(.118, .064, pow(fall, .55));

        // never plumb — and the drift widens the further it has fallen
        float wob = (sin(y*5.2 - uT*6.)*.020 + sin(y*11. + uT*9.)*.009) * (.35 + fall);

        float d    = abs(v.x - .5 - wob);
        float core = 1. - smoothstep(w*.55, w, d);
        float skin = 1. - smoothstep(w, w*1.6, d);

        // grain travelling downward: this is what stops it reading as a beam
        float flow = vnoise(vec2(v.x*9., y*7. + uT*3.4))*.55
                   + vnoise(vec2(v.x*22., y*19. + uT*7.))*.28;
        float body = core * (.72 + flow*.5);

        // one refraction line just off the axis — not a glowing centre
        float spec = (1. - smoothstep(0., w*.34, abs(v.x - .5 - wob + w*.34)))
                   * (.30 + flow*.45);

        float top = smoothstep(1., .82, y);   // fades in from off-frame
        float bot = smoothstep(0., .07, y);
        float a   = (body*.95 + skin*.34 + spec*.5) * top * bot * uO;

        vec3 col = mix(vec3(.20,.105,.050), vec3(.42,.235,.110), core);
        col = mix(col, vec3(.74,.55,.34), spec*.85);
        gl_FragColor = vec4(col, clamp(a, 0., 1.));
      }`
  }));
  stream.position.set(0, H + 1.15, .12); stream.renderOrder = 12; stage.add(stream);

  /* ── steam ── */
  steam = new T.Mesh(new T.PlaneGeometry(1.9, 2.7), new T.ShaderMaterial({
    transparent:true, depthWrite:false, blending:T.AdditiveBlending,
    uniforms:{ uT:{value:0}, uO:{value:0} },
    vertexShader:'varying vec2 v; void main(){ v=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`uniform float uT,uO; varying vec2 v; ${NOISE}
      void main(){
        vec2 uv = v;
        float t = uT*.13;
        float n = fbm(vec2(uv.x*3.0 + sin(uv.y*3.2+t*2.2)*.42, uv.y*2.0 - t*2.6));
        float body = smoothstep(.44,.86,n);
        float fy = smoothstep(0.,.16,uv.y) * (1.-smoothstep(.42,1.,uv.y));
        float fx = smoothstep(0.,.24,uv.x) * (1.-smoothstep(.76,1.,uv.x));
        gl_FragColor = vec4(vec3(1.,.965,.92), body*fy*fx*uO*.42);
      }`
  }));
  steam.position.set(0, H + .95, .05); stage.add(steam);

  /* beans */
  const beanGeo = new T.IcosahedronGeometry(.115, 2);
  const beanMat = new T.MeshPhysicalMaterial({ color:0xD9AE72, roughness:.42, metalness:0,
    clearcoat:.55, clearcoatRoughness:.35, envMapIntensity:.9 });
  for(let i = 0; i < 7; i++){
    const m = new T.Mesh(beanGeo, beanMat);
    m.scale.setScalar(0);
    m.userData = { s:1, r: 1.70 + (i % 3) * .34, y: .35 + (i % 4) * .70,
      sp: .30 + (i % 5) * .075, ph: i * (Math.PI * 2 / 7), tilt: (i % 2 ? .16 : -.13) };
    beans.push(m); stage.add(m);
  }

  const key = new T.DirectionalLight(0xfff2dc, 1.75); key.position.set(-3.4, 6.5, 5.4); scene.add(key);
  const rimL = new T.DirectionalLight(0xDDBC8A, 1.5); rimL.position.set(4.4, 3.2, -3.6); scene.add(rimL);
  scene.add(new T.HemisphereLight(0xA7B6F5, 0x070C1C, .55));
  scene.add(new T.PointLight(0xC9A063, 5.5, 8).translateY(3.9));

  /* Pre-compile every program now, while the splash is still up. Without this
     the whole set compiles on the first frame the cup appears — which is the
     hitch that made the opening feel like it jammed. */
  try{
    st.ring = .5; st.stream = 1; st.steam = 1;
    applyFill(.5);
    stream.visible = steam.visible = surface.visible = true;
    renderer.setSize(64, 64, false);
    renderer.compile(scene, camera);
    renderer.render(scene, camera);
    st.ring = 0; st.stream = 0; st.steam = 0;
  }catch{}
  t0 = performance.now();
  applyFill(0);
  ok = true;
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
  return true;
}

function applyFill(f: number){
  const y = Y0 + (H - Y0) * f;
  clip.constant = y;
  surface.position.y = y + .004;
  surface.visible = f > .012;
  const s = Math.max(.001, rAt(y) - .05);
  surface.scale.set(s, s, s);
  /* The stream now starts well above the rim, because the cup occludes
     everything below it — pour from just above the lip and all you see is a
     stub. Falling in from off-frame is what reads as a pot being tipped. */
  const sTop = H + 1.05, sBot = y + .05, sH = Math.max(.35, sTop - sBot);
  stream.position.y = (sTop + sBot) / 2;
  stream.scale.y = sH / 3.1;
  steam.position.y = y + 1.30;
}

let mount: HTMLElement | null = null;
function mountTo(el: HTMLElement | null){
  if(!ok || !el || mount === el) return;
  mount = el; el.appendChild(renderer.domElement); resize();
  kick();
}

/** Unhook the canvas. The loop stops itself on the next frame. */
function unmount(){ mount = null; }

/** Restart the loop if it stopped while nothing was mounted. */
function kick(){ if(ok && mount && !running) tick(); }
function resize(){
  if(!ok || !mount) return;
  const r = mount.getBoundingClientRect();
  const w = Math.max(1, r.width), h = Math.max(1, r.height);
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}

function tick(): void {
  /* Only keep the loop alive while there is something to draw. The old
     version called requestAnimationFrame unconditionally and then returned
     early — so an unmounted cup still woke the compositor sixty times a
     second, on every screen of the app, for nothing. On a mid-range Android
     that is a measurable slice of the battery and the jank. */
  if(!ok || !mount || document.hidden){ running = false; return; }
  running = true;
  requestAnimationFrame(tick);
  const t = (performance.now() - t0) / 1000;
  if(lerping){ fill += (targetFill - fill) * .09; applyFill(fill); }
  wobble += (0 - wobble) * .028;
  if(surface.material.uniforms){
    surface.material.uniforms.uT.value = t;
    surface.material.uniforms.uW.value = .15 + wobble;
  }
  ring.material.uniforms.uT.value = t;
  ring.material.uniforms.uP.value = st.ring;
  ring.material.uniforms.uO.value = 1;
  stream.material.uniforms.uT.value = t;
  stream.material.uniforms.uO.value = st.stream;
  stream.visible = st.stream > .003;
  steam.material.uniforms.uT.value = t;
  steam.material.uniforms.uO.value = st.steam;
  steam.visible = st.steam > .003;

  cupGroup.rotation.y = Math.sin(t * .38) * .17 + spin;
  cupGroup.rotation.z = Math.sin(t * .52) * .022;
  cupGroup.rotation.x = TILT + Math.sin(t * .61) * .016;
  cupGroup.position.y = Math.sin(t * .85) * .035;
  for(const m of beans){
    const d = m.userData, a = t * d.sp + d.ph;
    m.position.set(Math.cos(a) * d.r, d.y + Math.sin(t * .8 + d.ph) * .13, Math.sin(a) * d.r * .82);
    m.rotation.set(a * 1.7, a * 1.1, d.tilt + a * .5);
  }
  if(glow) glow.material.uniforms.uC.value.setHSL(.09, .55, .5 + Math.sin(t * .6) * .05);
  renderer.render(scene, camera);
}

return {
  start(){ if(init()) tick(); return ok; },
  ok: () => ok,
  mountTo, unmount, resize, kick,
  lowPower,
  /* ambient, lerped — used by the bean-drop */
  setFill(f: number){ targetFill = Math.max(0, Math.min(1, f)); lerping = true; },
  getFill: () => (lerping ? targetFill : fill),
  /* driven directly by a tween — no double smoothing, which is what stuttered */
  fillTo(v: number, dur: number, ease?: string){
    lerping = false; st.f = fill;
    return G.to(st, { f:v, duration:dur, ease:ease || 'power2.out',
      onUpdate(){ fill = st.f; applyFill(fill); },
      onComplete(){ targetFill = v; lerping = true; } });
  },
  ringTo(v: number, dur: number, ease?: string){ return G.to(st, { ring:v, duration:dur, ease:ease || 'power3.out' }); },
  streamTo(v: number, dur: number, ease?: string){ return G.to(st, { stream:v, duration:dur, ease:ease || 'none' }); },
  steamTo(v: number, dur?: number){ return G.to(st, { steam:v, duration:dur || 1.2, ease:'power1.inOut' }); },
  splash(k?: number){ wobble = Math.min(1.6, wobble + (k || .55)); },
  /* Fires onLand at the moment it hits, so the sound lands with the picture
     rather than a frame either side of it. */
  droplet(onLand?: () => void){
    if(!ok) return;
    const y0 = Y0 + (H - Y0) * fill + .05;
    const x0 = (Math.random() - .5) * .12, z0 = (Math.random() - .5) * .12;
    /* However full the cup is, the bead has to clear the rim — below it the
       front wall hides the whole arc and you barely see anything happen. */
    const apex = Math.max(.85, (H + .30) - y0);
    drop.position.set(x0, y0, z0);
    drop.scale.set(1, 1, 1);
    drop.visible = true;
    wobble = Math.min(1.6, wobble + .30);       // the kick that threw it
    const o = { t: 0 };
    return G.to(o, { t: 1, duration: .78, ease: 'none',
      onUpdate(){
        const k = o.t;
        /* A parabola, not an ease. Gravity decelerates it on the way up and
           accelerates it on the way down; any easing curve gets that wrong in
           one direction or the other. */
        drop.position.y = y0 + apex * (4 * k * (1 - k));
        drop.position.x = x0 + k * .06;
        const v = Math.abs(1 - 2 * k);          // 1 when fast, 0 at the apex
        drop.scale.set(1 - v * .20, 1 + v * .30, 1 - v * .20);
      },
      onComplete(){
        drop.visible = false;
        wobble = Math.min(1.6, wobble + .45);
        onLand && onLand();
      } });
  },
  pop(){ if(!ok) return; G.fromTo(cupGroup.scale, {x:1,y:1,z:1},
    {x:1.13,y:1.13,z:1.13,duration:.16,yoyo:true,repeat:1,ease:'power2.out'}); },
  state: () => ({ fill:+fill.toFixed(3), lerping, ring:+st.ring.toFixed(3), stream:+st.stream.toFixed(3), steam:+st.steam.toFixed(3), beanS:+beans[0].scale.x.toFixed(2), eScale:+entry.scale.x.toFixed(2) }),
  cupGroup: () => cupGroup,
  entryGroup: () => entry,
  beansIn(){ if(!ok) return;
    beans.forEach((m: any, i: number)=>G.to(m.scale,{x:1,y:1.34,z:.78,duration:.7,delay:i*.055,ease:'back.out(2.4)'})); },
  look(){},                                   /* pointer parallax removed on request */
  screenPos(){
    if(!ok || !mount) return null;
    const r = mount.getBoundingClientRect();
    return { x:r.left + r.width / 2, y:r.top + r.height * .42, r };
  }
};
})()

/* Dev-only handle so the pour can be held still and looked at — an animation
   you can only see for one second in passing is an animation you cannot judge.
   Never defined in a production build. */
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  ;(window as unknown as { __Cup?: unknown }).__Cup = Cup
}

export type CupApi = typeof Cup
