// Where a visitor came from, for the leads they send: the ad click (gclid,
// gbraid, wbraid) and its UTM tags, kept for 90 days from the visit that had
// them, so a lead sent a few pages (or days) later still names its ad. Any
// form field marked data-tracking gets them, e.g.
//   gclid=Cj0K… | utm_campaign=123 | utm_content=456 | utm_term=commercial planters | landing=/business-seasonal-displays
const KEYS = ["gclid", "gbraid", "wbraid", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]
const STORE = "healing.attribution"
const DAYS = 90

function read() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || "null")
    return saved && Date.now() - saved.at < DAYS * 864e5 ? saved : null
  } catch { return null }
}

function capture() {
  const params = new URLSearchParams(window.location.search)
  const found = Object.fromEntries(KEYS.filter((key) => params.get(key)).map((key) => [key, params.get(key)]))
  if (Object.keys(found).length === 0) return read()
  const visit = { ...found, landing: window.location.pathname, at: Date.now() }
  try { localStorage.setItem(STORE, JSON.stringify(visit)) } catch {}
  return visit
}

const visit = capture()
if (visit) {
  const line = [...KEYS, "landing"].filter((key) => visit[key]).map((key) => `${key}=${visit[key]}`).join(" | ")
  document.querySelectorAll("[data-tracking]").forEach((field) => (field.value = line))
}
