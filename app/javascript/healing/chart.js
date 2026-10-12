// What both calculators draw with (healing/roi, healing/garden_value):
// dollars written short, a year-by-year bar chart of the net with the
// low-to-high range behind it, and a figure that eases to its new value.
import { animate, stagger } from "healing/vendor/motion"

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
export const money = (n) => {
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

// net: [{low, mid, high}] a year. The bars grow in when `animateIn`.
export function draw(chart, net, animateIn) {
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
export function tween(el, from, to) {
  if (reduced || from === null || !isFinite(from)) return (el.textContent = money(to))
  const start = performance.now()
  const tick = (now) => {
    const t = Math.min((now - start) / 500, 1)
    el.textContent = money(from + (to - from) * (1 - Math.pow(1 - t, 3)))
    if (t < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}
