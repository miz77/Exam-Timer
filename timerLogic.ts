export type TimerStatus = 'idle' | 'readying' | 'running' | 'finished';


export interface TimerState {
  status: TimerStatus;
  /** 経過時間（秒）。準備時間中はマイナス値。 */
  elapsedSeconds: number;
  /** 試験の総時間（秒） */
  totalDurationSeconds: number;
  /** 画面に表示する時刻 (時) */
  displayHour: number;
  /** 画面に表示する時刻 (分) */
  displayMinute: number;
  /** 画面に表示する時刻 (秒) */
  displaySecond: number;
}

// --- コアロジッククラス ---

export class ExamTimer {
  // --- 状態管理 ---
  private status: TimerStatus = 'idle';
  private startTime: { h: number; m: number } = { h: 9, m: 0 };
  private endTime: { h: number; m: number } = { h: 10, m: 30 };
  private readyTimeSeconds: number = 10;
  private totalDurationSeconds: number = 0;
  private elapsedSeconds: number = 0;

  private timerId: number | null = null;

  // --- UIへの通知用コールバック ---
  private onUpdate: (state: TimerState) => void;
  
  /**
   * 現在のタイマーの状態取得。
   */
  public get currentStatus(): TimerStatus {
    return this.status;
  }

  /**
   * @param onUpdate UIを更新するためのコールバック関数
   */
  constructor(onUpdate: (state: TimerState) => void) {
    this.onUpdate = onUpdate;
    this.calculateTotalDuration();
    this.broadcastState(); // 初期状態を通知
  }

  /**
   * 試験の開始時刻と終了時刻を設定
   * @param startH 開始時刻（時）
   * @param startM 開始時刻（分）
   * @param endH 終了時刻（時）
   * @param endM 終了時刻（分）
   */
  public setExamTimes(startH: number, startM: number, endH: number, endM: number) {
    this.startTime = { h: startH, m: startM };
    this.endTime = { h: endH, m: endM };
    this.calculateTotalDuration();
    this.reset(); // 時間が変更されたらリセット
  }

  /**
   * 準備時間を設定
   * @param seconds 準備時間（秒）
   */
  public setReadyTime(seconds: number) {
    this.readyTimeSeconds = seconds;
    if (this.status === 'idle') {
        this.broadcastState();
    }
  }

  /**
   * タイマーを開始
   */
  public start() {
    if (this.status !== 'idle') return;

    if (this.totalDurationSeconds <= 0) {
      // 不正な時間（開始時刻 = 終了時刻）をUIへ通知
      window.dispatchEvent(new CustomEvent('exam-timer-error', {
        detail: { code: 'INVALID_TIME_RANGE' }
      }));
      console.error("終了時刻は開始時刻と等しいか、それ以前に設定されています。");
      return;
    }

    this.status = this.readyTimeSeconds > 0 ? 'readying' : 'running';
    this.elapsedSeconds = -this.readyTimeSeconds;

    // 1秒ごとにtickメソッドを呼び出す setTimeoutではなくsetInterval. えらいメモリ食ったことがあるため
    this.timerId = window.setInterval(() => this.tick(), 1000);
    this.broadcastState();
  }

  /**
   * タイマーをリセットする
   */
  public reset() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.status = 'idle';
    this.elapsedSeconds = 0;
    this.broadcastState();
  }

  /**
   * 1秒ごとの処理
   */
  private tick() {
    this.elapsedSeconds++;

    if (this.status === 'readying' && this.elapsedSeconds >= 0) {
      this.status = 'running';
    }

    if (this.elapsedSeconds >= this.totalDurationSeconds) {
      this.status = 'finished';
      if (this.timerId) {
        clearInterval(this.timerId);
        this.timerId = null;
      }
    }
    
    this.broadcastState();
  }
  
  /**
   * 試験の総時間を計算する
   */
  private calculateTotalDuration() {
    const startTotalSeconds = this.startTime.h * 3600 + this.startTime.m * 60;
    let endTotalSeconds = this.endTime.h * 3600 + this.endTime.m * 60;

    // 終了時刻が開始時刻より前の場合、日付をまたいだと判断
    if (endTotalSeconds < startTotalSeconds) {
      endTotalSeconds += 24 * 3600; // 24時間分の秒数を加算
    }

    this.totalDurationSeconds = endTotalSeconds - startTotalSeconds;
  }

  /**
   * 現在の状態をUIに通知する
   */
  private broadcastState() {
    const totalMinutes = (this.startTime.h * 60 + this.startTime.m) + (this.elapsedSeconds / 60);
    
    const h = Math.floor(totalMinutes / 60) % 24;
    const m = Math.floor(totalMinutes % 60);
    // 秒針の計算はUI側で行うため、ここでは単純な表示用の秒数を渡す
    const s = this.elapsedSeconds >= 0 ? this.elapsedSeconds % 60 : 0;
    
    const state: TimerState = {
      status: this.status,
      elapsedSeconds: this.elapsedSeconds,
      totalDurationSeconds: this.totalDurationSeconds,
      displayHour: h < 0 ? this.startTime.h : h,
      displayMinute: m < 0 ? this.startTime.m : m,
      displaySecond: s,
    };
    
    // 登録されたコールバック関数を実行してUIに通知
    this.onUpdate(state);
  }
}