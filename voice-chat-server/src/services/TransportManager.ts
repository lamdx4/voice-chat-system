import { types } from 'mediasoup';

class TransportManager {
  private transports: Map<string, types.WebRtcTransport> = new Map();

  addTransport(transportId: string, transport: types.WebRtcTransport): void {
    this.transports.set(transportId, transport);
  }

  getTransport(transportId: string): types.WebRtcTransport | undefined {
    return this.transports.get(transportId);
  }

  removeTransport(transportId: string): void {
    const transport = this.transports.get(transportId);
    if (transport) {
      transport.close();
      this.transports.delete(transportId);
    }
  }

  removeAllTransportsForRoom(_roomId: string): void {
    // In a more complex implementation, you'd track which transports belong to which room
    // For now, this is a placeholder
  }

  closeAll(): void {
    for (const transport of this.transports.values()) {
      transport.close();
    }
    this.transports.clear();
  }
}

export default new TransportManager();

