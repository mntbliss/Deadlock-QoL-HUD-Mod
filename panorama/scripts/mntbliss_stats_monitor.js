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

    if (!match) return true;

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

  function markEmpty(panel, empty) {
    if (!valid(panel)) return;

    try {
      if (empty) panel.AddClass("mntbliss_empty_slot");
      else panel.RemoveClass("mntbliss_empty_slot");
    } catch (_err) {}
  }

  function iconIsShown(img) {
    if (!valid(img)) return false;

    if (hasClass(img, "BrokenImage") || hasClass(img, "Hidden") || hasClass(img, "hidden")) {
      return false;
    }

    try {
      if (img.visible === false) return false;
    } catch (_err) {}

    try {
      var vis = String(img.style.visibility || "");
      if (vis === "collapse" || vis === "hidden") return false;
    } catch (_err) {}

    return true;
  }

  function tidyEmptyIcons(modifier) {
    var list = null;

    try {
      list = modifier.FindChildTraverse("casterList");
    } catch (_err) {
      return;
    }

    if (!valid(list)) return;

    var chips = 0;

    try {
      chips = list.GetChildCount();
    } catch (_err) {
      return;
    }

    for (var i = 0; i < chips; i++) {
      var chip = list.GetChild(i);

      if (!hasClass(chip, "casterAndModifiers")) continue;

      var shown = 0;
      var hero = null;
      var bonus = null;
      var mods = null;

      try {
        hero = chip.FindChildTraverse("heroIcon");
        bonus = chip.FindChildTraverse("bonusIcon");
        mods = chip.FindChildTraverse("modifierList");
      } catch (_err) {}

      markEmpty(bonus, true);

      if (valid(hero)) {
        var heroOn = iconIsShown(hero);
        markEmpty(hero, !heroOn);
        if (heroOn) shown += 1;
      }

      if (valid(mods)) {
        var n = 0;

        try {
          n = mods.GetChildCount();
        } catch (_err) {
          n = 0;
        }

        for (var j = 0; j < n; j++) {
          var row = mods.GetChild(j);
          var ability = null;

          try {
            ability = row.FindChildTraverse("abilityIcon");
          } catch (_err) {}

          var art = iconIsShown(ability);
          markEmpty(ability, !art);
          markEmpty(row, !art);
          if (art) shown += 1;
        }
      }

      markEmpty(chip, shown === 0);
    }
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
        tidyEmptyIcons(child);
      } else {
        child.AddClass("mntbliss_stat_hidden");
        child.RemoveClass("mntbliss_stat_ghost");
      }
    }

    $.Schedule(POLL, tick);
  }

  tick();
})();
