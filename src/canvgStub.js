// jsPDF can lazily import "canvg" to draw SVG images. The logbook PDF never does, so this empty module stands in for it
// (see the alias in vite.config.js) and keeps a 150 KB chunk out of the app and its offline cache.
export default undefined;
