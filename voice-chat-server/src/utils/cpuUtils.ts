import os from 'os';

/**
 * CPU utility functions
 */
export class CpuUtils {
  /**
   * Get total number of CPU cores
   */
  static getCpuCores(): number {
    return os.cpus().length;
  }
}

export default CpuUtils;

