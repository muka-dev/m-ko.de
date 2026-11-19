// Quick check on the AI adoption page: five statements in, one suggested starting point out.
// The texts live in the page (one block per result), so this file holds no language strings.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AdoptionCheck = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // 0 to 2 ticked: book or workshop. 3 to 4: days 1 to 30. All 5: straight into the pilot.
  function recommend(ticked) {
    if (ticked >= 5) return 'pilot';
    if (ticked >= 3) return 'clarity';
    return 'start';
  }

  if (typeof document !== 'undefined') {
    var init = function () {
      var form = document.querySelector('[data-adopt-check]');
      if (!form) return;
      var blocks = document.querySelectorAll('[data-result]');
      var update = function () {
        var key = recommend(form.querySelectorAll('input:checked').length);
        blocks.forEach(function (b) { b.hidden = b.getAttribute('data-result') !== key; });
      };
      form.addEventListener('change', update);
      update();
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }

  return { recommend: recommend };
});
