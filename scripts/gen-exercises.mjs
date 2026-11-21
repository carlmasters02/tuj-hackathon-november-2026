#!/usr/bin/env node
// Emits packages/shared/problems/code/<lang>/*.json from the hand-written curriculum below.
// Re-run after editing: node scripts/gen-exercises.mjs
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(import.meta.url), "..", "..", "packages", "shared", "problems", "code");
const T = (stdin, expectedStdout, hidden = false) => ({ stdin, expectedStdout, hidden });
const LOOP = { python: "\\b(for|while)\\b", c: "\\b(for|while|do)\\b", java: "\\b(for|while|do)\\b" };

// Shared problems: same statement and tests in every language.
const SHARED = [
  {
    slug: "sum-two", concept: "io-variables", difficulty: 1, title: "Sum of two numbers",
    prompt: "Read two integers from one line (separated by a space) and print their sum.\n\n**Input:** `3 4`  \n**Output:** `7`",
    tests: [T("3 4", "7"), T("-5 10", "5"), T("1000000 2000000", "3000000", true), T("0 0", "0", true)],
    hints: ["First get the whole line, then split it into two pieces.", "Each piece is text until you convert it to a number.", "Print only the number — no extra words, no prompt text."],
  },
  {
    slug: "even-odd", concept: "conditionals", difficulty: 1, title: "Even or odd",
    prompt: "Read one integer and print `even` if it is even, otherwise `odd`. Negative numbers and zero count too.",
    tests: [T("4", "even"), T("7", "odd"), T("-3", "odd", true), T("0", "even", true)],
    hints: ["The remainder after dividing by 2 tells you the answer.", "Zero is even.", "Careful with negative numbers: in some languages the remainder of a negative number is negative. Compare with 0 rather than with 1."],
  },
  {
    slug: "sum-to-n", concept: "loops", difficulty: 1, title: "Add up 1 to n",
    prompt: "Read a non-negative integer `n` and print `1 + 2 + … + n` (print `0` when `n` is 0). Use a loop — that's the point of this exercise.",
    tests: [T("5", "15"), T("1", "1"), T("0", "0", true), T("100", "5050", true)],
    required: { all: { regex: LOOP, message: "Use a loop to add the numbers one at a time." } },
    hints: ["You need a running total that starts at 0.", "The loop variable should take every value from 1 up to and including n.", "If n is 0 the loop should not run at all — check your loop condition."],
  },
  {
    slug: "temperature", concept: "functions", difficulty: 1, title: "Celsius to Fahrenheit",
    prompt: "Write a **function** that converts Celsius to Fahrenheit (`F = C × 9/5 + 32`). Read a Celsius value (may have decimals), call your function, and print the result with exactly one decimal place.\n\n**Input:** `100`  \n**Output:** `212.0`",
    tests: [T("100", "212.0"), T("0", "32.0"), T("-40", "-40.0", true), T("36.6", "97.9", true)],
    required: {
      python: { regex: "def\\s+\\w+\\s*\\(", message: "Define a function with def and use it." },
      c: { regex: "\\b(double|float)\\s+(?!main\\b)\\w+\\s*\\([^)]*\\)\\s*\\{", message: "Write a function (other than main) that returns a double." },
      java: { regex: "static\\s+(double|float)\\s+\\w+\\s*\\(", message: "Write a static method that returns a double." },
    },
    hints: ["Read the input as a decimal number, not an integer.", "Watch out for integer division: 9/5 is 1 in C and Java. Make at least one side a decimal.", "Format the output to one decimal place instead of printing the raw value."],
  },
  {
    slug: "largest", concept: "arrays", difficulty: 2, title: "Largest number",
    prompt: "The first line is `n` (≥ 1). The second line holds `n` integers. Print the largest one. Find it with your own loop — no built-in max or sort.",
    tests: [T("5\n3 9 2 7 4", "9"), T("3\n-1 -5 -3", "-1"), T("1\n42", "42", true), T("6\n0 0 0 0 0 1", "1", true)],
    forbidden: {
      python: { regex: "\\bmax\\s*\\(|\\bsorted\\s*\\(|\\.sort\\s*\\(", message: "Find the largest value with your own loop instead of max/sort." },
      java: { regex: "Arrays\\.sort|Collections\\.(max|sort)|\\.stream\\s*\\(", message: "Find the largest value with your own loop instead of sort/streams." },
    },
    hints: ["Keep track of the biggest value you've seen so far.", "What should 'biggest so far' start as? Starting at 0 breaks when every number is negative.", "Start with the first element, then compare every other element with it."],
  },
  {
    slug: "vowels", concept: "strings", difficulty: 1, title: "Count the vowels",
    prompt: "Read one line of text and print how many vowels (`a e i o u`, upper or lower case) it contains.",
    tests: [T("Hello World", "3"), T("AEIOU aeiou", "10"), T("rhythm", "0", true), T("Programming in C is fun", "6", true)],
    hints: ["Read the whole line, including spaces.", "Look at one character at a time.", "Upper-case vowels count too — convert each character to lower case before checking, or check both."],
  },
  {
    slug: "rectangle", concept: "structs-classes", difficulty: 2, title: "Rectangle",
    prompt: "Read width and height (integers). Store them in a **struct/class** that can compute area and perimeter, then print:\n\n```\narea 12\nperimeter 14\n```",
    tests: [T("3 4", "area 12\nperimeter 14"), T("5 5", "area 25\nperimeter 20"), T("1 10", "area 10\nperimeter 22", true), T("7 2", "area 14\nperimeter 18", true)],
    required: {
      python: { regex: "class\\s+\\w+", message: "Define a class to hold the rectangle." },
      c: { regex: "struct\\s+\\w+\\s*\\{", message: "Define a struct to hold the rectangle." },
      java: { regex: "class\\s+(?!Main\\b)\\w+", message: "Define a separate class (not Main) for the rectangle." },
    },
    hints: ["The struct/class needs two fields: width and height.", "Perimeter is the distance all the way around: two widths plus two heights.", "Output format matters: a lowercase word, one space, the number."],
  },
  {
    slug: "factorial", concept: "recursion", difficulty: 2, title: "Recursive factorial",
    prompt: "Read `n` (0 ≤ n ≤ 12) and print `n!`. Solve it **recursively** — loops are not allowed.",
    tests: [T("5", "120"), T("0", "1"), T("10", "3628800", true), T("12", "479001600", true)],
    forbidden: { all: { regex: LOOP, message: "No loops here — the function should call itself instead." } },
    hints: ["Every recursive function needs a base case that returns without calling itself.", "What is 0! ? That's your base case.", "n! can be written using (n-1)!."],
  },
  {
    slug: "grade-calculator", concept: "mini-project", difficulty: 2, title: "Mini project: grade calculator",
    prompt: "First line: `n`. Second line: `n` scores (0–100). Print the average with one decimal, then the letter grade for that average (A ≥ 90, B ≥ 80, C ≥ 70, D ≥ 60, otherwise F):\n\n```\naverage 84.0\ngrade B\n```",
    tests: [T("3\n90 85 77", "average 84.0\ngrade B"), T("2\n59 60", "average 59.5\ngrade F"), T("1\n100", "average 100.0\ngrade A", true), T("5\n70 71 72 73 74", "average 72.0\ngrade C", true), T("3\n60 61 59", "average 60.0\ngrade D", true), T("4\n100 100 95 91", "average 96.5\ngrade A", true)],
    hints: ["Add up the scores first, then divide by n — as a decimal division.", "Check the grade boundaries from the top (A) down so the first match wins.", "59.5 is still below 60."],
  },
  {
    slug: "text-stats", concept: "mini-project", difficulty: 3, title: "Mini project: text statistics",
    prompt: "Read all lines until the end of input. Print the number of lines, words (separated by whitespace), characters (not counting newlines) and the longest word (the first one if there's a tie):\n\n```\nlines 2\nwords 6\nchars 25\nlongest hello\n```\nA final newline at the end of the input does not start a new line. Empty lines count as lines.",
    tests: [T("hello world\nthis is a test", "lines 2\nwords 6\nchars 25\nlongest hello"), T("one", "lines 1\nwords 1\nchars 3\nlongest one"), T("a bb ccc\n\ndddd e", "lines 3\nwords 5\nchars 14\nlongest dddd", true), T("  spaced   out  ", "lines 1\nwords 2\nchars 16\nlongest spaced", true)],
    hints: ["Read line by line until there's no more input.", "Splitting on whitespace handles several spaces in a row; splitting on a single space doesn't.", "Only replace the longest word when a new word is strictly longer."],
  },
  {
    slug: "bank-account", concept: "mini-project", difficulty: 3, title: "Mini project: bank account",
    prompt: "The first line is the starting balance. Each following line is a command until the end of input:\n\n- `deposit X` — add X\n- `withdraw X` — subtract X, but if X is more than the balance print `insufficient funds` and change nothing\n- `balance` — print `balance B`\n\nIf X ≤ 0 for deposit or withdraw, print `invalid amount` and change nothing. Model the account as a **class/struct**.",
    tests: [T("100\ndeposit 50\nwithdraw 30\nbalance", "balance 120"), T("10\nwithdraw 20\nbalance\ndeposit -5\nbalance", "insufficient funds\nbalance 10\ninvalid amount\nbalance 10"), T("0\ndeposit 1000\nwithdraw 1000\nbalance\nwithdraw 1\nbalance", "balance 0\ninsufficient funds\nbalance 0", true), T("500\nbalance", "balance 500", true)],
    required: {
      python: { regex: "class\\s+\\w+", message: "Model the account as a class." },
      c: { regex: "struct\\s+\\w+\\s*\\{", message: "Model the account as a struct." },
      java: { regex: "class\\s+(?!Main\\b)\\w+", message: "Model the account as its own class." },
    },
    hints: ["Read the first line separately, then loop over the remaining lines.", "Split each command line into the command word and (maybe) an amount.", "Check for invalid amounts before checking for insufficient funds."],
  },
];

const EXTRA = {
  python: {
    slug: "fizzbuzz", concept: "loops", difficulty: 2, title: "FizzBuzz",
    prompt: "Read `n` and print the numbers 1 to n, one per line — but print `Fizz` for multiples of 3, `Buzz` for multiples of 5, and `FizzBuzz` for multiples of both.",
    tests: [T("5", "1\n2\nFizz\n4\nBuzz"), T("15", "1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz"), T("1", "1", true), T("16", "1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz\n16", true)],
    hints: ["Loop over every number from 1 to n inclusive.", "The order of your checks matters.", "Check 'multiple of both' before checking 3 or 5 on their own."],
  },
  c: {
    slug: "swap-pointers", concept: "pointers-memory", difficulty: 2, title: "Swap with pointers",
    prompt: "Write `void swap(int *a, int *b)` that swaps two integers through pointers. Read two integers, call `swap(&x, &y)`, then print them (now swapped) separated by a space.",
    tests: [T("1 2", "2 1"), T("-7 7", "7 -7"), T("5 5", "5 5", true), T("0 100", "100 0", true)],
    required: [
      { regex: "void\\s+swap\\s*\\(\\s*int\\s*\\*\\s*\\w+\\s*,\\s*int\\s*\\*\\s*\\w+\\s*\\)", message: "Define void swap(int *a, int *b)." },
      { regex: "swap\\s*\\(\\s*&\\s*\\w+\\s*,\\s*&\\s*\\w+\\s*\\)", message: "Call swap with the addresses of your variables: swap(&x, &y)." },
    ],
    hints: ["Inside swap, *a means 'the int that a points to'.", "You need a temporary variable to hold one value while you overwrite it.", "If the numbers don't swap, check that you assign through *a and *b, not to a and b themselves."],
  },
  java: {
    slug: "shapes-interface", concept: "oop-interfaces", difficulty: 3, title: "Shapes with an interface",
    prompt: "Define an interface `Shape` with a method `double area()`, and classes `Circle` and `Square` that implement it. Input: `n`, then n lines like `circle 1` or `square 2`. Print each area with two decimals, one per line.",
    tests: [T("2\nsquare 2\ncircle 1", "4.00\n3.14"), T("1\nsquare 3", "9.00"), T("1\ncircle 2.5", "19.63", true), T("3\nsquare 1.5\nsquare 0\ncircle 0", "2.25\n0.00\n0.00", true)],
    required: [
      { regex: "interface\\s+Shape\\b", message: "Declare interface Shape." },
      { regex: "implements\\s+Shape", message: "Your shape classes should implement Shape." },
    ],
    hints: ["An interface only declares the method; each class provides its own area().", "Store each shape in a variable of type Shape, then call area() on it.", "Use Math.PI for π and format with two decimal places."],
  },
};

const STARTER = {
  python: "# Read input with input(), print output with print().\n\n",
  c: "#include <stdio.h>\n\nint main(void) {\n    \n    return 0;\n}\n",
  java: "import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner in = new Scanner(System.in);\n        \n    }\n}\n",
};

// Concept notes: what the concept is + a minimal example that is NOT the exercise's answer.
const NOTES = {
  "io-variables": {
    python: "Variables hold values. `input()` returns a line of **text**; convert with `int()` or `float()`.\n\n```python\nname = input()\nage = int(input())\nprint(name, age + 1)\n```",
    c: "Declare a variable with its type. `scanf` reads into a variable's address.\n\n```c\nint age;\nscanf(\"%d\", &age);\nprintf(\"%d\\n\", age + 1);\n```",
    java: "`Scanner` reads input; `nextInt()` reads the next whole number.\n\n```java\nScanner in = new Scanner(System.in);\nint age = in.nextInt();\nSystem.out.println(age + 1);\n```",
  },
  conditionals: {
    python: "`if` / `elif` / `else` choose which block runs.\n\n```python\nif temp > 30:\n    print(\"hot\")\nelif temp > 15:\n    print(\"mild\")\nelse:\n    print(\"cold\")\n```",
    c: "```c\nif (temp > 30) {\n    printf(\"hot\\n\");\n} else if (temp > 15) {\n    printf(\"mild\\n\");\n} else {\n    printf(\"cold\\n\");\n}\n```",
    java: "```java\nif (temp > 30) {\n    System.out.println(\"hot\");\n} else if (temp > 15) {\n    System.out.println(\"mild\");\n} else {\n    System.out.println(\"cold\");\n}\n```",
  },
  loops: {
    python: "`for` repeats over a range; `while` repeats while a condition holds.\n\n```python\nfor i in range(3):      # 0, 1, 2\n    print(i)\n\ncount = 3\nwhile count > 0:\n    count -= 1\n```",
    c: "```c\nfor (int i = 0; i < 3; i++) {   // 0, 1, 2\n    printf(\"%d\\n\", i);\n}\nint count = 3;\nwhile (count > 0) count--;\n```",
    java: "```java\nfor (int i = 0; i < 3; i++) {   // 0, 1, 2\n    System.out.println(i);\n}\nint count = 3;\nwhile (count > 0) count--;\n```",
  },
  functions: {
    python: "A function packages a calculation you can reuse.\n\n```python\ndef area_of_square(side):\n    return side * side\n\nprint(area_of_square(4))\n```",
    c: "Declare the return type and parameter types. Define it above `main`.\n\n```c\nint area_of_square(int side) {\n    return side * side;\n}\n```",
    java: "`static` methods can be called from `main` directly.\n\n```java\nstatic int areaOfSquare(int side) {\n    return side * side;\n}\n```",
  },
  arrays: {
    python: "A list holds many values in order; index from 0.\n\n```python\nnums = [int(x) for x in input().split()]\nprint(nums[0], len(nums))\nfor x in nums:\n    print(x)\n```",
    c: "Arrays have a fixed size; valid indices are 0..size-1.\n\n```c\nint nums[100];\nfor (int i = 0; i < n; i++) scanf(\"%d\", &nums[i]);\n```",
    java: "```java\nint[] nums = new int[n];\nfor (int i = 0; i < n; i++) nums[i] = in.nextInt();\nSystem.out.println(nums.length);\n```",
  },
  strings: {
    python: "Strings are sequences of characters.\n\n```python\ns = input()\nfor ch in s:\n    if ch.isdigit():\n        print(\"digit\", ch)\nprint(s.upper())\n```",
    c: "A string is a `char` array ending in `'\\0'`. Read a line with `fgets` (never `gets`).\n\n```c\nchar line[256];\nfgets(line, sizeof line, stdin);\nfor (int i = 0; line[i] != '\\0'; i++) { /* line[i] */ }\n```",
    java: "```java\nString s = in.nextLine();\nfor (int i = 0; i < s.length(); i++) {\n    char c = s.charAt(i);\n}\nString upper = s.toUpperCase();\n```",
  },
  "structs-classes": {
    python: "A class groups data with the functions that use it.\n\n```python\nclass Point:\n    def __init__(self, x, y):\n        self.x = x\n        self.y = y\n    def dist_from_origin(self):\n        return (self.x ** 2 + self.y ** 2) ** 0.5\n```",
    c: "A struct groups related fields.\n\n```c\nstruct point { int x; int y; };\nstruct point p = { 3, 4 };\nprintf(\"%d\\n\", p.x);\n```",
    java: "Extra classes can live in Main.java as long as they aren't `public`.\n\n```java\nclass Point {\n    int x, y;\n    Point(int x, int y) { this.x = x; this.y = y; }\n    int sum() { return x + y; }\n}\n```",
  },
  recursion: {
    python: "A recursive function calls itself on a smaller problem and stops at a base case.\n\n```python\ndef countdown(n):\n    if n == 0:\n        return\n    print(n)\n    countdown(n - 1)\n```",
    c: "```c\nvoid countdown(int n) {\n    if (n == 0) return;      // base case\n    printf(\"%d\\n\", n);\n    countdown(n - 1);       // smaller problem\n}\n```",
    java: "```java\nstatic void countdown(int n) {\n    if (n == 0) return;      // base case\n    System.out.println(n);\n    countdown(n - 1);       // smaller problem\n}\n```",
  },
  "pointers-memory": {
    c: "A pointer stores an address. `&x` is x's address; `*p` is the value at p.\n\n```c\nvoid add_one(int *p) { *p = *p + 1; }\nint x = 5;\nadd_one(&x);   // x is now 6\n```",
  },
  "oop-interfaces": {
    java: "An interface is a contract: any class that `implements` it must provide its methods.\n\n```java\ninterface Greeter { String greet(); }\nclass English implements Greeter {\n    public String greet() { return \"hello\"; }\n}\nGreeter g = new English();\n```",
  },
  "mini-project": {
    python: "Mini projects combine earlier concepts. Plan first: what do you read, what do you store, what do you print?\n\n```python\nimport sys\nfor line in sys.stdin:\n    line = line.rstrip(\"\\n\")\n```",
    c: "Read until the end of input by checking what the reading function returns.\n\n```c\nchar line[256];\nwhile (fgets(line, sizeof line, stdin) != NULL) {\n    /* handle one line */\n}\n```",
    java: "```java\nScanner in = new Scanner(System.in);\nwhile (in.hasNextLine()) {\n    String line = in.nextLine();\n}\n```",
  },
};

const C_FORBID = [{ regex: "\\bgets\\s*\\(", message: "gets() is unsafe and removed from C — use fgets() instead." }];

function patterns(spec, lang) {
  if (!spec) return undefined;
  if (Array.isArray(spec)) return spec;
  const p = spec[lang] ?? spec.all;
  if (!p) return undefined;
  return [{ regex: typeof p.regex === "object" ? p.regex[lang] : p.regex, message: p.message }];
}

let count = 0;
const ids = [];
for (const lang of ["python", "c", "java"]) {
  const dir = join(root, lang);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const list = [...SHARED.slice(0, 8), EXTRA[lang], ...SHARED.slice(8)];
  list.forEach((p, i) => {
    const id = `${lang}-${String(i + 1).padStart(2, "0")}-${p.slug}`;
    const req = patterns(p.required, lang);
    const forb = [...(patterns(p.forbidden, lang) ?? []), ...(lang === "c" ? C_FORBID : [])];
    const ex = {
      id, lang, concept: p.concept, difficulty: p.difficulty, title: p.title, promptMd: p.prompt,
      starterCode: STARTER[lang], tests: p.tests,
      ...(req ? { requiredPatterns: req } : {}),
      ...(forb.length ? { forbiddenPatterns: forb } : {}),
      hints: p.hints, conceptNoteMd: NOTES[p.concept][lang],
    };
    writeFileSync(join(dir, `${id}.json`), JSON.stringify(ex, null, 2) + "\n");
    ids.push([lang, id]);
    count++;
  });
}
const ident = (id) => id.replace(/-(\w)/g, (_, c) => c.toUpperCase()).replace(/^(\d)/, "_$1");
const index =
  "// GENERATED by scripts/gen-exercises.mjs — do not edit by hand.\n" +
  ids.map(([lang, id]) => `import ${ident(id)} from "../../problems/code/${lang}/${id}.json";`).join("\n") +
  "\n\nexport const RAW_EXERCISES: unknown[] = [" + ids.map(([, id]) => ident(id)).join(", ") + "];\n";
writeFileSync(join(root, "..", "..", "src", "code", "exercises.generated.ts"), index);
console.log(`wrote ${count} exercises`);
