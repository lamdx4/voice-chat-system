import { useMemo } from 'react';
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
  // Calculate grid layout based on participant count
  const gridConfig = useMemo(() => {
    const count = participants.length;
    
    if (count === 1) {
      return { cols: 1, rows: 1, aspectRatio: '16/9' };
    } else if (count === 2) {
      return { cols: 2, rows: 1, aspectRatio: '4/3' };
    } else if (count <= 4) {
      return { cols: 2, rows: 2, aspectRatio: '4/3' };
    } else if (count <= 6) {
      return { cols: 3, rows: 2, aspectRatio: '16/9' };
    } else if (count <= 9) {
      return { cols: 3, rows: 3, aspectRatio: '16/9' };
    } else if (count <= 12) {
      return { cols: 4, rows: 3, aspectRatio: '16/9' };
    } else if (count <= 16) {
      return { cols: 4, rows: 4, aspectRatio: '16/9' };
    } else {
      // For very large groups, show max 16 in grid
      return { cols: 4, rows: 4, aspectRatio: '16/9', overflow: true };
    }
  }, [participants.length]);

  const displayedParticipants = gridConfig.overflow 
    ? participants.slice(0, 16) 
    : participants;

  const remainingCount = gridConfig.overflow 
    ? participants.length - 16 
    : 0;

  return (
    <div className="h-full flex items-center justify-center p-4">
      <div 
        className="w-full h-full grid gap-2 md:gap-3 lg:gap-4"
        style={{
          gridTemplateColumns: `repeat(${gridConfig.cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${gridConfig.rows}, minmax(0, 1fr))`,
          maxHeight: '100%',
        }}
      >
        {displayedParticipants.map((participant, index) => {
          // Show "more" overlay on last tile if overflow
          const isLastTile = gridConfig.overflow && index === 15;
          
          return (
            <div 
              key={participant.userId}
              className="relative min-h-0"
              style={{ aspectRatio: gridConfig.aspectRatio }}
            >
              <ParticipantCard
                name={participant.name}
                isLocal={participant.isLocal}
                isMuted={participant.isLocal ? isMuted : participant.isMuted}
                isVideoEnabled={participant.isLocal ? isVideoEnabled : participant.isVideoEnabled}
                audioTrack={participant.audioTrack}
                videoTrack={participant.videoTrack}
              />
              {isLastTile && remainingCount > 0 && (
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


