(function () {
  "use strict";

  var POLL = 0.12;
  var stats = $.GetContextPanel();
  var ABSOLUTE_IDS = {
    clipSizeContainer: true,
    spiritContainer: true,
  };
  var LIVE_IDS = {
    speedDisplayContainer: true,
  };

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

  function collectText(panel, parts) {
    if (!valid(panel)) return;

    try {
      if (panel.text) parts.push(String(panel.text));
    } catch (_err) {}

    var count = 0;

    try {
      count = panel.GetChildCount();
    } catch (_err) {
      return;
    }

    for (var i = 0; i < count; i++) collectText(panel.GetChild(i), parts);
  }

  function isZeroValue(panel) {
    var parts = [];

    collectText(panel, parts);

    var raw = parts.join(" ").replace(/,/g, "");
    var match = raw.match(/-?\d+(?:\.\d+)?/);

    if (!match) return false;

    return Math.abs(parseFloat(match[0])) < 0.0001;
  }

  function shouldShowModifier(panel, detail) {
    if (!hasClass(panel, "miniModifier")) return false;

    var id = "";

    try {
      id = panel.id || "";
    } catch (_err) {}

    if (LIVE_IDS[id]) return true;
    if (hasClass(panel, "isZero") || isZeroValue(panel)) return false;
    if (
      hasClass(panel, "isNegative") ||
      hasClass(panel, "IsNegative") ||
      hasClass(panel, "isPositive") ||
      hasClass(panel, "IsPositive")
    ) {
      return true;
    }
    if (hasClass(panel, "isBaseValue")) return false;
    if (ABSOLUTE_IDS[id] && !hasClass(panel, "shouldShow")) return false;
    if (detail) return true;

    return hasClass(panel, "shouldShow");
  }

  function tick() {
    if (!valid(stats)) return;

    var detail = hasClass(stats, "gDetailView") || hasClass(stats, "gScoreboardOpen");
    var count = 0;

    try {
      count = stats.GetChildCount();
    } catch (_err) {
      $.Schedule(POLL, tick);
      return;
    }

    for (var i = 0; i < count; i++) {
      var child = stats.GetChild(i);

      if (!hasClass(child, "miniModifier")) continue;

      var id = "";

      try {
        id = child.id || "";
      } catch (_err) {}

      var zero = hasClass(child, "isZero") || isZeroValue(child);

      if (LIVE_IDS[id] && zero) {
        child.RemoveClass("mntbliss_stat_hidden");
        child.AddClass("mntbliss_stat_ghost");
      } else if (shouldShowModifier(child, detail)) {
        child.RemoveClass("mntbliss_stat_hidden");
        child.RemoveClass("mntbliss_stat_ghost");
      } else {
        child.AddClass("mntbliss_stat_hidden");
        child.RemoveClass("mntbliss_stat_ghost");
      }

      var bonus = null;

      try {
        bonus = child.FindChildTraverse("bonusIcon");
      } catch (_err) {
        bonus = null;
      }

      if (valid(bonus)) {
        bonus.style.visibility = "collapse";
        bonus.style.width = "0px";
        bonus.style.height = "0px";
      }
    }

    $.Schedule(POLL, tick);
  }

  tick();
})();
