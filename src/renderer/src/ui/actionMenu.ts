export type AppActionMenuItem = {
  label: string
  icon?: string
  color?: 'neutral' | 'error'
  onSelect: () => void
}
