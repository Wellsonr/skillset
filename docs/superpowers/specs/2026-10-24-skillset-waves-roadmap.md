# Skillset Waves Roadmap — Wave 1 Design

> 2026-10-24. Roadmap 7 fitur hasil review pasca-v0.1.1. Gelombang penuh ada di dokumen ini; wave 1 dieksekusi sekarang, wave 2–3 menyusul dengan plan sendiri.

## Latar

v0.1.1 live di GitHub (`main` = split polyrepo). Pain nyata: (1) `claude plugin update` melewatkan konten baru bila `plugin.json` tidak di-bump — terbukti 2026-10-23; (2) katalog stale hanya terdeteksi saat command router dijalankan manual; (3) 38+ tes hijau, katalog 470 skill lintas plugin, banyak duplikat — tabel substitusi manual di `skills/router/SKILL.md` dirawat tangan.

## Fitur per gelombang

- **Gelombang 1 (plan: `2026-10-24-skillset-wave1-doctor-dedup-hook.md`):** #1 `/skillset:doctor`, #7 deteksi duplikat lintas-plugin, #2 hook SessionStart warn-only.
- **Gelombang 2:** #3 usage log + `/skillset:stats`, #6 custom chain template.
- **Gelombang 3:** #4 token-aware routing (ranking + estimasi biaya token), #5 rules v2 (validasi trigger, rules per-project).

## Keputusan desain Gelombang 1 (user: "gas" → default saya, tercatat sebagai keputusan saya)

1. **Hook warn-only, tidak pernah auto-update.** SessionStart menjalankan cek drift baca-saja. Katalog stale → satu baris peringatan yang menyasar `/skillset:update`; katalog belum ada → sarankan `/skillset:init`; SELALU exit 0, dan **diam saat fresh** — nol tambahan konteks tiap sesi sehat.
2. **Doctor report-only.** Tidak pernah memodifikasi state plugin. Check: catalog exists + umur (warn > 7 hari), drift (reuse `checkDrift`), manifest↔installed (`diffManifest`), `rules.md` ada, ringkasan duplikat, flag opsional `--skillset-src <dir>` (versi source vs terpasang — menangkap jebakan lupa bump/publish).
3. **Duplikat konservatif.** Flag bila Jaccard ≥ 0.6 atas token `name + description` (lowercase, split non-alphanumeric) ATAU nama ternormalisasi identik — hanya antar plugin, hanya sesama kind. Hasil di `catalog.json.duplicates` + section `catalog.md`.

## Goals / Non-goals / Anti-goals (Gelombang 1)

- **Goals:** deteksi dini katalog/state stale; satu command audit sekali-jalan; sinyal duplikasi tabel substitusi otomatis.
- **Non-goals:** auto-fix apa pun (update/install/bump otomatis), semantic similarity (embeddings), cek versi ke registry jarak jauh.
- **Anti-goals:**
  - Hook yang menambah latensi/konteks tiap sesi sehat.
  - Doctor yang memicu aksi tanpa persetujuan user.
  - Deteksi duplikat yang berisik (false positive flooding catalog.md).

## Kontrak (mengikuti scan/query/sync)

- Exit: `0` sehat / `1` ada temuan / 2 input malformed.
- Zero-dependency: hanya `node:` builtins; ESM `.mjs`.
- Hook & doctor **read-only** terhadap state plugin.
