// 브랜드 플로우: 붉은 빛의 띠가 천천히 흐르며 모양이 바뀐다.
// 흐림 필터 대신 "작게 그려서 크게 늘리기"로 부드러움을 만든다. Chrome·Safari 모두 가볍게 동작.

type Layers = { haze: HTMLCanvasElement; soft: HTMLCanvasElement; edge: HTMLCanvasElement }
type Shape = { P: [number, number][]; tw: number; fold: number; a: number }

const VW = 640 // 그래픽 좌표계(화면을 덮도록 늘림)
const VH = 480
const RED = '237,32,36' // kt-red

export function startBrandFlow({ haze, soft, edge }: Layers, { still = false } = {}) {
  const ctx = edge.getContext('2d')
  const sctx = soft.getContext('2d') // 1/4 해상도: 안쪽 번짐
  const hctx = haze.getContext('2d') // 1/10 해상도: 바깥 번짐
  if (!ctx || !sctx || !hctx) return () => {}

  const bufs = [document.createElement('canvas'), document.createElement('canvas')]
  let w = 1
  let h = 1
  let dpr = 1
  let raf = 0
  const start = performance.now()

  // 반으로 줄였다가 다시 키워서 가볍게 흐리게 한다
  function smooth(c: HTMLCanvasElement, levels: number) {
    let prev: HTMLCanvasElement = c
    for (let k = 0; k < levels; k++) {
      const b = bufs[k % 2]
      const bw = Math.max(1, prev.width >> 1)
      const bh = Math.max(1, prev.height >> 1)
      if (b.width !== bw || b.height !== bh) {
        b.width = bw
        b.height = bh
      }
      const bx = b.getContext('2d')!
      bx.clearRect(0, 0, bw, bh)
      bx.drawImage(prev, 0, 0, prev.width, prev.height, 0, 0, bw, bh)
      prev = b
    }
    const cx = c.getContext('2d')!
    cx.setTransform(1, 0, 0, 1, 0, 0)
    cx.globalAlpha = 1
    cx.clearRect(0, 0, c.width, c.height)
    cx.imageSmoothingQuality = 'high'
    cx.drawImage(prev, 0, 0, prev.width, prev.height, 0, 0, c.width, c.height)
  }

  function resize() {
    const r = (edge.parentElement ?? edge).getBoundingClientRect()
    w = Math.max(1, r.width)
    h = Math.max(1, r.height)
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    edge.width = Math.round(w * dpr)
    edge.height = Math.round(h * dpr)
    soft.width = Math.max(1, Math.round(w / 4))
    soft.height = Math.max(1, Math.round(h / 4))
    haze.width = Math.max(1, Math.round(w / 10))
    haze.height = Math.max(1, Math.round(h / 10))
    if (still) draw(0)
  }

  // 화면을 덮도록 640x480 좌표계를 맞춘다(cover)
  function fit(c: CanvasRenderingContext2D, px: number) {
    const s = Math.max(w / VW, h / VH) * px
    c.setTransform(s, 0, 0, s, (w * px - VW * s) / 2, (h * px - VH * s) / 2)
  }

  function shape(time: number): Shape {
    const a = time / 1000
    return {
      P: [
        [-60, 500],
        [210 + 34 * Math.sin(a * 0.42), 470 + 24 * Math.cos(a * 0.34)],
        [260 + 40 * Math.cos(a * 0.38), 150 + 34 * Math.sin(a * 0.46)],
        [700, 40 + 26 * Math.sin(a * 0.26)],
      ],
      tw: 170 + 26 * Math.sin(a * 0.5),
      fold: 0.08 + 0.16 * Math.sin(a * 0.45), // 접히는 자리가 띠를 따라 오간다
      a,
    }
  }

  // 가운데 곡선에서 k만큼 옆으로 떨어진 선
  function points(S: Shape, k: number, steps: number) {
    const [p0, p1, p2, p3] = S.P
    const out: number[] = []
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const u = 1 - t
      const x = u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0]
      const y = u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]
      const dx = 3 * u * u * (p1[0] - p0[0]) + 6 * u * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0])
      const dy = 3 * u * u * (p1[1] - p0[1]) + 6 * u * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1])
      const l = Math.hypot(dx, dy) || 1
      const off =
        S.tw *
        Math.sin(Math.PI * Math.min(1, t * 1.05)) *
        Math.cos(Math.PI * (t - S.fold) * 1.1) *
        (1 + 0.18 * Math.sin(t * 7 - S.a * 1.1)) *
        k
      out.push(x - (dy / l) * off, y + (dx / l) * off)
    }
    return out
  }

  function stroke(c: CanvasRenderingContext2D, pts: number[]) {
    c.beginPath()
    c.moveTo(pts[0], pts[1])
    for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1])
    c.stroke()
  }

  function grad(c: CanvasRenderingContext2D, stops: [number, number][]) {
    const g = c.createLinearGradient(0, VH, VW, 0)
    for (const [at, alpha] of stops) g.addColorStop(at, `rgba(${RED},${alpha})`)
    return g
  }

  function draw(time: number) {
    const S = shape(time)
    const body: [number, number][] = [
      [0.05, 0],
      [0.35, 1],
      [0.7, 1],
      [0.98, 0],
    ]

    // 바깥 번짐
    hctx!.setTransform(1, 0, 0, 1, 0, 0)
    hctx!.clearRect(0, 0, haze.width, haze.height)
    fit(hctx!, 0.1)
    hctx!.lineCap = 'round'
    hctx!.strokeStyle = grad(hctx!, [
      [0.05, 0],
      [0.4, 1],
      [0.72, 0.8],
      [1, 0],
    ])
    const hp = points(S, 0.55, 40)
    for (let j = 0; j < 10; j++) {
      hctx!.globalAlpha = 0.022
      hctx!.lineWidth = 30 + j * 18
      stroke(hctx!, hp)
    }
    for (let m = 10; m >= 3; m--) {
      const r = m / 10
      const pr = points(S, r, 40)
      for (let n = 0; n < 3; n++) {
        hctx!.globalAlpha = (0.05 * Math.pow(1 - r, 1.2) + 0.01) / 2
        hctx!.lineWidth = 10 + 24 * r + n * 10
        stroke(hctx!, pr)
      }
    }
    smooth(haze, 2)

    // 안쪽 번짐
    sctx!.setTransform(1, 0, 0, 1, 0, 0)
    sctx!.clearRect(0, 0, soft.width, soft.height)
    fit(sctx!, 0.25)
    sctx!.lineCap = 'round'
    sctx!.strokeStyle = grad(sctx!, body)
    for (let i = 12; i >= 0; i--) {
      const q = i / 30
      sctx!.globalAlpha = 0.13 * Math.pow(1 - q / 0.42, 1.3) + 0.012
      sctx!.lineWidth = 8 + 24 * q
      stroke(sctx!, points(S, q, 60))
    }
    smooth(soft, 1)

    // 선명한 앞쪽 가장자리와 접힘선
    ctx!.setTransform(1, 0, 0, 1, 0, 0)
    ctx!.clearRect(0, 0, edge.width, edge.height)
    fit(ctx!, dpr)
    ctx!.lineCap = 'round'
    ctx!.strokeStyle = grad(ctx!, [
      [0.12, 0],
      [0.42, 1],
      [0.62, 0.9],
      [0.9, 0],
    ])
    // 화면이 커져도 선 굵기는 화면 기준으로 일정하게(가장자리 1.5px, 접힘선 0.75px)
    const unit = 1 / Math.max(w / VW, h / VH)
    ctx!.globalAlpha = 0.35
    ctx!.lineWidth = 0.75 * unit
    stroke(ctx!, points(S, 0.5, 80))
    ctx!.globalAlpha = 1
    ctx!.lineWidth = 1.5 * unit
    stroke(ctx!, points(S, 0, 80))
  }

  function loop(now: number) {
    draw(now - start)
    raf = requestAnimationFrame(loop)
  }

  resize()
  window.addEventListener('resize', resize)
  if (still) draw(0)
  else raf = requestAnimationFrame(loop)

  return () => {
    cancelAnimationFrame(raf)
    window.removeEventListener('resize', resize)
  }
}
