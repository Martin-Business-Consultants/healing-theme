// Before and after, as a slider: the after photo laid over the before, uncovered up to a
// handle that follows a range input (so keys and screen readers work too)
// and the pointer. It sweeps across once as it comes into view.
import { inView } from "healing/vendor/motion"

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches

document.querySelectorAll('[data-compare="slider"]').forEach((figure) => {
  const frame = figure.querySelector(".compare__frame")
  const range = figure.querySelector("[data-compare-range]")
  const set = (value) => {
    figure.style.setProperty("--compare", `${value}%`)
    range.value = value
  }

  figure.classList.add("is-sliding")
  range.hidden = false
  range.addEventListener("input", () => set(range.value))

  const follow = (event) => {
    const box = frame.getBoundingClientRect()
    set(Math.round(Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)) * 100))
  }
  frame.addEventListener("pointerdown", (event) => {
    follow(event)
    frame.setPointerCapture(event.pointerId)
    frame.addEventListener("pointermove", follow)
  })
  frame.addEventListener("pointerup", () => frame.removeEventListener("pointermove", follow))
  frame.addEventListener("pointercancel", () => frame.removeEventListener("pointermove", follow))

  set(50)
  if (reduced) return
  inView(figure, () => {
    // A sweep from mostly before to mostly after, then back to the middle.
    const start = performance.now()
    const tick = (now) => {
      const t = Math.min((now - start) / 2200, 1)
      set(Math.round(50 + 35 * Math.sin(t * Math.PI * 2) * (1 - t)))
      if (t < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, { amount: 0.5 })
})
