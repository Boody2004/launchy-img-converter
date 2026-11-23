import { useId } from "react";

export default function Logo({ className }) {
  const id = useId();
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient
          id={`${id}a`}
          x1="0"
          y1="34"
          x2="0"
          y2="56.75"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#0a4fb8" stopOpacity="0" />
          <stop offset="1" stopColor="#0a4fb8" stopOpacity="0.55" />
        </linearGradient>
        <linearGradient
          id={`${id}b`}
          x1="0"
          y1="43"
          x2="0"
          y2="20.25"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#0a4fb8" stopOpacity="0" />
          <stop offset="1" stopColor="#0a4fb8" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      <g transform="translate(50 -4.5) rotate(45)" fill="#1a8cff">
        <path d="M0 8.3H20.25V56.75H68.7V77H15A15 15 0 0 1 0 62Z" />
        <path d="M77 68.7H56.75V20.25H8.3V0H62A15 15 0 0 1 77 15Z" />
        <rect x="0" y="34" width="20.25" height="22.75" fill={`url(#${id}a)`} />
        <rect x="56.75" y="20.25" width="20.25" height="22.75" fill={`url(#${id}b)`} />
      </g>
    </svg>
  );
}
