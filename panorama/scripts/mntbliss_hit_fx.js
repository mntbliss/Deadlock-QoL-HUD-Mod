(function () {
  "use strict";

  var BASE_DURATION = __HIT_DURATION__;
  var SPEED = __HIT_SPEED__;
  var POLL = 0.016;
  var MIN_DURATION = 0.03;
  var MAX_INTERVAL = 1.2;
  var MIN_INTERVAL = 0.012;

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
  var fireRateBox = null;
  var fireRateBonus = 0;
  var currentDuration = 0;

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

  function hudRoot() {
    var panel = gun;

    for (var i = 0; i < 24; i++) {
      var parent = null;

      try {
        parent = panel.GetParent();
      } catch (_err) {
        break;
      }

      if (!valid(parent)) break;

      panel = parent;
    }

    return panel;
  }

  function parsePercent(text) {
    var raw = String(text || "").replace(/,/g, "");
    var match = raw.match(/-?\d+(?:\.\d+)?/);

    if (!match) return null;

    return parseFloat(match[0]);
  }

  function firstPercent(panel) {
    if (!valid(panel)) return null;

    try {
      if (panel.text) {
        var value = parsePercent(panel.text);

        if (value !== null) return value;
      }
    } catch (_err) {}

    var count = 0;

    try {
      count = panel.GetChildCount();
    } catch (_err) {
      return null;
    }

    for (var i = 0; i < count; i++) {
      var nested = firstPercent(panel.GetChild(i));

      if (nested !== null) return nested;
    }

    return null;
  }

  function corePercent(box) {
    if (!valid(box)) return null;

    var core = null;

    try {
      core = box.GetChild(0);
    } catch (_err) {
      return null;
    }

    return firstPercent(core);
  }

  function refreshFireRateStat() {
    if (!valid(fireRateBox)) {
      try {
        fireRateBox = hudRoot().FindChildTraverse("fireRateContainer");
      } catch (_err) {
        fireRateBox = null;
      }
    }

    var bonus = corePercent(fireRateBox);

    if (bonus !== null) fireRateBonus = bonus;
  }

  function ammoCount() {
    var label = child("mntbliss_weapon_ammo");

    if (!valid(label)) return -1;

    var value = parseInt(label.text, 10);

    return isNaN(value) ? -1 : value;
  }

  function noteShots(dropped) {
    var t = now();
    var count = Math.max(dropped, 1);

    if (lastShotAt > 0) {
      var interval = (t - lastShotAt) / count;

      if (interval > MIN_INTERVAL && interval < MAX_INTERVAL) lastInterval = interval;
    }

    lastShotAt = t;

    if (!playing) return;
    if (!stillHitting && !hasClass(gun, "show_hit_marker") && !hasClass(gun, "show_crit_hit_marker")) return;

    var next = clipDuration();

    if (next < currentDuration * 0.9) {
      play(panelForHit(hasClass(gun, "show_crit_hit_marker")), next);
    }
  }

  function liveInterval() {
    if (lastInterval <= 0) return 0;
    if (now() - lastShotAt > MAX_INTERVAL) return 0;

    return lastInterval;
  }

  function clipDuration() {
    var duration = BASE_DURATION / Math.max(SPEED, 0.01);
    var interval = liveInterval();

    if (interval > 0) duration = Math.min(duration, interval);
    else duration = duration / Math.max(0.25, 1 + fireRateBonus / 100);

    return Math.max(MIN_DURATION, duration);
  }

  function pollAmmo() {
    var ammo = ammoCount();

    if (ammo < 0) return;

    if (lastAmmo >= 0 && ammo < lastAmmo) noteShots(lastAmmo - ammo);

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
    currentDuration = duration;
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
      currentDuration = 0;
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

      var next = clipDuration();

      if (next < currentDuration * 0.9) play(panelForHit(isCrit), next);

      return;
    }

    stillHitting = false;
    play(panelForHit(isCrit), clipDuration());
  }

  function tick() {
    if (!valid(gun)) return;

    refreshFireRateStat();
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
