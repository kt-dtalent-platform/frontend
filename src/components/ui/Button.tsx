import type { ComponentProps } from 'react'
import { buttonClass, type ButtonSize as Size, type ButtonVariant as Variant } from './buttonClass'

type Props = ComponentProps<'button'> & { variant?: Variant; size?: Size }

export function Button({ variant = 'secondary', size = 'md', className, type = 'button', ...props }: Props) {
  return <button type={type} className={buttonClass({ variant, size, className })} {...props} />
}
