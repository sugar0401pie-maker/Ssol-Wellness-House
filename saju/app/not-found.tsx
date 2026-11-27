import Link from "next/link";

export default function NotFound() {
  return (
    <div className="pg center" style={{ paddingTop: 48 }}>
      <h2>찾는 화면이 없어요</h2>
      <Link className="btn" href="/" style={{ textDecoration: "none" }}>
        처음으로
      </Link>
    </div>
  );
}
