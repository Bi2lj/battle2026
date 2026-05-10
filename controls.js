// controls.js — 虚拟控制器，接管触控输入并注入 game.keys

(function () {
  // 等待 game 实例挂载到 window
  function waitForGame(cb) {
    if (window._game) { cb(window._game); return; }
    const t = setInterval(() => {
      if (window._game) { clearInterval(t); cb(window._game); }
    }, 50);
  }

  // ── 画布缩放 ────────────────────────────────────────────────────────────────
  function scaleCanvas() {
    const wrap    = document.getElementById('canvas-wrap');
    const canvas  = document.getElementById('gameCanvas');
    const overlay = document.getElementById('menu-overlay');
    if (!canvas) return;

    const isLandscape = window.innerWidth > window.innerHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let scale;
    if (isLandscape) {
      scale = Math.min((vw - 160) / canvas.width, vh / canvas.height);
    } else {
      scale = Math.min(vw / canvas.width, (vh - 200) / canvas.height);
    }
    scale = Math.min(scale, 1);

    // 关键：wrapper 设为缩放后的尺寸，canvas 用 transform 缩放
    const sw = Math.floor(canvas.width  * scale);
    const sh = Math.floor(canvas.height * scale);
    wrap.style.width    = sw + 'px';
    wrap.style.height   = sh + 'px';
    wrap.style.overflow = 'hidden';
    canvas.style.transform       = `scale(${scale})`;
    canvas.style.transformOrigin = 'top left';

    if (overlay) {
      overlay.style.width  = sw + 'px';
      overlay.style.height = sh + 'px';
      // overlay 内的按钮坐标是基于原始 canvas 尺寸的，需要同步缩放
      overlay.style.transform       = `scale(${scale})`;
      overlay.style.transformOrigin = 'top left';
      overlay.style.width  = canvas.width  + 'px';
      overlay.style.height = canvas.height + 'px';
    }
  }

  window.addEventListener('resize', scaleCanvas);
  window.addEventListener('orientationchange', () => setTimeout(scaleCanvas, 300));
  window.addEventListener('load', scaleCanvas);

  // ── D-pad 触控 ──────────────────────────────────────────────────────────────
  const KEY_MAP = {
    'btn-up':    'ArrowUp',
    'btn-down':  'ArrowDown',
    'btn-left':  'ArrowLeft',
    'btn-right': 'ArrowRight',
    'btn-shoot': 'Space',
  };

  // 追踪每个 touch identifier 对应的按钮
  const touchMap = {};  // touchId → buttonId

  function getButtonFromTouch(touch) {
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!el) return null;
    return el.closest('[id]')?.id || null;
  }

  function pressKey(btnId, game) {
    const code = KEY_MAP[btnId];
    if (!code || !game) return;
    game.keys[code] = true;
    document.getElementById(btnId)?.classList.add('pressed');
  }

  function releaseKey(btnId, game) {
    const code = KEY_MAP[btnId];
    if (!code || !game) return;
    game.keys[code] = false;
    document.getElementById(btnId)?.classList.remove('pressed');
  }

  waitForGame(game => {
    const dpad  = document.getElementById('dpad');
    const shoot = document.getElementById('btn-shoot');

    function onTouchStart(e) {
      e.preventDefault();
      game.audio.resume();
      for (const t of e.changedTouches) {
        const btnId = getButtonFromTouch(t);
        if (btnId && KEY_MAP[btnId]) {
          touchMap[t.identifier] = btnId;
          pressKey(btnId, game);
        }
      }
    }

    function onTouchEnd(e) {
      e.preventDefault();
      for (const t of e.changedTouches) {
        const btnId = touchMap[t.identifier];
        if (btnId) {
          releaseKey(btnId, game);
          delete touchMap[t.identifier];
        }
      }
    }

    function onTouchMove(e) {
      e.preventDefault();
      for (const t of e.changedTouches) {
        const newBtnId = getButtonFromTouch(t);
        const oldBtnId = touchMap[t.identifier];
        if (newBtnId !== oldBtnId) {
          if (oldBtnId) releaseKey(oldBtnId, game);
          if (newBtnId && KEY_MAP[newBtnId]) {
            touchMap[t.identifier] = newBtnId;
            pressKey(newBtnId, game);
          } else {
            delete touchMap[t.identifier];
          }
        }
      }
    }

    // 绑定到整个控制区，支持滑动切换方向
    const controls = document.getElementById('controls');
    controls.addEventListener('touchstart',  onTouchStart, { passive: false });
    controls.addEventListener('touchend',    onTouchEnd,   { passive: false });
    controls.addEventListener('touchcancel', onTouchEnd,   { passive: false });
    controls.addEventListener('touchmove',   onTouchMove,  { passive: false });

    // ── 辅助按钮 ──────────────────────────────────────────────────────────────
    document.getElementById('btn-pause')?.addEventListener('touchstart', e => {
      e.preventDefault();
      game.audio.resume();
      if (game.state === 2) game.state = 3;       // S_PLAY → S_PAUSE
      else if (game.state === 3) game.state = 2;  // S_PAUSE → S_PLAY
    }, { passive: false });

    document.getElementById('btn-music')?.addEventListener('touchstart', e => {
      e.preventDefault();
      const on = game.audio.toggleMusic();
      document.getElementById('btn-music').textContent = on ? '音乐' : '静音';
      if (on && game.state === 2) game.audio.playGameMusic();
    }, { passive: false });

    // ── 菜单触控按钮 ──────────────────────────────────────────────────────────
    updateMenuOverlay(game);

    // 监听游戏状态变化，更新菜单按钮
    const origLoop = game._loop.bind(game);
    let lastState = game.state;
    setInterval(() => {
      if (game.state !== lastState) {
        lastState = game.state;
        updateMenuOverlay(game);
      }
    }, 200);
  });

  // ── 菜单覆盖层按钮 ──────────────────────────────────────────────────────────
  function updateMenuOverlay(game) {
    const overlay = document.getElementById('menu-overlay');
    if (!overlay) return;
    overlay.innerHTML = '';

    const S_MENU = 0, S_OVER = 4, S_WIN = 5;
    const cw = game.canvas.width;
    const ch = game.canvas.height;

    if (game.state === S_MENU) {
      // 关卡选择左右箭头
      const btnL = makeOverlayBtn('◀', cw * 0.28, ch * 0.62, 48, 48);
      const btnR = makeOverlayBtn('▶', cw * 0.72, ch * 0.62, 48, 48);
      const btnStart = makeOverlayBtn('开始游戏', cw * 0.5, ch * 0.73, 140, 44);

      btnL.addEventListener('touchstart', e => {
        e.preventDefault();
        game.audio.resume();
        game.selectedLevel = Math.max(0, game.selectedLevel - 1);
      }, { passive: false });
      btnR.addEventListener('touchstart', e => {
        e.preventDefault();
        game.audio.resume();
        game.selectedLevel = Math.min(2, game.selectedLevel + 1);
      }, { passive: false });
      btnStart.addEventListener('touchstart', e => {
        e.preventDefault();
        game.audio.resume();
        game._startGame();
      }, { passive: false });

      overlay.appendChild(btnL);
      overlay.appendChild(btnR);
      overlay.appendChild(btnStart);
    }

    if (game.state === S_OVER || game.state === S_WIN) {
      const btnRestart = makeOverlayBtn('再玩一次', cw * 0.5, ch * 0.65, 160, 48);
      btnRestart.addEventListener('touchstart', e => {
        e.preventDefault();
        game.audio.resume();
        game._startGame();
      }, { passive: false });
      overlay.appendChild(btnRestart);
    }
  }

  function makeOverlayBtn(text, cx, cy, w, h) {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.left   = (cx - w / 2) + 'px';
    btn.style.top    = (cy - h / 2) + 'px';
    btn.style.width  = w + 'px';
    btn.style.height = h + 'px';
    btn.style.fontSize = w > 80 ? '15px' : '20px';
    return btn;
  }
})();
