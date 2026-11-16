import React, { type ReactNode, type SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function svg(props: IconProps, children: ReactNode) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      {children}
    </svg>
  );
}

export function IconOverview(props: IconProps) {
  return svg(props, <><path d="M4 11 12 4l8 7" /><path d="M6 10.5V20h12v-9.5" /></>);
}

export function IconRuns(props: IconProps) {
  return svg(props, <><path d="M8 6v12l10-6-10-6Z" /></>);
}

export function IconHistory(props: IconProps) {
  return svg(props, <><circle cx="12" cy="12" r="8" /><path d="M12 8v5l3 2" /></>);
}

export function IconProjects(props: IconProps) {
  return svg(props, <><path d="M3 7h6l2 2h10v10H3Z" /><path d="M3 7V5h5l2 2" /></>);
}

export function IconSettings(props: IconProps) {
  return svg(
    props,
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4" />
    </>,
  );
}

export function IconDevice(props: IconProps) {
  return svg(props, <><rect x="8" y="3" width="8" height="18" rx="2" /><path d="M11 18h2" /></>);
}

export function IconCli(props: IconProps) {
  return svg(props, <><path d="M5 7 9 12 5 17" /><path d="M11 17h8" /></>);
}

export function IconFlask(props: IconProps) {
  return svg(props, <><path d="M9 3h6M10 3v6L5 19a2 2 0 0 0 1.7 3h10.6A2 2 0 0 0 19 19L14 9V3" /></>);
}

export function IconCheck(props: IconProps) {
  return svg(props, <><circle cx="12" cy="12" r="8" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>);
}

export function IconCross(props: IconProps) {
  return svg(props, <><circle cx="12" cy="12" r="8" /><path d="m9 9 6 6M15 9l-6 6" /></>);
}

export function IconClock(props: IconProps) {
  return svg(props, <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>);
}

export function IconShield(props: IconProps) {
  return svg(props, <><path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z" /></>);
}

export function IconLink(props: IconProps) {
  return svg(props, <><path d="M9 12a4 4 0 0 0 6 0l2-2a4 4 0 1 0-6-6l-1 1" /><path d="M15 12a4 4 0 0 0-6 0l-2 2a4 4 0 1 0 6 6l1-1" /></>);
}

export function IconScripts(props: IconProps) {
  return svg(props, <><path d="M7 4h7l4 4v12H7Z" /><path d="M14 4v4h4" /></>);
}

export function IconAlert(props: IconProps) {
  return svg(props, <><path d="M12 4 3 20h18L12 4Z" /><path d="M12 10v5M12 17h.01" /></>);
}

export function IconSearch(props: IconProps) {
  return svg(props, <><circle cx="11" cy="11" r="6" /><path d="m20 20-4-4" /></>);
}

export function IconChevron(props: IconProps) {
  return svg(props, <path d="m6 9 6 6 6-6" />);
}

export function IconHelp(props: IconProps) {
  return svg(props, <><circle cx="12" cy="12" r="8" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.8.4-1.4.9-1.4 1.7M12 17h.01" /></>);
}

export function IconArrow(props: IconProps) {
  return svg(props, <path d="M5 12h14M13 6l6 6-6 6" />);
}

export function IconSun(props: IconProps) {
  return svg(props, <><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" /></>);
}

export function IconMoon(props: IconProps) {
  return svg(props, <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4 7 7 0 0 0 20 14.5Z" />);
}
