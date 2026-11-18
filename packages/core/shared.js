// Functions that were byte-for-byte (or behaviour-for-behaviour) the same in two or more of the original apps.
// Same-named but different functions (streak, sessionKcal, muscleLoad, parseCSV, importCSV, diet's string weekStart) stay in their own core.
(function (root) {
  const rad = x => x * Math.PI / 180;

  // Great-circle distance in meters. Points are { lat, lon }.
  function haversine(a, b) {
    const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  // Walking/running MET by speed (km/h).
  const speedMet = kmh => kmh < 3.2 ? 2.5 : kmh < 4.8 ? 3.3 : kmh < 5.6 ? 3.8 : kmh < 6.5 ? 5 : kmh < 8 ? 7 : kmh < 9.7 ? 9 : 10.5;

  // kcal = MET × 3.5 × kg / 200 × minutes.
  const workoutKcal = (met, kg, minutes) => Math.round(met * 3.5 * kg / 200 * minutes);

  // Local calendar date 'YYYY-MM-DD'. Accepts Date, ms or anything new Date() takes.
  const ymd = x => { const d = new Date(x); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

  // Local Monday 00:00 of the week containing ms, as ms.
  const weekStart = ms => { const d = new Date(ms); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return d.getTime(); };

  const api = { rad, haversine, speedMet, workoutKcal, ymd, weekStart };
  if (typeof module !== 'undefined') module.exports = api; else root.Shared = api;
})(this);
