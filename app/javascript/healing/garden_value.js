// What a home garden gives back (data-garden-value), in four returns.
// Money, year by year against the investment and each year's care:
//   home value: the gain so far, home × % × ramp(year), counted once
//   lawn turned into garden: square feet × savings × lawn ramp(year)
//   food beds: square feet × produce value, every season
// The home value gain is never shown above what the garden cost (× the cap).
// Health: the active share of the hours a week in the garden, over the
// growing season, at the gardening MET (net kcal = (MET − 1) × kg × hours),
// and as a share of the 150 minutes a week of moderate activity adults are
// advised to get. Mind: the time outdoors itself. Earth: roof square
// feet × inches of rain × 0.623 gallons × the share a rain garden holds, lawn
// turned to habitat, and the mowing it no longer needs. "Plan my garden"
// writes the estimate into the contact form.
import { animate } from "healing/vendor/motion"
import { draw, money, tween } from "healing/chart"

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
const count = (n) => Math.round(n).toLocaleString("en-US")
const share = (shares, year) => shares[Math.min(year, shares.length) - 1]

function estimate(c, i) {
  const years = Array.from({ length: i.years }, (_, k) => k + 1)
  const homeGain = (pct, year) => Math.min(i.home * (pct / 100) * share(c.ramp, year), i.investment * c.homeCap)
  const series = (lawnRate, producePerFt, homePct) => {
    let flow = 0
    return years.map((year) => {
      flow += i.lawn * lawnRate * share(c.lawnRamp, year) + i.edible * producePerFt
      return flow + homeGain(homePct, year) - i.investment - i.care * year
    })
  }
  const low = series(c.lawn[0], c.produce[0], c.homePct[0])
  const high = series(c.lawn[1], c.produce[1], c.homePct[1])
  const net = low.map((l, k) => ({ low: l, high: high[k], mid: (l + high[k]) / 2 }))
  const mid = (a, b) => (a + b) / 2
  const last = i.years
  const hoursSeason = i.hours * c.activeShare * c.seasonWeeks
  const kcal = (c.met - 1) * (c.weightLb / 2.2046) * hoursSeason
  const weeklyMinutes = i.hours * 60
  const gallons = i.roof * c.precip * c.gallonsPerInch * c.capture
  return {
    net, last: net[net.length - 1], spent: i.investment + i.care * last,
    homeGain: homeGain(mid(...c.homePct), last),
    lawnSaved: years.reduce((sum, year) => sum + i.lawn * mid(...c.lawn) * share(c.lawnRamp, year), 0),
    produce: i.edible * mid(...c.produce) * last,
    hoursSeason, kcal, guideline: (weeklyMinutes * c.activeShare) / c.guideline, weeklyMinutes, outdoorHours: i.hours * c.seasonWeeks,
    gallons, mowHours: (i.lawn / 1000) * c.mowMinutes / 60
  }
}

function setMeter(root, key, fraction) {
  const ring = root.querySelector(`[data-garden-meter="${key}"]`)
  const value = root.querySelector(`[data-garden-meter-value="${key}"]`)
  const filled = Math.min(fraction, 1) * 100
  value.textContent = `${Math.round(fraction * 100)}%`
  // Set outright when motion is reduced or the ring's tab is hidden (nothing to animate).
  if (reduced || ring.closest("[hidden]")) {
    ring.style.strokeDashoffset = `${100 - filled}`
    return
  }
  animate(ring, { strokeDashoffset: `${100 - filled}` }, { duration: 0.8, ease: [0.22, 1, 0.36, 1] })
}

function setUp(root) {
  const config = JSON.parse(root.dataset.gardenValue)
  const form = root.querySelector("[data-garden-form]")
  const out = (name) => root.querySelector(`[data-garden="${name}"]`)
  const all = (selector) => root.querySelectorAll(selector)
  let shown = null, years = null

  const read = () => {
    const data = new FormData(form)
    const number = (name) => Math.max(0, parseFloat(data.get(name)) || 0)
    return { home: number("home"), investment: number("investment"), care: number("care"), lawn: number("lawn"),
      edible: number("edible"), roof: number("roof"), hours: number("hours"), years: Math.max(1, number("years")) }
  }

  const update = () => {
    const inputs = read()
    const r = estimate(config, inputs)
    all("[data-garden-years]").forEach((el) => (el.textContent = inputs.years))
    root.querySelector("[data-garden-years-out]").textContent = inputs.years
    root.querySelector("[data-garden-hours-out]").textContent = inputs.hours

    tween(out("net"), shown, r.last.mid)
    shown = r.last.mid
    out("net-range").textContent = `After the ${money(r.spent)} it costs: ${money(r.last.low)} to ${money(r.last.high)}`
    out("home-gain").textContent = money(r.homeGain)
    out("lawn-saved").textContent = money(r.lawnSaved)
    out("produce").textContent = money(r.produce)
    draw(root.querySelector("[data-garden-chart]"), r.net, years !== inputs.years)
    years = inputs.years

    out("active-hours").textContent = `${count(r.hoursSeason)} hours`
    out("kcal").textContent = count(r.kcal)
    out("kcal-total").textContent = count(r.kcal * inputs.years)
    out("weight").textContent = count(config.weightLb)
    setMeter(root, "guideline", r.guideline)

    out("garden-minutes").textContent = `${count(r.weeklyMinutes)} min a week`
    out("season-hours").textContent = `${count(r.outdoorHours)} hours outdoors a season, ${count(r.outdoorHours * inputs.years)} over ${inputs.years} years`

    out("gallons").textContent = `${count(r.gallons)} gal`
    out("habitat").textContent = `${count(inputs.lawn)} sq ft`
    out("mowing").textContent = `${r.mowHours.toFixed(1)} hours`
    out("earth-total").textContent = r.gallons > 0
      ? `${count(r.gallons * inputs.years)} gallons of rain soaked into your own ground over ${inputs.years} years, instead of running to the storm drain.`
      : "Add the roof area that could drain to a rain garden to see the rain it would keep on site."

    root.querySelector('[data-garden-summary="money"]').textContent = money(r.last.mid)
    root.querySelector('[data-garden-summary="health"]').textContent = `${count(r.hoursSeason)} h`
    root.querySelector('[data-garden-summary="mind"]').textContent = `${count(r.weeklyMinutes)} min`
    root.querySelector('[data-garden-summary="earth"]').textContent = r.gallons > 0 ? `${count(r.gallons / 1000)}k gal` : `${count(inputs.lawn)} ft²`
    root.result = { inputs, r }
  }

  // The four returns are tabs: arrow keys move between them.
  const tabs = [...all("[data-garden-tab]")]
  const select = (tab) => {
    tabs.forEach((t) => {
      const on = t === tab
      t.setAttribute("aria-selected", on)
      t.tabIndex = on ? 0 : -1
      const panel = root.querySelector(`[data-garden-panel="${t.dataset.gardenTab}"]`)
      panel.hidden = !on
      if (on && !reduced) animate(panel, { opacity: [0, 1], transform: ["translateY(10px)", "translateY(0)"] }, { duration: 0.35 })
    })
  }
  tabs.forEach((tab, k) => {
    tab.tabIndex = k === 0 ? 0 : -1
    tab.addEventListener("click", () => select(tab))
    tab.addEventListener("keydown", (event) => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key]
      if (!step) return
      const next = tabs[(k + step + tabs.length) % tabs.length]
      next.focus()
      select(next)
    })
  })

  form.addEventListener("input", update)
  form.addEventListener("submit", (event) => event.preventDefault())

  root.querySelector("[data-garden-plan]").addEventListener("click", () => {
    const { inputs, r } = root.result
    const line = [`Home garden: ${money(inputs.investment)} invested`, inputs.lawn ? `${inputs.lawn} sq ft of lawn into garden` : null,
      inputs.edible ? `${inputs.edible} sq ft of food beds` : null, inputs.roof ? `rain garden for ${inputs.roof} sq ft of roof` : null,
      `${inputs.hours} h/week`, `${inputs.years} years: ${money(r.last.low)} to ${money(r.last.high)} net`].filter(Boolean).join("; ")
    document.querySelectorAll("form[data-contact-form] [data-estimate]").forEach((field) => (field.value = line))
  })

  update()
}

document.querySelectorAll("[data-garden-value]").forEach(setUp)
