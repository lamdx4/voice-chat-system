import path from 'path';
import { app } from 'electron';

/**
 * Resource Manager for handling application resources
 * Works in both development and production environments
 */
export class ResourceManager {
  private static resourcesPath: string;

  /**
   * Initialize the resource manager
   */
  static initialize(): void {
    const isDev = !app.isPackaged;
    
    if (isDev) {
      // In development, resources are in the project root
      this.resourcesPath = path.join(app.getAppPath(), 'resources');
    } else {
      // In production, resources are in the app resources folder
      this.resourcesPath = path.join(process.resourcesPath, 'resources');
    }
    
    console.log('Resource path initialized:', this.resourcesPath);
  }

  /**
   * Get the full path to a resource
   * @param resourcePath - Relative path to the resource (e.g., 'audio/notification.mp3')
   * @returns Full path to the resource
   */
  static getPath(resourcePath: string): string {
    if (!this.resourcesPath) {
      this.initialize();
    }
    return path.join(this.resourcesPath, resourcePath);
  }

  /**
   * Get the resources root directory
   * @returns Root resources directory path
   */
  static getRootPath(): string {
    if (!this.resourcesPath) {
      this.initialize();
    }
    return this.resourcesPath;
  }

  /**
   * Check if a resource exists
   * @param resourcePath - Relative path to the resource
   * @returns True if the resource exists
   */
  static async exists(resourcePath: string): Promise<boolean> {
    const fs = await import('fs/promises');
    try {
      await fs.access(this.getPath(resourcePath));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Read a resource file
   * @param resourcePath - Relative path to the resource
   * @returns File contents as buffer
   */
  static async readFile(resourcePath: string): Promise<Buffer> {
    const fs = await import('fs/promises');
    return fs.readFile(this.getPath(resourcePath));
  }

  /**
   * Read a resource file as string
   * @param resourcePath - Relative path to the resource
   * @param encoding - Text encoding (default: 'utf-8')
   * @returns File contents as string
   */
  static async readText(resourcePath: string, encoding: BufferEncoding = 'utf-8'): Promise<string> {
    const fs = await import('fs/promises');
    return fs.readFile(this.getPath(resourcePath), { encoding });
  }

  /**
   * Read a resource file as JSON
   * @param resourcePath - Relative path to the resource
   * @returns Parsed JSON object
   */
  static async readJSON<T = any>(resourcePath: string): Promise<T> {
    const content = await this.readText(resourcePath);
    return JSON.parse(content);
  }
}

