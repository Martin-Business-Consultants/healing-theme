// The ROI calculator: what a planting project could return, year by year.
// Each industry (data-roi) says what its uplift applies to and a low and a
// high percentage; the site says how fast plantings fill in (the ramp, the
// share of the full benefit in year 1, 2, … and on), what a square foot of
// lawn costs to keep, and how fast those savings come (the lawn ramp: weeding
// while a planting establishes eats into them at first). Per year:
//   yearly basis (sales, rent, budget): basis × uplift × ramp(year)
//   property value: the gain so far, basis × uplift × ramp(year), counted once
//   lawn turned to planting: square feet × savings × lawn ramp(year)
// against the investment plus each year's care. The chart is the net, mid
// estimate, with the low-to-high range behind it. "Plan this project" writes
// the estimate into the planner and picks the kind of property there.
import { animate, stagger } from "healing/vendor/motion"

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
const money = (n) => {
  const abs = Math.abs(n)
  const text = abs >= 1e6 ? `$${(abs / 1e6).toFixed(abs >= 1e7 ? 0 : 1)}M` : abs >= 1e4 ? `$${Math.round(abs / 1e3)}k` : `$${Math.round(abs).toLocaleString("en-US")}`
  return n < 0 ? `−${text}` : text
}
const ns = "http://www.w3.org/2000/svg"
const svg = (name, attributes = {}) => {
  const el = document.createElementNS(ns, name)
  Object.entries(attributes).forEach(([key, value]) => el.setAttribute(key, value))
  return el
}

// Year-by-year cumulative benefit at one uplift percentage.
function benefits({ basis, amount, uplift, lawnSqft, lawnRate, years, ramp, lawnRamp }) {
  const share = (shares, year) => shares[Math.min(year, shares.length) - 1]
  let total = 0
  return Array.from({ length: years }, (_, i) => {
    const year = i + 1
    const lawn = lawnSqft * lawnRate * share(lawnRamp, year)
    if (basis === "property_value") {
      total += lawn
      return total + amount * (uplift / 100) * share(ramp, year)
    }
    total += amount * (uplift / 100) * share(ramp, year) + lawn
    return total
  })
}

function estimate(config, inputs) {
  const industry = config.industries.find((i) => i.slug === inputs.industry) ?? config.industries[0]
  const common = { basis: industry.basis, amount: inputs.amount, lawnSqft: inputs.lawn, years: inputs.years, ramp: config.ramp, lawnRamp: config.lawnRamp }
  const low = benefits({ ...common, uplift: industry.low, lawnRate: config.lawn[0] ?? 0 })
  const high = benefits({ ...common, uplift: industry.high, lawnRate: config.lawn[1] ?? config.lawn[0] ?? 0 })
  const cost = Array.from({ length: inputs.years }, (_, i) => inputs.investment + inputs.care * (i + 1))
  const net = low.map((l, i) => ({ low: l - cost[i], high: high[i] - cost[i], mid: (l + high[i]) / 2 - cost[i] }))
  const last = net[net.length - 1]
  const spent = cost[cost.length - 1]
  const payback = net.findIndex((n) => n.mid >= 0)
  return { industry, net, last, spent, payback: payback >= 0 ? payback + 1 : null, roi: spent > 0 ? last.mid / spent : null }
}

function draw(chart, net, animateIn) {
  const width = 600, height = 220, pad = 28
  const values = net.flatMap((n) => [n.low, n.high, 0])
  const max = Math.max(...values), min = Math.min(...values)
  const y = (v) => pad / 2 + (max - v) / ((max - min) || 1) * (height - pad * 1.5)
  const step = (width - 8) / net.length
  const x = (i) => 4 + i * step + step / 2
  const root = svg("svg", { viewBox: `0 0 ${width} ${height}`, class: "roi__svg" })
  // The low-to-high range: along the high estimates, back along the low.
  const highs = net.map((n, i) => `${x(i)},${y(n.high)}`)
  const lows = net.map((n, i) => `${x(i)},${y(n.low)}`).reverse()
  root.append(svg("polygon", { class: "roi__band", points: [...highs, ...lows].join(" ") }))
  root.append(svg("polyline", { class: "roi__edge", points: highs.join(" ") }), svg("polyline", { class: "roi__edge", points: lows.join(" ") }))
  root.append(svg("line", { class: "roi__zero", x1: 0, x2: width, y1: y(0), y2: y(0) }))
  const bars = net.map((n, i) => {
    const top = Math.min(y(n.mid), y(0)), h = Math.max(Math.abs(y(n.mid) - y(0)), 1)
    const bar = svg("rect", { class: `roi__bar ${n.mid >= 0 ? "is-positive" : "is-negative"}`, x: x(i) - step * 0.3, width: step * 0.6, y: top, height: h, rx: 3 })
    bar.style.transformOrigin = `0 ${y(0)}px`
    root.append(bar)
    const every = net.length > 12 ? 2 : 1
    if ((i + 1) % every === 0 || i === 0) {
      const label = svg("text", { class: "roi__year", x: x(i), y: height - 4, "text-anchor": "middle" })
      label.textContent = i + 1
      root.append(label)
    }
    return bar
  })
  chart.replaceChildren(root)
  if (animateIn && !reduced) animate(bars, { transform: ["scaleY(0)", "scaleY(1)"] }, { duration: 0.6, delay: stagger(0.03), ease: [0.22, 1, 0.36, 1] })
}

// The big figure eases from what it showed to what it shows now.
function tween(el, from, to) {
  if (reduced || from === null || !isFinite(from)) return (el.textContent = money(to))
  const start = performance.now()
  const tick = (now) => {
    const t = Math.min((now - start) / 500, 1)
    el.textContent = money(from + (to - from) * (1 - Math.pow(1 - t, 3)))
    if (t < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

function setUp(root) {
  const config = JSON.parse(root.dataset.roi)
  const form = root.querySelector("[data-roi-form]")
  const out = (name) => root.querySelector(`[data-roi-${name}]`)
  let shown = null, years = null

  const read = () => {
    const data = new FormData(form)
    const number = (name) => Math.max(0, parseFloat(data.get(name)) || 0)
    return { industry: data.get("industry"), amount: number("amount"), investment: number("investment"), care: number("care"), lawn: number("lawn"), years: Math.max(1, number("years")) }
  }

  const update = (event) => {
    const inputs = read()
    // A new industry starts from its own typical figure and words.
    if (event?.target?.name === "industry") {
      const industry = config.industries.find((i) => i.slug === inputs.industry)
      form.elements.amount.value = industry.amount
      inputs.amount = industry.amount
      out("amount-label").textContent = industry.label
      out("note").textContent = industry.note ?? ""
    }
    const result = estimate(config, inputs)
    out("years").textContent = inputs.years
    out("years-out").textContent = inputs.years
    tween(out("value"), shown, result.last.mid)
    shown = result.last.mid
    out("range").textContent = `Net of what you put in: ${money(result.last.low)} to ${money(result.last.high)}`
    out("roi").textContent = result.roi === null ? "—" : `${Math.round(result.roi * 100)}%`
    out("payback").textContent = result.payback ? `Year ${result.payback}` : `Not within ${inputs.years} years`
    out("cost").textContent = money(result.spent)
    draw(out("chart"), result.net, years !== inputs.years)
    years = inputs.years
    root.result = { inputs, result }
  }

  form.addEventListener("input", update)
  form.addEventListener("submit", (event) => event.preventDefault())

  out("plan").addEventListener("click", () => {
    const { inputs, result } = root.result
    const planner = document.getElementById("planner")
    if (!planner) return
    const line = [`${result.industry.name}`, `${form.querySelector("[data-roi-amount-label]").textContent}: ${money(inputs.amount)}`,
      `investment ${money(inputs.investment)}`, inputs.care ? `care ${money(inputs.care)}/yr` : null, inputs.lawn ? `${inputs.lawn} sq ft of lawn` : null,
      `${inputs.years} years: ${money(result.last.low)} to ${money(result.last.high)} net`, result.payback ? `pays back in year ${result.payback}` : null].filter(Boolean).join("; ")
    const field = planner.querySelector("[data-planner-estimate]")
    if (field) field.value = line
    const property = planner.querySelector(`input[name="property_type"][value="${CSS.escape(result.industry.property ?? "")}"]`)
    if (property) property.checked = true
  })

  update()
}

document.querySelectorAll("[data-roi]").forEach(setUp)
