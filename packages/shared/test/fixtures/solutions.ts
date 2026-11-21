/**
 * TEST FIXTURES ONLY — used to prove each exercise's tests are correct and passable.
 * Never imported by the app, never bundled, never shown to students (Code Dojo has no solution reveal).
 */
export const SOLUTIONS: Record<string, { python: string; c: string; java: string }> = {
  "sum-two": {
    python: "a, b = map(int, input().split())\nprint(a + b)\n",
    c: "#include <stdio.h>\nint main(void){long a,b;scanf(\"%ld %ld\",&a,&b);printf(\"%ld\\n\",a+b);return 0;}\n",
    java: "import java.util.Scanner;\npublic class Main{public static void main(String[] x){Scanner in=new Scanner(System.in);long a=in.nextLong(),b=in.nextLong();System.out.println(a+b);}}\n",
  },
  "even-odd": {
    python: "n = int(input())\nprint('even' if n % 2 == 0 else 'odd')\n",
    c: "#include <stdio.h>\nint main(void){int n;scanf(\"%d\",&n);printf(n%2==0?\"even\\n\":\"odd\\n\");return 0;}\n",
    java: "import java.util.Scanner;\npublic class Main{public static void main(String[] x){int n=new Scanner(System.in).nextInt();System.out.println(n%2==0?\"even\":\"odd\");}}\n",
  },
  "sum-to-n": {
    python: "n = int(input())\nt = 0\nfor i in range(1, n + 1):\n    t += i\nprint(t)\n",
    c: "#include <stdio.h>\nint main(void){int n,t=0;scanf(\"%d\",&n);for(int i=1;i<=n;i++)t+=i;printf(\"%d\\n\",t);return 0;}\n",
    java: "import java.util.Scanner;\npublic class Main{public static void main(String[] x){int n=new Scanner(System.in).nextInt(),t=0;for(int i=1;i<=n;i++)t+=i;System.out.println(t);}}\n",
  },
  temperature: {
    python: "def c_to_f(c):\n    return c * 9 / 5 + 32\nprint(f'{c_to_f(float(input())):.1f}')\n",
    c: "#include <stdio.h>\ndouble c_to_f(double c){return c*9.0/5.0+32.0;}\nint main(void){double c;scanf(\"%lf\",&c);printf(\"%.1f\\n\",c_to_f(c));return 0;}\n",
    java: "import java.util.*;\npublic class Main{static double cToF(double c){return c*9.0/5.0+32.0;}public static void main(String[] x){double c=new Scanner(System.in).nextDouble();System.out.println(String.format(Locale.ROOT,\"%.1f\",cToF(c)));}}\n",
  },
  largest: {
    python: "n = int(input())\nnums = [int(v) for v in input().split()]\nbest = nums[0]\nfor v in nums:\n    if v > best:\n        best = v\nprint(best)\n",
    c: "#include <stdio.h>\nint main(void){int n,b,v;scanf(\"%d\",&n);scanf(\"%d\",&b);for(int i=1;i<n;i++){scanf(\"%d\",&v);if(v>b)b=v;}printf(\"%d\\n\",b);return 0;}\n",
    java: "import java.util.Scanner;\npublic class Main{public static void main(String[] x){Scanner in=new Scanner(System.in);int n=in.nextInt(),b=in.nextInt();for(int i=1;i<n;i++){int v=in.nextInt();if(v>b)b=v;}System.out.println(b);}}\n",
  },
  vowels: {
    python: "print(sum(1 for ch in input().lower() if ch in 'aeiou'))\n",
    c: "#include <stdio.h>\n#include <ctype.h>\n#include <string.h>\nint main(void){char s[1024];int n=0;if(!fgets(s,sizeof s,stdin))return 0;for(int i=0;s[i];i++){char c=tolower((unsigned char)s[i]);if(strchr(\"aeiou\",c)&&c)n++;}printf(\"%d\\n\",n);return 0;}\n",
    java: "import java.util.Scanner;\npublic class Main{public static void main(String[] x){String s=new Scanner(System.in).nextLine().toLowerCase();int n=0;for(char c:s.toCharArray())if(\"aeiou\".indexOf(c)>=0)n++;System.out.println(n);}}\n",
  },
  rectangle: {
    python: "class Rect:\n    def __init__(self, w, h):\n        self.w, self.h = w, h\n    def area(self):\n        return self.w * self.h\n    def perimeter(self):\n        return 2 * (self.w + self.h)\nr = Rect(*map(int, input().split()))\nprint('area', r.area())\nprint('perimeter', r.perimeter())\n",
    c: "#include <stdio.h>\nstruct rect{int w;int h;};\nint main(void){struct rect r;scanf(\"%d %d\",&r.w,&r.h);printf(\"area %d\\nperimeter %d\\n\",r.w*r.h,2*(r.w+r.h));return 0;}\n",
    java: "import java.util.Scanner;\nclass Rect{int w,h;Rect(int w,int h){this.w=w;this.h=h;}int area(){return w*h;}int per(){return 2*(w+h);}}\npublic class Main{public static void main(String[] x){Scanner in=new Scanner(System.in);Rect r=new Rect(in.nextInt(),in.nextInt());System.out.println(\"area \"+r.area());System.out.println(\"perimeter \"+r.per());}}\n",
  },
  factorial: {
    python: "def f(n):\n    return 1 if n == 0 else n * f(n - 1)\nprint(f(int(input())))\n",
    c: "#include <stdio.h>\nlong f(int n){return n==0?1:n*f(n-1);}\nint main(void){int n;scanf(\"%d\",&n);printf(\"%ld\\n\",f(n));return 0;}\n",
    java: "import java.util.Scanner;\npublic class Main{static long f(int n){return n==0?1:n*f(n-1);}public static void main(String[] x){System.out.println(f(new Scanner(System.in).nextInt()));}}\n",
  },
  fizzbuzz: {
    python: "n = int(input())\nfor i in range(1, n + 1):\n    print('FizzBuzz' if i % 15 == 0 else 'Fizz' if i % 3 == 0 else 'Buzz' if i % 5 == 0 else i)\n",
    c: "",
    java: "",
  },
  "swap-pointers": {
    python: "",
    c: "#include <stdio.h>\nvoid swap(int *a, int *b){int t=*a;*a=*b;*b=t;}\nint main(void){int x,y;scanf(\"%d %d\",&x,&y);swap(&x, &y);printf(\"%d %d\\n\",x,y);return 0;}\n",
    java: "",
  },
  "shapes-interface": {
    python: "",
    c: "",
    java: "import java.util.*;\ninterface Shape{double area();}\nclass Circle implements Shape{double r;Circle(double r){this.r=r;}public double area(){return Math.PI*r*r;}}\nclass Square implements Shape{double s;Square(double s){this.s=s;}public double area(){return s*s;}}\npublic class Main{public static void main(String[] x){Scanner in=new Scanner(System.in);int n=in.nextInt();for(int i=0;i<n;i++){String k=in.next();double v=in.nextDouble();Shape s=k.equals(\"circle\")?new Circle(v):new Square(v);System.out.println(String.format(Locale.ROOT,\"%.2f\",s.area()));}}}\n",
  },
  "grade-calculator": {
    python: "n = int(input())\ns = [int(v) for v in input().split()]\navg = sum(s) / n\ng = 'A' if avg >= 90 else 'B' if avg >= 80 else 'C' if avg >= 70 else 'D' if avg >= 60 else 'F'\nprint(f'average {avg:.1f}')\nprint(f'grade {g}')\n",
    c: "#include <stdio.h>\nint main(void){int n,v;double t=0;scanf(\"%d\",&n);for(int i=0;i<n;i++){scanf(\"%d\",&v);t+=v;}double a=t/n;char g=a>=90?'A':a>=80?'B':a>=70?'C':a>=60?'D':'F';printf(\"average %.1f\\ngrade %c\\n\",a,g);return 0;}\n",
    java: "import java.util.*;\npublic class Main{public static void main(String[] x){Scanner in=new Scanner(System.in);int n=in.nextInt();double t=0;for(int i=0;i<n;i++)t+=in.nextInt();double a=t/n;char g=a>=90?'A':a>=80?'B':a>=70?'C':a>=60?'D':'F';System.out.println(String.format(Locale.ROOT,\"average %.1f\",a));System.out.println(\"grade \"+g);}}\n",
  },
  "text-stats": {
    python: "import sys\ndata = sys.stdin.read()\nif data.endswith('\\n'):\n    data = data[:-1]\nlines = data.split('\\n')\nwords = data.split()\nlongest = ''\nfor w in words:\n    if len(w) > len(longest):\n        longest = w\nprint('lines', len(lines))\nprint('words', len(words))\nprint('chars', sum(len(l) for l in lines))\nprint('longest', longest)\n",
    c: "#include <stdio.h>\n#include <string.h>\n#include <ctype.h>\nint main(void){char line[4096],longest[4096]=\"\";int lines=0,words=0,chars=0;while(fgets(line,sizeof line,stdin)){size_t L=strlen(line);if(L&&line[L-1]=='\\n')line[--L]=0;lines++;chars+=(int)L;char*p=line;while(*p){while(*p&&isspace((unsigned char)*p))p++;if(!*p)break;char*s=p;while(*p&&!isspace((unsigned char)*p))p++;int wl=(int)(p-s);words++;if(wl>(int)strlen(longest)){memcpy(longest,s,wl);longest[wl]=0;}}}printf(\"lines %d\\nwords %d\\nchars %d\\nlongest %s\\n\",lines,words,chars,longest);return 0;}\n",
    java: "import java.util.*;\npublic class Main{public static void main(String[] x){Scanner in=new Scanner(System.in);int lines=0,words=0,chars=0;String longest=\"\";while(in.hasNextLine()){String l=in.nextLine();lines++;chars+=l.length();for(String w:l.trim().split(\"\\\\s+\")){if(w.isEmpty())continue;words++;if(w.length()>longest.length())longest=w;}}System.out.println(\"lines \"+lines);System.out.println(\"words \"+words);System.out.println(\"chars \"+chars);System.out.println(\"longest \"+longest);}}\n",
  },
  "bank-account": {
    python: "import sys\nclass Account:\n    def __init__(self, b):\n        self.b = b\n    def deposit(self, x):\n        if x <= 0:\n            return 'invalid amount'\n        self.b += x\n    def withdraw(self, x):\n        if x <= 0:\n            return 'invalid amount'\n        if x > self.b:\n            return 'insufficient funds'\n        self.b -= x\nlines = sys.stdin.read().split('\\n')\nacc = Account(int(lines[0]))\nfor l in lines[1:]:\n    p = l.split()\n    if not p:\n        continue\n    if p[0] == 'balance':\n        print('balance', acc.b)\n    else:\n        msg = getattr(acc, p[0])(int(p[1]))\n        if msg:\n            print(msg)\n",
    c: "#include <stdio.h>\n#include <string.h>\nstruct account{long b;};\nint main(void){struct account a;char cmd[32];long x;if(scanf(\"%ld\",&a.b)!=1)return 0;while(scanf(\"%31s\",cmd)==1){if(!strcmp(cmd,\"balance\")){printf(\"balance %ld\\n\",a.b);continue;}scanf(\"%ld\",&x);if(x<=0){printf(\"invalid amount\\n\");continue;}if(!strcmp(cmd,\"deposit\"))a.b+=x;else if(x>a.b)printf(\"insufficient funds\\n\");else a.b-=x;}return 0;}\n",
    java: "import java.util.*;\nclass Account{long b;Account(long b){this.b=b;}String apply(String c,long x){if(x<=0)return \"invalid amount\";if(c.equals(\"deposit\")){b+=x;return null;}if(x>b)return \"insufficient funds\";b-=x;return null;}}\npublic class Main{public static void main(String[] a){Scanner in=new Scanner(System.in);Account acc=new Account(in.nextLong());while(in.hasNext()){String c=in.next();if(c.equals(\"balance\")){System.out.println(\"balance \"+acc.b);continue;}String r=acc.apply(c,in.nextLong());if(r!=null)System.out.println(r);}}}\n",
  },
};
