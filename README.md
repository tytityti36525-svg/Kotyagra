# 🐱 КотяГра — Інструкція для деплою

## Структура файлів
```
kotya_gra/
├── index.html        ← головна сторінка
├── style.css         ← стилі
├── app.js            ← логіка гри + Firebase
├── manifest.json     ← PWA маніфест
├── firestore.rules   ← правила безпеки (для Firebase Console)
└── README.md
```

---

## 1. Firebase налаштування

### Увімкни Authentication
1. Firebase Console → **Authentication** → **Sign-in method**
2. Увімкни **Email/Password** ✅
3. Увімкни **Google** ✅ (додай свій домен в Authorized domains)

### Увімкни Firestore Database
1. Firebase Console → **Firestore Database** → **Create database**
2. Обери **Production mode**
3. Обери регіон (рекомендую `europe-west3`)

### Встанови правила безпеки
1. Firebase Console → **Firestore** → **Rules**
2. Скопіюй вміст файлу `firestore.rules` і збережи

### Увімкни Firestore індекси (автоматично запропонує при першому запиті)

---

## 2. Деплой на GitHub Pages (БЕЗКОШТОВНО)

```bash
# 1. Ініціалізуй git репозиторій
git init
git add .
git commit -m "🐱 КотяГра v1.0"

# 2. Створи репозиторій на GitHub і запуш
git remote add origin https://github.com/ТВІ_НІКНЕЙМ/kotya-gra.git
git branch -M main
git push -u origin main

# 3. Налаштуй GitHub Pages
# GitHub → Settings → Pages → Source: Deploy from branch → main → / (root)
```

**Твоя гра буде доступна за адресою:**
`https://ТВІ_НІКНЕЙМ.github.io/kotya-gra`

---

## 3. Деплой на Firebase Hosting (рекомендовано)

```bash
# Встанови Firebase CLI
npm install -g firebase-tools

# Логін
firebase login

# Ініціалізуй проект
firebase init hosting
# → Use existing project → kotyagra-d737c
# → Public directory: . (крапка — поточна папка)
# → Single-page app: No
# → Overwrite index.html: No

# Деплой!
firebase deploy
```

**Гра буде на:** `https://kotyagra-d737c.web.app`

---

## 4. Додай авторизований домен для Google Auth

Firebase Console → **Authentication** → **Settings** → **Authorized domains**
Додай:
- `ТВІ_НІКНЕЙМ.github.io` (для GitHub Pages)
- `kotyagra-d737c.web.app` (для Firebase Hosting — вже є)

---

## 5. Іконки для PWA (опціонально)

Щоб гра встановлювалась як додаток на телефон, додай:
- `icon-192.png` (192×192 пікселів)
- `icon-512.png` (512×512 пікселів)

---

## Функції гри

| Функція | Статус |
|---------|--------|
| 🔐 Email/пароль реєстрація | ✅ |
| 🔐 Google авторизація | ✅ |
| 🐱 Виховання котика (їжа/вода/гра/сон) | ✅ |
| 🏋️ Тренування навиків (Одяг/Аксесуари/Прикраси) | ✅ |
| 💎 Ларець з дорогоцінностями | ✅ |
| 🌳 Прогулянки з прогрес-баром | ✅ |
| 🎈 Клуби (вступ/створення/копилка) | ✅ Firebase |
| 🏆 Рейтинги гравців/клубів/краси | ✅ Firebase |
| 📬 Пошта між гравцями | ✅ Firebase |
| 💬 Реальний чат (Firestore realtime) | ✅ Firebase |
| 🟢 Онлайн-лічильник | ✅ Firebase |
| 📱 PWA (встановлення на телефон) | ✅ |
| 💾 Збереження прогресу | ✅ Firebase |
