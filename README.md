# بازی فلش — Arrow Puzzle

بازی منطقی فلش، یک مینی‌اپ ایتا با قابلیت نصب روی Cloudflare Pages و پایگاه داده D1.

## ساختار پروژه

```
.
├── public/            ← فایل‌های استاتیک (HTML/CSS/JS) — served by Cloudflare Pages
│   ├── index.html
│   ├── css/
│   │   ├── base.css
│   │   ├── layout.css
│   │   └── game.css
│   └── js/
│       ├── app.js     ← ورودی اصلی برنامه
│       ├── eitaa.js   ← پوشش SDK ایتا
│       ├── api.js     ← کلاینت HTTP
│       └── game.js    ← موتور بازی
├── functions/         ← Pages Functions (سرور)
│   └── api/
│       ├── _shared/auth.js    ← تأیید HMAC initData
│       ├── session.js         ← POST /api/session
│       ├── leaderboard.js     ← GET  /api/leaderboard
│       └── game/
│           ├── start.js       ← POST /api/game/start
│           └── finish.js      ← POST /api/game/finish
├── migrations/
│   └── 0001_initial.sql
└── wrangler.jsonc
```

## راه‌اندازی

### ۱. نصب وابستگی‌ها

```bash
npm install
```

### ۲. ساخت پایگاه داده D1

```bash
npx wrangler d1 create arrow-puzzle-db
```

شناسه پایگاه داده خروجی را در `wrangler.jsonc` جایگزین `<DATABASE_ID>` کنید.

### ۳. اجرای مایگریشن‌ها

```bash
npm run db:migrate:local   # برای توسعه محلی
npm run db:migrate:remote  # برای محیط تولید
```

### ۴. تنظیم توکن ایتا

در داشبورد Cloudflare → Workers & Pages → پروژه شما → Settings → Variables and Secrets:

- نام: `EITAA_TOKEN`
- مقدار: توکن ربات/اپ ایتا شما
- نوع: **Secret** (نه متغیر ساده)

### ۵. توسعه محلی

```bash
npm run dev
# یا
EITAA_TOKEN=DEV npx wrangler pages dev public
```

در حالت توسعه محلی، متغیر `EITAA_TOKEN=DEV` احراز هویت را دور می‌زند و از یک کاربر آزمایشی استفاده می‌کند.

### ۶. استقرار روی Cloudflare Pages

1. ریپو را به GitHub پوش کنید.
2. داشبورد Cloudflare → Workers & Pages → Create → Pages → Import repository.
3. **Build command:** (خالی بگذارید)
4. **Build output directory:** `public`
5. پایگاه داده D1 را در Settings → Bindings → D1 Database با نام `DB` متصل کنید.
6. متغیر `EITAA_TOKEN` را به عنوان Secret اضافه کنید.

## قوانین بازی

- هر خانه یک فلش با جهت تصادفی دارد.
- با لمس هر فلش، آن ۴۵ درجه در جهت ساعتگرد می‌چرخد.
- هدف: همه فلش‌ها باید به سمت خانه هدف (★) اشاره کنند.
- بازی با کمترین حرکت، بیشترین امتیاز را می‌دهد.
- ۲۰ مرحله با سختی‌های مختلف (شبکه ۳×۳ تا ۸×۸).

## امنیت

- توکن ایتا **فقط** روی سرور نگه‌داری می‌شود — هرگز به کلاینت ارسال نمی‌شود.
- `initData` با HMAC-SHA256 روی سرور تأیید می‌شود.
- امتیاز توسط سرور محاسبه می‌شود — کلاینت نمی‌تواند امتیاز دستکاری کند.
- تمام دستورات SQL با Prepared Statements اجرا می‌شوند.
