(function () {
  "use strict";

  var BASE_DURATION = __HIT_DURATION__;
  var SPEED = __HIT_SPEED__;
  var POLL = 0.016;
  var MIN_DURATION = 0.05;
  var MAX_INTERVAL = 1.2;

  var gun = $.GetContextPanel();
  var playToken = 0;
  var playing = false;
  var stillHitting = false;
  var lastShotAt = 0;
  var lastInterval = 0;
  var lastAmmo = -1;
  var wasHit = false;
  var wasCrit = false;
  var nextIsCrit = false;

  function valid(panel) {
    try {
      return !!(panel && panel.IsValid && panel.IsValid());
    } catch (_err) {
      return false;
    }
  }

  function hasClass(panel, name) {
    try {
      return !!(valid(panel) && panel.BHasClass && panel.BHasClass(name));
    } catch (_err) {
      return false;
    }
  }

  function child(id) {
    try {
      return gun.FindChildTraverse(id);
    } catch (_err) {
      return null;
    }
  }

  function now() {
    return Date.now() / 1000;
  }

  function ammoCount() {
    var label = child("mntbliss_weapon_ammo");

    if (!valid(label)) return -1;

    var value = parseInt(label.text, 10);

    return isNaN(value) ? -1 : value;
  }

  function noteShot() {
    var t = now();

    if (lastShotAt > 0) {
      var interval = t - lastShotAt;

      if (interval > 0.04 && interval < MAX_INTERVAL) lastInterval = interval;
    }

    lastShotAt = t;
    updateFireRateLabel();
  }

  function clipDuration() {
    var duration = BASE_DURATION / Math.max(SPEED, 0.01);

    if (lastInterval > 0) duration = Math.min(duration, lastInterval);

    return Math.max(MIN_DURATION, duration);
  }

  function updateFireRateLabel() {
    var label = child("mntbliss_fire_rate_label");

    if (!valid(label) || lastInterval <= 0) return;

    label.text = (1 / lastInterval).toFixed(2) + "/s";

    var row = child("mntbliss_fire_rate");

    if (valid(row)) row.AddClass("mntbliss_has_rate");
  }

  function pollAmmo() {
    var ammo = ammoCount();

    if (ammo < 0) return;

    if (lastAmmo >= 0 && ammo < lastAmmo) noteShot();

    lastAmmo = ammo;
  }

  function hide(panel) {
    if (!valid(panel)) return;

    panel.RemoveClass("mntbliss_hit_play");
  }

  function panelForHit(isCrit) {
    var hearts = child("mntbliss_hit_hearts");
    var spikes = child("mntbliss_heart_spikes");

    if (isCrit) {
      hide(hearts);
      return spikes;
    }

    hide(spikes);
    return hearts;
  }

  function play(panel, duration) {
    if (!valid(panel)) return;

    var token = ++playToken;

    playing = true;
    panel.RemoveClass("mntbliss_hit_play");
    panel.style.animationDuration = duration + "s";

    $.Schedule(0, function () {
      if (token !== playToken || !valid(panel)) return;

      panel.AddClass("mntbliss_hit_play");
    });

    $.Schedule(duration, function () {
      if (token !== playToken || !valid(gun) || !valid(panel)) return;

      var isCrit = hasClass(gun, "show_crit_hit_marker");
      var held = stillHitting || hasClass(gun, "show_hit_marker") || isCrit;

      stillHitting = false;

      if (held) {
        play(panelForHit(nextIsCrit || isCrit), clipDuration());
        return;
      }

      playing = false;
      hide(panel);
    });
  }

  function onHit(isCrit) {
    nextIsCrit = isCrit;

    if (playing && isCrit && !wasCrit) {
      stillHitting = false;
      play(panelForHit(true), clipDuration());
      return;
    }

    if (playing) {
      stillHitting = true;
      return;
    }

    stillHitting = false;
    play(panelForHit(isCrit), clipDuration());
  }

  function tick() {
    if (!valid(gun)) return;

    pollAmmo();

    var isCrit = hasClass(gun, "show_crit_hit_marker");
    var isHit = hasClass(gun, "show_hit_marker") || isCrit;

    if (isHit && (!wasHit || isCrit !== wasCrit)) onHit(isCrit);

    wasHit = isHit;
    wasCrit = isCrit;
    $.Schedule(POLL, tick);
  }

  tick();
})();
