"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { readDraft, type Draft } from "./draft";

type Copy = { confirm_title: string; confirm_button: string; confirm_edit: string; time_label: string; place_label: string; gender_label: string };

// /{type}/birth/confirm — 입력 확인(경고 없음). '처음이에요'를 고른 사람은 고민 쓰기 앞에 살 소개(/about-sal)를 본다.
export default function BirthConfirm({ slug, copy }: { slug: string; copy: Copy }) {
  const router = useRouter();
  const [d, setD] = useState<Draft | null>(null);

  useEffect(() => {
    const x = readDraft();
    if (!x.nickname || !x.birth) {
      router.replace(`/${slug}/birth`);
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setD(x);
  }, [router, slug]);

  if (!d?.birth) return null;
  const b = d.birth;
  const nextHref = d.firstTimer === "처음이에요" ? `/about-sal?next=/${slug}/worry` : `/${slug}/worry`;

  return (
    <div className="pg">
      <h2>{copy.confirm_title}</h2>
      <div className="box">
        <table>
          <tbody>
            <tr>
              <th>{b.calendar}</th>
              <td>
                {b.year}년 {b.month}월 {b.day}일
              </td>
            </tr>
            <tr>
              <th>{copy.time_label}</th>
              <td>{b.timeKnown ? `${b.hour}시 ${b.minute}분` : b.timeSlot}</td>
            </tr>
            <tr>
              <th>{copy.place_label}</th>
              <td>{b.region ?? "-"}</td>
            </tr>
            <tr>
              <th>{copy.gender_label}</th>
              <td>{b.gender}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <Link className="btn" href={nextHref} style={{ textAlign: "center", textDecoration: "none" }}>
        {copy.confirm_button}
      </Link>
      <Link className="btn ghost" href={`/${slug}/birth`} style={{ textAlign: "center", textDecoration: "none" }}>
        {copy.confirm_edit}
      </Link>
    </div>
  );
}
