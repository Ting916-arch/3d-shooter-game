import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const canvas = document.getElementById('gameCanvas');
const scoreEl = document.getElementById('score');
const waveEl = document.getElementById('wave');
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
scene.fog = new THREE.Fog(0x040b17, 18, 60);

const camera = new THREE.PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 0.1, 200);
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
  enemyBurst: 0,
  bullets: [],
  enemies: [],
  particles: [],
  stars: [],
  asteroidField: [],
};

let player;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function createStarfield() {
  const geometry = new THREE.BufferGeometry();
  const starCount = 1200;
  const positions = new Float32Array(starCount * 3);

  for (let i = 0; i < starCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 80;
    positions[i * 3 + 1] = Math.random() * 35 + 3;
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
  const hemi = new THREE.HemisphereLight(0x8cd5ff, 0x06111a, 1.1);
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
    new THREE.CircleGeometry(24, 72),
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
    new THREE.TorusGeometry(14, 0.18, 16, 128),
    new THREE.MeshBasicMaterial({ color: 0x6cb8ff, transparent: true, opacity: 0.35 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -2.1;
  scene.add(ring);

  for (let i = 0; i < 30; i++) {
    const size = 0.6 + Math.random() * 1.2;
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
  group.userData.drift = (Math.random() - 0.5) * 3;

  scene.add(group);
  state.enemies.push(group);
}

function createBullet(position, direction) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.2, 0.9),
    new THREE.MeshStandardMaterial({
      color: 0x7fe8ff,
      emissive: 0x4bd9ff,
      emissiveIntensity: 1.2,
      metalness: 0.3,
      roughness: 0.25,
    })
  );

  mesh.position.copy(position);
  mesh.userData.velocity = direction.clone().multiplyScalar(30);
  mesh.castShadow = true;
  scene.add(mesh);
  state.bullets.push(mesh);
}

function resetGame() {
  state.started = true;
  state.gameOver = false;
  state.score = 0;
  state.wave = 1;
  state.health = state.maxHealth;
  state.fireCooldown = 0;
  state.spawnTimer = 0.9;
  state.enemyBurst = 0;
  state.bullets.forEach((b) => scene.remove(b));
  state.enemies.forEach((e) => scene.remove(e));
  state.particles.forEach((p) => scene.remove(p));
  state.bullets = [];
  state.enemies = [];
  state.particles = [];

  if (player) {
    player.position.set(0, 1, 8);
    player.rotation.set(-0.2, 0, 0);
  }

  updateHud();
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
      const bulletOrigin = player.position.clone();
      bulletOrigin.y += 0.2;
      bulletOrigin.z -= 1.8;
      createBullet(bulletOrigin, new THREE.Vector3(0, 0, -1));
      state.fireCooldown = 0.18;
      makeParticleBurst(bulletOrigin.clone().add(new THREE.Vector3(0, 0, 0.8)), 0x7fe8ff, 8, 0.8);
    }
  } else {
    state.fireCooldown = Math.max(0, state.fireCooldown - dt);
  }
}

function updateEnemies(dt) {
  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    const x = (Math.random() - 0.5) * 16;
    createEnemy(x, -24);
    state.spawnTimer = clamp(1.1 - state.wave * 0.08, 0.38, 1.1) + Math.random() * 0.25;
  }

  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const enemy = state.enemies[i];
    enemy.position.z += enemy.userData.speed * dt;
    enemy.position.x += Math.sin((performance.now() * 0.001) + i) * 0.8 * dt;
    enemy.position.y = 1.2 + Math.sin((performance.now() * 0.0015) + i) * 0.5;
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
}

function updateBullets(dt) {
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const bullet = state.bullets[i];
    bullet.position.addScaledVector(bullet.userData.velocity, dt);

    if (bullet.position.z < -30 || bullet.position.z > 25 || Math.abs(bullet.position.x) > 20 || Math.abs(bullet.position.y) > 10) {
      scene.remove(bullet);
      state.bullets.splice(i, 1);
      continue;
    }

    for (let j = state.enemies.length - 1; j >= 0; j--) {
      const enemy = state.enemies[j];
      if (bullet.position.distanceTo(enemy.position) < 1.3) {
        scene.remove(bullet);
        state.bullets.splice(i, 1);

        enemy.userData.hp -= 1;
        makeParticleBurst(bullet.position.clone(), 0xdff9ff, 8, 0.9);

        if (enemy.userData.hp <= 0) {
          scene.remove(enemy);
          state.enemies.splice(j, 1);
          state.score += 10;
          makeParticleBurst(enemy.position.clone(), 0x7ef7a6, 16, 1.5);
          if (state.score > 0 && state.score % 100 === 0) {
            state.wave += 1;
            state.health = clamp(state.health + 10, 0, state.maxHealth);
          }
        }
        break;
      }
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

function update(dt) {
  if (!state.started || state.gameOver) {
    return;
  }

  updateStars(dt);
  updatePlayer(dt);
  updateEnemies(dt);
  updateBullets(dt);
  updateParticles(dt);
  updateAsteroids(dt);
  updateHud();

  camera.position.x = THREE.MathUtils.lerp(camera.position.x, player.position.x * 0.8, 0.08);
  camera.position.y = THREE.MathUtils.lerp(camera.position.y, 6.5 + player.position.z * 0.15, 0.08);
  camera.position.z = THREE.MathUtils.lerp(camera.position.z, 18, 0.08);
  camera.lookAt(player.position.x * 0.7, 0.4, -5);
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
handleResize();
requestAnimationFrame(animate);
