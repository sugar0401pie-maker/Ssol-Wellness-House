"use client";
// 챌린지 사진은 서버에 올리지 않고 이 기기에만 둔다(요청문 3-4·9-4장). 기기를 바꾸면 사진 자리는 "N일" 칸으로 보인다.
// 큰 사진(720, 카드 다시 만들기용)은 지금 챌린지 것만 두고, 작은 그림(160, 기록 줄용)은 계속 둔다. 저장소가 막혀도 화면은 그대로 동작한다.
const P = "ssol.chal";
const k = (kind: "full" | "thumb", cid: string, n: number) => `${P}.${kind}.${cid}.${n}`;

function get(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function set(key: string, v: string): boolean {
  try {
    window.localStorage.setItem(key, v);
    return true;
  } catch {
    return false;
  }
}

function scaled(src: HTMLCanvasElement, size: number, q: number): string {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  c.getContext("2d")?.drawImage(src, 0, 0, size, size);
  return c.toDataURL("image/jpeg", q);
}

export function savePhoto(cid: string, n: number, photo: HTMLCanvasElement) {
  set(k("thumb", cid, n), scaled(photo, 160, 0.72));
  set(k("full", cid, n), scaled(photo, 720, 0.82));
  prune(cid);
}
export const loadPhoto = (cid: string, n: number): string | null => (typeof window === "undefined" ? null : get(k("full", cid, n)));
export const loadThumb = (cid: string, n: number): string | null => (typeof window === "undefined" ? null : get(k("thumb", cid, n)));

// 다른 챌린지의 큰 사진은 지운다(용량 아끼기). 작은 그림은 남긴다.
function prune(keepCid: string) {
  try {
    const ls = window.localStorage;
    for (let i = ls.length - 1; i >= 0; i--) {
      const key = ls.key(i);
      if (key && key.startsWith(`${P}.full.`) && !key.startsWith(`${P}.full.${keepCid}.`)) ls.removeItem(key);
    }
  } catch {
    /* 저장소를 못 쓰면 그냥 둔다 */
  }
}
