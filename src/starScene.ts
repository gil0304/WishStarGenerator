import * as THREE from 'three';
import type { StarParams } from './starParams';
import { mulberry32 } from './rng';

const FOV = 45;
/** 星全体（外側の輪＋粒子）が収まるのに必要な画面半幅（ワールド単位） */
const HALF_WIDTH_NEEDED = 12.5;
/** 星の中心位置（画面中央より少し上に置く） */
const STAR_Y = 2;

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInCubic = (t: number) => t * t * t;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

// ---------- テクスチャ生成（すべてCanvasで手描き） ----------

function makeCanvas(w: number, h = w): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

/** やわらかい円形グロー */
function glowTexture(size = 128): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

/** 十字の光条つきの星本体 */
function flareTexture(size = 256): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(size);
  const cx = size / 2;
  const core = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx * 0.5);
  core.addColorStop(0, 'rgba(255,255,255,1)');
  core.addColorStop(0.3, 'rgba(255,255,255,0.7)');
  core.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, size, size);

  ctx.globalCompositeOperation = 'lighter';
  const spike = (rot: number, len: number, thick: number) => {
    ctx.save();
    ctx.translate(cx, cx);
    ctx.rotate(rot);
    ctx.scale(1, thick);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, len);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, len, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  spike(0, cx * 0.98, 0.05);
  spike(Math.PI / 2, cx * 0.98, 0.05);
  spike(Math.PI / 4, cx * 0.55, 0.035);
  spike(-Math.PI / 4, cx * 0.55, 0.035);
  return new THREE.CanvasTexture(c);
}

/** 薄い光の輪（半径0.78の位置に光の帯） */
function ringTexture(size = 256): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0.68, 'rgba(255,255,255,0)');
  g.addColorStop(0.78, 'rgba(255,255,255,0.7)');
  g.addColorStop(0.88, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

/** 天の川のぼんやりした帯 */
function bandTexture(w = 512, h = 128): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(w, h);
  const v = ctx.createLinearGradient(0, 0, 0, h);
  v.addColorStop(0, 'rgba(170,190,255,0)');
  v.addColorStop(0.5, 'rgba(190,205,255,0.55)');
  v.addColorStop(1, 'rgba(170,190,255,0)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
  // 横方向の端をフェード
  ctx.globalCompositeOperation = 'destination-in';
  const hGrad = ctx.createLinearGradient(0, 0, w, 0);
  hGrad.addColorStop(0, 'rgba(0,0,0,0)');
  hGrad.addColorStop(0.25, 'rgba(0,0,0,1)');
  hGrad.addColorStop(0.75, 'rgba(0,0,0,1)');
  hGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = hGrad;
  ctx.fillRect(0, 0, w, h);
  return new THREE.CanvasTexture(c);
}

/** 夜空の縦グラデーション背景 */
function skyTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(2, 512);
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#040512');
  g.addColorStop(0.55, '#0a102c');
  g.addColorStop(1, '#131b40');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 2, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeSprite(
  tex: THREE.Texture,
  color: THREE.ColorRepresentation,
  scale: number,
  opacity: number,
): THREE.Sprite {
  const mat = new THREE.SpriteMaterial({
    map: tex,
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const s = new THREE.Sprite(mat);
  s.scale.set(scale, scale, 1);
  return s;
}

function disposeObject(root: THREE.Object3D): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const m = (o as unknown as { material?: THREE.Material | THREE.Material[] }).material;
    if (m) (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose());
  });
}

// ---------- 型 ----------

interface OrbitParticle {
  radius: number;
  angle: number;
  speed: number;
  bobAmp: number;
  bobPhase: number;
  bobSpeed: number;
}

interface ParticleRing {
  points: THREE.Points;
  positions: Float32Array;
  data: OrbitParticle[];
}

interface TwinkleLayer {
  material: THREE.PointsMaterial;
  base: number;
  speed: number;
  phase: number;
}

interface BirthState {
  t: number;
  resolve: () => void;
  converge: THREE.Points;
  convergeMat: THREE.PointsMaterial;
  positions: Float32Array;
  starts: Float32Array;
  delays: Float32Array;
  flash: THREE.Sprite;
  starSize: number;
}

// ---------- 本体 ----------

export class StarScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private container: HTMLElement;
  private clock = new THREE.Clock();
  private elapsed = 0;

  private texGlow = glowTexture();
  private texFlare = flareTexture();
  private texRing = ringTexture();
  private texBand = bandTexture();

  private params: StarParams | null = null;
  private starGroup: THREE.Group | null = null;
  private spin: THREE.Group | null = null;
  private coreSprites: { glow: THREE.Sprite; core: THREE.Sprite; inner: THREE.Sprite } | null = null;
  private rings: ParticleRing[] = [];
  private tail: { sprite: THREE.Sprite; baseOpacity: number }[] = [];
  private flickerVal = 0;

  private bgGroup: THREE.Group | null = null;
  private twinkleLayers: TwinkleLayer[] = [];

  private birth: BirthState | null = null;

  constructor(container: HTMLElement, initialBackgroundSeed: number) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 300);
    this.scene.background = skyTexture();
    this.buildBackground(initialBackgroundSeed);

    this.onResize();
    window.addEventListener('resize', () => this.onResize());
    this.renderer.setAnimationLoop(() => this.tick());
  }

  /** アスペクト比から、星全体が横に収まるカメラ距離を求める */
  private cameraZ(aspect: number): number {
    const halfFov = (FOV / 2) * (Math.PI / 180);
    return Math.max(26, HALF_WIDTH_NEEDED / (Math.tan(halfFov) * aspect));
  }

  private onResize(): void {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.position.z = this.cameraZ(this.camera.aspect);
    this.camera.updateProjectionMatrix();
  }

  private tick(): void {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.elapsed += dt;
    this.update(dt);

    // カメラをわずかに揺らして夜空に浮遊感を出す
    this.camera.position.x = Math.sin(this.elapsed * 0.06) * 0.8;
    this.camera.position.y = Math.cos(this.elapsed * 0.05) * 0.5;
    this.camera.lookAt(0, 0.5, 0);

    this.renderer.render(this.scene, this.camera);
  }

  // ---------- 背景 ----------

  private buildBackground(seed: number): void {
    if (this.bgGroup) {
      this.scene.remove(this.bgGroup);
      disposeObject(this.bgGroup);
    }
    this.twinkleLayers = [];
    const rng = mulberry32(seed);
    const g = new THREE.Group();
    const palette = ['#ffffff', '#dfe8ff', '#fff3d6', '#cfd8ff'];

    // 瞬く星のレイヤー ×3
    for (let layer = 0; layer < 3; layer++) {
      const count = 130;
      const positions = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);
      const color = new THREE.Color();
      for (let i = 0; i < count; i++) {
        positions[i * 3] = (rng() * 2 - 1) * 95;
        positions[i * 3 + 1] = (rng() * 2 - 1) * 65;
        positions[i * 3 + 2] = -30 - rng() * 45;
        color.set(palette[Math.floor(rng() * palette.length)]);
        colors.set([color.r, color.g, color.b], i * 3);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const mat = new THREE.PointsMaterial({
        size: 0.35 + layer * 0.18,
        map: this.texGlow,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true,
        opacity: 0.55,
      });
      const points = new THREE.Points(geo, mat);
      points.frustumCulled = false;
      g.add(points);
      this.twinkleLayers.push({
        material: mat,
        base: 0.45 + layer * 0.12,
        speed: 0.6 + layer * 0.5 + rng() * 0.4,
        phase: rng() * Math.PI * 2,
      });
    }

    // 天の川：帯に沿って星をガウス分布で散らす
    const bandAngle = -0.5 - rng() * 0.4;
    const dirX = Math.cos(bandAngle);
    const dirY = Math.sin(bandAngle);
    {
      const count = 260;
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const along = (rng() * 2 - 1) * 110;
        const perp = (rng() + rng() + rng() - 1.5) * 9;
        positions[i * 3] = dirX * along - dirY * perp;
        positions[i * 3 + 1] = dirY * along + dirX * perp;
        positions[i * 3 + 2] = -40 - rng() * 25;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const mat = new THREE.PointsMaterial({
        size: 0.28,
        map: this.texGlow,
        color: '#dfe6ff',
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0.35,
      });
      const points = new THREE.Points(geo, mat);
      points.frustumCulled = false;
      g.add(points);
      this.twinkleLayers.push({
        material: mat,
        base: 0.32,
        speed: 0.4,
        phase: rng() * Math.PI * 2,
      });
    }
    // 帯そのもののぼんやりした光
    {
      const mat = new THREE.MeshBasicMaterial({
        map: this.texBand,
        transparent: true,
        opacity: 0.07,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const band = new THREE.Mesh(new THREE.PlaneGeometry(240, 55), mat);
      band.rotation.z = bandAngle;
      band.position.z = -60;
      g.add(band);
    }

    this.scene.add(g);
    this.bgGroup = g;
  }

  // ---------- 星の生成 ----------

  setStar(params: StarParams): void {
    this.clearStar();
    this.params = params;
    this.buildBackground(params.backgroundSeed);

    const rng = mulberry32(params.seed ^ 0x5f3a9e1);
    const glowColor = new THREE.Color(params.glowColor);
    const coreColor = new THREE.Color(params.coreColor);
    const I = params.intensity;

    const group = new THREE.Group();
    group.position.y = STAR_Y;

    // 中心の星（グロー＋光条＋白いコア）
    const glow = makeSprite(this.texGlow, glowColor, params.starSize * 7.5, 0.5 * I);
    const core = makeSprite(this.texFlare, coreColor, params.starSize * 3.2, 0.95 * I);
    const inner = makeSprite(this.texGlow, '#ffffff', params.starSize * 1.4, 0.85 * I);
    group.add(glow, core, inner);
    this.coreSprites = { glow, core, inner };

    // 光の輪と周回粒子
    const spin = new THREE.Group();
    this.rings = [];
    for (let r = 0; r < params.ringCount; r++) {
      const radius = params.orbitRadius * (1 + r * 0.45) * (0.95 + rng() * 0.1);
      const wrap = new THREE.Group();
      wrap.rotation.x = 1.05 + rng() * 0.5;
      wrap.rotation.z = params.ringTilt + r * (0.6 + rng() * 0.8);

      // 薄い光の輪
      const ringSize = (radius / 0.78) * 2;
      const ringMat = new THREE.MeshBasicMaterial({
        map: this.texRing,
        color: glowColor,
        transparent: true,
        opacity: 0.28 * I,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      wrap.add(new THREE.Mesh(new THREE.PlaneGeometry(ringSize, ringSize), ringMat));

      // 周回粒子
      const count = Math.max(12, Math.round(params.particleCount / params.ringCount));
      const positions = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);
      const data: OrbitParticle[] = [];
      const color = new THREE.Color();
      const dir = r % 2 === 0 ? 1 : -1;
      for (let i = 0; i < count; i++) {
        const p: OrbitParticle = {
          radius: radius * (0.88 + rng() * 0.24),
          angle: rng() * Math.PI * 2,
          speed: params.orbitSpeed * (0.6 + rng() * 0.8) * dir,
          bobAmp: 0.2 + rng() * 0.5,
          bobPhase: rng() * Math.PI * 2,
          bobSpeed: 0.5 + rng(),
        };
        data.push(p);
        positions[i * 3] = Math.cos(p.angle) * p.radius;
        positions[i * 3 + 1] = Math.sin(p.angle) * p.radius;
        positions[i * 3 + 2] = 0;
        color.set(params.particleColors[Math.floor(rng() * params.particleColors.length)]);
        color.offsetHSL(0, 0, (rng() - 0.5) * 0.15);
        colors.set([color.r, color.g, color.b], i * 3);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const mat = new THREE.PointsMaterial({
        size: params.particleSize,
        map: this.texGlow,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true,
        opacity: 0.9 * I,
      });
      const points = new THREE.Points(geo, mat);
      points.frustumCulled = false;
      wrap.add(points);
      this.rings.push({ points, positions, data });

      spin.add(wrap);
    }
    group.add(spin);
    this.spin = spin;

    // 流れ星のような尾
    this.tail = [];
    const tailGroup = new THREE.Group();
    const tailDir = new THREE.Vector3(rng() < 0.5 ? -1 : 1, 0.45, 0).normalize();
    const tailCount = 14;
    for (let i = 0; i < tailCount; i++) {
      const f = (i + 1) / tailCount;
      const baseOpacity = 0.35 * Math.pow(1 - f, 1.5) * I;
      const sprite = makeSprite(
        this.texGlow,
        glowColor,
        params.starSize * (1.6 * (1 - f) + 0.25),
        baseOpacity,
      );
      sprite.position.copy(tailDir).multiplyScalar(f * params.tailLength);
      sprite.position.y += Math.sin(f * 5) * 0.25;
      tailGroup.add(sprite);
      this.tail.push({ sprite, baseOpacity });
    }
    group.add(tailGroup);

    this.scene.add(group);
    this.starGroup = group;
  }

  clearStar(): void {
    if (this.birth) this.finishBirth();
    if (this.starGroup) {
      this.scene.remove(this.starGroup);
      disposeObject(this.starGroup);
    }
    this.starGroup = null;
    this.spin = null;
    this.coreSprites = null;
    this.rings = [];
    this.tail = [];
    this.params = null;
  }

  // ---------- 生成演出（§8.2：光が集まり、星が生まれる） ----------

  playBirth(params: StarParams): Promise<void> {
    this.setStar(params);
    this.starGroup!.visible = false;
    this.starGroup!.scale.setScalar(0.001);

    const count = 90;
    const rng = mulberry32(params.seed ^ 0x51f3a9);
    const starts = new Float32Array(count * 3);
    const delays = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // 球殻上のランダム点から中心へ集まる
      const theta = rng() * Math.PI * 2;
      const z = rng() * 2 - 1;
      const s = Math.sqrt(1 - z * z);
      const r = 8 + rng() * 10;
      starts[i * 3] = s * Math.cos(theta) * r;
      starts[i * 3 + 1] = s * Math.sin(theta) * r + STAR_Y;
      starts[i * 3 + 2] = z * r * 0.4;
      delays[i] = rng() * 0.35;
    }
    const positions = starts.slice();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.32,
      map: this.texGlow,
      color: '#ffe9c4',
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0,
    });
    const converge = new THREE.Points(geo, mat);
    converge.frustumCulled = false;
    this.scene.add(converge);

    const flash = makeSprite(this.texGlow, '#ffffff', 0.01, 0);
    flash.position.set(0, STAR_Y, 0);
    this.scene.add(flash);

    return new Promise<void>((resolve) => {
      this.birth = {
        t: 0,
        resolve,
        converge,
        convergeMat: mat,
        positions,
        starts,
        delays,
        flash,
        starSize: params.starSize,
      };
      // タブが非表示になるとrequestAnimationFrameが止まるため、
      // 演出が終わらなくても一定時間で必ず完了させる
      window.setTimeout(() => this.finishBirth(), 4000);
    });
  }

  private finishBirth(): void {
    const b = this.birth;
    if (!b) return;
    this.scene.remove(b.converge, b.flash);
    b.converge.geometry.dispose();
    b.convergeMat.dispose();
    b.flash.material.dispose();
    if (this.starGroup) {
      this.starGroup.visible = true;
      this.starGroup.scale.setScalar(1);
    }
    this.birth = null;
    b.resolve();
  }

  private updateBirth(dt: number): void {
    const b = this.birth!;
    b.t += dt;
    const T = b.t;
    const CONVERGE_END = 1.05;
    const FLASH_AT = 1.0;
    const REVEAL_AT = 1.15;
    const END = 2.35;

    // 光の粒が中心へ集まる
    b.convergeMat.opacity =
      Math.min(1, T / 0.25) *
      (T > CONVERGE_END ? Math.max(0, 1 - (T - CONVERGE_END) / 0.25) : 1);
    const n = b.delays.length;
    for (let i = 0; i < n; i++) {
      const lt = clamp01((T - b.delays[i]) / 0.9);
      const e = easeInCubic(lt);
      b.positions[i * 3] = b.starts[i * 3] * (1 - e);
      b.positions[i * 3 + 1] = b.starts[i * 3 + 1] * (1 - e) + STAR_Y * e;
      b.positions[i * 3 + 2] = b.starts[i * 3 + 2] * (1 - e);
    }
    b.converge.geometry.attributes.position.needsUpdate = true;

    // 閃光
    if (T >= FLASH_AT) {
      const ft = clamp01((T - FLASH_AT) / 0.45);
      (b.flash.material as THREE.SpriteMaterial).opacity = (1 - ft) * 0.95;
      const s = b.starSize * (2 + easeOutCubic(ft) * 12);
      b.flash.scale.set(s, s, 1);
    }

    // 星が現れる
    if (T >= REVEAL_AT && this.starGroup) {
      const rt = clamp01((T - REVEAL_AT) / 0.95);
      this.starGroup.visible = true;
      this.starGroup.scale.setScalar(Math.max(0.001, easeOutCubic(rt)));
    }

    if (T >= END) this.finishBirth();
  }

  // ---------- 毎フレーム更新 ----------

  private update(dt: number): void {
    if (this.params && this.starGroup && this.coreSprites && this.spin) {
      const p = this.params;

      // 脈動＋不規則な点滅
      let pulse = 1 + p.pulseDepth * Math.sin(this.elapsed * p.pulseSpeed * Math.PI * 2);
      if (p.flicker > 0) {
        this.flickerVal = this.flickerVal * 0.86 + (Math.random() - 0.5) * p.flicker * 0.5;
        pulse += this.flickerVal;
      }
      pulse = Math.max(0.5, pulse);

      const { glow, core, inner } = this.coreSprites;
      const cs = p.starSize * 3.2 * pulse;
      core.scale.set(cs, cs, 1);
      const gs = p.starSize * 7.5 * (1 + (pulse - 1) * 0.6);
      glow.scale.set(gs, gs, 1);
      const is = p.starSize * 1.4 * pulse;
      inner.scale.set(is, is, 1);
      (glow.material as THREE.SpriteMaterial).opacity =
        0.5 * p.intensity * clamp01(0.7 + 0.3 * pulse);

      // ゆっくり回転
      this.spin.rotation.y = this.elapsed * p.rotationSpeed;

      // 粒子の周回
      for (const ring of this.rings) {
        const data = ring.data;
        for (let i = 0; i < data.length; i++) {
          const d = data[i];
          d.angle += d.speed * dt;
          ring.positions[i * 3] = Math.cos(d.angle) * d.radius;
          ring.positions[i * 3 + 1] = Math.sin(d.angle) * d.radius;
          ring.positions[i * 3 + 2] =
            Math.sin(this.elapsed * d.bobSpeed + d.bobPhase) * d.bobAmp;
        }
        ring.points.geometry.attributes.position.needsUpdate = true;
      }

      // 尾のゆらめき
      for (let i = 0; i < this.tail.length; i++) {
        const t = this.tail[i];
        (t.sprite.material as THREE.SpriteMaterial).opacity =
          t.baseOpacity * (0.8 + 0.2 * Math.sin(this.elapsed * 2 + i * 0.7));
      }
    }

    // 背景の星の瞬き
    for (const layer of this.twinkleLayers) {
      layer.material.opacity =
        layer.base * (0.7 + 0.3 * Math.sin(this.elapsed * layer.speed + layer.phase));
    }

    if (this.birth) this.updateBirth(dt);
  }

  // ---------- 画像書き出し ----------

  /** 指定サイズで1フレーム描画してPNGのdataURLを返す（画面表示は次フレームで復元） */
  renderToDataURL(width: number, height: number): string {
    const prevPixelRatio = this.renderer.getPixelRatio();
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(width, height, false);

    const aspect = width / height;
    this.camera.aspect = aspect;
    this.camera.position.set(0, 0, this.cameraZ(aspect));
    // 縦長のときは星を少し上に配置する
    this.camera.lookAt(0, aspect < 1 ? -1.2 : 0.5, 0);
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
    const url = this.renderer.domElement.toDataURL('image/png');

    this.renderer.setPixelRatio(prevPixelRatio);
    this.onResize();
    return url;
  }
}
