(() => {
  // 二重起動ガード
  if (window.__ballRollInited) {
    return;
  }
  window.__ballRollInited = true;

  const {
    Engine, World, Bodies, Body, Events, Runner,
  } = Matter;

  const engine = Engine.create();
  engine.gravity.y = 1.0;
  const world = engine.world;

  // 画面全体に被せるキャンバス（クリック透過）
  const canvas = document.createElement('canvas');
  canvas.id = '__ball_roll_canvas';
  Object.assign(canvas.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100vw',
    height: '100vh',
    pointerEvents: 'none',
    zIndex: '2147483646',
  });
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  // 床（画面下）
  const floor = Bodies.rectangle(
    window.innerWidth / 2,
    window.innerHeight + 25,
    window.innerWidth * 2,
    50,
    { isStatic: true, label: 'floor' },
  );
  World.add(world, floor);

  // 左右の壁
  const leftWall = Bodies.rectangle(-25, window.innerHeight / 2, 50, window.innerHeight * 2, { isStatic: true });
  const rightWall = Bodies.rectangle(window.innerWidth + 25, window.innerHeight / 2, 50, window.innerHeight * 2, { isStatic: true });
  World.add(world, [leftWall, rightWall]);

  // DOM要素を物理ボディとして登録
  const obstacles = [];
  function scanDom() {
    // 既存の障害物を一度全部削除
    obstacles.forEach(b => World.remove(world, b));
    obstacles.length = 0;

    const selector = 'button, a, input, textarea, select, [role="button"], .card, [data-ball-target]';
    const elements = document.querySelectorAll(selector);

    elements.forEach(el => {
      const rect = el.getBoundingClientRect();
      // 画面内 & ある程度の大きさがある要素のみ
      if (rect.width < 20 || rect.height < 10) return;
      if (rect.width > window.innerWidth * 0.9) return; // 画面幅いっぱいの要素は除外（謎の板対策）
      if (rect.bottom < 0 || rect.top > window.innerHeight) return;
      if (rect.right < 0 || rect.left > window.innerWidth) return;

      // 非表示要素を除外
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.opacity === '0' || style.display === 'none') return;

      const body = Bodies.rectangle(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
        rect.width,
        rect.height,
        {
          isStatic: true,
          label: 'dom',
          restitution: 0.6,
          friction: 0.2,
          render: { rect },
        },
      );
      obstacles.push(body);
      World.add(world, body);
    });
  }
  scanDom();

  // スクロール/リサイズでDOM座標が変わるのでスキャンし直す
  let scanScheduled = false;
  function scheduleScan() {
    if (scanScheduled) return;
    scanScheduled = true;
    requestAnimationFrame(() => {
      scanScheduled = false;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      // 床と壁も位置再設定
      Body.setPosition(floor, { x: window.innerWidth / 2, y: window.innerHeight + 25 });
      Body.setPosition(leftWall, { x: -25, y: window.innerHeight / 2 });
      Body.setPosition(rightWall, { x: window.innerWidth + 25, y: window.innerHeight / 2 });
      scanDom();
    });
  }
  window.addEventListener('scroll', scheduleScan, { passive: true });
  window.addEventListener('resize', scheduleScan);

  // ボール
  const balls = [];
  const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];

  function spawnBall(x, y) {
    const radius = 10 + Math.random() * 10;
    const ball = Bodies.circle(x, y, radius, {
      restitution: 0.6,
      friction: 0.1,
      density: 0.002,
      render: { color: colors[Math.floor(Math.random() * colors.length)] },
    });
    Body.setVelocity(ball, { x: (Math.random() - 0.5) * 4, y: 0 });
    balls.push(ball);
    World.add(world, ball);
  }

  // ===== プレイヤー干渉 =====
  // - ボールの上でドラッグ: 掴んで投げる
  // - 空白 + Shift+クリック: その場にボール追加
  // - スペースキー押下中: カーソル周辺のボールを吹き飛ばす（扇風機モード）

  let dragging = null; // { ball, offsetX, offsetY, lastX, lastY, lastTime }
  let lastMouse = { x: 0, y: 0 };
  let spaceHeld = false;

  function findBallAt(x, y) {
    // 手前（後から追加した方）から判定
    for (let i = balls.length - 1; i >= 0; i--) {
      const b = balls[i];
      const dx = x - b.position.x;
      const dy = y - b.position.y;
      if (dx * dx + dy * dy <= b.circleRadius * b.circleRadius) return b;
    }
    return null;
  }

  window.addEventListener('mousedown', (e) => {
    if (!window.__ballRollActive) return;
    if (e.button !== 0) return;

    const ball = findBallAt(e.clientX, e.clientY);
    if (ball) {
      // ボール掴んだ → ページのクリックを止めてドラッグ開始
      e.preventDefault();
      e.stopPropagation();
      Body.setStatic(ball, true); // ドラッグ中は重力無効
      dragging = {
        ball,
        offsetX: e.clientX - ball.position.x,
        offsetY: e.clientY - ball.position.y,
        lastX: e.clientX,
        lastY: e.clientY,
        lastTime: performance.now(),
      };
    } else if (e.shiftKey) {
      // Shift+クリックで空白にボール追加
      e.preventDefault();
      e.stopPropagation();
      spawnBall(e.clientX, e.clientY);
    }
  }, true);

  window.addEventListener('mousemove', (e) => {
    lastMouse.x = e.clientX;
    lastMouse.y = e.clientY;
    if (!dragging) return;
    e.preventDefault();
    e.stopPropagation();
    const now = performance.now();
    const dt = Math.max(1, now - dragging.lastTime);
    dragging.ball._vx = (e.clientX - dragging.lastX) / dt * 16; // 速度近似
    dragging.ball._vy = (e.clientY - dragging.lastY) / dt * 16;
    Body.setPosition(dragging.ball, {
      x: e.clientX - dragging.offsetX,
      y: e.clientY - dragging.offsetY,
    });
    dragging.lastX = e.clientX;
    dragging.lastY = e.clientY;
    dragging.lastTime = now;
  }, true);

  window.addEventListener('mouseup', (e) => {
    if (!dragging) return;
    e.preventDefault();
    e.stopPropagation();
    const ball = dragging.ball;
    Body.setStatic(ball, false);
    Body.setVelocity(ball, {
      x: Math.max(-30, Math.min(30, ball._vx || 0)),
      y: Math.max(-30, Math.min(30, ball._vy || 0)),
    });
    dragging = null;
  }, true);

  // Fキーで周辺のボールを吹き飛ばす（Fan = 扇風機）
  function isTypingTarget() {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
  }
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyF' && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey && !isTypingTarget()) {
      e.preventDefault();
      spaceHeld = true;
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'KeyF') spaceHeld = false;
  });

  // 毎フレーム：スペース中なら近くのボールを押す
  Events.on(engine, 'beforeUpdate', () => {
    if (!spaceHeld) return;
    balls.forEach(b => {
      const dx = b.position.x - lastMouse.x;
      const dy = b.position.y - lastMouse.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < 150 * 150 && distSq > 1) {
        const dist = Math.sqrt(distSq);
        const force = 0.02 * (1 - dist / 150);
        Body.applyForce(b, b.position, {
          x: (dx / dist) * force,
          y: (dy / dist) * force,
        });
      }
    });
  });

  // レンダリング
  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 障害物は物理的には存在するが描画しない（見た目はページそのまま）

    // ボール
    balls.forEach(ball => {
      ctx.beginPath();
      ctx.arc(ball.position.x, ball.position.y, ball.circleRadius, 0, Math.PI * 2);
      ctx.fillStyle = ball.render?.color ?? '#3b82f6';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 回転を示す小さな線
      ctx.save();
      ctx.translate(ball.position.x, ball.position.y);
      ctx.rotate(ball.angle);
      ctx.beginPath();
      ctx.moveTo(-ball.circleRadius * 0.7, 0);
      ctx.lineTo(ball.circleRadius * 0.7, 0);
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    });

    requestAnimationFrame(render);
  }
  render();

  // 物理エンジン駆動
  const runner = Runner.create();
  Runner.run(runner, engine);

  // 画面外に落ちたボールは削除
  setInterval(() => {
    for (let i = balls.length - 1; i >= 0; i--) {
      const b = balls[i];
      if (b.position.y > window.innerHeight + 200 || b.position.x < -200 || b.position.x > window.innerWidth + 200) {
        World.remove(world, b);
        balls.splice(i, 1);
      }
    }
  }, 1000);

  // popup からのコマンド
  window.__ballRoll = (cmd) => {
    window.__ballRollActive = true;
    if (cmd === 'drop') {
      spawnBall(window.innerWidth / 2 + (Math.random() - 0.5) * 200, 20);
    } else if (cmd === 'dropMany') {
      for (let i = 0; i < 10; i++) {
        setTimeout(() => spawnBall(Math.random() * window.innerWidth, 20), i * 80);
      }
    } else if (cmd === 'reset') {
      balls.forEach(b => World.remove(world, b));
      balls.length = 0;
      window.__ballRollActive = false;
    }
  };

  console.log('%c🎱 Ball Roll injected', 'color:#3b82f6;font-weight:bold');
})();
