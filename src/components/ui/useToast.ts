import { createContext, useContext } from 'react'

// 완료 알림 띄우기. 화면에서 const toast = useToast(); toast('정보를 고쳤어요')
export type Show = (message: string) => void
export const ToastContext = createContext<Show>(() => {})
export const useToast = () => useContext(ToastContext)
