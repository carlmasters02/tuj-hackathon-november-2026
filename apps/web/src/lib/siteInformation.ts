export const REPOSITORY_URL = "https://github.com/carlmasters02/tuj-hackathon-november-2026";
export const LEGAL_LAST_UPDATED = "22 November 2026";

export const LEGAL_LINKS = [
  { href: "/legal/terms", label: "Terms of Use" },
  { href: "/legal/privacy", label: "Privacy Policy" },
  { href: "/legal/cookies", label: "Cookie Policy" },
  { href: "/legal/accessibility", label: "Accessibility" },
  { href: "/legal/copyright", label: "Copyright & Content" },
] as const;

export type Developer = {
  id: string;
  name: string;
  initials: string;
  role: string;
  bio: string;
  /** Path under /public; omit to show the initials tile instead. */
  photo?: string;
  /** Public profiles, shown as links on the card. */
  links?: readonly DeveloperLink[];
};

export type DeveloperLink = { kind: "linkedin" | "github" | "website"; href: string };

/** The four Humagination developers, shown in this order on /about/developers. */
export const DEVELOPERS: readonly Developer[] = [
  {
    id: "carl-masters",
    name: "Carl Masters",
    initials: "CM",
    role: "Cybersecurity student · Temple University Japan",
    bio: "Hello everyone, I'm Carl, a Cybersecurity student at Temple University Japan. I am passionate about security and AI and I aim to help with the development of secure software and the responsible and safe development of AI.",
    photo: "/developers/carl-masters.jpg",
    links: [
      { kind: "linkedin", href: "https://www.linkedin.com/in/carl-masters-724951297/" },
      { kind: "github", href: "https://github.com/carlmasters02" },
      { kind: "website", href: "https://carlmasters.com/" },
    ],
  },
  {
    id: "bristy-das",
    name: "Bristy Das",
    initials: "BD",
    role: "Computer Science student · Temple University Japan",
    bio: "I'm a Computer Science student at Temple University Japan, passionate about technology and creativity. I enjoy exploring new ideas, learning through hands-on projects, and using technology to bring people together.",
    photo: "/developers/bristy-das.jpg",
    links: [
      { kind: "linkedin", href: "https://www.linkedin.com/in/bristy-das-604291286/" },
    ],
  },
  {
    id: "rishika-bajaj",
    name: "Rishika Bajaj",
    initials: "RB",
    role: "Computer Science student · Temple University Japan",
    bio: "Hi I'm Rishika, a Computer Science student at Temple University Japan Campus. I enjoy exploring new technologies, and solving problems. I'm particularly interested in AI and always curious to learn new things and experiment with ideas.",
    photo: "/developers/rishika-bajaj.jpg",
    links: [
      { kind: "linkedin", href: "https://www.linkedin.com/in/rishika-bajaj-148673373/" },
    ],
  },
  {
    id: "marquine-silva",
    name: "Marquine Silva",
    initials: "MS",
    role: "Computer Science student · Temple University Japan",
    bio: "Hi, I am Marquine, majoring in Computer Science at Temple University Japan Campus. My interests are centered around data science and AI, and I enjoy problem-solving.",
    photo: "/developers/marquine-silva.jpg",
  },
];
