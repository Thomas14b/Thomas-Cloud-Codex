import { colors } from "./data";
export function Monster({
  index = 0,
  size = 100,
}: {
  index?: number;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 160 160"
      aria-hidden="true"
      className="monster"
    >
      <ellipse cx="80" cy="142" rx="43" ry="8" fill="#254f4218" />
      <path
        d={
          index % 2
            ? "M34 93Q20 66 43 59L40 22Q63 17 73 54L88 52Q97 16 117 22L115 62Q141 79 126 112Q112 140 77 138Q39 141 34 93"
            : "M29 100Q17 66 43 60Q40 33 60 34L78 49Q110 21 122 44L119 64Q144 81 130 109Q116 140 77 138Q40 142 29 100"
        }
        fill={colors[index % 6]}
        stroke="#254f42"
        strokeWidth="3"
      />
      <ellipse cx="60" cy="86" rx="5" ry="7" fill="#254f42" />
      <ellipse cx="101" cy="86" rx="5" ry="7" fill="#254f42" />
      <path
        d="M68 107Q80 119 92 107"
        fill="none"
        stroke="#254f42"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <ellipse cx="45" cy="101" rx="9" ry="5" fill="#e9958a" opacity=".65" />
      <ellipse cx="116" cy="101" rx="9" ry="5" fill="#e9958a" opacity=".65" />
    </svg>
  );
}
