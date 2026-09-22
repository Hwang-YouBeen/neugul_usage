/**
 * Webview renderer. Receives a UsageViewState from the extension and draws it.
 * All state lives on the extension side; this file only renders.
 *
 * The DOM is rebuilt only when the *shape* of the view changes (which agents
 * are shown, which windows exist, error vs data). Gauge values are patched in
 * place so the fill width can animate.
 */
(function () {
  'use strict';

  var vscode = acquireVsCodeApi();
  var root = document.getElementById('root');

  var shapeKey = null;
  var lastState = null;

  window.addEventListener('message', function (event) {
    var message = event.data;
    if (message && message.type === 'state') {
      lastState = message.payload;
      render(lastState);
    }
  });

  root.addEventListener('click', function (event) {
    var target = event.target;
    if (!target || typeof target.closest !== 'function') {
      return;
    }
    var action = target.closest('[data-command]');
    if (action) {
      vscode.postMessage({ type: 'command', command: action.dataset.command });
    }
  });

  // Countdowns tick locally so the panel stays honest between updates.
  var countdownTimer = setInterval(updateCountdowns, 30000);
  window.addEventListener('unload', function () {
    clearInterval(countdownTimer);
  });

  function render(state) {
    document.body.dataset.animation = state.animation;

    var visible = state.agents.filter(function (agent) {
      return state.agentMode === 'both' || agent.agent === state.activeAgent;
    });

    var key = shapeOf(visible, state);
    if (key !== shapeKey) {
      shapeKey = key;
      root.innerHTML =
        visible.map(function (agent) { return cardSkeleton(agent, state); }).join('') +
        footer(state);
    }

    visible.forEach(function (agent) {
      patchCard(agent, state);
    });
    patchFooter(state);
  }

  /** Anything that changes this string requires new nodes rather than a patch. */
  function shapeOf(visible, state) {
    return visible
      .map(function (agent) {
        var status = agent.status;
        var detail = status.state;
        if (status.state === 'no-data') {
          detail += ':' + status.reason;
        } else if (status.state === 'ok') {
          detail += status.usage.unlimited ? ':unlimited' : ':' + windowOrder(agent, state).join(',');
        }
        return agent.agent + '=' + detail;
      })
      .join('|');
  }

  /** Primary window first, then the other one if it exists. */
  function windowOrder(agent, state) {
    if (agent.status.state !== 'ok') {
      return [];
    }
    var windows = agent.status.usage.windows;
    var primary = windows[state.primaryWindow] ? state.primaryWindow
      : (windows.fiveHour ? 'fiveHour' : (windows.longTerm ? 'longTerm' : null));
    if (!primary) {
      return [];
    }
    var other = primary === 'fiveHour' ? 'longTerm' : 'fiveHour';
    return windows[other] ? [primary, other] : [primary];
  }

  // ---------- skeleton ----------

  function cardSkeleton(agent, state) {
    return (
      '<section class="card" data-agent="' + agent.agent + '">' +
      '<header class="card-header">' +
      '<span class="dot"></span>' +
      '<h2>' + escapeHtml(agent.label) + '</h2>' +
      '<span class="badges"></span>' +
      '</header>' +
      bodySkeleton(agent, state) +
      '</section>'
    );
  }

  function bodySkeleton(agent, state) {
    var status = agent.status;

    if (status.state === 'error') {
      return '<div class="empty"><p class="empty-message"></p></div>';
    }
    if (status.state === 'no-data') {
      return (
        '<div class="empty"><p class="empty-message"></p>' + emptyAction(status.reason) + '</div>'
      );
    }
    if (status.usage.unlimited) {
      return '<div class="unlimited"><span class="raccoon" aria-hidden="true">🦝</span><p>무제한 크레딧</p></div>';
    }

    var order = windowOrder(agent, state);
    if (order.length === 0) {
      return '<div class="empty"><p class="empty-message"></p></div>';
    }

    return order
      .map(function (kind, index) {
        var isPrimary = index === 0;
        return (
          '<div class="gauge ' + (isPrimary ? 'primary' : 'secondary') + '" data-window="' + kind + '">' +
          '<div class="track-row">' +
          '<span class="raccoon" aria-hidden="true">🦝</span>' +
          '<div class="track" role="progressbar" aria-valuemin="0" aria-valuemax="100">' +
          '<div class="fill"></div></div>' +
          '</div>' +
          '<div class="gauge-meta"><span>' + windowLabel(kind) + '</span>' +
          '<span class="value"></span></div>' +
          '<div class="gauge-reset"></div>' +
          '</div>'
        );
      })
      .join('');
  }

  function emptyAction(reason) {
    if (reason === 'bridge-missing') {
      return '<button data-command="installBridge">연동하기</button>';
    }
    if (reason === 'not-installed') {
      return '<button data-command="openSettings">경로 설정</button>';
    }
    return '';
  }

  function footer() {
    return (
      '<footer class="footer">' +
      '<button data-command="selectAgent" class="link mode-label"></button>' +
      '<button data-command="refresh" class="link">새로고침</button>' +
      '</footer>'
    );
  }

  // ---------- patching ----------

  function patchCard(agent, state) {
    var card = root.querySelector('[data-agent="' + agent.agent + '"]');
    if (!card) {
      return;
    }

    var classes = ['card', 'mood-' + agent.mood];
    if (!agent.isActive) {
      classes.push('inactive');
    }
    if (agent.isStale) {
      classes.push('stale');
    }
    card.className = classes.join(' ');
    card.querySelector('.dot').classList.toggle('on', agent.isActive);

    var status = agent.status;
    var badges = card.querySelector('.badges');
    if (badges) {
      badges.innerHTML = badgeHtml(status);
    }

    var message = card.querySelector('.empty-message');
    if (message) {
      message.textContent =
        status.state === 'error'
          ? status.message
          : (status.state === 'no-data' ? status.detail || '사용량 정보를 찾을 수 없습니다.' : '');
      return;
    }

    if (status.state !== 'ok' || status.usage.unlimited) {
      return;
    }

    var windows = status.usage.windows;
    var gauges = card.querySelectorAll('.gauge');
    for (var i = 0; i < gauges.length; i++) {
      patchGauge(gauges[i], windows[gauges[i].dataset.window]);
    }
  }

  function patchGauge(node, window) {
    if (!window) {
      return;
    }
    var remaining = clamp(window.remainingPercent);
    node.querySelector('.fill').style.width = remaining + '%';
    node.querySelector('.track').setAttribute('aria-valuenow', String(Math.round(remaining)));
    node.querySelector('.value').textContent = Math.round(remaining) + '% 남음';

    var reset = node.querySelector('.gauge-reset');
    reset.dataset.reset = window.resetsAt || '';
    reset.textContent = resetText(window.resetsAt);
  }

  function patchFooter(state) {
    var label = root.querySelector('.mode-label');
    if (label) {
      label.textContent = {
        auto: '자동',
        codex: 'Codex 고정',
        claude: 'Claude Code 고정',
        both: '둘 다 보기'
      }[state.agentMode];
    }
  }

  function badgeHtml(status) {
    if (status.state !== 'ok') {
      return '';
    }
    var html = '';
    if (status.usage.planType) {
      html += '<span class="badge">' + escapeHtml(status.usage.planType) + '</span>';
    }
    if (status.usage.estimated) {
      html += '<span class="badge badge-warn">추정치</span>';
    }
    return html;
  }

  // ---------- helpers ----------

  function updateCountdowns() {
    var nodes = root.querySelectorAll('.gauge-reset');
    for (var i = 0; i < nodes.length; i++) {
      var raw = nodes[i].dataset.reset;
      nodes[i].textContent = resetText(raw ? Number(raw) : undefined);
    }
  }

  function resetText(resetsAt) {
    if (!resetsAt) {
      return '리셋 시각 알 수 없음';
    }
    var diff = Number(resetsAt) - Date.now();
    if (diff <= 0) {
      return '곧 리셋';
    }
    var minutes = Math.floor(diff / 60000);
    var days = Math.floor(minutes / 1440);
    var hours = Math.floor((minutes % 1440) / 60);
    var mins = minutes % 60;
    if (days > 0) {
      return days + '일 ' + hours + '시간 후 리셋';
    }
    if (hours > 0) {
      return hours + '시간 ' + mins + '분 후 리셋';
    }
    return Math.max(1, mins) + '분 후 리셋';
  }

  function windowLabel(kind) {
    return kind === 'fiveHour' ? '5시간 창' : '장기 창';
  }

  function clamp(value) {
    if (typeof value !== 'number' || !isFinite(value)) {
      return 0;
    }
    return Math.min(100, Math.max(0, value));
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  // Ask the extension for an initial paint.
  vscode.postMessage({ type: 'command', command: 'refresh' });
})();
