(function () {
  'use strict';

  function appendQuery(url) {
    var qs = document.location.search.replace('?', '');
    if (!qs) return url;
    return url + (url.indexOf('?') > 0 ? '&' : '?') + qs;
  }

  // ───────────────────────── Navegação entre etapas ─────────────────────────
  var steps = Array.prototype.slice.call(document.querySelectorAll('.step'));
  var initialized = {};

  // Header compartilhado das perguntas — persiste no DOM, só atualiza texto/largura
  // (nunca é removido/recriado, então a barra sempre transiciona suavemente entre valores
  // em vez de sumir e voltar do zero a cada etapa).
  var STEP_HEADER_DATA = {
    2:  { label: 'Évaluation du profil',          counter: '1/3', pct: 33.33, back: null },
    3:  { label: 'Évaluation du profil',          counter: '2/3', pct: 66.67, back: '2' },
    4:  { label: 'Évaluation du profil',          counter: '3/3', pct: 100,   back: '3' },
    6:  { label: 'Vérification des ingrédients',  counter: '1/4', pct: 25,    back: '5' },
    7:  { label: 'Vérification des ingrédients',  counter: '2/4', pct: 50,    back: '6' },
    8:  { label: 'Vérification des ingrédients',  counter: '3/4', pct: 75,    back: '7' },
    9:  { label: 'Vérification des ingrédients',  counter: '4/4', pct: 100,   back: '8' },
    13: { label: 'Calibration de la dose',        counter: '1/5', pct: 20,    back: null },
    14: { label: 'Calibration de la dose',        counter: '2/5', pct: 40,    back: '13' },
    15: { label: 'Calibration de la dose',        counter: '3/5', pct: 60,    back: '14' },
    16: { label: 'Calibration de la dose',        counter: '4/5', pct: 80,    back: '15' },
    17: { label: 'Calibration de la dose',        counter: '5/5', pct: 100,   back: '16' }
  };

  var sharedHeader = document.getElementById('shared-header');
  var sharedHeaderLabel = document.getElementById('shared-header-label');
  var sharedHeaderCounter = document.getElementById('shared-header-counter');
  var sharedHeaderFill = document.getElementById('shared-header-fill');
  var sharedHeaderBack = document.getElementById('shared-header-back');
  var currentBackTarget = null;

  if (sharedHeaderBack) {
    sharedHeaderBack.addEventListener('click', function () {
      if (currentBackTarget) goToStep(currentBackTarget);
    });
  }

  function updateSharedHeader(n) {
    var data = STEP_HEADER_DATA[n];
    if (!data) {
      if (sharedHeader) sharedHeader.classList.add('is-hidden');
      return;
    }
    if (sharedHeader) sharedHeader.classList.remove('is-hidden');
    if (sharedHeaderLabel) sharedHeaderLabel.textContent = data.label;
    if (sharedHeaderCounter) sharedHeaderCounter.textContent = data.counter;
    if (sharedHeaderFill) sharedHeaderFill.style.width = data.pct + '%';
    currentBackTarget = data.back;
    if (sharedHeaderBack) sharedHeaderBack.disabled = !data.back;
  }

  function animateProgressBars(stepEl) {
    // usado só pelos cartões de checkpoint de receita (etapas 5/11/18) — essas telas
    // são recriadas do zero a cada visita, então a barra recomeça do 0% de propósito.
    var bars = stepEl.querySelectorAll('.qz-progress-fill');
    bars.forEach(function (bar) {
      var targetWidth = bar.style.width;
      bar.style.transition = 'none';
      bar.style.width = '0%';
      void bar.offsetWidth; // força reflow pra garantir que a transição reinicie
      requestAnimationFrame(function () {
        bar.style.transition = 'width .9s cubic-bezier(.22,1,.36,1)';
        bar.style.width = targetWidth;
      });
    });
  }

  function resetStepSelection(target) {
    // ao (re)entrar numa etapa, limpa qualquer seleção/estado de uma visita anterior —
    // no site original, voltar pra uma pergunta sempre mostra ela "em branco" de novo.
    target.querySelectorAll('.selected').forEach(function (el) { el.classList.remove('selected'); });
    target.querySelectorAll('.qz-continue').forEach(function (btn) {
      if (target.id !== 'step-2') btn.classList.remove('enabled');
    });
  }

  function goToStep(n) {
    steps.forEach(function (s) { s.classList.remove('is-active'); });
    var target = document.getElementById('step-' + n);
    if (!target) return;
    resetStepSelection(target);
    // reinicia a animação de entrada (fade/slide) mesmo se o elemento já foi mostrado antes
    target.style.animation = 'none';
    void target.offsetWidth;
    target.style.animation = '';
    target.classList.add('is-active');
    animateProgressBars(target);
    updateSharedHeader(n);
    window.scrollTo(0, 0);
    if (!initialized[n]) {
      initialized[n] = true;
      if (n == 16) initWaterMicroLoading();
      if (n == 22) initFinalLoading();
      if (n == 23) initFinalPage();
    }
  }

  document.addEventListener('click', function (e) {
    var next = e.target.closest('[data-next]');
    if (next) { goToStep(next.getAttribute('data-next')); return; }
    var back = e.target.closest('[data-back]');
    if (back) { goToStep(back.getAttribute('data-back')); }
  });

  // ───────────────────────── Perguntas de seleção única (avançam ao clicar) ─────────────────────────
  document.querySelectorAll('.quiz-options').forEach(function (group) {
    var next = group.getAttribute('data-group-next');
    group.querySelectorAll('button').forEach(function (opt) {
      opt.addEventListener('click', function () {
        opt.classList.add('selected');
        setTimeout(function () {
          if (next === 'micro') { showWaterMicroLoading(); }
          else if (next) { goToStep(next); }
        }, 320);
      });
    });
  });

  // ───────────────────────── Etapa 2 — stepper de idade/peso ─────────────────────────
  document.querySelectorAll('.qz-stepper').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var targetId = btn.getAttribute('data-target');
      var delta = parseInt(btn.getAttribute('data-delta'), 10);
      var el = document.getElementById(targetId);
      if (!el) return;
      var val = parseInt(el.textContent, 10) + delta;
      var min = targetId === 'age-exact' ? 18 : 40;
      var max = targetId === 'age-exact' ? 90 : 160;
      val = Math.max(min, Math.min(max, val));
      el.textContent = val;
    });
  });

  // ───────────────────────── Etapa 9 — modal de retenção ─────────────────────────
  (function retentionModal() {
    var step9 = document.getElementById('step-9');
    if (!step9) return;
    var modal = document.getElementById('retention-modal');
    var options = step9.querySelectorAll('.quiz-options button');
    options.forEach(function (opt) {
      opt.addEventListener('click', function () {
        setTimeout(function () { if (modal) modal.classList.remove('is-hidden'); }, 450);
      }, { once: true });
    });
    // fecha o modal (senão ele fica flutuando por cima de todas as próximas etapas, bloqueando cliques)
    if (modal) {
      modal.querySelector('[data-next]').addEventListener('click', function () {
        modal.classList.add('is-hidden');
      });
    }
  })();

  // ───────────────────────── Perguntas de múltipla escolha + botão Continuer (ex: etapas 3 e 13) ─────────────────────────
  document.querySelectorAll('.multi-confirm').forEach(function (wrap) {
    var step = wrap.closest('.step');
    var continueBtn = step.querySelector('.qz-continue');
    if (!continueBtn) return;
    wrap.querySelectorAll('button').forEach(function (opt) {
      opt.addEventListener('click', function () {
        opt.classList.toggle('selected');
        var anySelected = wrap.querySelectorAll('button.selected').length > 0;
        continueBtn.classList.toggle('enabled', anySelected);
      });
    });
    continueBtn.addEventListener('click', function () {
      if (continueBtn.classList.contains('enabled')) goToStep(continueBtn.getAttribute('data-next'));
    });
  });

  // ───────────────────────── Perguntas de seleção única com botão Continuer separado ─────────────────────────
  document.querySelectorAll('.single-confirm').forEach(function (wrap) {
    var step = wrap.closest('.step');
    var continueBtn = step.querySelector('.qz-continue');
    if (!continueBtn) return;
    wrap.querySelectorAll('button').forEach(function (opt) {
      opt.addEventListener('click', function () {
        wrap.querySelectorAll('button').forEach(function (o) { o.classList.remove('selected'); });
        opt.classList.add('selected');
        continueBtn.classList.add('enabled');
      });
    });
    continueBtn.addEventListener('click', function () {
      if (continueBtn.classList.contains('enabled')) goToStep(continueBtn.getAttribute('data-next'));
    });
  });

  // idem para a etapa 2 (idade/peso) — botão Continuer sempre habilitado (steppers têm valor padrão)
  document.querySelectorAll('.qz-continue').forEach(function (btn) {
    if (btn.closest('#step-2')) {
      btn.classList.add('enabled');
      btn.addEventListener('click', function () { goToStep(btn.getAttribute('data-next')); });
    }
  });

  // ───────────────────────── Etapa 16 — pergunta da água + micro-loading ─────────────────────────
  function showWaterMicroLoading() {
    var loader = document.getElementById('micro-loading');
    var bar = document.getElementById('micro-loading-bar');
    var duration = 1800;
    if (loader) loader.classList.remove('is-hidden');
    if (bar) {
      bar.style.transition = 'none';
      bar.style.width = '0%';
      void bar.offsetWidth;
      bar.style.transition = 'width ' + duration + 'ms linear';
      requestAnimationFrame(function () { bar.style.width = '100%'; });
    }
    setTimeout(function () {
      if (loader) loader.classList.add('is-hidden');
      goToStep(17);
    }, duration);
  }
  function initWaterMicroLoading() { /* nada a inicializar antecipadamente */ }

  // ───────────────────────── Etapa 22 — loading final com mensagens progressivas ─────────────────────────
  function initFinalLoading() {
    var CIRCUMFERENCE = 314.1592653589793;
    var DURATION = 4000;
    var pctEl = document.getElementById('final-load-pct');
    var ring = document.getElementById('final-ring');
    var msgEls = document.querySelectorAll('#step-22 .final-msg');
    var startTime = Date.now();

    function setMsgActive(idx) {
      msgEls.forEach(function (el, i) {
        if (i === idx) {
          el.style.color = 'rgb(42,157,111)';
          el.style.fontWeight = '600';
        } else {
          el.style.color = 'rgb(136,136,136)';
          el.style.fontWeight = '400';
        }
      });
    }

    var interval = setInterval(function () {
      var elapsed = Date.now() - startTime;
      var pct = Math.min(100, Math.round((elapsed / DURATION) * 100));
      if (pctEl) pctEl.textContent = pct + '%';
      if (ring) ring.style.strokeDashoffset = CIRCUMFERENCE * (1 - pct / 100);
      var activeIdx = Math.min(msgEls.length - 1, Math.floor((pct / 100) * msgEls.length));
      setMsgActive(activeIdx);
      if (pct >= 100) {
        clearInterval(interval);
        setTimeout(function () { goToStep(23); }, 900);
      }
    }, 100);
  }

  // ───────────────────────── Etapa 23 — página final (VSL longa + oferta) ─────────────────────────
  function initFinalPage() {
    var seen = new WeakSet();
    function appendQueryToCheckoutLinks() {
      document.querySelectorAll('#step-23 a[href^="https://pay.mycheckoutt.com"]').forEach(function (a) {
        if (seen.has(a)) return;
        seen.add(a);
        a.href = appendQuery(a.getAttribute('href'));
      });
    }
    appendQueryToCheckoutLinks();
    // o botão do player de vídeo (vturb-anchor-button) é injetado de forma assíncrona pelo script
    // da Converteai — reaplica o repasse de UTM/fbclid quando ele (ou qualquer outro link) aparecer depois.
    var linksObserver = new MutationObserver(appendQueryToCheckoutLinks);
    linksObserver.observe(document.getElementById('step-23'), { childList: true, subtree: true });

    (function countdown() {
      var totalSeconds = 14 * 60 + 39;
      var minEl = document.getElementById('cd-min');
      var secEl = document.getElementById('cd-sec');
      var stickyEl = document.getElementById('cd-sticky');

      function render() {
        var m = Math.floor(totalSeconds / 60);
        var s = totalSeconds % 60;
        var mm = String(m).padStart(2, '0');
        var ss = String(s).padStart(2, '0');
        if (minEl) minEl.textContent = mm;
        if (secEl) secEl.textContent = ss;
        if (stickyEl) stickyEl.textContent = mm + ':' + ss;
      }

      render();
      setInterval(function () {
        totalSeconds = totalSeconds > 0 ? totalSeconds - 1 : 14 * 60 + 39;
        render();
      }, 1000);
    })();

    document.querySelectorAll('#step-23 section').forEach(function (section) {
      var heading = section.querySelector('h2');
      if (!heading || heading.textContent.indexOf('Questions fr') === -1) return;

      section.querySelectorAll(':scope button').forEach(function (btn) {
        var answer = btn.nextElementSibling;
        if (!answer) return;
        var icon = btn.querySelector('span.flex-shrink-0');

        btn.addEventListener('click', function () {
          var isOpen = answer.style.maxHeight !== '0px' && answer.style.maxHeight !== '';
          answer.style.maxHeight = isOpen ? '0px' : '400px';
          if (icon) icon.style.transform = isOpen ? 'none' : 'rotate(180deg)';
        });
      });
    });

    (function testimonialCarousel() {
      var track = document.getElementById('testi-track');
      if (!track) return;
      var dotsWrap = null;
      document.querySelectorAll('#step-23 button[data-index]').forEach(function (d) {
        dotsWrap = d.parentElement;
      });
      var dots = dotsWrap ? Array.prototype.slice.call(dotsWrap.querySelectorAll('button[data-index]')) : [];
      var total = dots.length || 5;
      var current = total - 1;

      function goTo(i) {
        current = Math.max(0, Math.min(total - 1, i));
        track.style.transform = 'translateX(-' + (current * 20) + '%)';
        dots.forEach(function (d, idx) {
          var active = idx === current;
          d.style.width = active ? '20px' : '6px';
          d.style.background = active ? 'rgb(59, 111, 255)' : 'rgb(209, 218, 232)';
        });
      }

      dots.forEach(function (d, idx) {
        d.addEventListener('click', function () { goTo(idx); });
      });

      var startX = null;
      var wrapper = track.parentElement;
      wrapper.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; }, { passive: true });
      wrapper.addEventListener('touchend', function (e) {
        if (startX === null) return;
        var dx = e.changedTouches[0].clientX - startX;
        if (dx > 40) goTo(current - 1);
        else if (dx < -40) goTo(current + 1);
        startX = null;
      }, { passive: true });

      goTo(current);
    })();

    (function socialProofPopup() {
      var popup = document.getElementById('social-proof-popup');
      if (!popup) return;

      function play() {
        popup.style.display = 'block';
        popup.classList.remove('animate-slide-in-fade');
        void popup.offsetWidth;
        popup.classList.add('animate-slide-in-fade');
        setTimeout(function () { popup.style.display = 'none'; }, 5000);
      }

      setTimeout(play, 8000);
      setInterval(play, 25000);
    })();
  }

})();
