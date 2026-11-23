export default function Blob({ className = "" }) {
  return (
    <div
      aria-hidden="true"
      className={`blob ${className}`}
    />
  );
}
