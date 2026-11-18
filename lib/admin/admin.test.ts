import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { adminEmails, isAdminUser, DEFAULT_ADMIN_EMAIL } from "./config.ts";
import { deriveAdminSecret, issueAdminToken, passwordMatches, verifyAdminToken } from "./token.ts";
import { kstDateTime, parseRange } from "./range.ts";
import { maskContacts, normalizeUserCode, pseudonymCode } from "./privacy.ts";

describe("관리자 판별", () => {
  const kakao = { email: DEFAULT_ADMIN_EMAIL, app_metadata: { provider: "kakao", providers: ["kakao"] } };
  test("지정한 이메일 + 카카오 가입 계정만 관리자", () => {
    assert.equal(isAdminUser(kakao), true);
    assert.equal(isAdminUser({ ...kakao, email: "SeoTaiJi0124@Naver.com " }), true); // 대소문자·공백 무시
  });
  test("같은 이메일이어도 카카오 가입이 아니면 거부(이메일·비밀번호 가입 등)", () => {
    assert.equal(isAdminUser({ email: DEFAULT_ADMIN_EMAIL, app_metadata: { provider: "email", providers: ["email"] } }), false);
  });
  test("다른 이메일·익명·값 없음은 거부", () => {
    assert.equal(isAdminUser({ ...kakao, email: "someone@naver.com" }), false);
    assert.equal(isAdminUser({ ...kakao, is_anonymous: true }), false);
    assert.equal(isAdminUser({ app_metadata: { provider: "kakao" } }), false);
    assert.equal(isAdminUser(null), false);
    assert.equal(isAdminUser(undefined), false);
  });
  test("identities에 kakao가 있어도 인정, ADMIN_EMAILS로 목록을 바꿀 수 있다", () => {
    assert.equal(isAdminUser({ email: DEFAULT_ADMIN_EMAIL, identities: [{ provider: "kakao" }] }), true);
    assert.deepEqual(adminEmails({}), [DEFAULT_ADMIN_EMAIL]);
    assert.deepEqual(adminEmails({ ADMIN_EMAILS: " A@x.com , ,b@x.com" }), ["a@x.com", "b@x.com"]);
    assert.equal(isAdminUser({ email: "a@x.com", app_metadata: { provider: "kakao" } }, adminEmails({ ADMIN_EMAILS: "a@x.com" })), true);
  });
});

describe("관리자 암호·표", () => {
  const secret = deriveAdminSecret("service-key", "pw-1234");
  const now = 1_700_000_000_000;
  test("암호 비교: 같으면 통과, 다르거나 서버에 설정이 없으면 거부", () => {
    assert.equal(passwordMatches("pw-1234", "pw-1234"), true);
    assert.equal(passwordMatches("pw-12345", "pw-1234"), false);
    assert.equal(passwordMatches("", "pw-1234"), false);
    assert.equal(passwordMatches("anything", undefined), false);
    assert.equal(passwordMatches("", undefined), false);
    assert.equal(passwordMatches("", ""), false);
  });
  test("표: 발급 직후엔 유효, 같은 사용자만, 만료되면 무효", () => {
    const t = issueAdminToken("user-1", secret, now, 30);
    assert.equal(verifyAdminToken(t, "user-1", secret, now + 1000), true);
    assert.equal(verifyAdminToken(t, "user-2", secret, now + 1000), false);
    assert.equal(verifyAdminToken(t, "user-1", secret, now + 31 * 60_000), false);
  });
  test("표를 바꾸거나 다른 비밀·빈 값이면 무효", () => {
    const t = issueAdminToken("user-1", secret, now, 30);
    const [uid, , sig] = t.split(".");
    assert.equal(verifyAdminToken(`${uid}.${now + 999_999_999}.${sig}`, "user-1", secret, now), false); // 만료를 늘려 봐도 서명이 안 맞음
    assert.equal(verifyAdminToken(t, "user-1", deriveAdminSecret("service-key", "other-pw"), now), false); // 암호를 바꾸면 기존 표 무효
    assert.equal(verifyAdminToken("", "user-1", secret, now), false);
    assert.equal(verifyAdminToken(null, "user-1", secret, now), false);
    assert.equal(verifyAdminToken("a.b", "user-1", secret, now), false);
    assert.equal(verifyAdminToken(t, "user-1", "", now), false);
  });
  test("서비스 키나 암호가 없으면 비밀이 빈 값 → 표가 통하지 않는다", () => {
    assert.equal(deriveAdminSecret(undefined, "pw"), "");
    assert.equal(deriveAdminSecret("k", undefined), "");
  });
});

describe("기간(한국 시간)", () => {
  test("빈 칸은 전체 기간", () => {
    const r = parseRange("", "");
    assert.ok(r.ok && r.range.fromIso === null && r.range.toIso === null && r.range.label.startsWith("전체"));
  });
  test("끝 날짜는 그날 하루 전체를 포함(다음 날 0시 KST 미만)", () => {
    const r = parseRange("2026-11-01", "2026-11-17");
    assert.ok(r.ok);
    if (r.ok) {
      assert.equal(r.range.fromIso, "2026-10-31T15:00:00.000Z");
      assert.equal(r.range.toIso, "2026-11-17T15:00:00.000Z");
    }
  });
  test("잘못된 날짜·뒤바뀐 순서는 오류", () => {
    assert.equal(parseRange("2026-13-01", "").ok, false);
    assert.equal(parseRange("2026-02-30", "").ok, false);
    assert.equal(parseRange("11/01", "").ok, false);
    assert.equal(parseRange("2026-11-17", "2026-11-01").ok, false);
  });
  test("한쪽만 입력", () => {
    const a = parseRange("2026-11-01", "");
    assert.ok(a.ok && a.range.fromIso !== null && a.range.toIso === null);
    const b = parseRange("", "2026-11-01");
    assert.ok(b.ok && b.range.fromIso === null && b.range.toIso !== null);
  });
  test("한국 시간 표기", () => {
    assert.equal(kstDateTime("2026-11-17T15:30:00.000Z"), "2026-11-18 00:30");
    assert.equal(kstDateTime(null), "");
    assert.equal(kstDateTime("not-a-date"), "");
  });
});

describe("종합 내보내기용 식별 줄이기", () => {
  test("같은 계정은 같은 코드, 다른 계정·다른 비밀이면 다른 코드, 원래 id가 드러나지 않는다", () => {
    const a = pseudonymCode("11111111-aaaa", "s1");
    assert.equal(a, pseudonymCode("11111111-aaaa", "s1"));
    assert.notEqual(a, pseudonymCode("22222222-bbbb", "s1"));
    assert.notEqual(a, pseudonymCode("11111111-aaaa", "s2"));
    assert.match(a, /^U-[0-9A-F]{8}$/);
    assert.equal(a.includes("1111"), false);
  });
  test("글 속 이메일·전화번호·주민번호를 가린다", () => {
    const t = maskContacts("제 번호는 010-1234-5678이고 메일은 abc.def@gmail.com, 주민번호 900101-1234567 입니다. 1234 5678 같은 일반 숫자는 그대로.");
    assert.ok(t.includes("[전화번호]") && t.includes("[이메일]") && t.includes("[주민번호]"));
    assert.equal(/010-1234|gmail|1234567/.test(t), false);
    assert.ok(t.includes("1234 5678"));
  });
});

describe("이용자 코드 검색", () => {
  test("코드 모양을 정리한다(대소문자·공백·U- 생략 허용)", () => {
    assert.equal(normalizeUserCode("U-1A2B3C4D"), "U-1A2B3C4D");
    assert.equal(normalizeUserCode("  u-1a2b3c4d "), "U-1A2B3C4D");
    assert.equal(normalizeUserCode("u1a2b3c4d"), "U-1A2B3C4D");
    assert.equal(normalizeUserCode("1A2B3C4D"), "U-1A2B3C4D");
  });
  test("코드가 아니면 null — 이메일·이름 검색으로 넘어간다", () => {
    for (const q of ["홍길동", "abc@gmail.com", "U-1A2B3C4", "U-1A2B3C4D5", "U-ZZZZZZZZ", ""]) assert.equal(normalizeUserCode(q), null, q);
  });
  test("종합 내보내기에서 만든 코드를 그대로 넣으면 같은 코드로 정리된다", () => {
    const c = pseudonymCode("11111111-aaaa", "s1");
    assert.equal(normalizeUserCode(c.toLowerCase()), c);
  });
});
