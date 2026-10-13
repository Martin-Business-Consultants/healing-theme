// Number boxes (input[data-number]) show their thousands with commas as
// they're typed, 2000000 as 2,000,000, keeping the cursor among the same
// digits. They're text boxes for that (a number box can't show commas),
// with the numeric keypad on phones; numberValue reads one back.
export const formatNumber = (n) => (n === "" || n === null || Number.isNaN(Number(n)) ? "" : Math.round(Number(n)).toLocaleString("en-US"))

export const numberValue = (value) => Math.max(0, parseFloat(String(value ?? "").replace(/[^\d.]/g, "")) || 0)

function reformat(input) {
  const caret = input.selectionStart ?? input.value.length
  const digitsBefore = input.value.slice(0, caret).replace(/\D/g, "").length
  const digits = input.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "")
  input.value = digits ? Number(digits).toLocaleString("en-US") : ""
  // Back among the same digits: after the digitsBefore-th one.
  let position = 0, seen = 0
  while (position < input.value.length && seen < digitsBefore) { if (/\d/.test(input.value[position])) seen++; position++ }
  input.setSelectionRange(position, position)
}

document.addEventListener("input", (event) => {
  if (event.target.matches?.("input[data-number]")) reformat(event.target)
}, true)
