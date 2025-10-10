import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUserStore } from '@/stores/userStore';
import { UserCircle, Mic, Users, Video } from 'lucide-react';

export function InitUser() {
  const [name, setName] = useState('');
  const initializeUser = useUserStore((state) => state.initializeUser);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      initializeUser(name.trim());
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-10 left-10 w-32 h-32 bg-blue-200 rounded-full blur-3xl opacity-30 animate-pulse" />
      <div className="absolute bottom-10 right-10 w-40 h-40 bg-purple-200 rounded-full blur-3xl opacity-30 animate-pulse" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-pink-200 rounded-full blur-3xl opacity-20" />

      <Card className="w-full max-w-md shadow-2xl border-4 relative z-10 backdrop-blur-sm bg-white/90">
        <CardHeader className="text-center space-y-4 pb-8">
          <div className="flex justify-center mb-2">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-purple-400 rounded-full blur-lg opacity-50 animate-pulse" />
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center relative shadow-xl">
                <UserCircle className="w-14 h-14 text-white" />
              </div>
            </div>
          </div>
          <div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Welcome to Voice Chat
            </CardTitle>
            <CardDescription className="text-base mt-2">
              Connect with friends through crystal-clear voice calls
            </CardDescription>
          </div>

          {/* Features */}
          <div className="grid grid-cols-3 gap-4 pt-4">
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <Mic className="w-6 h-6 text-green-600" />
              </div>
              <p className="text-xs font-medium text-gray-600">HD Voice</p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <p className="text-xs font-medium text-gray-600">Group Calls</p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                <Video className="w-6 h-6 text-purple-600" />
              </div>
              <p className="text-xs font-medium text-gray-600">Video Chat</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-semibold">Your Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Enter your display name..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={30}
                required
                autoFocus
                className="border-2 focus:border-purple-300 h-12 text-base"
              />
              <p className="text-xs text-muted-foreground">{name.length}/30 characters</p>
            </div>
            <Button 
              type="submit" 
              className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 shadow-lg hover:shadow-xl transition-all" 
              size="lg" 
              disabled={!name.trim()}
            >
              Get Started 🚀
            </Button>
          </form>
          <p className="text-xs text-muted-foreground text-center">
            🔒 Your name is saved locally and never shared without your permission
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

