// The nav's menus open on a click, or on hover with a pointer that can, one
// at a time, and close on Escape, a click outside or the pointer leaving;
// they slide in with Motion, their links a beat behind. The burger opens the
// small-screen menu, a native <dialog>.
import { animate, stagger } from "healing/vendor/motion"

const nav = document.querySelector("[data-nav]")
const menu = document.getElementById("mobile-menu")
const burger = document.querySelector("[data-menu-open]")
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
const hovers = window.matchMedia("(hover: hover) and (pointer: fine)").matches

if (nav) {
  const update = () => nav.classList.toggle("is-scrolled", window.scrollY > 50)
  update()
  window.addEventListener("scroll", update, { passive: true })

  const items = [...nav.querySelectorAll("[data-menu]")]
  let open = null
  let timer = null

  const close = (item = open, { focus = false } = {}) => {
    if (!item) return
    const button = item.querySelector("[data-menu-button]")
    button.setAttribute("aria-expanded", "false")
    item.querySelector("[data-menu-panel]").hidden = true
    if (focus) button.focus()
    if (open === item) open = null
    nav.classList.toggle("has-menu", Boolean(open))
  }

  const show = (item) => {
    if (open === item) return
    const wasOpen = Boolean(open)
    close()
    open = item
    const panel = item.querySelector("[data-menu-panel]")
    item.querySelector("[data-menu-button]").setAttribute("aria-expanded", "true")
    panel.hidden = false
    nav.classList.add("has-menu")
    if (reduced) return
    if (!wasOpen) animate(panel, { opacity: [0, 1], transform: ["translateY(-8px)", "translateY(0)"] }, { duration: 0.3, ease: [0.22, 1, 0.36, 1] })
    animate(panel.querySelectorAll("[data-menu-links] > li, .mega__proof"), { opacity: [0, 1], transform: ["translateY(6px)", "translateY(0)"] },
      { duration: 0.35, delay: stagger(0.025, { startDelay: 0.05 }) })
  }

  items.forEach((item) => {
    const button = item.querySelector("[data-menu-button]")
    button.addEventListener("click", () => (open === item ? close(item) : show(item)))
    if (hovers) {
      item.addEventListener("pointerenter", () => { clearTimeout(timer); timer = setTimeout(() => show(item), open ? 0 : 120) })
      item.addEventListener("pointerleave", () => { clearTimeout(timer); timer = setTimeout(() => close(item), 250) })
    }
    // Leaving the menu by keyboard closes it.
    item.addEventListener("focusout", (event) => { if (!item.contains(event.relatedTarget)) close(item) })
  })

  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && open) close(open, { focus: true }) })
  document.addEventListener("click", (event) => { if (open && !open.contains(event.target)) close() })
}

if (menu && burger) {
  const close = () => menu.close()
  burger.addEventListener("click", () => {
    menu.showModal()
    burger.setAttribute("aria-expanded", "true")
  })
  menu.addEventListener("close", () => burger.setAttribute("aria-expanded", "false"))
  menu.querySelector("[data-menu-close]")?.addEventListener("click", close)
  // A click on the backdrop lands on the dialog itself, outside its content.
  menu.addEventListener("click", (event) => { if (event.target === menu) close() })
  // A link to somewhere on this page (#contact) closes the menu on the way.
  menu.querySelectorAll("a").forEach((link) => link.addEventListener("click", close))
}
