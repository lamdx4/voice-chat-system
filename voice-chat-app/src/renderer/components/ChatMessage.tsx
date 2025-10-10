import { useState, useRef } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { Reply, SmilePlus, MoreVertical } from 'lucide-react';
import { ChatMessage as ChatMessageType, MessageReaction } from '@/types';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';

interface ChatMessageProps {
  message: ChatMessageType;
  isOwnMessage: boolean;
  currentUserId: string;
  formatTime: (timestamp: number) => string;
  getInitials: (name: string) => string;
  onReply: (message: ChatMessageType) => void;
  onReact: (messageId: string, emoji: string) => void;
}

export function ChatMessageComponent({
  message,
  isOwnMessage,
  currentUserId,
  formatTime,
  getInitials,
  onReply,
  onReact,
}: ChatMessageProps) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    onReact(message.messageId, emojiData.emoji);
    setShowEmojiPicker(false);
  };

  const handleReactionClick = (emoji: string) => {
    onReact(message.messageId, emoji);
  };

  const userHasReacted = (reaction: MessageReaction) => {
    return reaction.userIds.includes(currentUserId);
  };

  return (
    <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} group`}>
      <div className={`max-w-[85%] ${isOwnMessage ? 'items-end' : 'items-start'} flex flex-col`}>
        {/* Reply indicator */}
        {message.replyTo && (
          <div className={`mb-1 text-xs text-gray-500 ${isOwnMessage ? 'text-right' : 'text-left'}`}>
            <div className="flex items-center gap-1 mb-1">
              <Reply className="w-3 h-3" />
              <span>Replying to {message.replyTo.userName}</span>
            </div>
            <div className={`px-3 py-1 rounded border-l-2 ${
              isOwnMessage ? 'border-blue-400 bg-blue-50' : 'border-gray-400 bg-gray-50'
            }`}>
              <p className="truncate max-w-[250px]">{message.replyTo.content}</p>
            </div>
          </div>
        )}

        {/* Message header */}
        <div className="flex items-center gap-2 mb-1">
          <Avatar className="w-6 h-6">
            <AvatarFallback className="text-xs bg-gray-200">
              {getInitials(message.userName)}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs font-medium text-gray-700">
            {message.userName}
          </span>
          <span className="text-xs text-gray-500">
            {formatTime(message.timestamp)}
          </span>
        </div>

        {/* Message content with actions */}
        <div className="relative">
          <div className={`rounded-2xl px-4 py-2 ${
            isOwnMessage
              ? 'bg-blue-500 text-white rounded-tr-none'
              : 'bg-gray-100 text-gray-900 rounded-tl-none'
          }`}>
            <p className="text-sm break-all whitespace-pre-wrap hyphens-auto" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
              {message.content}
            </p>
          </div>

          {/* Action buttons - show on hover */}
          <div className="absolute -right-20 top-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
            <DropdownMenu open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <SmilePlus className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="p-0">
                <div ref={emojiPickerRef}>
                  <EmojiPicker
                    onEmojiClick={handleEmojiClick}
                    width={300}
                    height={350}
                    searchDisabled
                    skinTonesDisabled
                    previewConfig={{ showPreview: false }}
                  />
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onReply(message)}>
                  <Reply className="w-4 h-4 mr-2" />
                  Reply
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Reactions */}
        {message.reactions && message.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {message.reactions.map((reaction, index) => (
              <button
                key={index}
                onClick={() => handleReactionClick(reaction.emoji)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors ${
                  userHasReacted(reaction)
                    ? 'bg-blue-100 border border-blue-300'
                    : 'bg-gray-100 hover:bg-gray-200 border border-gray-200'
                }`}
              >
                <span>{reaction.emoji}</span>
                <span className="text-gray-600">{reaction.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

