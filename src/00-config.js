// ---------- Settings: one object every part of the visualizer reads, remembered between sessions ----------
// What kind of screen this is: a phone gets the touch layout and starts lighter.
const TOUCH = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
const PHONE = TOUCH && Math.min(screen.width, screen.height) < 900;
const AUTO_CAP = PHONE ? 720 : 1080;   // where Auto detail starts
const DEFAULTS = {
  intensity: 1, speed: 1, punch: 1, bass: 1, mid: 1, treb: 1,          // music
  bright: 1, trail: 1, glow: 1, hueShift: 0, sat: 1,                  // picture
  cam: 1, spaces: true,                                               // camera
  auto: true, sceneSec: 30, transSec: 2.4, favOnly: false, detail: 0, // scenes
  fav: {}, hide: {}, micId: ''
};
const STORE_KEY = 'afterimage.settings.v3';
const CFG = (() => {
  const c = JSON.parse(JSON.stringify(DEFAULTS));
  try { const s = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); if (s && typeof s === 'object') for (const k in DEFAULTS) if (typeof s[k] === typeof DEFAULTS[k]) c[k] = s[k]; } catch (e) {}
  return c;
})();
let saveTimer = 0;
function saveCfg() { clearTimeout(saveTimer); saveTimer = setTimeout(() => { try { localStorage.setItem(STORE_KEY, JSON.stringify(CFG)); } catch (e) {} }, 300); }
