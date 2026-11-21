import { redirect } from "next/navigation";

/** Keep old Portfolio links working without showing a redundant Writing landing page. */
export default function WritingRedirect() {
  redirect("/portfolio/words");
}
