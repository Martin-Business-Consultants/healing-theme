// The site's motion, with Motion (motion.dev, healing/vendor/motion): the
// browser's own Web Animations with springs, inView for what scrolls into
// view, and scroll for what moves with the page. Elements opt in with data
// attributes:
//   data-hero-item     staggered entrance on load (held invisible by .motion-pending)
//   data-hero-media    a slow settle on load, then parallax as the header scrolls away
//   data-reveal        fades up when scrolled into view
//   data-reveal-group  the same, staggering its children
//   data-grow-x        draws in from the left
//   data-count         a figure ("9–12%", "$1,200") counts up to itself
//   data-draw          an SVG path draws itself in
//   data-spin-in       turns and settles into place
//   data-area-map      the service area map: counties, then towns, then the pin
//   #mobile-cta        the booking bar, shown between the header and the contact form
// Anything on screen at load is left alone, so the first frame is complete.
import { animate, inView, scroll, spring, stagger } from "healing/vendor/motion"

const ease = [0.22, 1, 0.36, 1]
const settle = { type: spring, bounce: 0.25, duration: 0.9 }
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
const belowFold = (el) => el.getBoundingClientRect().top > window.innerHeight * 0.92

// Hidden now (inline styles), and shown with `play` the first time they
// scroll into view. The styles hold through any delay and give way to the
// animation's own keyframes, and go once it has finished.
function onFirstView(watch, hidden, styles, play, amount = 0.15) {
  hidden = [].concat(hidden).filter(Boolean)
  if (hidden.length === 0 || !belowFold(watch)) return
  hidden.forEach((el) => Object.assign(el.style, styles))
  inView(watch, () => {
    Promise.all([].concat(play()).map((animation) => animation?.finished)).finally(() => {
      hidden.forEach((el) => Object.keys(styles).forEach((key) => (el.style[key] = "")))
    })
  }, { amount })
}

function heroEntrance() {
  const items = [...document.querySelectorAll("[data-hero-item]")]
  const root = document.documentElement
  if (reduced || items.length === 0) return root.classList.remove("motion-pending")

  // Take over from the CSS hold before releasing it, so nothing flashes.
  items.forEach((el) => (el.style.opacity = "0"))
  root.classList.remove("motion-pending")
  animate(items, { opacity: [0, 1], transform: ["translateY(28px)", "translateY(0)"] }, { duration: 0.9, delay: stagger(0.11, { startDelay: 0.1 }), ease })
    .finished.then(() => items.forEach((el) => (el.style.opacity = "")))
}

function heroMedia() {
  if (reduced) return
  document.querySelectorAll("[data-hero-media]").forEach((media) => {
    const img = media.querySelector("img")
    if (img) animate(img, { transform: ["scale(1.08)", "scale(1)"] }, { duration: 1.8, ease })

    // Drift the photo down at a fraction of the scroll, so it sits flush under the nav at the top.
    const section = media.closest("section") ?? media
    scroll((progress) => { media.style.translate = `0 ${progress * section.clientHeight * 0.18}px` },
      { target: section, offset: ["start start", "end start"] })
  })
}

function reveals() {
  if (reduced) return
  const up = (distance) => ({ opacity: [0, 1], transform: [`translateY(${distance}px)`, "translateY(0)"] })

  document.querySelectorAll("[data-reveal]").forEach((el) => {
    onFirstView(el, el, { opacity: "0" }, () => animate(el, up(24), { duration: 0.8, ease }))
  })

  document.querySelectorAll("[data-reveal-group]").forEach((group) => {
    const children = [...group.children]
    onFirstView(group, children, { opacity: "0" }, () => animate(children, up(28), { duration: 0.8, delay: stagger(0.1), ease }), 0.1)
  })

  document.querySelectorAll("[data-grow-x]").forEach((el) => {
    onFirstView(el, el, { transform: "scaleX(0)" }, () => animate(el, { transform: ["scaleX(0)", "scaleX(1)"] }, { duration: 1.4, ease }), 0)
  })

  document.querySelectorAll("[data-spin-in]").forEach((el) => {
    onFirstView(el, el, { opacity: "0" }, () => animate(el, { opacity: [0, 1], transform: ["rotate(-90deg) scale(0.8)", "rotate(0deg) scale(1)"] }, settle))
  })
}

// "9–12%" counts its first number up from zero, keeping the rest as written.
function counters() {
  document.querySelectorAll("[data-count]").forEach((el) => {
    const text = el.textContent.trim()
    const match = text.match(/\d[\d,]*(\.\d+)?/)
    if (reduced || !match || !belowFold(el)) return
    const target = parseFloat(match[0].replace(/,/g, ""))
    const decimals = match[1] ? match[1].length - 1 : 0
    const format = (n) => text.replace(match[0], n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }))
    el.textContent = format(0)
    inView(el, () => {
      const start = performance.now()
      const tick = (now) => {
        const t = Math.min((now - start) / 1400, 1)
        el.textContent = format(target * (1 - Math.pow(1 - t, 4)))
        if (t < 1) requestAnimationFrame(tick)
        else el.textContent = text
      }
      requestAnimationFrame(tick)
    }, { amount: 0.6 })
  })
}

function drawings() {
  if (reduced) return
  document.querySelectorAll("svg").forEach((svg) => {
    const paths = [...svg.querySelectorAll("[data-draw]")].filter((path) => path.getTotalLength)
    if (paths.length === 0 || !belowFold(svg)) return
    paths.forEach((path) => {
      const length = path.getTotalLength()
      path.style.strokeDasharray = `${length}`
      path.style.strokeDashoffset = `${length}`
    })
    inView(svg, () => {
      paths.forEach((path, i) => {
        animate(path, { strokeDashoffset: [path.style.strokeDashoffset, "0"] }, { duration: 1.6, delay: i * 0.08, ease })
          .finished.then(() => { path.style.strokeDasharray = ""; path.style.strokeDashoffset = "" })
      })
    }, { amount: 0.3 })
  })
}

function areaMaps() {
  if (reduced) return
  document.querySelectorAll("[data-area-map]").forEach((map) => {
    const counties = [...map.querySelectorAll(".area-map__county")]
    const towns = [...map.querySelectorAll(".area-map__town")]
    const pin = map.querySelector("[data-area-base]")
    onFirstView(map, [...counties, ...towns, pin], { opacity: "0" }, () => [
      animate(counties, { opacity: [0, 1], transform: ["scale(0.94)", "scale(1)"] }, { duration: 0.7, delay: stagger(0.08), ease }),
      animate(towns, { opacity: [0, 1], transform: ["translateY(6px)", "translateY(0)"] }, { duration: 0.5, delay: stagger(0.04, { startDelay: 0.5 }), ease }),
      pin && animate(pin, { opacity: [0, 1] }, { duration: 0.3, delay: 0.9 }),
      pin && animate(pin.querySelector(".area-map__pin"), { transform: ["translateY(-40px)", "translateY(0)"] }, { ...settle, bounce: 0.5, delay: 0.9 })
    ], 0.3)
  })
}

// A list of areas beside the map lights its counties on hover or focus.
function areaHighlights() {
  document.querySelectorAll("[data-area-counties]").forEach((link) => {
    const map = link.closest(".areas")?.querySelector("[data-area-map]")
    if (!map) return
    const counties = link.dataset.areaCounties.split(" ").map((key) => map.querySelector(`[data-county="${key}"]`)).filter(Boolean)
    const on = () => counties.forEach((county) => county.classList.add("is-active"))
    const off = () => counties.forEach((county) => county.classList.remove("is-active"))
    link.addEventListener("pointerenter", on)
    link.addEventListener("pointerleave", off)
    link.addEventListener("focus", on)
    link.addEventListener("blur", off)
  })
}

function mobileCta() {
  const bar = document.getElementById("mobile-cta")
  if (!bar) return

  const hero = document.querySelector("[data-cta-hide]")
  const forms = [document.getElementById("contact"), document.getElementById("plan")].filter(Boolean)
  const seen = new Map()
  const update = () => {
    const show = ![...seen.values()].some(Boolean)
    bar.classList.toggle("is-visible", show)
    bar.inert = !show
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => seen.set(entry.target, entry.isIntersecting))
    update()
  }, { threshold: 0.1 })
  ;[hero, ...forms].filter(Boolean).forEach((el) => { seen.set(el, el === hero && !belowFold(el)); observer.observe(el) })
  update()
}

heroEntrance()
heroMedia()
reveals()
counters()
drawings()
areaMaps()
areaHighlights()
mobileCta()
