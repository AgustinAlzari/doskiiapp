import useChatStore from '../../store/chatStore'

export default function ChatLayout({ children }) {
  const chatOpen = useChatStore(s => s.open)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginRight: chatOpen ? 520 : 0 }}>
      {children}
    </div>
  )
}
