# Skillset Rules

Rules di bawah hanya berlaku dalam workflow command skillset (`/skillset:make|development|plan|execute|review`), tidak pada sesi Claude Code biasa. Section `selalu` aktif di semua workflow; section lain aktif bila triggernya cocok dengan task. Edit file ini langsung, atau lewat `/skillset:rules`.

## selalu
- Setiap ada progress (fase selesai / milestone) → update dokumentasi terkait di docs/

## init
- Baca CLAUDE.md + docs/ project dulu sebelum mulai workflow

## web-project
<!-- trigger: task membangun web frontend baru -->
- Wajib sertakan service-worker (PWA-ready)
- Form login: dukung navigasi Tab + submit via Enter
