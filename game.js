* {
  box-sizing: border-box;
}

html, body {
  margin: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #050b18;
  color: #edf6ff;
  font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
}

body {
  display: grid;
  place-items: center;
  background:
    radial-gradient(circle at top, rgba(87, 126, 255, 0.22), transparent 30%),
    linear-gradient(180deg, #060d1a 0%, #030812 100%);
}

#gameWrapper {
  position: relative;
  width: min(94vw, 1200px);
  height: min(88vh, 760px);
  border: 1px solid rgba(130, 181, 255, 0.3);
  border-radius: 18px;
  overflow: hidden;
  box-shadow:
    0 25px 60px rgba(0, 0, 0, 0.5),
    inset 0 0 30px rgba(116, 172, 255, 0.08),
    0 0 0 1px rgba(255, 255, 255, 0.02);
  background: #020813;
}

#gameCanvas {
  display: block;
  width: 100%;
  height: 100%;
  cursor: crosshair;
}

#hud {
  position: absolute;
  inset: 0;
  pointer-events: none;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 18px 20px;
}

.panel {
  background: rgba(9, 17, 27, 0.56);
  border: 1px solid rgba(150, 180, 255, 0.18);
  border-radius: 12px;
  backdrop-filter: blur(6px);
  padding: 10px 14px;
  box-shadow: inset 0 0 18px rgba(110, 171, 255, 0.04);
}

.left {
  display: flex;
  gap: 18px;
  flex-wrap: wrap;
  align-items: center;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-size: 12px;
}

.right {
  min-width: 180px;
}

.hp-label {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 11px;
  color: rgba(223, 236, 255, 0.82);
  margin-bottom: 8px;
}

.hp-bar {
  position: relative;
  height: 12px;
  width: 100%;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
}

#healthFill {
  position: absolute;
  inset: 0 auto 0 0;
  width: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #79f7b2 0%, #69d8ff 55%, #ffcf5a 80%, #ff6680 100%);
  transition: width 0.12s ease-out;
}

.overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(1, 5, 12, 0.45);
  backdrop-filter: blur(4px);
  z-index: 20;
}

.overlay.hidden {
  display: none;
}

.card {
  width: min(86%, 420px);
  padding: 28px 24px 22px;
  border-radius: 22px;
  background: rgba(6, 12, 20, 0.82);
  border: 1px solid rgba(111, 188, 255, 0.28);
  box-shadow: 0 22px 52px rgba(0, 0, 0, 0.46);
  text-align: center;
}

.card h1, .card h2 {
  margin: 0 0 14px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-size: clamp(1.8rem, 4vw, 2.8rem);
}

.card p {
  margin: 10px 0;
  color: rgba(227, 239, 255, 0.8);
  line-height: 1.7;
}

button {
  margin-top: 18px;
  border: none;
  border-radius: 12px;
  padding: 12px 22px;
  font-weight: 800;
  font-size: 1rem;
  letter-spacing: 0.08em;
  background: linear-gradient(135deg, #7fe8ff 0%, #6c9cff 100%);
  color: #03131d;
  cursor: pointer;
  box-shadow: 0 16px 26px rgba(98, 157, 255, 0.35);
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}

button:hover {
  transform: translateY(-1px);
  box-shadow: 0 18px 30px rgba(98, 157, 255, 0.42);
}

.game-over h2 {
  font-size: clamp(1.8rem, 4vw, 2.5rem);
}

@media (max-width: 680px) {
  #hud {
    padding: 12px 12px;
  }

  .panel {
    padding: 8px 10px;
  }

  .left {
    gap: 10px;
    font-size: 10px;
    letter-spacing: 0.04em;
  }

  .right {
    min-width: 120px;
  }
}
