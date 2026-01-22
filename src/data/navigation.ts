import GridIcon from "../icons/grid2.svg";
import SubgridIcon from "../icons/subgrid2.svg";
import FlexboxIcon from "../icons/flex.svg";
import SdaIcon from "../icons/scrolling.svg";

export interface NavItem {
  href: string;
  text: string;
  longText?: string;
  icon: typeof GridIcon;
  collection: "grid" | "subgrid" | "flexbox" | "sda";
  separator?: boolean;
}

export const navItems: NavItem[] = [
  { href: "/grid", text: "Grid", icon: GridIcon, collection: "grid" },
  {
    href: "/subgrid",
    text: "Subgrid",
    icon: SubgridIcon,
    collection: "subgrid",
  },
  { href: "/flex", text: "Flexbox", icon: FlexboxIcon, collection: "flexbox" },
  {
    href: "/sda",
    text: "Scroll",
    longText: "Scroll Animations",
    icon: SdaIcon,
    collection: "sda",
    separator: true,
  },
];

export type Exercise = {
  id: string;
  data: { title: string; draft?: boolean };
};

export const isCurrentPath = (pathname: string, href: string): boolean =>
  pathname.replace(/\/$/, "").startsWith(href);
