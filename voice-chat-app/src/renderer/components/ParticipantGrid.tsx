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
  // Show max 16 participants in grid, rest shown as "+N more"
  const displayedParticipants = participants.slice(0, 16);
  const remainingCount = participants.length > 16 ? participants.length - 16 : 0;

  return (
    <div className="w-full h-full p-4 overflow-auto">
      <div className="grid gap-3 md:gap-4 lg:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 auto-rows-fr">
        {displayedParticipants.map((participant, index) => {
          // Show "more" overlay on last tile if overflow
          const isLastTile = remainingCount > 0 && index === 15;
          
          return (
            <div 
              key={participant.userId}
              className="relative w-full aspect-video"
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


