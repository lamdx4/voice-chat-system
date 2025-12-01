import { ParticipantCard } from './ParticipantCard';

interface Participant {
  userId: string;
  name: string;
  isLocal: boolean;
  isMuted: boolean;
  isVideoEnabled: boolean;
  audioTrack?: MediaStreamTrack;
  videoTrack?: MediaStreamTrack;
}

interface ParticipantGridProps {
  participants: Participant[];
  isMuted: boolean;
  isVideoEnabled: boolean;
}

export function ParticipantGrid({ participants, isMuted, isVideoEnabled }: ParticipantGridProps) {
  // Smart grid column calculation based on participant count (Discord-style)
  const calculateGridConfig = (count: number) => {
    if (count === 1) return { cols: 1, maxTileWidth: '1200px' };
    if (count === 2) return { cols: 2, maxTileWidth: '800px' };
    if (count <= 4) return { cols: 2, maxTileWidth: '600px' };
    if (count <= 6) return { cols: 3, maxTileWidth: '500px' };
    if (count <= 9) return { cols: 3, maxTileWidth: '450px' };
    if (count <= 16) return { cols: 4, maxTileWidth: '400px' };
    return { cols: 4, maxTileWidth: '350px' };
  };

  // Show max 16 participants in grid, rest shown as "+N more"
  const displayedParticipants = participants.slice(0, 16);
  const remainingCount = participants.length > 16 ? participants.length - 16 : 0;
  
  const gridConfig = calculateGridConfig(displayedParticipants.length);

  return (
    <div className="w-full h-full p-6 flex items-center justify-center overflow-auto">
      <div 
        className="grid gap-4 place-items-center w-full"
        style={{
          gridTemplateColumns: `repeat(${gridConfig.cols}, minmax(min(100%, ${gridConfig.maxTileWidth}), 1fr))`,
          maxWidth: `calc(${gridConfig.cols} * ${gridConfig.maxTileWidth} + ${gridConfig.cols - 1} * 1rem)`,
        }}
      >
        {displayedParticipants.map((participant, index) => {
          // Show "more" overlay on last tile if overflow
          const isLastTile = remainingCount > 0 && index === 15;
          
          return (
            <div 
              key={participant.userId}
              className="relative w-full aspect-video"
              style={{
                maxWidth: gridConfig.maxTileWidth,
              }}
            >
              <ParticipantCard
                name={participant.name}
                isLocal={participant.isLocal}
                isMuted={participant.isLocal ? isMuted : participant.isMuted}
                isVideoEnabled={participant.isLocal ? isVideoEnabled : participant.isVideoEnabled}
                audioTrack={participant.audioTrack}
                videoTrack={participant.videoTrack}
              />
              {isLastTile && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm rounded-lg">
                  <div className="text-center text-white">
                    <p className="text-4xl font-bold">+{remainingCount}</p>
                    <p className="text-sm mt-1">more participants</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


