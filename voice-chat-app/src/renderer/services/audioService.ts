// Import audio files - Vite will handle bundling
import ringtoneSound from '../../assets/ringring.m4a';
import outgoingCallSound from '../../assets/outgoing-call.m4a';

// Audio service for call sounds
class AudioService {
  private ringtoneAudio: HTMLAudioElement | null = null;
  private outgoingAudio: HTMLAudioElement | null = null;

  /**
   * Play incoming call ringtone (for person receiving the call)
   */
  playIncomingRingtone() {
    this.stopIncomingRingtone(); // Stop any existing

    try {
      this.ringtoneAudio = new Audio(ringtoneSound);
      this.ringtoneAudio.loop = true; // Loop until answered/rejected
      this.ringtoneAudio.volume = 0.6;
      
      // Play with promise handling for autoplay policy
      const playPromise = this.ringtoneAudio.play();
      
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log('🔔 Incoming ringtone playing');
          })
          .catch((error) => {
            console.warn('⚠️ Ringtone autoplay prevented:', error);
            // User interaction required to play audio
          });
      }
    } catch (error) {
      console.error('❌ Error playing incoming ringtone:', error);
    }
  }

  /**
   * Stop incoming call ringtone
   */
  stopIncomingRingtone() {
    if (this.ringtoneAudio) {
      this.ringtoneAudio.pause();
      this.ringtoneAudio.currentTime = 0;
      this.ringtoneAudio = null;
      console.log('🔇 Incoming ringtone stopped');
    }
  }

  /**
   * Play outgoing call sound (for person making the call)
   */
  playOutgoingCallSound() {
    this.stopOutgoingCallSound(); // Stop any existing

    try {
      this.outgoingAudio = new Audio(outgoingCallSound);
      this.outgoingAudio.loop = true; // Loop until answered/cancelled
      this.outgoingAudio.volume = 0.5;
      
      // Play with promise handling for autoplay policy
      const playPromise = this.outgoingAudio.play();
      
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log('📞 Outgoing call sound playing');
          })
          .catch((error) => {
            console.warn('⚠️ Outgoing call sound autoplay prevented:', error);
          });
      }
    } catch (error) {
      console.error('❌ Error playing outgoing call sound:', error);
    }
  }

  /**
   * Stop outgoing call sound
   */
  stopOutgoingCallSound() {
    if (this.outgoingAudio) {
      this.outgoingAudio.pause();
      this.outgoingAudio.currentTime = 0;
      this.outgoingAudio = null;
      console.log('🔇 Outgoing call sound stopped');
    }
  }

  /**
   * Stop all sounds
   */
  stopAllSounds() {
    this.stopIncomingRingtone();
    this.stopOutgoingCallSound();
  }
}

// Export singleton instance
export const audioService = new AudioService();

