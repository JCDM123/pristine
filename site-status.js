/* Maintenance switch. The studio sets MAINTENANCE to true or false.
   While it is on, visitors see /maintenance.html. Anyone who has unlocked the studio on this device still sees the full site. */
(function () {
  var MAINTENANCE = true;
  window.PW_MAINTENANCE = MAINTENANCE;
  try {
    if (!MAINTENANCE) return;
    if (/\/(maintenance|studio)\.html$/.test(location.pathname)) return;
    if (localStorage.getItem('pw_owner') === '1') return;
    location.replace('/maintenance.html');
  } catch (e) {}
})();
