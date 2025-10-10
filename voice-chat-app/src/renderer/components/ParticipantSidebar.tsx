import { useState } from 'react';
import { CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, Mic, MicOff, ChevronDown } from 'lucide-react';

interface Participant {
  userId: string;
  name: string;
  isLocal: boolean;
  isMuted?: boolean;
}

interface ParticipantSidebarProps {
  participants: Participant[];
  isMuted: boolean;
  getInitials: (name: string) => string;
}

const MAX_VISIBLE = 10;

export function ParticipantSidebar({ participants, isMuted, getInitials }: ParticipantSidebarProps) {
  const [showAll, setShowAll] = useState(false);
  
  const hasOverflow = participants.length > MAX_VISIBLE;
  const visibleParticipants = showAll ? participants : participants.slice(0, MAX_VISIBLE);
  const remainingCount = hasOverflow ? participants.length - MAX_VISIBLE : 0;

  return (
    <div className="w-80 border-l bg-white shadow-xl flex flex-col">
      <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-purple-50">
        <CardTitle className="text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" />
            <span>In Call</span>
          </div>
          <Badge variant="secondary" className="bg-blue-100 text-blue-700">
            {participants.length}
          </Badge>
        </CardTitle>
      </CardHeader>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-1">
          {visibleParticipants.map((participant) => (
            <div
              key={participant.userId}
              className="group flex items-center gap-3 p-2 rounded-lg hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 transition-all duration-200 cursor-pointer"
            >
              <div className="relative">
                <Avatar className="w-9 h-9 border-2 border-blue-200 group-hover:border-blue-400 transition-colors">
                  <AvatarFallback className="bg-gradient-to-br from-blue-100 to-purple-100 text-blue-700 text-xs font-semibold">
                    {getInitials(participant.name)}
                  </AvatarFallback>
                </Avatar>
                {/* Status indicator */}
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white bg-green-500" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate text-gray-900">
                    {participant.name}
                  </span>
                  {participant.isLocal && (
                    <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-blue-500 text-white">
                      You
                    </Badge>
                  )}
                </div>
              </div>

              {/* Mic status */}
              <div className="flex-shrink-0">
                {participant.isLocal ? (
                  isMuted ? (
                    <div className="bg-red-100 p-1.5 rounded-md group-hover:bg-red-200 transition-colors">
                      <MicOff className="w-3.5 h-3.5 text-red-600" />
                    </div>
                  ) : (
                    <div className="bg-green-100 p-1.5 rounded-md group-hover:bg-green-200 transition-colors">
                      <Mic className="w-3.5 h-3.5 text-green-600" />
                    </div>
                  )
                ) : (
                  <div className="bg-gray-100 p-1.5 rounded-md group-hover:bg-gray-200 transition-colors">
                    <Mic className="w-3.5 h-3.5 text-gray-500" />
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Show more button */}
          {hasOverflow && !showAll && (
            <Button
              variant="ghost"
              className="w-full justify-between text-sm text-gray-600 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 hover:text-blue-700"
              onClick={() => setShowAll(true)}
            >
              <span>Show {remainingCount} more</span>
              <ChevronDown className="w-4 h-4" />
            </Button>
          )}

          {showAll && hasOverflow && (
            <Button
              variant="ghost"
              className="w-full text-sm text-gray-600 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 hover:text-blue-700"
              onClick={() => setShowAll(false)}
            >
              Show less
            </Button>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

