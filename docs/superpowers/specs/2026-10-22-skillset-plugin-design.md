# Skillset — Plugin Router Skill untuk Claude Code (Design Spec)

- **Tanggal:** 2026-10-22
- **Status:** Draft → menunggu review user
- **Klasifikasi:** Architectural (project baru, plugin baru)
- **Pendekatan terpilih:** A — Katalog persisten + router prompt + anti-stale check
- **Repo plugin:** `/config/workspace/ai/skillset`

---

## 1. Ringkasan & Tujuan

`skillset` adalah plugin Claude Code yang menjadi **satu pintu (router/orchestrator) untuk ratusan skill** dari semua plugin terpasang di user scope (superpowers, mattpocock-skills, ecc, vercel, figma, expo, cloudflare, postman, stripe, redis-development, plugin-dev, frontend-design, pr-review-toolkit, commit-commands, dll).

Pengguna cukup memanggil satu command berdasarkan **intensi** (mis. `/skillset:make`, `/skillset:development`), dan plugin yang:

1. Menjamin semua plugin wajib **terpasang dan selalu latest** (auto-install + auto-update).
2. Membaca **katalog skill** yang digenerate otomatis dari plugin terpasang.
3. **Mencocokkan task** dengan kombinasi skill lintas plugin, mengusulkan rantai + alasan, menunggu konfirmasi, lalu mengeksekusinya berantai.
4. Menerapkan **rules custom pengguna** selama workflow berjalan.

**Success criteria:**
- `/skillset:init` di mesin baru → semua plugin manifest terpasang, ter-update ke latest, katalog tergenerate.
- `/skillset:make "tambah filter tanggal di dashboard"` → mengusulkan rantai skill yang relevan (dari superpowers/mattpocock/ecc/…), menunggu konfirmasi, lalu mengeksekusi dengan rules aktif.
- Drift versi plugin terdeteksi murah di tiap invokasi command.
- Task trivial tidak dipaksa masuk workflow (router menjawab langsung).

## 2. Keputusan Desain (locked)

| # | Keputusan | Pilihan | Alasan |
|---|---|---|---|
| D1 | Cakupan rules | **Workflow-only** — rules hanya aktif dalam command plugin, tanpa hooks global | Tidak menyentuh sesi Claude Code biasa; lebih aman & sederhana |
| D2 | Perilaku routing | **Usulkan → konfirmasi** sebelum eksekusi rantai | Aman dari salah-tebak intensi; tetap satu round-trip |
| D3 | Manifest awal | **Semua plugin user-scope terpasang saat ini**, editable | Sesuai keinginan pengguna; file bisa diedit kapan saja |
| D4 | Auto-update | `/init` dan `/update` menjalankan `claude plugin update` semua plugin manifest + `marketplace update` | "Selalu latest"; drift check murah di antara keduanya |
| D5 | Arsitektur | **Pendekatan A** — katalog persisten (generated) + router prompt | Transparan, cepat, debuggable; bisa di-upgrade ke subagent (C) nanti tanpa ubah bentuk data |
| D6 | Command set | **9 command lengkap dari awal** (init, update, make, development, plan, execute, review, rules, catalog) | Permintaan eksplisit: command di-initialisasi lengkap sejak awal |
| D7 | Rantai skill archetype | Ditentukan **oleh desainer plugin** (tabel §6), router menyesuaikan per task | Permintaan eksplisit pengguna |
| D8 | Lokasi data runtime | `~/.claude/skillset/data/` — **di luar repo plugin** | Tidak ter-commit; selamat dari update plugin; aman saat plugin dibagikan |

## 3. Arsitektur Plugin

### 3.1 Identitas

- Nama plugin: `skillset` (kebab-case), versi awal `0.1.0`.
- Distribusi: repo git ini; instalasi via marketplace lokal (`claude plugin marketplace add <path|repo>` → `claude plugin install skillset@<marketplace>`). Publishing ke marketplace publik = di luar scope v1.

### 3.2 Struktur direktori

```
skillset/                            ← repo plugin (sumber)
├── .claude-plugin/plugin.json       ← manifest plugin (name, version, description, author)
├── commands/                        ← 9 slash command (.md)
│   ├── init.md        update.md     ├── make.md       development.md
│   ├── plan.md        execute.md    ├── review.md
│   └── rules.md       catalog.md
├── skills/
│   └── router/SKILL.md              ← prosedur routing bersama (dipakai semua command router)
├── scripts/                         ← Node ESM (.mjs), zero-dependency
│   ├── scan.mjs                     ← scan plugin terpasang → generate katalog; --check = anti-stale
│   ├── sync.mjs                     ← manifest ↔ terpasang: install kurang + update semua
│   └── query.mjs                    ← filter katalog per keyword (hemat token routing)
├── templates/rules.template.md      ← template rules.md awal
├── docs/
│   ├── superpowers/specs/…          ← spec ini
│   └── manual-verification.md       ← checklist verifikasi manual per command
├── tests/scan.test.mjs              ← unit test scan.mjs (fixture)
└── README.md

~/.claude/skillset/data/             ← runtime (di luar repo, D8)
├── manifest.json                    ← plugin wajib (editable)
├── rules.md                         ← rules custom (editable)
├── catalog.json                     ← katalog mesin (generated)
└── catalog.md                       ← katalog human-readable (generated)
```

Aturan struktur mengikuti konvensi resmi plugin Claude Code: manifest wajib di `.claude-plugin/plugin.json`; `commands/`, `skills/`, `scripts/` di root plugin; path portabel memakai `${CLAUDE_PLUGIN_ROOT}`.

### 3.3 Prinsip DRY router

Kelima command router (`make`, `development`, `plan`, `execute`, `review`) berbagi satu prosedur routing di `skills/router/SKILL.md`. Command `.md` adalah **wrapper tipis**: frontmatter (`argument-hint`) + instruksi "ikuti skill `skillset:router` dengan archetype X dan task `$ARGUMENTS`". Jika invokasi skill-internal bermasalah saat implementasi, fallback = inline template yang sama di tiap command (keputusan diambil saat build, tidak mengubah bentuk data).

## 4. Model Data

### 4.1 `manifest.json`

```json
{
  "autoUpdate": true,
  "plugins": ["superpowers@claude-plugins-official", "mattpocock-skills@…", "…"]
}
```

- Dibuat otomatis saat `/init` pertama: isi = semua plugin scope `user` di `installed_plugins.json` (D3).
- Bisa diedit manual atau lewat `/skillset:init` ulang; `sync.mjs` yang membacanya.

### 4.2 `rules.md`

Markdown ber-section; tiap section = scope trigger; dibaca manusia dan router:

```markdown
## selalu
- Setiap ada progress (fase selesai / milestone) → update dokumentasi terkait di docs/

## init
- Baca CLAUDE.md + docs/ project dulu sebelum mulai workflow

## web-project
- Wajib sertakan service-worker (PWA-ready)
- Form login: dukung navigasi Tab + submit via Enter
```

- Scope `selalu` selalu aktif; scope lain aktif bila triggernya cocok dengan task (penilaian router). Nama scope bebas (tag), deskripsi trigger boleh ditulis sebagai komentar `<!-- trigger: … -->` di bawah header.
- `/skillset:rules` = lihat / tambah / edit dengan format konsisten; file tetap markdown biasa yang bisa diedit manual.

### 4.3 `catalog.json` + `catalog.md` (generated)

```json
{
  "generatedAt": "2026-10-22T04:39:00.000Z",
  "plugins": [
    {
      "name": "superpowers",
      "marketplace": "claude-plugins-official",
      "version": "6.4.1",
      "skills":      [{ "name": "brainstorming", "description": "…" }],
      "commands":    [{ "name": "…", "description": "…" }],
      "agents":      [{ "name": "…", "description": "…" }]
    }
  ]
}
```

- `catalog.md` = kondensat human-readable: dikelompokkan per plugin, satu baris `name — description` per skill/command/agent. Inilah yang dibaca router (via `query.mjs`), bukan file mentah 600+ skill.

## 5. Scripts

Semua Node ESM zero-dependency. Referensi dari command memakai `!`node ${CLAUDE_PLUGIN_ROOT}/scripts/…``.

### 5.1 `scan.mjs`
- Sumber: `~/.claude/plugins/installed_plugins.json` → entri `scope === "user"` (plus path installPath per plugin).
- Walk per plugin: `skills/*/SKILL.md`, `commands/*.md`, `agents/*.md` → parsing frontmatter `name` + `description` (regex sederhana; harus tahan nilai multi-baris plain-scalar).
- Output: `catalog.json` + `catalog.md` (ditulis ke `~/.claude/skillset/data/`).
- Mode `--check`: bandingkan set `{plugin@marketplace → version}` di `installed_plugins.json` vs `catalog.json`; cetak JSON `{"fresh": bool, "changes": […]}`; exit code 0 = segar, 1 = drift/katalog hilang. Cepat, tanpa network — dipakai pre-flight tiap command router.

### 5.2 `sync.mjs`
- Baca `manifest.json`; list plugin terpasang (flag eksak `claude plugin list` diverifikasi saat implementasi).
- Untuk yang kurang → `claude plugin install <plugin>@<marketplace>`.
- `claude plugin marketplace update` + `claude plugin update <plugin>` untuk tiap plugin manifest.
- Ringkasan hasil (sukses/gagal per plugin) sebagai output; flag interaktif/`-y` diverifikasi saat implementasi.

### 5.3 `query.mjs`
- Argumen: keyword(s). Baca `catalog.json`, skor kecocokan keyword di `name`+`description`, cetak entri teratas per kategori (skill/command/agent) dengan prefix plugin — output ringkas untuk konteks command.

## 6. Command Set & Archetype Rantai

### 6.1 Prosedur routing bersama (`skills/router/SKILL.md`)

1. **Pre-flight anti-stale** — `scan.mjs --check`; bila drift → tawarkan `/skillset:update` dulu.
2. **Load selektif** — `query.mjs <keyword domain>` + `rules.md`; katalog TIDAK pernah dibaca penuh.
3. **Analisis task** — domain, stack, deliverable; deteksi task trivial → jawab langsung tanpa rantai (§7).
4. **Pilih rantai** — archetype (§6.2) disesuaikan kondisi; substitusi bila skill tak tersedia (§7).
5. **Usulkan → konfirmasi** (D2) — tampilkan: rantai (skill → peran → alasan), rules yang akan aktif, file rencana dibaca.
6. **Eksekusi berantai** via Skill tool — urut sesuai rantai; rules dicek tiap fase; gate internal tiap skill (mis. approval brainstorming) dihormati router.
7. **Ringkasan akhir** — hasil per fase + kewajiban rules "progress → docs".

### 6.2 Archetype per command (D7 — rantai titik-awal, router menyesuaikan)

**`/skillset:make <task>`** — ide → kode bekerja:
1. `superpowers:brainstorming` (klasifikasi & desain)
2. `mattpocock-skills:codebase-design` + `mattpocock-skills:domain-modeling` (bila struktur/domain signifikan)
3. `superpowers:writing-plans`
4. `superpowers:test-driven-development` ⇄ `mattpocock-skills:tdd` (substitusi dua arah)
5. `mattpocock-skills:code-review`
6. `superpowers:verification-before-completion`

**`/skillset:development <task>`** — full lifecycle → release: semua `/make`, plus:
7. `superpowers:requesting-code-review` → `superpowers:receiving-code-review`
8. `superpowers:finishing-a-development-branch`
9. `commit-commands:commit-push-pr`
10. Deploy sesuai stack terdeteksi: `vercel:deploy` / `cloudflare:wrangler` / `ecc:pm2` / pola docker (`docker:build:prod`)

**`/skillset:plan <task>`** — berhenti di plan:
1. `mattpocock-skills:research` (bila perlu riset lib/pola)
2. `superpowers:brainstorming` (bila belum ada spec — sampai spec disetujui)
3. `superpowers:writing-plans` → deliverable = dokumen plan

**`/skillset:execute <plan-path>`** — jalankan plan existing:
1. Deteksi ukuran plan: kecil → `superpowers:executing-plans`; besar/paralelisabel → `superpowers:subagent-driven-development`
2. Selama implementasi: `superpowers:test-driven-development` ⇄ `mattpocock-skills:tdd`
3. Review antar-task (bila subagent-driven): `pr-review-toolkit:code-reviewer` ⇄ `ecc:code-reviewer`
4. Penutup: `superpowers:verification-before-completion` + laporan per task

**`/skillset:review`** — review perubahan sesi yang baru dikerjakan:
1. Deteksi scope: diff belum di-commit (`git status`); bila bersih → commit terakhir sesi (log/reflog)
2. Review utama: `mattpocock-skills:code-review`; bila ada PR → `pr-review-toolkit:review-pr`
3. Reviewer per-bahasa sesuai ekstensi file di diff: agent `ecc:typescript-reviewer`, `ecc:go-reviewer`, `ecc:php-reviewer`, dll.
4. Opsional (diusulkan router bila relevan): `ecc:pr-test-analyzer` (cakupan test), `security-auditor` (diff sentuh auth/payment/env/secrets)
5. Output: findings terurut severity + rekomendasi fix

**Command non-router:**
- `/skillset:init` — pastikan dir data; generate manifest awal bila belum ada (D3); `sync.mjs` (install + update, D4); `scan.mjs`; salin `templates/rules.template.md` → `rules.md` bila belum ada; ringkasan.
- `/skillset:update` — `sync.mjs` + `scan.mjs` (dipakai juga setelah drift terdeteksi).
- `/skillset:rules` — lihat/tambah/edit `rules.md` format konsisten.
- `/skillset:catalog` — browse katalog (per plugin, keyword, versi terpasang) via `query.mjs`.

## 7. Error Handling & Edge Cases

- **Install/update gagal** (network/marketplace): lanjut dengan yang terpasang, laporkan plugin gagal, jangan blok workflow.
- **Skill di rantai tak tersedia** (plugin disabled/uninstall): usulkan substitusi dari katalog (pas substitusi dua arah sudah didefinisikan, mis. tdd superpowers⇄mattpocock; code-reviewer pr-review-toolkit⇄ecc) atau skip + catatan; minta konfirmasi user pada saat proposal (D2).
- **Katalog belum ada** (belum `/init`): command mendeteksi, menawarkan menjalankan `/skillset:init` dulu.
- **Drift versi**: warning + tawaran `/skillset:update` (tidak memaksa).
- **Task trivial** (pertanyaan kecil, bukan proyek): router menyatakan tidak butuh rantai, menjawab langsung.
- **Katalog sangat besar**: mitigasi token = `query.mjs` selalu; full-read dilarang oleh prosedur router.

## 8. Testing & Validasi

- `claude plugin validate /config/workspace/ai/skillset` — gate struktur manifest & komponen.
- Unit test `tests/scan.test.mjs` dengan fixture direktori plugin palsu: parsing frontmatter (termasuk deskripsi multi-baris), `--check` deteksi drift, output katalog.
- `docs/manual-verification.md` — checklist verifikasi manual per command (konvensi workspace).
- `claude plugin eval` — ditunda ke v2 (YAGNI).

## 9. Batasan Scope (v1 — sengaja tidak dibuat)

- Enforcement rules via hooks global (D1 menutup ini).
- Rules per-project (v1: rules user-global saja).
- WebSocket/progress UI, marketplace publik, dukungan Windows path.
- Router subagent (Pendekatan C) — pintu upgrade terbuka, bentuk data tidak berubah.

## 10. Referensi Riset

- Struktur & manifest plugin: https://code.claude.com/docs/en/plugins/overview
- Hooks (dipelajari, tidak dipakai di v1): https://code.claude.com/docs/en/hooks
- Skills: https://code.claude.com/docs/en/skills
- CLI terverifikasi lokal: `claude plugin install|update|list|validate`, `claude plugin marketplace add|update`
- Referensi lokal: skill `plugin-dev:plugin-structure`, `plugin-dev:command-development`, `plugin-dev:skill-development` (plugin-dev@anthropic-plugin-directory)
- Prior art (diposition berbeda): `ecc:skill-scout` (pencarian saat pembuatan skill, bukan routing runtime), `superpowers:using-superpowers` (routing internal satu plugin)
