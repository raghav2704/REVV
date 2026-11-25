import type { Metadata } from "next";
import SmartCarFinder from "@/components/SmartCarFinder";

export const metadata: Metadata = {
  title: "Smart Car Finder | REVV",
  description:
    "Find active REVV listings that fit your budget and preferences with free, transparent rule-based matching.",
};
export default function CarFinderPage() {
  return <SmartCarFinder />;
}
