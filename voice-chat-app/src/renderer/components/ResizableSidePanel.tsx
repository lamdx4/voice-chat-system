import { useState, useRef, useEffect } from 'react';
import { CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Send, ChevronRight, Smile, X } from 'lucide-react';
import { ChatMessage } from '@/types';
import { ChatMessageComponent } from './ChatMessage';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';

interface ResizableSidePanelProps {
  messages: ChatMessage[];
  messageInput: string;
  setMessageInput: (value: string) => void;
  handleSendMessage: (e: React.FormEvent) => void;
  currentUserId: string;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  formatTime: (timestamp: number) => string;
  getInitials: (name: string) => string;
  onClose: () => void;
  onReply?: (message: ChatMessage) => void;
  onReact?: (messageId: string, emoji: string) => void;
  replyingTo?: ChatMessage | null;
  onCancelReply?: () => void;
}

const MIN_WIDTH = 280;
const MAX_WIDTH = 600;
const DEFAULT_WIDTH = 384;

export function ResizableSidePanel({
  messages,
  messageInput,
  setMessageInput,
  handleSendMessage,
  currentUserId,
  messagesEndRef,
  formatTime,
  getInitials,
  onClose,
  onReply = () => {},
  onReact = () => {},
  replyingTo = null,
  onCancelReply = () => {},
}: ResizableSidePanelProps) {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [showInputEmojiPicker, setShowInputEmojiPicker] = useState(false);
  const resizeRef = useRef<HTMLDivElement>(null);

  const handleInputEmojiClick = (emojiData: EmojiClickData) => {
    setMessageInput(messageInput + emojiData.emoji);
    setShowInputEmojiPicker(false);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      // Calculate new width from the right edge
      const newWidth = window.innerWidth - e.clientX;
      const clampedWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth));
      setWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    if (isResizing) {
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  return (
    <div
      className="relative h-full bg-white border-l shadow-xl flex flex-col"
      style={{ width: `${width}px` }}
    >
      {/* Resize Handle - LEFT EDGE */}
      <div
        ref={resizeRef}
        className="absolute left-0 top-0 bottom-0 w-1 hover:w-2 bg-transparent hover:bg-blue-500 cursor-ew-resize z-10 transition-all"
        onMouseDown={handleResizeStart}
      />

      {/* Header */}
      <CardHeader className="border-b bg-gradient-to-r from-blue-500 to-purple-500 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2 text-white">
            <MessageSquare className="w-5 h-5" />
            Messages
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white hover:bg-white/20"
            onClick={onClose}
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </CardHeader>

      {/* Messages Area */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {messages.map((message) => (
            <ChatMessageComponent
              key={message.messageId}
              message={message}
              isOwnMessage={message.userId === currentUserId}
              currentUserId={currentUserId}
              formatTime={formatTime}
              getInitials={getInitials}
              onReply={onReply}
              onReact={onReact}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t bg-gray-50 flex-shrink-0">
        {/* Reply Indicator */}
        {replyingTo && (
          <div className="px-4 pt-3 pb-2 border-b bg-blue-50">
            <div className="flex items-center justify-between text-sm">
              <div className="flex-1">
                <p className="text-blue-700 font-medium">Replying to {replyingTo.userName}</p>
                <p className="text-gray-600 truncate">{replyingTo.content}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={onCancelReply}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSendMessage} className="p-4">
          <div className="flex gap-2">
            <DropdownMenu open={showInputEmojiPicker} onOpenChange={setShowInputEmojiPicker}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" type="button">
                  <Smile className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="p-0">
                <EmojiPicker
                  onEmojiClick={handleInputEmojiClick}
                  width={300}
                  height={350}
                  searchDisabled
                  skinTonesDisabled
                  previewConfig={{ showPreview: false }}
                />
              </DropdownMenuContent>
            </DropdownMenu>

            <Input
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder={replyingTo ? "Type your reply..." : "Type a message..."}
              maxLength={500}
              className="flex-1"
            />
            <Button type="submit" disabled={!messageInput.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

