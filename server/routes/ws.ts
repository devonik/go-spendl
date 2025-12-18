export const peers: Set<{
  // Send a message to all users
  send: (message: string) => void
}> = new Set()
export default defineWebSocketHandler({
  open(peer) {
    peers.add(peer)
    console.log('[ws] open', peer.id)
    // Subscribe the newly connected peer to a general channel
    peer.subscribe('updates')
    // Optionally, broadcast initial connection count
    peer.publish('updates', `User ${peer.id} connected. Total: ${peer.peers.size}`)
  },
  message(peer, message) {
    console.log('[ws] message', message.text())
    // Handle incoming messages
  },
  close(peer, event) {
    peers.delete(peer)
    console.log('[ws] close', peer.id, event.code)
    peer.unsubscribe('updates')
    // Notify others on close
    peer.publish('updates', `User ${peer.id} disconnected. Total: ${peer.peers.size}`)
  },
  error(peer, error) {
    console.error('[ws] error', peer.id, error)
  },
})
