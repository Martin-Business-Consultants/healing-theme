// The nav turns solid once the page scrolls (and the announcement folds
// away), and the burger opens the small-screen menu, a native <dialog>.
const nav = document.querySelector("[data-nav]")
const menu = document.getElementById("mobile-menu")
const burger = document.querySelector("[data-menu-open]")

if (nav) {
  const update = () => nav.classList.toggle("is-scrolled", window.scrollY > 50)
  update()
  window.addEventListener("scroll", update, { passive: true })
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
