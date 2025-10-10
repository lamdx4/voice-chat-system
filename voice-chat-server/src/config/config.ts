import dotenv from "dotenv";
import pickLanIp from "../utils/IpLan";
import CpuUtils from "../utils/cpuUtils";

dotenv.config();
console.log(process.env.MEDIASOUP_LISTEN_IP);

export const config = {
  server: {
    port: parseInt(process.env.PORT || "3000", 10),
    nodeEnv: process.env.NODE_ENV || "development",
  },
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD || "",
  },
  mediasoup: {
    numWorkers: parseInt(process.env.MEDIASOUP_NUM_WORKERS || String(CpuUtils.getCpuCores()), 10),
    worker: {
      rtcMinPort: parseInt(process.env.RTC_MIN_PORT || "10000", 10),
      rtcMaxPort: parseInt(process.env.RTC_MAX_PORT || "10100", 10),
      logLevel: "warn" as const,
      logTags: ["info", "ice", "dtls", "rtp", "srtp", "rtcp"] as const,
    },
    router: {
      mediaCodecs: [
        {
          kind: "audio" as const,
          mimeType: "audio/opus",
          clockRate: 48000,
          channels: 2,
        },
        {
          kind: "video" as const,
          mimeType: "video/VP8",
          clockRate: 90000,
          parameters: {
            "x-google-start-bitrate": 1000,
          },
        },
        {
          kind: "video" as const,
          mimeType: "video/H264",
          clockRate: 90000,
          parameters: {
            "packetization-mode": 1,
            "profile-level-id": "42e01f",
            "level-asymmetry-allowed": 1,
          },
        },
      ],
    },
    webRtcTransport: {
      listenIps: [
        {
          ip: String(process.env.MEDIASOUP_LISTEN_IP),
          announcedIp: pickLanIp(),
        },
      ],
      initialAvailableOutgoingBitrate: 1000000,
      minimumAvailableOutgoingBitrate: 600000,
      maxSctpMessageSize: 262144,
      maxIncomingBitrate: 1500000,
    },
  },
};
