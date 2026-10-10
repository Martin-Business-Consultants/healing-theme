// The site's motion, with the browser's own Web Animations API and
// IntersectionObserver. Elements opt in with data attributes:
//   data-hero-item     staggered entrance on load (held invisible by .motion-pending)
//   data-hero-media    a slow settle on load, then parallax as the header scrolls away
//   data-reveal        fades up when scrolled into view
//   data-reveal-group  the same, staggering its children
//   data-grow-x        draws in from the left
//   #mobile-cta        the booking bar, shown between the header and the contact form
// Anything on screen at load is left alone, so the first frame is complete.
const ease = "cubic-bezier(0.22, 1, 0.36, 1)"
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
const belowFold = (el) => el.getBoundingClientRect().top > window.innerHeight * 0.92

function whenSeen(el, callback, amount = 0.15) {
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      observer.disconnect()
      callback()
    }
  }, { threshold: amount })
  observer.observe(el)
}

function heroEntrance() {
  const items = [...document.querySelectorAll("[data-hero-item]")]
  const root = document.documentElement
  if (reduced || items.length === 0) return root.classList.remove("motion-pending")

  // Take over from the CSS hold before releasing it, so nothing flashes.
  items.forEach((el) => (el.style.opacity = "0"))
  root.classList.remove("motion-pending")
  items.forEach((el, i) => {
    el.animate([{ opacity: 0, translate: "0 28px" }, { opacity: 1, translate: "0 0" }],
      { duration: 900, delay: 100 + i * 110, easing: ease, fill: "backwards" })
    el.style.opacity = ""
  })
}

function heroMedia() {
  if (reduced) return
  document.querySelectorAll("[data-hero-media]").forEach((media) => {
    media.querySelector("img")?.animate([{ scale: 1.08 }, { scale: 1 }], { duration: 1800, easing: ease })

    // Drift the photo down at a fraction of the scroll, so it sits flush under the nav at the top.
    const section = media.closest("section") ?? media
    let queued = false
    window.addEventListener("scroll", () => {
      if (queued) return
      queued = true
      requestAnimationFrame(() => {
        queued = false
        media.style.translate = `0 ${Math.min(window.scrollY, section.clientHeight) * 0.18}px`
      })
    }, { passive: true })
  })
}

function reveal(elements, keyframes, { duration = 800, stagger = 0 } = {}) {
  elements.forEach((el, i) => {
    el.animate(keyframes, { duration, delay: i * stagger, easing: ease, fill: "backwards" })
  })
}

function reveals() {
  if (reduced) return
  const up = (distance) => [{ opacity: 0, translate: `0 ${distance}px` }, { opacity: 1, translate: "0 0" }]

  document.querySelectorAll("[data-reveal]").forEach((el) => {
    if (!belowFold(el)) return
    const hidden = el.animate([{ opacity: 0, translate: "0 24px" }], { fill: "forwards" })
    whenSeen(el, () => { hidden.cancel(); reveal([el], up(24)) })
  })

  document.querySelectorAll("[data-reveal-group]").forEach((group) => {
    if (!belowFold(group)) return
    const children = [...group.children]
    const hidden = children.map((el) => el.animate([{ opacity: 0, translate: "0 28px" }], { fill: "forwards" }))
    whenSeen(group, () => { hidden.forEach((a) => a.cancel()); reveal(children, up(28), { stagger: 100 }) })
  })

  document.querySelectorAll("[data-grow-x]").forEach((el) => {
    if (!belowFold(el)) return
    const hidden = el.animate([{ scale: "0 1" }], { fill: "forwards" })
    whenSeen(el, () => { hidden.cancel(); reveal([el], [{ scale: "0 1" }, { scale: "1 1" }], { duration: 1400 }) }, 0)
  })
}

function mobileCta() {
  const bar = document.getElementById("mobile-cta")
  if (!bar) return

  const hero = document.querySelector("[data-cta-hide]")
  const contact = document.getElementById("contact")
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
  ;[hero, contact].filter(Boolean).forEach((el) => { seen.set(el, el === hero && !belowFold(el)); observer.observe(el) })
  update()
}

heroEntrance()
heroMedia()
reveals()
mobileCta()
