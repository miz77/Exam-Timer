// src/lib/presets.ts
export interface Preset {
  start: string
  end:   string
}

export const presets: Record<string,Preset> = {
  '電工二種・技能試験': { start: '11:30', end: '12:10' },
  // 他のプリセットもいつかここに追加しようと思うけど、数が増えてくると現状のUIではだめそうということに気づいてしまった。
}