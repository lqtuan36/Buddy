import {
  PodcastAudioStatus,
  Story,
  StorySceneCue,
  VoiceGender,
  VoicePreference,
} from '../types/domain';
import { normalizeVietnameseTextForTts, voiceService } from './voiceService';

export type PodcastPlayerStatus =
  | 'idle'
  | 'generating'
  | 'loading'
  | 'playing'
  | 'paused'
  | 'ended'
  | 'error';

export type PodcastErrorCategory =
  | 'api_config'
  | 'quota_429'
  | 'server_5xx'
  | 'timeout'
  | 'invalid_wav'
  | 'browser_playback'
  | null;

export interface PodcastPlaybackSnapshot {
  storyId: string | null;
  status: PodcastPlayerStatus;
  audioStatus: PodcastAudioStatus;
  audioUrl: string | null;
  audioAssetId: string | null;
  currentTimeSec: number;
  durationSec: number;
  bufferedSec: number;
  playbackRate: number;
  volume: number;
  muted: boolean;
  voiceGender: VoiceGender;
  activeSceneIndex: number;
  sceneOffsetSec: number;
  sceneTimeline: StorySceneCue[];
  engineMode: 'server-continuous-wav' | 'browser-continuous-timeline';
  errorCategory: PodcastErrorCategory;
  errorMessage: string | null;
}

type PodcastSubscriber = (snapshot: PodcastPlaybackSnapshot) => void;

function buildDefaultSceneTimeline(
  story: Story,
  fallbackSceneUrls: Array<{ imageUrl: string; sceneCaption: string }>
): StorySceneCue[] {
  if (Array.isArray(story.sceneTimeline) && story.sceneTimeline.length > 0) {
    return story.sceneTimeline.map((cue, idx) => ({
      ...cue,
      imageUrl:
        cue.imageUrl ||
        fallbackSceneUrls[idx % Math.max(1, fallbackSceneUrls.length)]?.imageUrl ||
        '',
      caption:
        cue.caption ||
        fallbackSceneUrls[idx % Math.max(1, fallbackSceneUrls.length)]?.sceneCaption ||
        `Minh họa ${idx + 1}`,
    }));
  }

  let cursorSec = 0;
  return story.paragraphs.map((para, idx) => {
    const words = Math.max(8, para.trim().split(/\s+/).length);
    const segSec = Math.max(10, Math.round(words / 2.15));
    const startTimeSec = cursorSec;
    const endTimeSec = cursorSec + segSec;
    cursorSec = endTimeSec;
    const visual =
      fallbackSceneUrls[idx % Math.max(1, fallbackSceneUrls.length)];
    return {
      sceneIndex: idx,
      paragraphIndex: idx,
      startTimeSec,
      endTimeSec,
      imageUrl: visual?.imageUrl || '',
      caption:
        visual?.sceneCaption ||
        para.slice(0, 82),
    };
  });
}

class PodcastPlaybackController {
  private audioElement: HTMLAudioElement | null = null;
  private subscribers: Set<PodcastSubscriber> = new Set();
  private activeStory: Story | null = null;
  private abortController: AbortController | null = null;
  private fallbackTimerId: number | null = null;
  private fallbackLastTickMs = 0;
  private fallbackSpokenSceneIndex = -1;
  private sessionToken = 0;

  private snapshot: PodcastPlaybackSnapshot = {
    storyId: null,
    status: 'idle',
    audioStatus: 'none',
    audioUrl: null,
    audioAssetId: null,
    currentTimeSec: 0,
    durationSec: 180,
    bufferedSec: 0,
    playbackRate: 1.0,
    volume: 0.9,
    muted: false,
    voiceGender: 'female',
    activeSceneIndex: 0,
    sceneOffsetSec: 0,
    sceneTimeline: [],
    engineMode: 'server-continuous-wav',
    errorCategory: null,
    errorMessage: null,
  };

  public subscribe(fn: PodcastSubscriber): () => void {
    this.subscribers.add(fn);
    fn({ ...this.snapshot });
    return () => {
      this.subscribers.delete(fn);
    };
  }

  private notify(): void {
    const copy: PodcastPlaybackSnapshot = {
      ...this.snapshot,
      sceneTimeline: [...this.snapshot.sceneTimeline],
    };
    for (const fn of this.subscribers) {
      fn(copy);
    }
  }

  public getSnapshot(): PodcastPlaybackSnapshot {
    return { ...this.snapshot };
  }

  private findSceneIndexForTime(
    timeSec: number,
    timeline: StorySceneCue[],
    offsetSec = this.snapshot?.sceneOffsetSec ?? 0
  ): number {
    if (!timeline || timeline.length === 0) return 0;
    const adjustedTime = Math.max(0, timeSec + offsetSec);
    for (let i = 0; i < timeline.length; i++) {
      const cue = timeline[i];
      if (adjustedTime >= cue.startTimeSec && adjustedTime < cue.endTimeSec) {
        return i;
      }
    }
    if (adjustedTime >= timeline[timeline.length - 1].endTimeSec) {
      return timeline.length - 1;
    }
    return 0;
  }

  /**
   * Adjusts the scene timing offset within [-2.0, +2.0] seconds so scene transitions can be fine-tuned
   * against the audio narration timeline (Section A.4).
   */
  public setSceneOffsetSec(offsetSec: number): void {
    const clamped = Math.max(-2, Math.min(2, Math.round(offsetSec * 2) / 2));
    const nextSceneIdx = this.findSceneIndexForTime(
      this.snapshot.currentTimeSec,
      this.snapshot.sceneTimeline,
      clamped
    );
    this.snapshot = {
      ...this.snapshot,
      sceneOffsetSec: clamped,
      activeSceneIndex: nextSceneIdx,
    };
    this.notify();
  }

  /**
   * Loads and prepares a continuous Podcast Episode for the given story and voice preference.
   * Checks cached episode audio on the server (including disk existence after server restart)
   * or synthesizes the full continuous WAV episode.
   */
  public async loadEpisode(
    story: Story,
    preference: VoicePreference,
    fallbackSceneUrls: Array<{ imageUrl: string; sceneCaption: string }>,
    options?: {
      initialTimeSec?: number;
      autoPlay?: boolean;
      forceRegenerate?: boolean;
      onEpisodeMetadataReady?: (meta: {
        audioAssetId?: string;
        audioUrl?: string;
        audioStatus: PodcastAudioStatus;
        actualDurationSeconds: number;
        sceneTimeline: StorySceneCue[];
        voiceId?: string;
        voiceGender: VoiceGender;
      }) => void;
    }
  ): Promise<void> {
    // Stop any separate chat/guide voice immediately so there are never two audio sources
    voiceService.cancel();
    this.cleanupAudioOnly();

    this.sessionToken += 1;
    const token = this.sessionToken;
    this.activeStory = story;

    const initialTimeline = buildDefaultSceneTimeline(story, fallbackSceneUrls);
    const estDuration =
      story.actualDurationSeconds ||
      initialTimeline[initialTimeline.length - 1]?.endTimeSec ||
      Math.max(120, story.durationMinutes * 60);

    const startAtSec = Math.max(
      0,
      Math.min(estDuration - 1, options?.initialTimeSec || 0)
    );

    const safeRate = [0.85, 1, 1.1, 1.25].includes(preference.speechRate)
      ? preference.speechRate
      : 1.0;

    this.snapshot = {
      storyId: story.id,
      status: 'generating',
      audioStatus: 'generating',
      audioUrl: story.audioUrl || null,
      audioAssetId: story.audioAssetId || null,
      currentTimeSec: startAtSec,
      durationSec: estDuration,
      bufferedSec: 0,
      playbackRate: safeRate,
      volume: preference.volume,
      muted: preference.muted,
      voiceGender: preference.gender,
      activeSceneIndex: this.findSceneIndexForTime(startAtSec, initialTimeline, this.snapshot.sceneOffsetSec),
      sceneOffsetSec: this.snapshot.sceneOffsetSec,
      sceneTimeline: initialTimeline,
      engineMode: 'server-continuous-wav',
      errorCategory: null,
      errorMessage: null,
    };
    this.notify();

    const abortController = new AbortController();
    this.abortController = abortController;

    try {
      // Section A.3: If story already has a cached audioAssetId & audioUrl for the selected voiceGender,
      // verify that the file still exists on disk after server restart before trusting localStorage!
      if (
        !options?.forceRegenerate &&
        story.audioStatus === 'ready' &&
        story.audioAssetId &&
        story.audioUrl &&
        (!story.voiceGender || story.voiceGender === preference.gender)
      ) {
        try {
          const statusRes = await fetch(
            `/api/podcast/audio-status/${encodeURIComponent(story.audioAssetId)}`,
            { signal: abortController.signal }
          );
          if (statusRes.ok) {
            const statusJson = await statusRes.json();
            if (token !== this.sessionToken) return;
            if (statusJson.ok && statusJson.existsOnDisk && statusJson.audioUrl) {
              const cachedDuration =
                Number(statusJson.actualDurationSeconds) || estDuration;
              this.attachContinuousWavAudio(
                statusJson.audioUrl,
                story.audioAssetId,
                cachedDuration,
                initialTimeline,
                startAtSec,
                token,
                Boolean(options?.autoPlay)
              );
              return;
            }
          }
        } catch {
          // If disk status check fails, fall through to synthesize-episode
        }
      }

      const response = await fetch('/api/podcast/synthesize-episode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyId: story.id,
          title: story.title,
          paragraphs: story.paragraphs,
          moralLesson: story.moralLesson,
          gender: preference.gender,
          contentVersion: story.contentVersion || 1,
          sceneImages: fallbackSceneUrls.map((s) => ({
            imageUrl: s.imageUrl,
            caption: s.sceneCaption,
          })),
          forceRegenerate: Boolean(options?.forceRegenerate),
        }),
        signal: abortController.signal,
      });

      if (token !== this.sessionToken) return;

      const payload = await response.json();
      if (token !== this.sessionToken) return;

      const resolvedTimeline: StorySceneCue[] = Array.isArray(payload.sceneTimeline)
        ? payload.sceneTimeline.map((cue: StorySceneCue, idx: number) => ({
            ...cue,
            imageUrl:
              cue.imageUrl ||
              fallbackSceneUrls[idx % Math.max(1, fallbackSceneUrls.length)]
                ?.imageUrl ||
              '',
            caption:
              cue.caption ||
              fallbackSceneUrls[idx % Math.max(1, fallbackSceneUrls.length)]
                ?.sceneCaption ||
              `Minh họa ${idx + 1}`,
          }))
        : initialTimeline;

      const resolvedDuration =
        Number(payload.actualDurationSeconds) ||
        resolvedTimeline[resolvedTimeline.length - 1]?.endTimeSec ||
        estDuration;

      if (response.ok && payload.ok && payload.audioUrl && payload.audioStatus === 'ready') {
        this.attachContinuousWavAudio(
          payload.audioUrl,
          payload.audioAssetId,
          resolvedDuration,
          resolvedTimeline,
          startAtSec,
          token,
          Boolean(options?.autoPlay)
        );

        if (options?.onEpisodeMetadataReady) {
          options.onEpisodeMetadataReady({
            audioAssetId: payload.audioAssetId,
            audioUrl: payload.audioUrl,
            audioStatus: 'ready',
            actualDurationSeconds: resolvedDuration,
            sceneTimeline: resolvedTimeline,
            voiceId: payload.voiceId,
            voiceGender: preference.gender,
          });
        }
        return;
      }

      // CRITICAL RULE (Section A.3): Never fake/simulate a playing state when real audio is unavailable!
      // Surface a clear error state and classification.
      this.snapshot = {
        ...this.snapshot,
        status: 'error',
        audioStatus: 'failed',
        audioUrl: null,
        audioAssetId: null,
        durationSec: resolvedDuration,
        sceneTimeline: resolvedTimeline,
        activeSceneIndex: this.findSceneIndexForTime(startAtSec, resolvedTimeline, this.snapshot.sceneOffsetSec),
        engineMode: 'server-continuous-wav',
        errorCategory: (payload.errorCategory as PodcastErrorCategory) || 'server_5xx',
        errorMessage:
          payload.reason ||
          payload.error ||
          'Không thể tạo âm thanh cho tập Podcast này. Vui lòng bấm "Thử lại" để tạo lại âm thanh.',
      };
      this.notify();

      if (options?.onEpisodeMetadataReady) {
        options.onEpisodeMetadataReady({
          audioStatus: 'failed',
          actualDurationSeconds: resolvedDuration,
          sceneTimeline: resolvedTimeline,
          voiceGender: preference.gender,
        });
      }
    } catch (err) {
      if (token !== this.sessionToken) return;
      if (err instanceof DOMException && err.name === 'AbortError') return;
      this.snapshot = {
        ...this.snapshot,
        status: 'error',
        audioStatus: 'failed',
        engineMode: 'server-continuous-wav',
        errorCategory: 'timeout',
        errorMessage:
          'Không thể kết nối bộ tạo âm thanh Podcast. Vui lòng kiểm tra kết nối và bấm "Thử lại".',
      };
      this.notify();
    }
  }

  private attachContinuousWavAudio(
    audioUrl: string,
    audioAssetId: string,
    expectedDurationSec: number,
    sceneTimeline: StorySceneCue[],
    startAtSec: number,
    token: number,
    autoPlay: boolean
  ): void {
    // Ensure any previous audio or Web Speech API is completely stopped
    this.cancelBrowserSpeechOnly();

    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = audioUrl;
    audio.volume = this.snapshot.muted ? 0 : Math.max(0, Math.min(1, this.snapshot.volume));
    audio.muted = this.snapshot.muted;
    audio.playbackRate = this.snapshot.playbackRate;
    this.audioElement = audio;

    this.snapshot = {
      ...this.snapshot,
      status: 'loading',
      audioStatus: 'ready',
      audioUrl,
      audioAssetId,
      durationSec: expectedDurationSec,
      sceneTimeline,
      engineMode: 'server-continuous-wav',
      errorMessage: null,
    };
    this.notify();

    audio.onloadedmetadata = () => {
      if (token !== this.sessionToken || this.audioElement !== audio) return;
      const realDuration =
        Number.isFinite(audio.duration) && audio.duration > 0
          ? audio.duration
          : expectedDurationSec;

      // Scale sceneTimeline proportionally if real WAV duration differs slightly from estimate
      const lastCueEnd =
        sceneTimeline[sceneTimeline.length - 1]?.endTimeSec || realDuration;
      const scale = lastCueEnd > 0 ? realDuration / lastCueEnd : 1;
      const calibratedTimeline = sceneTimeline.map((cue) => ({
        ...cue,
        startTimeSec: Number((cue.startTimeSec * scale).toFixed(2)),
        endTimeSec: Number((cue.endTimeSec * scale).toFixed(2)),
      }));

      if (startAtSec > 0 && startAtSec < realDuration - 1) {
        try {
          audio.currentTime = startAtSec;
        } catch {
          // Ignore early seek error
        }
      }

      this.snapshot = {
        ...this.snapshot,
        status: audio.paused ? 'idle' : 'playing',
        durationSec: realDuration,
        currentTimeSec: audio.currentTime || startAtSec,
        sceneTimeline: calibratedTimeline,
        activeSceneIndex: this.findSceneIndexForTime(
          audio.currentTime || startAtSec,
          calibratedTimeline
        ),
        errorMessage: null,
      };
      this.notify();

      if (autoPlay) {
        this.play();
      }
    };

    audio.ontimeupdate = () => {
      if (token !== this.sessionToken || this.audioElement !== audio) return;
      const cur = audio.currentTime || 0;
      const dur =
        Number.isFinite(audio.duration) && audio.duration > 0
          ? audio.duration
          : this.snapshot.durationSec;
      let bufferedEnd = this.snapshot.bufferedSec;
      try {
        if (audio.buffered && audio.buffered.length > 0) {
          bufferedEnd = audio.buffered.end(audio.buffered.length - 1);
        }
      } catch {
        // Ignore buffered range error
      }

      const nextSceneIdx = this.findSceneIndexForTime(
        cur,
        this.snapshot.sceneTimeline
      );

      this.snapshot = {
        ...this.snapshot,
        currentTimeSec: cur,
        durationSec: dur,
        bufferedSec: bufferedEnd,
        activeSceneIndex: nextSceneIdx,
      };
      this.notify();
    };

    audio.onplay = () => {
      if (token !== this.sessionToken || this.audioElement !== audio) return;
      audio.playbackRate = this.snapshot.playbackRate;
      this.snapshot = {
        ...this.snapshot,
        status: 'playing',
        errorMessage: null,
      };
      this.notify();
    };

    audio.onpause = () => {
      if (token !== this.sessionToken || this.audioElement !== audio) return;
      if (audio.ended) return;
      this.snapshot = {
        ...this.snapshot,
        status: 'paused',
        currentTimeSec: audio.currentTime || this.snapshot.currentTimeSec,
      };
      this.notify();
    };

    audio.onended = () => {
      if (token !== this.sessionToken || this.audioElement !== audio) return;
      this.snapshot = {
        ...this.snapshot,
        status: 'ended',
        currentTimeSec: this.snapshot.durationSec,
        activeSceneIndex: Math.max(0, this.snapshot.sceneTimeline.length - 1),
      };
      this.notify();
    };

    audio.onerror = () => {
      if (token !== this.sessionToken || this.audioElement !== audio) return;
      // Never fake playback when audio stream fails — show clear error state and allow retry
      this.audioElement = null;
      this.snapshot = {
        ...this.snapshot,
        status: 'error',
        audioStatus: 'failed',
        errorMessage:
          'Không thể phát tệp âm thanh của tập Podcast này. Vui lòng bấm "Thử lại" để tạo lại bản thu.',
      };
      this.notify();
    };
  }

  /**
   * Starts or resumes continuous playback from the exact currentTimeSec (<50ms latency).
   * Never fakes a playing state if real audio is unavailable.
   */
  public play(): void {
    // Always stop any other voice or speechSynthesis session so only 1 session plays at a time
    voiceService.cancel();
    this.cancelBrowserSpeechOnly();

    if (!this.audioElement || this.snapshot.audioStatus === 'failed') {
      this.snapshot = {
        ...this.snapshot,
        status: 'error',
        errorMessage:
          this.snapshot.errorMessage ||
          'Tệp âm thanh thực tế chưa sẵn sàng. Vui lòng bấm "Thử lại" để tạo âm thanh.',
      };
      this.notify();
      return;
    }

    // If ended, restart from 0:00
    if (
      this.snapshot.status === 'ended' ||
      this.snapshot.currentTimeSec >= this.snapshot.durationSec - 0.5
    ) {
      this.seekTo(0);
    }

    try {
      this.audioElement.playbackRate = this.snapshot.playbackRate;
      this.audioElement.muted = this.snapshot.muted;
      this.audioElement.volume = this.snapshot.muted
        ? 0
        : Math.max(0, Math.min(1, this.snapshot.volume));

      this.snapshot = {
        ...this.snapshot,
        status: 'playing',
        errorMessage: null,
      };
      this.notify();

      this.audioElement.play().catch(() => {
        this.snapshot = {
          ...this.snapshot,
          status: 'paused',
        };
        this.notify();
      });
    } catch {
      this.snapshot = {
        ...this.snapshot,
        status: 'error',
        errorMessage: 'Không thể bắt đầu phát âm thanh. Vui lòng thử lại.',
      };
      this.notify();
    }
  }

  /**
   * Immediately pauses playback synchronously (<50ms response time) and preserves exact currentTimeSec.
   */
  public pause(): void {
    this.cancelBrowserSpeechOnly();
    if (this.audioElement) {
      try {
        this.audioElement.pause();
      } catch {
        // Ignore pause error
      }
      this.snapshot = {
        ...this.snapshot,
        status: 'paused',
        currentTimeSec:
          this.audioElement.currentTime || this.snapshot.currentTimeSec,
      };
      this.notify();
      return;
    }

    this.pauseBrowserContinuousTimeline();
  }

  public togglePlayPause(): void {
    if (this.snapshot.status === 'playing') {
      this.pause();
    } else {
      this.play();
    }
  }

  /**
   * Seeks directly to any timestamp (0..durationSec) and synchronizes the active scene illustration.
   */
  public seekTo(targetSec: number): void {
    const clamped = Math.max(
      0,
      Math.min(this.snapshot.durationSec, Number(targetSec) || 0)
    );
    const nextSceneIdx = this.findSceneIndexForTime(
      clamped,
      this.snapshot.sceneTimeline
    );
    const prevSceneIdx = this.snapshot.activeSceneIndex;

    if (this.audioElement && this.snapshot.engineMode === 'server-continuous-wav') {
      try {
        this.audioElement.currentTime = clamped;
      } catch {
        // Ignore seek error if metadata not yet loaded
      }
    }

    this.snapshot = {
      ...this.snapshot,
      currentTimeSec: clamped,
      activeSceneIndex: nextSceneIdx,
      status:
        this.snapshot.status === 'ended' && clamped < this.snapshot.durationSec
          ? 'paused'
          : this.snapshot.status,
    };
    this.notify();

    // If running in browser continuous fallback and scene changed while playing, speak from the new scene
    if (
      this.snapshot.engineMode === 'browser-continuous-timeline' &&
      this.snapshot.status === 'playing' &&
      nextSceneIdx !== prevSceneIdx
    ) {
      this.speakFallbackScene(nextSceneIdx);
    }
  }

  /**
   * Jumps backward or forward by deltaSec (e.g., -15s or +15s).
   */
  public skipBy(deltaSec: number): void {
    this.seekTo(this.snapshot.currentTimeSec + deltaSec);
  }

  /**
   * Updates playback speed (0.85x, 1x, 1.1x, 1.25x) immediately without changing the selected voice.
   */
  public setPlaybackRate(rate: number): void {
    const allowed = [0.85, 1, 1.1, 1.25];
    const validRate = allowed.includes(rate) ? rate : 1.0;

    if (this.audioElement) {
      try {
        this.audioElement.playbackRate = validRate;
      } catch {
        // Ignore playbackRate error
      }
    }

    this.snapshot = {
      ...this.snapshot,
      playbackRate: validRate,
    };
    this.notify();
  }

  /**
   * Updates volume (0..1) and mute state immediately on the active audio stream.
   */
  public setVolume(volume: number, muted: boolean): void {
    const safeVol = Math.max(0, Math.min(1, volume));
    if (this.audioElement) {
      try {
        this.audioElement.muted = muted;
        this.audioElement.volume = muted ? 0 : safeVol;
      } catch {
        // Ignore volume update error
      }
    }

    this.snapshot = {
      ...this.snapshot,
      volume: safeVol,
      muted,
    };
    this.notify();

    if (
      this.snapshot.engineMode === 'browser-continuous-timeline' &&
      (muted || safeVol <= 0)
    ) {
      this.cancelBrowserSpeechOnly();
    }
  }

  // --- Browser Continuous Timeline Fallback (when server Gemini TTS key is not configured) ---
  private startBrowserContinuousTimeline(): void {
    if (this.fallbackTimerId !== null) {
      window.clearInterval(this.fallbackTimerId);
      this.fallbackTimerId = null;
    }

    const wasPaused =
      this.snapshot.status === 'paused' &&
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      window.speechSynthesis.paused;

    this.snapshot = {
      ...this.snapshot,
      status: 'playing',
    };
    this.notify();

    if (wasPaused) {
      try {
        window.speechSynthesis.resume();
      } catch {
        // Ignore resume error
      }
    } else {
      this.speakFallbackScene(this.snapshot.activeSceneIndex);
    }

    this.fallbackLastTickMs = performance.now();
    this.fallbackTimerId = window.setInterval(() => {
      if (this.snapshot.status !== 'playing') return;
      const now = performance.now();
      const elapsedSec =
        ((now - this.fallbackLastTickMs) / 1000) * this.snapshot.playbackRate;
      this.fallbackLastTickMs = now;

      const nextTime = Math.min(
        this.snapshot.durationSec,
        this.snapshot.currentTimeSec + elapsedSec
      );
      const nextSceneIdx = this.findSceneIndexForTime(
        nextTime,
        this.snapshot.sceneTimeline
      );

      if (
        nextSceneIdx !== this.snapshot.activeSceneIndex &&
        nextSceneIdx !== this.fallbackSpokenSceneIndex
      ) {
        this.speakFallbackScene(nextSceneIdx);
      }

      if (nextTime >= this.snapshot.durationSec) {
        if (this.fallbackTimerId !== null) {
          window.clearInterval(this.fallbackTimerId);
          this.fallbackTimerId = null;
        }
        this.cancelBrowserSpeechOnly();
        this.snapshot = {
          ...this.snapshot,
          currentTimeSec: this.snapshot.durationSec,
          activeSceneIndex: Math.max(0, this.snapshot.sceneTimeline.length - 1),
          status: 'ended',
        };
        this.notify();
        return;
      }

      this.snapshot = {
        ...this.snapshot,
        currentTimeSec: nextTime,
        activeSceneIndex: nextSceneIdx,
      };
      this.notify();
    }, 100);
  }

  private pauseBrowserContinuousTimeline(): void {
    if (this.fallbackTimerId !== null) {
      window.clearInterval(this.fallbackTimerId);
      this.fallbackTimerId = null;
    }
    if (
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      window.speechSynthesis.speaking
    ) {
      try {
        window.speechSynthesis.pause();
      } catch {
        // Ignore pause error
      }
    }
    this.snapshot = {
      ...this.snapshot,
      status: 'paused',
    };
    this.notify();
  }

  private speakFallbackScene(sceneIndex: number): void {
    this.fallbackSpokenSceneIndex = sceneIndex;
    if (
      !this.activeStory ||
      this.snapshot.muted ||
      this.snapshot.volume <= 0 ||
      typeof window === 'undefined' ||
      !('speechSynthesis' in window)
    ) {
      return;
    }

    try {
      const voices = window.speechSynthesis.getVoices() || [];
      const viVoices = voices.filter((v) =>
        (v.lang || '').toLowerCase().startsWith('vi')
      );
      if (viVoices.length === 0) return;

      window.speechSynthesis.cancel();
      const paraText =
        this.activeStory.paragraphs[sceneIndex] ||
        this.activeStory.paragraphs[0] ||
        '';
      if (!paraText) return;

      const utterance = new SpeechSynthesisUtterance(
        normalizeVietnameseTextForTts(paraText)
      );
      utterance.lang = 'vi-VN';
      utterance.volume = Math.max(0, Math.min(1, this.snapshot.volume));
      utterance.rate = Math.max(
        0.75,
        Math.min(1.25, 0.94 * this.snapshot.playbackRate)
      );

      if (this.snapshot.voiceGender === 'male') {
        const maleVoice =
          viVoices.find((v) => /nam|male|minh|an|quang|hieu/i.test(v.name)) ||
          (viVoices.length > 1 ? viVoices[1] : viVoices[0]);
        utterance.voice = maleVoice;
        utterance.pitch = 0.92;
      } else {
        const femaleVoice =
          viVoices.find((v) => /nu|nữ|female|linh|mai|lan|hoai|my/i.test(v.name)) ||
          viVoices[0];
        utterance.voice = femaleVoice;
        utterance.pitch = 1.1;
      }

      window.speechSynthesis.speak(utterance);
    } catch {
      // Ignore speechSynthesis errors
    }
  }

  private cancelBrowserSpeechOnly(): void {
    this.fallbackSpokenSceneIndex = -1;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore cancel error
      }
    }
  }

  private cleanupAudioOnly(): void {
    if (this.abortController) {
      try {
        this.abortController.abort();
      } catch {
        // Ignore abort error
      }
      this.abortController = null;
    }

    if (this.fallbackTimerId !== null) {
      window.clearInterval(this.fallbackTimerId);
      this.fallbackTimerId = null;
    }

    this.cancelBrowserSpeechOnly();

    if (this.audioElement) {
      try {
        this.audioElement.onloadedmetadata = null;
        this.audioElement.ontimeupdate = null;
        this.audioElement.onplay = null;
        this.audioElement.onpause = null;
        this.audioElement.onended = null;
        this.audioElement.onerror = null;
        this.audioElement.pause();
        this.audioElement.removeAttribute('src');
        this.audioElement.load();
      } catch {
        // Ignore cleanup error
      }
      this.audioElement = null;
    }
  }

  public stopAndCleanup(): void {
    this.sessionToken += 1;
    this.cleanupAudioOnly();
    this.activeStory = null;
    this.snapshot = {
      ...this.snapshot,
      storyId: null,
      status: 'idle',
      currentTimeSec: 0,
    };
    this.notify();
  }
}

export const podcastPlaybackController = new PodcastPlaybackController();

export function formatPodcastTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
