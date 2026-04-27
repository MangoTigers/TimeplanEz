import React from 'react'
import { useTranslation } from '@/lib/i18n'

interface ExpandableCardProps {
  title: string
  children: React.ReactNode
  className?: string
  contentClassName?: string
  collapsedMaxHeight?: number
  rightAction?: React.ReactNode
}

export const ExpandableCard: React.FC<ExpandableCardProps> = ({
  title,
  children,
  className = '',
  contentClassName = '',
  collapsedMaxHeight = 260,
  rightAction,
}) => {
  const { t } = useTranslation()
  const contentRef = React.useRef<HTMLDivElement | null>(null)
  const [expanded, setExpanded] = React.useState(false)
  const [canExpand, setCanExpand] = React.useState(false)

  React.useEffect(() => {
    const node = contentRef.current
    if (!node) {
      return
    }

    const updateExpandState = () => {
      setCanExpand(node.scrollHeight > collapsedMaxHeight)
    }

    updateExpandState()

    const observer = new ResizeObserver(updateExpandState)
    observer.observe(node)

    return () => observer.disconnect()
  }, [collapsedMaxHeight, children])

  return (
    <div className={`card ${className}`.trim()}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 className="text-lg font-bold">{title}</h2>
        <div className="flex items-center gap-2">
          {rightAction}
          {canExpand && (
            <button
              type="button"
              className="btn-secondary px-3 py-1 text-xs"
              onClick={() => setExpanded((prev) => !prev)}
            >
              {expanded ? t('common.showLess') : t('common.showMore')}
            </button>
          )}
        </div>
      </div>
      <div
        ref={contentRef}
        className={`${contentClassName}`.trim()}
        style={{
          maxHeight: expanded || !canExpand ? 'none' : `${collapsedMaxHeight}px`,
          overflow: expanded || !canExpand ? 'visible' : 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  )
}
