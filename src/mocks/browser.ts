import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'
import { liveHandler } from './live'

export const worker = setupWorker(liveHandler, ...handlers)
