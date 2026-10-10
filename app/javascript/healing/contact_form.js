// The contact form posts to the Forms plugin without leaving the page:
// the thank-you from the form, or each field's error beside it.
const FALLBACK = "Couldn't send that. Please check your connection and try again."
const MESSAGES = {
  captcha_failed: "Please complete the check and try again.",
  rate_limited: "Too many tries. Please wait a few minutes and try again.",
}

// Arriving from a link like /?service=<slug>#contact preselects that
// choice in the select named "service" (any select, by its name).
function preselect(form) {
  for (const [name, slug] of new URLSearchParams(window.location.search)) {
    const select = form.querySelector(`select[name="${CSS.escape(name)}"]`)
    const option = select?.querySelector(`option[data-slug="${CSS.escape(slug)}"]`)
    if (option) select.value = option.value
  }
}

function showErrors(form, errors) {
  for (const [name, messages] of Object.entries(errors)) {
    const el = form.querySelector(`[data-error-for="${CSS.escape(name)}"]`)
    if (!el) continue
    // The CMS says "is required"; the field's label makes it a sentence.
    el.textContent = [].concat(messages).map((message) => `${el.dataset.label ?? name} ${message}.`).join(" ")
    el.hidden = false
  }
}

async function submit(event) {
  const form = event.currentTarget
  event.preventDefault()
  const status = form.querySelector("[data-form-status]")
  const button = form.querySelector('button[type="submit"]')
  const data = new FormData(form)
  const done = () => {
    form.reset()
    status.textContent = form.dataset.success || "Thank you!"
    status.hidden = false
  }
  form.querySelectorAll("[data-error-for]").forEach((el) => { el.hidden = true; el.textContent = "" })

  // A bot filled the hidden field: pretend it worked. (One that skips this script still posts it, and the CMS drops it.)
  if (String(data.get(form.dataset.honeypot) ?? "").trim()) return done()

  button.disabled = true
  status.hidden = true
  try {
    const response = await fetch(form.action, { method: "POST", body: data, headers: { Accept: "application/json" } })
    const body = await response.json().catch(() => ({}))
    if (response.ok) return done()
    showErrors(form, body.errors ?? {})
    status.textContent = MESSAGES[body.error] ?? (body.errors ? "Please check the highlighted fields." : FALLBACK)
    status.hidden = false
  } catch {
    status.textContent = FALLBACK
    status.hidden = false
  } finally {
    button.disabled = false
  }
}

document.querySelectorAll("form[data-contact-form]").forEach((form) => {
  preselect(form)
  form.addEventListener("submit", submit)
})
