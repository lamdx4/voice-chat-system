import React, { useEffect, useState } from 'react';
import { X, Monitor, AppWindow } from 'lucide-react';

interface ScreenSource {
  id: string;
  name: string;
  thumbnail: string;
  display_id: string;
  appIcon: string | null;
}

interface ScreenShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (sourceId: string) => void;
}

export const ScreenShareModal: React.FC<ScreenShareModalProps> = ({
  isOpen,
  onClose,
  onSelect,
}) => {
  const [sources, setSources] = useState<ScreenSource[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSources();
    }
  }, [isOpen]);

  const loadSources = async () => {
    setIsLoading(true);
    try {
      // @ts-ignore
      const sources = await window.electronAPI.getScreenSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 300, height: 300 },
      });
      setSources(sources);
    } catch (error) {
      console.error('Failed to load screen sources:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Share Screen or Window
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {sources.map((source) => (
                <button
                  key={source.id}
                  onClick={() => onSelect(source.id)}
                  className="group flex flex-col items-start p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all text-left w-full"
                >
                  <div className="relative w-full aspect-video bg-gray-100 dark:bg-gray-900 rounded-md overflow-hidden mb-3 border border-gray-200 dark:border-gray-700 group-hover:shadow-md transition-shadow">
                    <img
                      src={source.thumbnail}
                      alt={source.name}
                      className="w-full h-full object-contain"
                    />
                    {source.appIcon && (
                      <div className="absolute bottom-1 right-1 w-6 h-6 bg-white rounded-md p-0.5 shadow-sm">
                        <img src={source.appIcon} alt="" className="w-full h-full object-contain" />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 w-full">
                    {source.id.startsWith('screen') ? (
                      <Monitor className="w-4 h-4 text-gray-500 shrink-0" />
                    ) : (
                      <AppWindow className="w-4 h-4 text-gray-500 shrink-0" />
                    )}
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate w-full">
                      {source.name}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
