const Icon = ({ className, children, strokeWidth = 2 }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {children}
  </svg>
);

export const UploadCloudIcon = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    aria-hidden="true"
    focusable="false"
  >
    <path
      fill="currentColor"
      d="M7 19a5 5 0 0 1-.9-9.92 6.5 6.5 0 0 1 12.48 1.4A4.25 4.25 0 0 1 17.75 19Z"
    />
    <path
      d="M12 16v-6m-2.75 2.5L12 9.75l2.75 2.75"
      fill="none"
      stroke="#0b0f17"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const FileIcon = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    aria-hidden="true"
    focusable="false"
  >
    <path
      fill="currentColor"
      d="M6 2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z"
    />
    <path fill="rgb(0 0 0 / 0.25)" d="M14 2v4a2 2 0 0 0 2 2h4Z" />
  </svg>
);

export const FilePlusIcon = ({ className }) => (
  <Icon className={className}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
    <path d="M14 3v5h5M12 11v6M9 14h6" />
  </Icon>
);

export const ArrowsIcon = ({ className }) => (
  <Icon className={className}>
    <path d="M20 11a8 8 0 0 0-14.9-3.5M4 4v4h4" />
    <path d="M4 13a8 8 0 0 0 14.9 3.5M20 20v-4h-4" />
  </Icon>
);

export const DownloadIcon = ({ className }) => (
  <Icon className={className}>
    <path d="M12 4v11m-4.5-4.5L12 15l4.5-4.5M5 20h14" />
  </Icon>
);

export const CopyIcon = ({ className }) => (
  <Icon className={className}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V6a2 2 0 0 1 2-2h9" />
  </Icon>
);

export const CheckIcon = ({ className }) => (
  <Icon className={className}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Icon>
);

export const CloseIcon = ({ className }) => (
  <Icon className={className}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
);

export const LayersIcon = ({ className }) => (
  <Icon className={className}>
    <path d="m12 3 9 5-9 5-9-5Z" />
    <path d="m3 13 9 5 9-5" />
  </Icon>
);

export const Spinner = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    className={`animate-spin motion-reduce:animate-none ${className ?? ""}`}
    aria-hidden="true"
    focusable="false"
  >
    <circle
      cx="12"
      cy="12"
      r="9"
      fill="none"
      stroke="currentColor"
      strokeOpacity="0.25"
      strokeWidth="3"
    />
    <path
      d="M21 12a9 9 0 0 0-9-9"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
    />
  </svg>
);
