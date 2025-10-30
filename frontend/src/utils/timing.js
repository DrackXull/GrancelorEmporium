// frontend/src/utils/timing.js
export function debounce(fn, ms = 300) {
  let t = null;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}
