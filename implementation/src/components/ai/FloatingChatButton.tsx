import React from 'react'
import { ChatBubbleOvalLeftEllipsisIcon } from '@heroicons/react/24/outline'

interface FloatingChatButtonProps {
  onClick: () => void
  unreadCount?: number
}

export const FloatingChatButton: React.FC<FloatingChatButtonProps> = ({ onClick, unreadCount }) => {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-40 flex items-center justify-center w-14 h-14 bg-sky text-white rounded-full shadow-lg hover:bg-sky-600 transition-all duration-200 hover:scale-105"
      aria-label="Open AI Assistant"
    >
      <ChatBubbleOvalLeftEllipsisIcon className="h-7 w-7" />
      {unreadCount && unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  )
}