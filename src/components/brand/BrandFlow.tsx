import { useEffect, useRef, useState } from 'react'
import flowRibbon from '../../assets/brand/flow-ribbon.webp'
import './brand-flow.css'
import { startBrandFlow } from './flow'

/**
 * 로그인 화면 바탕 그래픽. 붉은 빛의 띠가 천천히 흐르며 모양이 바뀐다.
 * 그리기 전·스크립트 실패 시에는 같은 모양의 정지 이미지를 보여 준다.
 */
export function BrandFlow() {
  const haze = useRef<HTMLCanvasElement>(null)
  const soft = useRef<HTMLCanvasElement>(null)
  const edge = useRef<HTMLCanvasElement>(null)
  const [live, setLive] = useState(false)

  useEffect(() => {
    if (!haze.current || !soft.current || !edge.current) return
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const stop = startBrandFlow({ haze: haze.current, soft: soft.current, edge: edge.current }, { still })
    const id = requestAnimationFrame(() => setLive(true))
    return () => {
      cancelAnimationFrame(id)
      stop()
    }
  }, [])

  return (
    <div className="brand-flow" aria-hidden>
      {!live && <img className="brand-flow__still" src={flowRibbon} alt="" />}
      <canvas ref={haze} />
      <canvas ref={soft} />
      <canvas ref={edge} />
    </div>
  )
}
