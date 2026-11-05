import flowHaze from '../../assets/brand/flow-haze.webp'
import flowRibbon from '../../assets/brand/flow-ribbon.webp'
import './brand-flow.css'

// 브랜드 플로우 띠의 앞쪽 가장자리. 흰 빛이 이 선을 따라 지나간다.
// 띠 이미지(flow-ribbon.webp)와 같은 좌표계(640x480)에서 만들었다.
const EDGE =
  'M-60.0 500.0 L-50.0 498.7 L-40.2 497.2 L-30.5 495.4 L-21.1 493.4 L-11.8 491.1 L-2.7 488.6 L6.2 485.8 L15.0 482.8 L23.6 479.6 L32.1 476.1 L40.5 472.5 L48.7 468.6 L56.8 464.5 L64.8 460.3 L72.7 455.8 L80.5 451.2 L88.2 446.4 L95.8 441.4 L103.3 436.2 L110.8 430.9 L118.2 425.5 L125.5 419.9 L132.8 414.1 L140.1 408.2 L147.3 402.2 L154.5 396.0 L161.6 389.7 L168.8 383.4 L176.0 376.9 L183.1 370.3 L190.3 363.6 L197.4 356.8 L204.6 349.9 L211.9 343.0 L219.1 336.0 L226.4 328.9 L233.8 321.7 L241.2 314.5 L248.7 307.3 L256.3 300.0 L263.9 292.7 L271.6 285.3 L279.4 277.9 L287.3 270.5 L295.4 263.1 L303.5 255.7 L311.8 248.2 L320.2 240.8 L328.7 233.4 L337.4 226.0 L346.2 218.6 L355.2 211.2 L364.3 203.9 L373.6 196.6 L383.1 189.4 L392.8 182.2 L402.7 175.1 L412.8 168.0 L423.1 161.0 L433.6 154.1 L444.3 147.2 L455.3 140.4 L466.5 133.8 L477.9 127.2 L489.6 120.7 L501.6 114.4 L513.8 108.1 L526.3 102.0 L539.0 96.0 L552.1 90.1 L565.4 84.4 L579.1 78.8 L593.0 73.4 L607.3 68.1 L621.9 63.0 L636.8 58.0 L652.1 53.2 L667.7 48.6 L683.7 44.2 L700.0 40.0'

/**
 * 로그인 화면 바탕 그래픽. 흐림이 많은 층은 미리 만든 이미지이고,
 * 이미지를 담은 층만 움직여서(transform) 끊기지 않는다.
 */
export function BrandFlow() {
  return (
    <div className="brand-flow" aria-hidden>
      <div className="brand-flow__layer brand-flow__haze">
        <img src={flowHaze} alt="" />
      </div>
      <div className="brand-flow__layer brand-flow__ribbon">
        <img src={flowRibbon} alt="" />
        <svg viewBox="0 0 640 480" preserveAspectRatio="xMidYMid slice">
          <path className="brand-flow__glint" d={EDGE} pathLength={1} />
        </svg>
      </div>
    </div>
  )
}
