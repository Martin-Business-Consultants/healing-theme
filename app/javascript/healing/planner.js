// The commercial project planner: its fieldsets become steps, with a
// progress row, Back and Next, each step checked before the next, and a
// review of every answer before it's sent. Steps slide with Motion. Sending
// is the contact form's (healing/contact_form.js); when the CMS turns a field
// down, the planner goes back to the step that holds it.
import { animate, spring } from "healing/vendor/motion"

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches

function setUp(form) {
  const steps = [...form.querySelectorAll("[data-planner-step]")]
  const review = form.querySelector("[data-planner-review]")
  const summary = form.querySelector("[data-planner-summary]")
  const back = form.querySelector("[data-planner-back]")
  const next = form.querySelector("[data-planner-next]")
  const submit = form.querySelector(".planner__submit")
  const dots = [...form.querySelectorAll("[data-planner-dot]")]
  const bar = form.querySelector("[data-planner-bar] span")
  let current = 0

  form.classList.add("is-stepped")
  form.querySelector("[data-planner-progress]").hidden = false
  form.querySelector("[data-planner-bar]").hidden = false
  review.hidden = false

  // The first required question on this step left unanswered, in page order.
  function missing(step) {
    return [...step.querySelectorAll('[role="radiogroup"][aria-required="true"], input:not([type="radio"]):not([type="checkbox"]), select, textarea')].find((el) =>
      el.matches('[role="radiogroup"]') ? !el.querySelector("input:checked") : !el.checkValidity())
  }

  function complain(target) {
    const name = target.matches?.('[role="radiogroup"]') ? target.querySelector("input")?.name : target.name
    const error = form.querySelector(`[data-error-for="${CSS.escape(name ?? "")}"]`)
    if (error) {
      error.textContent = target.validationMessage || `${error.dataset.label} is needed to go on.`
      error.hidden = false
    }
    const focusable = target.matches?.('[role="radiogroup"]') ? target.querySelector("input") : target
    focusable?.focus()
    if (!reduced) animate(target, { transform: ["translateX(0)", "translateX(-6px)", "translateX(6px)", "translateX(0)"] }, { duration: 0.35 })
  }

  // Every answer, as the step's label and the value given.
  function fillSummary() {
    summary.replaceChildren()
    steps.slice(0, -1).forEach((step, index) => {
      const answers = []
      const services = [...step.querySelectorAll('input[type="checkbox"]:checked')].map((box) => box.closest("label").querySelector(".choice__title").textContent.trim())
      if (services.length) answers.push(["Services", services.join(", ")])
      // Each question's answer, in the order the step asks them.
      step.querySelectorAll('[role="radiogroup"], input:not([type="radio"]):not([type="checkbox"]):not([type="hidden"]), select, textarea').forEach((el) => {
        if (el.matches('[role="radiogroup"]')) {
          const checked = el.querySelector("input:checked")
          if (checked) answers.push([el.querySelector(".field__label").firstChild.textContent.trim(), checked.value])
          return
        }
        const label = form.querySelector(`label[for="${CSS.escape(el.id)}"]`)
        if (el.value.trim() && label) answers.push([label.firstChild.textContent.trim(), el.value.trim()])
      })
      const group = document.createElement("div")
      group.className = "planner__summary-group"
      const head = document.createElement("div")
      head.className = "planner__summary-head"
      const title = document.createElement("span")
      title.textContent = step.querySelector("legend").lastChild.textContent
      head.append(title)
      const edit = document.createElement("button")
      edit.type = "button"
      edit.className = "text-link"
      edit.textContent = "Change"
      edit.addEventListener("click", () => go(index))
      head.append(edit)
      group.append(head)
      answers.forEach(([term, value]) => {
        const dt = document.createElement("dt")
        dt.textContent = term
        const dd = document.createElement("dd")
        dd.textContent = value
        group.append(dt, dd)
      })
      if (!answers.length) {
        const dd = document.createElement("dd")
        dd.className = "muted"
        dd.textContent = "Nothing yet"
        group.append(dd)
      }
      summary.append(group)
    })
  }

  function show(index, direction) {
    const last = index === steps.length - 1
    steps.forEach((step, i) => step.classList.toggle("is-current", i === index))
    dots.forEach((dot, i) => {
      dot.classList.toggle("is-done", i < index)
      dot.classList.toggle("is-current", i === index)
      if (i === index) dot.setAttribute("aria-current", "step")
      else dot.removeAttribute("aria-current")
    })
    back.hidden = index === 0
    next.hidden = last
    submit.hidden = !last
    if (last) fillSummary()
    const progress = `scaleX(${(index + 1) / steps.length})`
    if (reduced) return (bar.style.transform = progress)
    animate(bar, { transform: progress }, { type: spring, bounce: 0.2, duration: 0.6 })
    if (direction) {
      animate(steps[index], { opacity: [0, 1], transform: [`translateX(${direction * 32}px)`, "translateX(0)"] }, { duration: 0.45, ease: [0.22, 1, 0.36, 1] })
    }
  }

  function go(index) {
    const direction = Math.sign(index - current)
    current = Math.max(0, Math.min(index, steps.length - 1))
    show(current, direction)
    const top = form.getBoundingClientRect().top
    if (top < 0 || top > window.innerHeight * 0.5) form.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" })
    steps[current].querySelector("input:not([type=hidden]), select, textarea, button")?.focus({ preventScroll: true })
  }

  next.hidden = false
  next.addEventListener("click", () => {
    const gap = missing(steps[current])
    if (gap) return complain(gap)
    go(current + 1)
  })
  back.addEventListener("click", () => go(current - 1))

  // Enter in a text box goes on rather than sending early.
  form.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.target.tagName === "TEXTAREA" || current === steps.length - 1) return
    if (event.target.matches("input")) { event.preventDefault(); next.click() }
  })

  // Answering clears that question's message.
  form.addEventListener("change", (event) => {
    const error = form.querySelector(`[data-error-for="${CSS.escape(event.target.name)}"]`)
    if (error) error.hidden = true
  })

  // The CMS turned a field down: back to the step that holds it.
  form.addEventListener("contact-form:errors", (event) => {
    const name = Object.keys(event.detail.errors ?? {})[0]
    const step = steps.findIndex((s) => s.querySelector(`[name="${CSS.escape(name ?? "")}"]`))
    if (step >= 0) go(step)
  })
  form.addEventListener("contact-form:sent", () => go(0))

  show(0)
}

document.querySelectorAll("form[data-planner]").forEach(setUp)
