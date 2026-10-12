import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const canvas = document.getElementById('gameCanvas');
const scoreEl = document.getElementById('score');
const waveEl = document.getElementById('wave');
const weaponEl = document.getElementById('weapon');
const healthFill = document.getElementById('healthFill');
const finalScoreEl = document.getElementById('finalScore');
const startOverlay = document.getElementById('startOverlay');
const gameOverOverlay = document.getElementById('gameOverOverlay');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x040b17);
scene.fog = new THREE.Fog(0x040b17, 18, 70);

const camera = new THREE.PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 0.1, 220);
camera.position.set(0, 6, 18);

const clock = new THREE.Clock();
const keys = {};
const pointer = { x: 0, y: 0, down: false };

const state = {
  started: false,
  gameOver: false,
  score: 0,
  wave: 1,
  health: 100,
  maxHealth: 100,
  fireCooldown: 0,
  spawnTimer: 0.9,
  bullets: [],
  enemyBullets: [],
  enemies: [],
  particles: [],
  stars: [],
  asteroidField: [],
  boss: null,
  weaponLevel: 1,
  comboTimer: 0,
  flash: 0,
  elapsed: 0,
};

let player;
let bossWarning = null;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getWeaponName() {
  if (state.weaponLevel <= 1) return '常规';
  if (state.weaponLevel === 2) return '散射';
  return '重炮';
}

function updateWeaponUI() {
  weaponEl.textContent = getWeaponName();
}

function createStarfield() {
  const geometry = new THREE.BufferGeometry();
  const starCount = 1400;
  const positions = new Float32Array(starCount * 3);

  for (let i = 0; i < starCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 82;
    positions[i * 3 + 1] = Math.random() * 40 + 2;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 90;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: 0xdfeeff,
    size: 0.18,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });

  const stars = new THREE.Points(geometry, material);
  scene.add(stars);
  state.stars.push(stars);
}

function createAmbientScene() {
  const hemi = new THREE.HemisphereLight(0x8cd5ff, 0x06111a, 1.15);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(0xcfe8ff, 1.8);
  dir.position.set(-8, 12, 10);
  dir.castShadow = true;
  dir.shadow.mapSize.set(1024, 1024);
  dir.shadow.camera.near = 0.5;
  dir.shadow.camera.far = 60;
  dir.shadow.camera.left = -20;
  dir.shadow.camera.right = 20;
  dir.shadow.camera.top = 20;
  dir.shadow.camera.bottom = -20;
  scene.add(dir);

  const glow = new THREE.PointLight(0x7dd7ff, 18, 100, 2.2);
  glow.position.set(0, 4, 8);
  scene.add(glow);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(26, 72),
    new THREE.MeshStandardMaterial({
      color: 0x0b1527,
      metalness: 0.3,
      roughness: 0.8,
      emissive: 0x081827,
      side: THREE.DoubleSide,
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -2.2, 0);
  floor.receiveShadow = true;
  scene.add(floor);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(14.5, 0.18, 16, 128),
    new THREE.MeshBasicMaterial({ color: 0x6cb8ff, transparent: true, opacity: 0.35 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -2.1;
  scene.add(ring);

  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(3.2, 32, 32),
    new THREE.MeshStandardMaterial({
      color: 0x17356d,
      emissive: 0x0d2958,
      roughness: 0.9,
      metalness: 0.2,
    })
  );
  planet.position.set(-12, 6, -26);
  scene.add(planet);

  for (let i = 0; i < 35; i++) {
    const size = 0.6 + Math.random() * 1.4;
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(size, 0),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(0.08 + Math.random() * 0.08, 0.3, 0.45),
        roughness: 0.9,
        metalness: 0.2,
      })
    );
    rock.position.set(
      (Math.random() - 0.5) * 30,
      -1.8 + Math.random() * 2.2,
      -18 - Math.random() * 45
    );
    rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    rock.userData.spin = (Math.random() - 0.5) * 0.8;
    scene.add(rock);
    state.asteroidField.push(rock);
  }
}

function makeParticleBurst(position, color = 0x7fe8ff, count = 16, speed = 1.2) {
  for (let i = 0; i < count; i++) {
    const particle = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 6, 6),
      new THREE.MeshBasicMaterial({ color })
    );
    particle.position.copy(position);
    const angle = Math.random() * Math.PI * 2;
    const velocity = new THREE.Vector3(
      Math.cos(angle) * (0.5 + Math.random() * 1.5) * speed,
      Math.sin(angle) * (0.5 + Math.random() * 1.5) * speed,
      (Math.random() - 0.5) * 4 * speed
    );
    particle.userData.velocity = velocity;
    particle.userData.life = 0.8 + Math.random() * 0.8;
    scene.add(particle);
    state.particles.push(particle);
  }
}

function makeBossWarning() {
  if (bossWarning) return;

  bossWarning = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 1.2),
    new THREE.MeshBasicMaterial({
      color: 0xff5d73,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    })
  );
  bossWarning.position.set(0, 6.3, 6);
  scene.add(bossWarning);
}

function removeBossWarning() {
  if (bossWarning) {
    scene.remove(bossWarning);
    bossWarning = null;
  }
}

function createPlayer() {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xcfeeff,
    metalness: 0.7,
    roughness: 0.25,
    emissive: 0x12345d,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 3.4), bodyMat);
  body.castShadow = true;
  body.position.y = 0.2;
  group.add(body);

  const cockpit = new THREE.Mesh(
    new THREE.SphereGeometry(0.7, 22, 22, 0, Math.PI * 2, 0, Math.PI * 0.95),
    new THREE.MeshPhysicalMaterial({
      color: 0x9ae7ff,
      transparent: true,
      opacity: 0.9,
      metalness: 0.35,
      roughness: 0.08,
      transmission: 0.3,
      emissive: 0x133e56,
    })
  );
  cockpit.position.set(0, 0.8, -0.2);
  cockpit.scale.set(1.2, 1, 1.2);
  group.add(cockpit);

  const wingLeft = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.16, 1.7), bodyMat);
  wingLeft.position.set(-1.5, -0.1, 0);
  group.add(wingLeft);

  const wingRight = wingLeft.clone();
  wingRight.position.x = 1.5;
  group.add(wingRight);

  const engineLeft = new THREE.Mesh(
    new THREE.ConeGeometry(0.22, 0.9, 10),
    new THREE.MeshStandardMaterial({ color: 0xffcf66, emissive: 0xffaa33, emissiveIntensity: 1.6 })
  );
  engineLeft.rotation.x = Math.PI / 2;
  engineLeft.position.set(-0.4, -0.1, 2.1);
  group.add(engineLeft);

  const engineRight = engineLeft.clone();
  engineRight.position.x = 0.4;
  group.add(engineRight);

  group.position.set(0, 1, 8);
  group.rotation.x = -0.2;
  group.castShadow = true;
  scene.add(group);
  return group;
}

function createEnemy(x = 0, z = -20) {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xff647d,
    emissive: 0x7f0d1c,
    roughness: 0.4,
    metalness: 0.55,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.6), bodyMat);
  body.castShadow = true;
  group.add(body);

  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.42, 0),
    new THREE.MeshStandardMaterial({ color: 0xffd7a1, emissive: 0xffa95d, emissiveIntensity: 0.8 })
  );
  core.position.z = 0.2;
  group.add(core);

  const wingLeft = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.15, 0.9), bodyMat);
  wingLeft.position.set(-1, 0.1, 0);
  group.add(wingLeft);

  const wingRight = wingLeft.clone();
  wingRight.position.x = 1;
  group.add(wingRight);

  group.position.set(x, 1.2, z);
  group.rotation.y = Math.PI;
  group.userData.hp = 1 + Math.floor(state.wave / 3) * 0.5;
  group.userData.speed = 5 + state.wave * 0.8 + Math.random() * 1.5;
  group.userData.fireCooldown = 1.4 + Math.random() * 1.2;
  group.userData.drift = (Math.random() - 0.5) * 3;

  scene.add(group);
  state.enemies.push(group);
}

function createBoss() {
  const group = new THREE.Group();

  const hullMat = new THREE.MeshStandardMaterial({
    color: 0x8d9bff,
    emissive: 0x1d2e78,
    metalness: 0.8,
    roughness: 0.38,
  });

  const hull = new THREE.Mesh(new THREE.CapsuleGeometry(2.6, 6, 8, 16), hullMat);
  hull.rotation.z = Math.PI / 2;
  group.add(hull);

  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.3, 0),
    new THREE.MeshStandardMaterial({
      color: 0xfff1a8,
      emissive: 0xff9e3d,
      emissiveIntensity: 1.2,
    })
  );
  core.position.set(0, 0.3, 0);
  group.add(core);

  const leftWing = new THREE.Mesh(new THREE.BoxGeometry(2, 0.3, 3), hullMat);
  leftWing.position.set(-3.2, 0, 0);
  group.add(leftWing);

  const rightWing = leftWing.clone();
  rightWing.position.x = 3.2;
  group.add(rightWing);

  group.position.set(0, 1.6, -26);
  group.userData.hp = 30 + state.wave * 10;
  group.userData.maxHp = group.userData.hp;
  group.userData.speed = 2.2 + state.wave * 0.35;
  group.userData.fireCooldown = 1.2;
  group.userData.phase = Math.random() * Math.PI * 2;
  group.userData.direction = 1;

  scene.add(group);
  state.boss = group;
  makeBossWarning();
}

function createBullet(position, direction, color = 0x7fe8ff, speed = 30, damage = 1) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.2, 0.9),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 1.2,
      metalness: 0.3,
      roughness: 0.25,
    })
  );

  mesh.position.copy(position);
  mesh.userData.velocity = direction.clone().normalize().multiplyScalar(speed);
  mesh.userData.damage = damage;
  mesh.castShadow = true;
  scene.add(mesh);
  state.bullets.push(mesh);
}

function createEnemyBullet(position, target, color = 0xff5d73, speed = 12) {
  const dir = target.clone().sub(position);
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 10, 10),
    new THREE.MeshBasicMaterial({ color })
  );
  mesh.position.copy(position);
  mesh.userData.velocity = dir.normalize().multiplyScalar(speed);
  scene.add(mesh);
  state.enemyBullets.push(mesh);
}

function resetGame() {
  state.started = true;
  state.gameOver = false;
  state.score = 0;
  state.wave = 1;
  state.health = state.maxHealth;
  state.fireCooldown = 0;
  state.spawnTimer = 0.9;
  state.weaponLevel = 1;
  state.comboTimer = 0;
  state.elapsed = 0;
  state.bullets.forEach((b) => scene.remove(b));
  state.enemyBullets.forEach((b) => scene.remove(b));
  state.enemies.forEach((e) => scene.remove(e));
  state.particles.forEach((p) => scene.remove(p));
  if (state.boss) {
    scene.remove(state.boss);
    state.boss = null;
  }
  removeBossWarning();

  state.bullets = [];
  state.enemyBullets = [];
  state.enemies = [];
  state.particles = [];

  if (player) {
    player.position.set(0, 1, 8);
    player.rotation.set(-0.2, 0, 0);
  }

  updateHud();
  updateWeaponUI();
  gameOverOverlay.classList.add('hidden');
  startOverlay.classList.add('hidden');
}

function updateHud() {
  scoreEl.textContent = String(state.score);
  waveEl.textContent = String(state.wave);
  const pct = clamp((state.health / state.maxHealth) * 100, 0, 100);
  healthFill.style.width = `${pct}%`;
  finalScoreEl.textContent = String(state.score);
}

function startGame() {
  resetGame();
}

function endGame() {
  state.started = false;
  state.gameOver = true;
  finalScoreEl.textContent = String(state.score);
  gameOverOverlay.classList.remove('hidden');
}

function firePlayerWeapons() {
  const origin = player.position.clone();
  origin.y += 0.2;
  origin.z -= 1.8;

  if (state.weaponLevel <= 1) {
    createBullet(origin, new THREE.Vector3(0, 0, -1), 0x7fe8ff, 30, 1);
  } else if (state.weaponLevel === 2) {
    const directions = [
      new THREE.Vector3(-0.18, 0.08, -1),
      new THREE.Vector3(0, 0, -1),
      new THREE.Vector3(0.18, -0.08, -1),
    ];
    directions.forEach((dir) => createBullet(origin.clone(), dir, 0x9be8ff, 30, 1));
  } else {
    const directions = [
      new THREE.Vector3(-0.24, 0.12, -1),
      new THREE.Vector3(-0.12, 0.04, -1),
      new THREE.Vector3(0, 0, -1),
      new THREE.Vector3(0.12, -0.04, -1),
      new THREE.Vector3(0.24, -0.12, -1),
    ];
    directions.forEach((dir) => createBullet(origin.clone(), dir, 0xffd166, 34, 1.5));
  }

  makeParticleBurst(origin.clone().add(new THREE.Vector3(0, 0, 0.8)), state.weaponLevel >= 3 ? 0xffd166 : 0x7fe8ff, 8, 0.9);
}

function updatePlayer(dt) {
  const moveX = (keys['a'] || keys['arrowleft'] ? -1 : 0) + (keys['d'] || keys['arrowright'] ? 1 : 0);
  const moveZ = (keys['w'] || keys['arrowup'] ? -1 : 0) + (keys['s'] || keys['arrowdown'] ? 1 : 0);

  player.position.x += moveX * 8 * dt;
  player.position.z += moveZ * 7 * dt;
  player.position.x = clamp(player.position.x, -9.5, 9.5);
  player.position.z = clamp(player.position.z, 3, 15);

  const aimTarget = pointer.x * 3.2;
  const aimPitch = pointer.y * 1.6;
  player.rotation.y = THREE.MathUtils.lerp(player.rotation.y, aimTarget, 0.08);
  player.rotation.x = THREE.MathUtils.lerp(player.rotation.x, -0.2 + aimPitch, 0.1);

  if (keys[' '] || pointer.down) {
    state.fireCooldown -= dt;
    if (state.fireCooldown <= 0) {
      firePlayerWeapons();
      state.fireCooldown = state.weaponLevel >= 3 ? 0.11 : 0.18;
    }
  } else {
    state.fireCooldown = Math.max(0, state.fireCooldown - dt);
  }
}

function updateEnemyShots(dt) {
  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const enemy = state.enemies[i];
    enemy.userData.fireCooldown -= dt;
    if (enemy.userData.fireCooldown <= 0) {
      createEnemyBullet(enemy.position.clone(), player.position.clone(), 0xff5d73, 10 + state.wave * 0.6);
      enemy.userData.fireCooldown = 1.5 + Math.random() * 1.2;
    }
  }

  if (state.boss) {
    state.boss.userData.fireCooldown -= dt;
    if (state.boss.userData.fireCooldown <= 0) {
      for (let shot = 0; shot < 5; shot++) {
        const offset = (shot - 2) * 0.32;
        const pos = state.boss.position.clone().add(new THREE.Vector3(offset, 0, 1.6));
        const aim = player.position.clone().add(new THREE.Vector3(offset * 1.2, 0.2, 0)).sub(pos);
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.24, 10, 10),
          new THREE.MeshBasicMaterial({ color: 0xff8a65 })
        );
        mesh.position.copy(pos);
        mesh.userData.velocity = aim.normalize().multiplyScalar(12 + state.wave * 0.7);
        scene.add(mesh);
        state.enemyBullets.push(mesh);
      }
      state.boss.userData.fireCooldown = 1.1 - Math.min(state.wave * 0.03, 0.5);
    }
  }
}

function updateEnemies(dt) {
  if (!state.boss && state.score >= 180 && state.wave >= 5) {
    createBoss();
    state.wave += 1;
  }

  state.spawnTimer -= dt;
  if (!state.boss && state.spawnTimer <= 0) {
    const x = (Math.random() - 0.5) * 16;
    createEnemy(x, -24);
    const minDelay = Math.max(0.36, 1.1 - state.wave * 0.08);
    state.spawnTimer = minDelay + Math.random() * 0.25;
  }

  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const enemy = state.enemies[i];
    enemy.position.z += enemy.userData.speed * dt;
    enemy.position.x += Math.sin((state.elapsed * 2.2) + i) * 0.8 * dt;
    enemy.position.y = 1.2 + Math.sin((state.elapsed * 3.5) + i) * 0.5;
    enemy.rotation.y += dt * 2.4;

    if (enemy.position.z > 12) {
      scene.remove(enemy);
      state.enemies.splice(i, 1);
      state.health -= 15;
      makeParticleBurst(enemy.position.clone(), 0xff5d73, 18, 1.2);
      if (state.health <= 0) {
        state.health = 0;
        updateHud();
        endGame();
        return;
      }
    }
  }

  if (state.boss) {
    state.boss.position.x += Math.sin(state.elapsed * 1.8) * 3.3 * dt;
    state.boss.position.y = 1.6 + Math.sin(state.elapsed * 2.1) * 0.5;
    state.boss.rotation.y += dt * 1.5;

    if (state.boss.position.x > 9.5) state.boss.userData.direction = -1;
    if (state.boss.position.x < -9.5) state.boss.userData.direction = 1;
    state.boss.position.x += state.boss.userData.direction * state.boss.userData.speed * dt;

    if (state.boss.userData.hp <= 0) {
      state.score += 250;
      makeParticleBurst(state.boss.position.clone(), 0xffd166, 40, 2.2);
      scene.remove(state.boss);
      state.boss = null;
      removeBossWarning();
      state.wave += 1;
      state.health = clamp(state.health + 18, 0, state.maxHealth);
    }
  }
}

function updatePlayerProjectiles(dt) {
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const bullet = state.bullets[i];
    bullet.position.addScaledVector(bullet.userData.velocity, dt);

    if (bullet.position.z < -35 || bullet.position.z > 25 || Math.abs(bullet.position.x) > 22 || Math.abs(bullet.position.y) > 12) {
      scene.remove(bullet);
      state.bullets.splice(i, 1);
      continue;
    }

    if (state.boss) {
      if (bullet.position.distanceTo(state.boss.position) < 3.4) {
        scene.remove(bullet);
        state.bullets.splice(i, 1);
        state.boss.userData.hp -= bullet.userData.damage;
        makeParticleBurst(bullet.position.clone(), 0xffd166, 12, 1.1);
        continue;
      }
    }

    for (let j = state.enemies.length - 1; j >= 0; j--) {
      const enemy = state.enemies[j];
      if (bullet.position.distanceTo(enemy.position) < 1.4) {
        scene.remove(bullet);
        state.bullets.splice(i, 1);
        enemy.userData.hp -= bullet.userData.damage;
        makeParticleBurst(bullet.position.clone(), 0xdff9ff, 8, 0.9);

        if (enemy.userData.hp <= 0) {
          scene.remove(enemy);
          state.enemies.splice(j, 1);
          state.score += 10;
          state.comboTimer = 1.5;
          makeParticleBurst(enemy.position.clone(), 0x7ef7a6, 18, 1.5);
        }
        break;
      }
    }
  }
}

function updateEnemyProjectiles(dt) {
  for (let i = state.enemyBullets.length - 1; i >= 0; i--) {
    const bullet = state.enemyBullets[i];
    bullet.position.addScaledVector(bullet.userData.velocity, dt);

    if (bullet.position.distanceTo(player.position) < 1.7) {
      scene.remove(bullet);
      state.enemyBullets.splice(i, 1);
      state.health -= 10;
      state.flash = 0.26;
      makeParticleBurst(bullet.position.clone(), 0xff5d73, 12, 1.3);
      if (state.health <= 0) {
        state.health = 0;
        updateHud();
        endGame();
        return;
      }
      continue;
    }

    if (bullet.position.length() > 80) {
      scene.remove(bullet);
      state.enemyBullets.splice(i, 1);
    }
  }
}

function updateParticles(dt) {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.position.addScaledVector(p.userData.velocity, dt);
    p.userData.life -= dt;
    p.scale.multiplyScalar(0.992);
    if (p.userData.life <= 0) {
      scene.remove(p);
      state.particles.splice(i, 1);
    }
  }
}

function updateAsteroids(dt) {
  for (const rock of state.asteroidField) {
    rock.rotation.x += rock.userData.spin * dt * 2;
    rock.rotation.y += rock.userData.spin * dt * 1.5;
    rock.position.z += 1.3 * dt;
    if (rock.position.z > 18) {
      rock.position.z = -45;
      rock.position.x = (Math.random() - 0.5) * 30;
    }
  }
}

function updateStars(dt) {
  for (const star of state.stars) {
    star.rotation.z += dt * 0.03;
    star.position.z += dt * 0.6;
    if (star.position.z > 15) star.position.z = -30;
  }
}

function updatePowerups() {
  if (state.score >= 80 && state.weaponLevel < 2) {
    state.weaponLevel = 2;
    updateWeaponUI();
  }
  if (state.score >= 220 && state.weaponLevel < 3) {
    state.weaponLevel = 3;
    updateWeaponUI();
  }
}

function update(dt) {
  if (!state.started || state.gameOver) {
    return;
  }

  state.elapsed += dt;
  state.flash = Math.max(0, state.flash - dt);
  state.comboTimer = Math.max(0, state.comboTimer - dt);

  updateStars(dt);
  updateTimers();
  updatePlayer(dt);
  updateEnemies(dt);
  updateEnemyShots(dt);
  updatePlayerProjectiles(dt);
  updateEnemyProjectiles(dt);
  updateParticles(dt);
  updateAsteroids(dt);
  updatePowerups();
  updateHud();

  camera.position.x = THREE.MathUtils.lerp(camera.position.x, player.position.x * 0.8, 0.08);
  camera.position.y = THREE.MathUtils.lerp(camera.position.y, 6.5 + player.position.z * 0.15, 0.08);
  camera.position.z = THREE.MathUtils.lerp(camera.position.z, 18, 0.08);
  camera.lookAt(player.position.x * 0.7, 0.4, -5);

  if (state.flash > 0) {
    renderer.setClearColor(new THREE.Color(0x2c0e1b), 0.5 + state.flash * 0.7);
  } else {
    renderer.setClearColor(new THREE.Color(0x040b17), 1);
  }
}

function updateTimers() {
  if (state.comboTimer > 0) {
    state.score += dtToScoreBoost(state.comboTimer);
  }
}

function dtToScoreBoost(t) {
  return 0.35 * t;
}

function handleResize() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function animate() {
  const dt = Math.min(clock.getDelta(), 0.033);
  update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  keys[key] = true;
  if (key === ' ') {
    event.preventDefault();
  }
});

window.addEventListener('keyup', (event) => {
  const key = event.key.toLowerCase();
  keys[key] = false;
});

window.addEventListener('pointermove', (event) => {
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width;
  const y = (event.clientY - rect.top) / rect.height;
  pointer.x = (x - 0.5) * 2;
  pointer.y = (0.5 - y) * 2;
});

canvas.addEventListener('pointerdown', () => {
  pointer.down = true;
});

window.addEventListener('pointerup', () => {
  pointer.down = false;
});

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
window.addEventListener('resize', handleResize);

createStarfield();
createAmbientScene();
player = createPlayer();
updateHud();
updateWeaponUI();
handleResize();
requestAnimationFrame(animate);
