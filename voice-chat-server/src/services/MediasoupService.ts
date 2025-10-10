import * as mediasoup from 'mediasoup';
import { types } from 'mediasoup';
import { config } from '../config/config';

class MediasoupService {
  private workers: types.Worker[] = [];
  private routers: Map<string, types.Router> = new Map();
  private nextWorkerIndex: number = 0;

  async initialize(): Promise<void> {
    console.log('🚀 Initializing Mediasoup workers...');

    for (let i = 0; i < config.mediasoup.numWorkers; i++) {
      const worker = await mediasoup.createWorker({
        logLevel: config.mediasoup.worker.logLevel,
        logTags: config.mediasoup.worker.logTags as any,
        rtcMinPort: config.mediasoup.worker.rtcMinPort,
        rtcMaxPort: config.mediasoup.worker.rtcMaxPort,
      });

      worker.on('died', () => {
        console.error(`❌ Mediasoup worker ${i} died, exiting in 2 seconds...`);
        setTimeout(() => process.exit(1), 2000);
      });

      this.workers.push(worker);
      console.log(`✅ Mediasoup worker ${i} created [pid:${worker.pid}]`);
    }

    console.log(`✅ ${this.workers.length} Mediasoup workers initialized`);
  }

  getNextWorker(): types.Worker {
    const worker = this.workers[this.nextWorkerIndex];
    this.nextWorkerIndex = (this.nextWorkerIndex + 1) % this.workers.length;
    return worker;
  }

  async createRouter(roomId: string): Promise<types.Router> {
    const worker = this.getNextWorker();
    const router = await worker.createRouter({
      mediaCodecs: config.mediasoup.router.mediaCodecs as any,
    });

    this.routers.set(roomId, router);
    console.log(`✅ Router created for room: ${roomId}`);

    return router;
  }

  getRouter(roomId: string): types.Router | undefined {
    return this.routers.get(roomId);
  }

  deleteRouter(roomId: string): void {
    const router = this.routers.get(roomId);
    if (router) {
      router.close();
      this.routers.delete(roomId);
      console.log(`✅ Router deleted for room: ${roomId}`);
    }
  }

  async createWebRtcTransport(
    router: types.Router
  ): Promise<types.WebRtcTransport> {
    const transport = await router.createWebRtcTransport({
      listenIps: config.mediasoup.webRtcTransport.listenIps,
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      initialAvailableOutgoingBitrate:
        config.mediasoup.webRtcTransport.initialAvailableOutgoingBitrate,
    });

    return transport;
  }

  getWorkers(): types.Worker[] {
    return this.workers;
  }

  async close(): Promise<void> {
    console.log('🛑 Closing Mediasoup workers...');
    for (const worker of this.workers) {
      worker.close();
    }
    this.workers = [];
    this.routers.clear();
  }
}

export default new MediasoupService();

