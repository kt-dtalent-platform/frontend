import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// 우리 글자 스타일(text-title-1 등)을 색(text-ink)과 다른 그룹으로 알려 줘야(tokens.css의 --text-* 이름을 모두 적는다)
// 둘을 같이 써도 한쪽이 지워지지 않는다.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        {
          text: [
            'display',
            'display-sm',
            'number',
            'title-1',
            'title-2',
            'body',
            'body-long',
            'input-touch',
            'body-strong',
            'label',
            'label-sm',
            'caption',
            'overline',
          ],
        },
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
