// A gallery's lightbox: a photo opens large in a native <dialog>, at the
// biggest size its srcset offers, with its alt text as the caption and a
// count. Previous and next by buttons, arrow keys or a swipe; Escape, the
// close button or a click on the backdrop closes it, and focus goes back to
// the photo that opened it. The photos either side are fetched ahead.
import { Controller } from "healing/vendor/stimulus"
import { animate } from "healing/vendor/motion"

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches

// The widest candidate in an <img>'s srcset, else its src.
const largest = (img) => (img.getAttribute("srcset") ?? "").split(",").map((part) => part.trim().split(/\s+/))
  .filter(([url, width]) => url && width).sort((a, b) => parseInt(b[1]) - parseInt(a[1]))[0]?.[0] ?? img.currentSrc ?? img.src

export default class extends Controller {
  static targets = ["dialog", "image", "caption", "count", "thumb"]

  open({ params: { index } }) {
    this.index = index
    this.opener = document.activeElement
    this.show(0)
    this.dialogTarget.showModal()
    if (!reduced) animate(this.imageTarget, { opacity: [0, 1], transform: ["scale(0.96)", "scale(1)"] }, { duration: 0.35, ease: [0.22, 1, 0.36, 1] })
  }

  close() {
    this.dialogTarget.close()
  }

  closed() {
    this.opener?.focus()
  }

  next() { this.step(1) }
  prev() { this.step(-1) }

  // A click on the backdrop lands on the dialog itself.
  backdrop(event) {
    if (event.target === this.dialogTarget) this.close()
  }

  keydown(event) {
    const direction = { ArrowRight: 1, ArrowLeft: -1 }[event.key]
    if (direction) { event.preventDefault(); this.step(direction) }
  }

  swipeStart(event) {
    this.startX = event.clientX
  }

  swipeEnd(event) {
    const dx = event.clientX - (this.startX ?? event.clientX)
    if (Math.abs(dx) > 50) this.step(dx < 0 ? 1 : -1)
    this.startX = null
  }

  step(direction) {
    const count = this.thumbTargets.length
    this.index = (this.index + direction + count) % count
    this.show(direction)
  }

  show(direction) {
    const thumb = this.thumbTargets[this.index]
    const count = this.thumbTargets.length
    this.imageTarget.src = largest(thumb)
    this.imageTarget.alt = thumb.alt
    this.captionTarget.textContent = thumb.alt
    this.captionTarget.hidden = !thumb.alt
    this.countTarget.textContent = `${this.index + 1} / ${count}`
    if (direction && !reduced) {
      animate(this.imageTarget, { opacity: [0, 1], transform: [`translateX(${direction * 40}px)`, "translateX(0)"] }, { duration: 0.35, ease: [0.22, 1, 0.36, 1] })
    }
    for (const offset of [1, -1]) new Image().src = largest(this.thumbTargets[(this.index + offset + count) % count])
  }
}
