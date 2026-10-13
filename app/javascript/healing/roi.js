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
import { draw, money, tween } from "healing/chart"

// Year-by-year cumulative benefit at one uplift percentage, in its two
// parts: what the plantings add to the basis (sales, rent, or the property's
// value, counted once), and what turning lawn into planting saves.
function benefits({ basis, amount, uplift, lawnSqft, lawnRate, years, ramp, lawnRamp }) {
  const share = (shares, year) => shares[Math.min(year, shares.length) - 1]
  let added = 0, lawn = 0
  return Array.from({ length: years }, (_, i) => {
    const year = i + 1
    lawn += lawnSqft * lawnRate * share(lawnRamp, year)
    const gain = amount * (uplift / 100) * share(ramp, year)
    if (basis === "property_value") added = gain
    else added += gain
    return { added, lawn, total: added + lawn }
  })
}

// How each basis's added value is named and explained.
const BASES = {
  revenue: { line: "Added sales", what: "what better plantings could add to your sales", per: "of annual sales a year" },
  rent: { line: "Added rent", what: "what better plantings could add to your rent roll, through higher rents and faster leasing", per: "of annual rent a year" },
  budget: { line: "Added value", what: "what better plantings could add to your budget", per: "of the yearly budget" },
  property_value: { line: "Added property value", what: "what better plantings could add to your property's value, counted once", per: "of its value, once" },
}

function estimate(config, inputs) {
  const industry = config.industries.find((i) => i.slug === inputs.industry) ?? config.industries[0]
  const common = { basis: industry.basis, amount: inputs.amount, lawnSqft: inputs.lawn, years: inputs.years, ramp: config.ramp, lawnRamp: config.lawnRamp }
  const low = benefits({ ...common, uplift: industry.low, lawnRate: config.lawn[0] ?? 0 })
  const high = benefits({ ...common, uplift: industry.high, lawnRate: config.lawn[1] ?? config.lawn[0] ?? 0 })
  const cost = Array.from({ length: inputs.years }, (_, i) => inputs.investment + inputs.care * (i + 1))
  const net = low.map((l, i) => ({ low: l.total - cost[i], high: high[i].total - cost[i], mid: (l.total + high[i].total) / 2 - cost[i] }))
  const last = net[net.length - 1]
  const spent = cost[cost.length - 1]
  const payback = net.findIndex((n) => n.mid >= 0)
  const end = inputs.years - 1
  const parts = { added: [low[end].added, high[end].added], lawn: [low[end].lawn, high[end].lawn] }
  return { industry, net, last, spent, parts, payback: payback >= 0 ? payback + 1 : null, roi: spent > 0 ? last.mid / spent : null }
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

  // What the number is, line by line, and why: written for the industry and the years chosen.
  const explain = (result, inputs) => {
    const { industry, parts } = result
    const basis = BASES[industry.basis] ?? BASES.revenue
    const range = ([a, b]) => (Math.round(a) === Math.round(b) ? money(a) : `${money(a)} to ${money(b)}`)
    const pct = (n) => `${+n.toFixed(2)}%`
    const lines = [
      [basis.line, `${pct(industry.low)}–${pct(industry.high)} ${basis.per}, growing as the plantings fill in`, `+${range(parts.added)}`],
      inputs.lawn > 0 && [`Lawn care saved`, `${inputs.lawn.toLocaleString("en-US")} sq ft no longer mowed, watered or fed`, `+${range(parts.lawn)}`],
      [`Planting and care`, `${money(inputs.investment)} to plant${inputs.care ? `, ${money(inputs.care)} a year to keep` : ""}`, `−${money(result.spent)}`],
    ].filter(Boolean)
    out("what").textContent = `Over ${inputs.years} years, ${basis.what}${inputs.lawn > 0 ? ", plus what you'd save on lawn care" : ""}, after what the planting and its care cost. The big number is the middle of the range.`
    const list = out("breakdown")
    list.replaceChildren(...lines.map(([term, detail, amount]) => {
      const row = document.createElement("div")
      row.innerHTML = "<dt><span></span><small></small></dt><dd></dd>"
      row.querySelector("span").textContent = term
      row.querySelector("small").textContent = detail
      row.querySelector("dd").textContent = amount
      return row
    }))
    const total = document.createElement("div")
    total.className = "is-total"
    total.innerHTML = "<dt><span>Net return</span></dt><dd></dd>"
    total.querySelector("dd").textContent = `${money(result.last.low)} to ${money(result.last.high)}`
    list.append(total)
    out("why").textContent = industry.note ?? ""
  }

  const update = (event) => {
    const inputs = read()
    // A new industry starts from its own typical figure and words.
    if (event?.target?.name === "industry") {
      const industry = config.industries.find((i) => i.slug === inputs.industry)
      // and its own starting investment, care and lawn.
      for (const name of ["amount", "investment", "care", "lawn"]) {
        form.elements[name].value = industry[name]
        inputs[name] = industry[name]
      }
      out("amount-label").textContent = industry.label
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
    explain(result, inputs)
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
